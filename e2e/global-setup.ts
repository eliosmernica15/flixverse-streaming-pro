import { FullConfig } from "@playwright/test";
import { spawn, ChildProcess } from "child_process";
import { setTimeout as sleep } from "timers/promises";

let emulatorProcess: ChildProcess;

export default async function globalSetup(config: FullConfig) {
  if (process.env.PLAYWRIGHT_PARTY_E2E !== "1") {
    return;
  }

  console.log("Starting Firebase emulators for e2e tests...");

  return new Promise<void>((resolve, reject) => {
    const projectId = `demo-test-${Date.now()}`;

    emulatorProcess = spawn("npx", [
      "firebase",
      "emulators:start",
      "--only=firestore,auth",
      `--project=${projectId}`,
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
        GCLOUD_PROJECT: projectId,
      },
    });

    let output = "";
    let errorOutput = "";
    let resolved = false;

    emulatorProcess.stdout?.on("data", (data) => {
      output += data.toString();
      // Wait for emulators to be ready
      if (!resolved && (output.includes("All emulators started") || output.includes("i  functions: Skipping"))) {
        resolved = true;
        // Give a moment for full initialization
        void sleep(2000).then(() => {
          console.log("Firebase emulators started successfully");
          resolve();
        });
      }
    });

    emulatorProcess.stderr?.on("data", (data) => {
      errorOutput += data.toString();
    });

    emulatorProcess.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Failed to start emulators: ${err.message}`));
      }
    });

    emulatorProcess.on("exit", (code) => {
      if (!resolved && code !== 0) {
        resolved = true;
        reject(new Error(`Emulators exited with code ${code}: ${errorOutput}`));
      }
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Emulators failed to start within 60 seconds"));
      }
    }, 60_000);
  });
}

// Store process reference for teardown
(global as any).__EMULATOR_PROCESS__ = emulatorProcess;