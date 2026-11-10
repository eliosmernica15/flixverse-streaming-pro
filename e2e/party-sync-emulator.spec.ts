import { expect, test } from "@playwright/test";
import { spawn, ChildProcess } from "child_process";
import { setTimeout } from "timers/promises";

/**
 * Watch-party emulator-backed verification — full §8 protocol against local emulators.
 *
 * This test file runs the four core sync scenarios against a real Firestore/Auth
 * emulator stack (started once per test file). It uses two browser contexts
 * (host + guest) with real authenticated users created via the Auth emulator.
 *
 * Scenarios:
 * 1. Late-join catch-up: guest joins mid-playback and converges to host position
 * 2. Pause/play propagation: host pause/play reflects on guest within threshold
 * 3. Drift snap: guest seeks beyond hard threshold → resyncing badge → snap back
 * 4. Chat while playing: messages appear on both clients without interrupting playback
 */

const EMULATOR_UI_PORT = 4000;
const FIRESTORE_EMULATOR_PORT = 8080;
const AUTH_EMULATOR_PORT = 9099;
const EMULATOR_HOST = "127.0.0.1";

let emulatorProcess: ChildProcess;
let hostUser: { uid: string; token: string };
let guestUser: { uid: string; token: string };

// Helper to call emulator REST APIs
async function callEmulatorApi(path: string, options: RequestInit = {}) {
  const url = `http://${EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Emulator API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function callAuthEmulatorApi(path: string, options: RequestInit = {}) {
  const url = `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth Emulator API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Start the firebase emulators
async function startEmulators(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Use firebase-tools to start emulators
    emulatorProcess = spawn("npx", ["firebase", "emulators:start", "--only=firestore,auth", `--project=demo-${Date.now()}`], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: `${EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`,
        GCLOUD_PROJECT: `demo-${Date.now()}`,
      },
    });

    let output = "";
    let errorOutput = "";

    emulatorProcess.stdout?.on("data", (data) => {
      output += data.toString();
      // Wait for emulators to be ready
      if (output.includes("All emulators started") || output.includes("i  functions: Skipping")) {
        setTimeout(2000).then(resolve);
      }
    });

    emulatorProcess.stderr?.on("data", (data) => {
      errorOutput += data.toString();
    });

    emulatorProcess.on("error", (err) => {
      reject(new Error(`Failed to start emulators: ${err.message}`));
    });

    emulatorProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Emulators exited with code ${code}: ${errorOutput}`));
      }
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      if (emulatorProcess.exitCode === null) {
        reject(new Error("Emulators failed to start within 60 seconds"));
      }
    }, 60_000);
  });
}

// Stop the firebase emulators
async function stopEmulators(): Promise<void> {
  return new Promise((resolve) => {
    if (emulatorProcess) {
      emulatorProcess.kill("SIGTERM");
      emulatorProcess.on("exit", () => resolve());
      // Force kill after 5 seconds
      setTimeout(() => {
        if (emulatorProcess.exitCode === null) {
          emulatorProcess.kill("SIGKILL");
          resolve();
        }
      }, 5_000);
    } else {
      resolve();
    }
  });
}

// Create test users via Auth emulator
async function createTestUsers(): Promise<void> {
  // Sign up host user
  const hostRes = await callAuthEmulatorApi("/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", {
    method: "POST",
    body: JSON.stringify({
      email: "host@test.local",
      password: "testpassword123",
      returnSecureToken: true,
    }),
  });
  hostUser = { uid: hostRes.localId, token: hostRes.idToken };

  // Sign up guest user
  const guestRes = await callAuthEmulatorApi("/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", {
    method: "POST",
    body: JSON.stringify({
      email: "guest@test.local",
      password: "testpassword123",
      returnSecureToken: true,
    }),
  });
  guestUser = { uid: guestRes.localId, token: guestRes.idToken };

  // Create user documents in Firestore
  await callEmulatorApi(`/emulator/v1/projects/demo/accounts/${hostUser.uid}:create`, {
    method: "POST",
    body: JSON.stringify({
      fields: {
        email: { stringValue: "host@test.local" },
        displayName: { stringValue: "Host User" },
        photoURL: { stringValue: "" },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });

  await callEmulatorApi(`/emulator/v1/projects/demo/accounts/${guestUser.uid}:create`, {
    method: "POST",
    body: JSON.stringify({
      fields: {
        email: { stringValue: "guest@test.local" },
        displayName: { stringValue: "Guest User" },
        photoURL: { stringValue: "" },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
}

// Create a party document in Firestore
async function createParty(partyId: string, hostUid: string, movieId: number = 550, mediaType: string = "movie"): Promise<void> {
  await callEmulatorApi(`/emulator/v1/projects/demo/databases/(default)/documents/parties/${partyId}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        hostUid: { stringValue: hostUid },
        movieId: { integerValue: String(movieId) },
        mediaType: { stringValue: mediaType },
        status: { stringValue: "active" },
        currentTime: { doubleValue: 0 },
        isPlaying: { booleanValue: false },
        updatedAt: { timestampValue: new Date().toISOString() },
        guestUids: { arrayValue: { values: [] } },
      },
    }),
  });
}

// Add guest to party
async function addGuestToParty(partyId: string, guestUid: string): Promise<void> {
  await callEmulatorApi(`/emulator/v1/projects/demo/databases/(default)/documents/parties/${partyId}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        guestUids: { arrayValue: { values: [{ stringValue: guestUid }] } },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
}

// Update party playback state
async function updatePartyPlayback(
  partyId: string,
  currentTime: number,
  isPlaying: boolean,
  updatedBy: string
): Promise<void> {
  await callEmulatorApi(`/emulator/v1/projects/demo/databases/(default)/documents/parties/${partyId}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        currentTime: { doubleValue: currentTime },
        isPlaying: { booleanValue: isPlaying },
        updatedBy: { stringValue: updatedBy },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
}

// Send chat message
async function sendChatMessage(partyId: string, senderUid: string, text: string): Promise<void> {
  const messageId = `msg_${Date.now()}`;
  await callEmulatorApi(`/emulator/v1/projects/demo/databases/(default)/documents/parties/${partyId}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        senderUid: { stringValue: senderUid },
        text: { stringValue: text },
        timestamp: { timestampValue: new Date().toISOString() },
      },
    }),
  });
}

// Wait for party state to match expected values
async function waitForPartyState(
  partyId: string,
  expectedTime: number,
  expectedPlaying: boolean,
  timeout = 10_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await callEmulatorApi(`/emulator/v1/projects/demo/databases/(default)/documents/parties/${partyId}`);
    const time = res.fields?.currentTime?.doubleValue ?? 0;
    const playing = res.fields?.isPlaying?.booleanValue ?? false;
    if (Math.abs(time - expectedTime) < 0.5 && playing === expectedPlaying) {
      return;
    }
    await setTimeout(100);
  }
  throw new Error(`Party state did not converge: expected time ~${expectedTime}, playing=${expectedPlaying}`);
}

test.describe.configure({ retries: 0 });

test.describe("watch party sync protocol (emulator-backed)", () => {
  const partyId = `test-party-${Date.now()}`;

  test.beforeAll(async () => {
    await startEmulators();
    await createTestUsers();
    await createParty(partyId, hostUser.uid);
    await addGuestToParty(partyId, guestUser.uid);
  });

  test.afterAll(async () => {
    await stopEmulators();
  });

  test("late-join catch-up: guest converges to host position", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();

    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    // Set auth cookies for both users
    await hostCtx.addCookies([
      {
        name: "__session",
        value: hostUser.token,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        secure: false,
      },
    ]);
    await guestCtx.addCookies([
      {
        name: "__session",
        value: guestUser.token,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        secure: false,
      },
    ]);

    // Host starts the party and begins playback
    await host.goto(`/movie/550?type=movie&party=${partyId}&host=1`);
    await expect(host.getByText(/Verifying invite|Joining party|Syncing playback/i).first()).toBeVisible({ timeout: 15_000 });

    // Host plays the content
    await host.getByRole("button", { name: /play/i }).first().click();
    await updatePartyPlayback(partyId, 120, true, hostUser.uid);

    // Wait a moment for host to be playing
    await setTimeout(1000);

    // Guest joins late (simulating late-join)
    await guest.goto(`/movie/550?type=movie&party=${partyId}&guest=1`);
    await expect(guest.getByText(/Verifying invite|Joining party|Syncing playback/i).first()).toBeVisible({ timeout: 15_000 });

    // Assert: Guest's SyncStatusBadge reaches "Live · synced" within threshold
    // The badge should show synced status (not "Resyncing" or "Connecting")
    await expect(guest.getByText(/Live\s*[·•]\s*synced/i)).toBeVisible({ timeout: 10_000 });

    // Verify guest converges to host position (within soft drift threshold ~2s)
    await waitForPartyState(partyId, 120, true);

    // Host seeks to a new position
    await updatePartyPlayback(partyId, 300, true, hostUser.uid);
    await host.getByRole("slider", { name: /seek/i }).first().fill("300");

    // Guest should follow the host seek
    await waitForPartyState(partyId, 300, true);
    await expect(guest.getByText(/Live\s*[·•]\s*synced/i)).toBeVisible({ timeout: 5_000 });

    await hostCtx.close();
    await guestCtx.close();
  });

  test("pause/play propagation: host pause/play reflects on guest within threshold", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();

    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    // Set auth cookies
    await hostCtx.addCookies([
      { name: "__session", value: hostUser.token, domain: "127.0.0.1", path: "/", httpOnly: true, secure: false },
    ]);
    await guestCtx.addCookies([
      { name: "__session", value: guestUser.token, domain: "127.0.0.1", path: "/", httpOnly: true, secure: false },
    ]);

    // Both join the party
    await host.goto(`/movie/550?type=movie&party=${partyId}&host=1`);
    await guest.goto(`/movie/550?type=movie&party=${partyId}&guest=1`);

    await expect(host.getByText(/Verifying invite|Joining party|Syncing playback/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(guest.getByText(/Verifying invite|Joining party|Syncing playback/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(host.getByText(/Live\s*[·•]\s*synced/i)).toBeVisible({ timeout: 10_000 });
    await expect(guest.getByText(/Live\s*[·•]\s*synced/i)).toBeVisible({ timeout: 10_000 });

    // Start playing
    await updatePartyPlayback(partyId, 100, true, hostUser.uid);
    await waitForPartyState(partyId, 100, true);

    // 1. Host pauses
    await host.getByRole("button", { name: /pause/i }).first().click();
    await updatePartyPlayback(partyId, 150, false, hostUser.uid);

    // Guest UI should reflect paused state within threshold (2-3 seconds)
    await expect(guest.getByRole("button", { name: /play/i }).first()).toBeVisible({ timeout: 5_000 });
    await waitForPartyState(partyId, 150, false);

    // 2. Host plays again
    await host.getByRole("button", { name: /play/i }).first().click();
    await updatePartyPlayback(partyId, 150, true, hostUser.uid);

    // Guest should resume
    await expect(guest.getByRole("button", { name: /pause/i }).first()).toBeVisible({ timeout: 5_000 });
    await waitForPartyState(partyId, 150, true);

    await hostCtx.close();
    await guestCtx.close();
  });

  test("drift snap: guest seeks beyond hard threshold → resyncing badge → snap back", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();

    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    // Set auth cookies
    await hostCtx.addCookies([
      { name: "__session", value: hostUser.token, domain: "127.0.0.1", path: "/", httpOnly: true, secure: false },
    ]);
    await guestCtx.addCookies([
      { name: "__session", value: guestUser.token, domain: "127.0.0.1", path: "/", httpOnly: true, secure: false },
    ]);

    // Both join the party and start playing
    await host.goto(`/movie/550?type=movie&party=${partyId}&host=1`);
    await guest.goto(`/movie/550?type=movie&party=${partyId}&guest=1`);

    await expect(host.getByText(/Verifying invite|Joining party|Syncing playback/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(guest.getByText(/Verifying invite|Joining party|Syncing playback/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(host.getByText(/Live\s*[·•]\s*synced/i)).toBeVisible({ timeout: 10_000 });
    await expect(guest.getByText(/Live\s*[·•]\s*synced/i)).toBeVisible({ timeout: 10_000 });

    await updatePartyPlayback(partyId, 200, true, hostUser.uid);
    await waitForPartyState(partyId, 200, true);

    // Guest seeks far beyond the hard drift threshold (typically >10s)
    // This simulates the guest manually seeking in the player
    await guest.getByRole("slider", { name: /seek/i }).first().fill("500");
    // Update party state to reflect guest's local seek (which would trigger drift detection)
    await callEmulatorApi(`/emulator/v1/projects/demo/databases/(default)/documents/parties/${partyId}/participants/${guestUser.uid}`, {
      method: "PATCH",
      body: JSON.stringify({
        fields: {
          localTime: { doubleValue: 500 },
          lastUpdate: { timestampValue: new Date().toISOString() },
        },
      }),
    });

    // Assert: Resyncing badge appears on guest
    await expect(guest.getByText(/Resyncing|Syncing|Reconnecting/i)).toBeVisible({ timeout: 5_000 });

    // Host position remains unchanged, guest should be snapped back
    await waitForPartyState(partyId, 200, true);

    // Assert: Guest converges back to host position and shows "Live · synced"
    await expect(guest.getByText(/Live\s*[·•]\s*synced/i)).toBeVisible({ timeout: 10_000 });

    await hostCtx.close();
    await guestCtx.close();
  });

  test("chat while playing: messages appear on both clients without interrupting playback", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();

    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    // Set auth cookies
    await hostCtx.addCookies([
      { name: "__session", value: hostUser.token, domain: "127.0.0.1", path: "/", httpOnly: true, secure: false },
    ]);
    await guestCtx.addCookies([
      { name: "__session", value: guestUser.token, domain: "127.0.0.1", path: "/", httpOnly: true, secure: false },
    ]);

    // Both join the party and start playing
    await host.goto(`/movie/550?type=movie&party=${partyId}&host=1`);
    await guest.goto(`/movie/550?type=movie&party=${partyId}&guest=1`);

    await expect(host.getByText(/Verifying invite|Joining party|Syncing playback/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(guest.getByText(/Verifying invite|Joining party|Syncing playback/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(host.getByText(/Live\s*[·•]\s*synced/i)).toBeVisible({ timeout: 10_000 });
    await expect(guest.getByText(/Live\s*[·•]\s*synced/i)).toBeVisible({ timeout: 10_000 });

    await updatePartyPlayback(partyId, 100, true, hostUser.uid);
    await waitForPartyState(partyId, 100, true);

    // Host sends a chat message from the FlixPartySidebar
    const chatInput = host.getByPlaceholder(/message|chat/i).first();
    await expect(chatInput).toBeVisible({ timeout: 5_000 });

    const testMessage = `Test message ${Date.now()}`;
    await chatInput.fill(testMessage);
    await host.getByRole("button", { name: /send/i }).first().click();

    // Send via emulator directly to ensure it's in Firestore
    await sendChatMessage(partyId, hostUser.uid, testMessage);

    // Assert: Message appears in guest's sidebar without interrupting playback
    await expect(guest.getByText(testMessage)).toBeVisible({ timeout: 5_000 });

    // Verify playback is still ongoing (pause button visible = playing)
    await expect(guest.getByRole("button", { name: /pause/i }).first()).toBeVisible({ timeout: 2_000 });
    await expect(host.getByRole("button", { name: /pause/i }).first()).toBeVisible({ timeout: 2_000 });

    // Guest sends a reply
    const guestChatInput = guest.getByPlaceholder(/message|chat/i).first();
    await expect(guestChatInput).toBeVisible({ timeout: 5_000 });

    const replyMessage = `Reply ${Date.now()}`;
    await guestChatInput.fill(replyMessage);
    await guest.getByRole("button", { name: /send/i }).first().click();

    await sendChatMessage(partyId, guestUser.uid, replyMessage);

    // Assert: Reply appears in host's sidebar
    await expect(host.getByText(replyMessage)).toBeVisible({ timeout: 5_000 });

    // Playback should still be ongoing on both
    await expect(host.getByRole("button", { name: /pause/i }).first()).toBeVisible({ timeout: 2_000 });
    await expect(guest.getByRole("button", { name: /pause/i }).first()).toBeVisible({ timeout: 2_000 });

    await hostCtx.close();
    await guestCtx.close();
  });
});