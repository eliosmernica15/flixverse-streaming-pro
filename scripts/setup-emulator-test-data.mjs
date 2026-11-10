#!/usr/bin/env node
/**
 * Setup test data in Firebase emulators for E2E tests.
 *
 * Creates:
 * - Two authenticated users (host and guest)
 * - A party document in Firestore with both users
 * - Initial party state
 */

import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

const app = initializeApp({
  apiKey: "test",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo-project",
});

const auth = getAuth(app);
const db = getFirestore(app);

// Use emulators
auth.useEmulator("http://127.0.0.1:9099");
const { connectFirestoreEmulator } = await import("firebase/firestore");
connectFirestoreEmulator(db, "127.0.0.1", 8080);

async function setupTestData() {
  try {
    // Create host user
    const hostCred = await createUserWithEmailAndPassword(
      auth,
      "host@test.flixverse.local",
      "testpassword123"
    );
    const hostUid = hostCred.user.uid;
    console.log(`Created host user: ${hostUid}`);

    // Create guest user
    const guestCred = await createUserWithEmailAndPassword(
      auth,
      "guest@test.flixverse.local",
      "testpassword123"
    );
    const guestUid = guestCred.user.uid;
    console.log(`Created guest user: ${guestUid}`);

    // Sign in as host to get token for Firestore writes
    await signInWithEmailAndPassword(auth, "host@test.flixverse.local", "testpassword123");

    // Create user documents
    await setDoc(doc(db, "users", hostUid), {
      email: "host@test.flixverse.local",
      displayName: "Host User",
      photoURL: "",
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, "users", guestUid), {
      email: "guest@test.flixverse.local",
      displayName: "Guest User",
      photoURL: "",
      createdAt: serverTimestamp(),
    });

    // Create party document
    const partyId = `test-party-${Date.now()}`;
    await setDoc(doc(db, "parties", partyId), {
      hostUid,
      movieId: 550,
      mediaType: "movie",
      status: "active",
      currentTime: 0,
      isPlaying: false,
      updatedBy: hostUid,
      updatedAt: serverTimestamp(),
      guestUids: [guestUid],
    });

    // Create participant documents for real-time sync
    await setDoc(doc(db, "parties", partyId, "participants", hostUid), {
      uid: hostUid,
      localTime: 0,
      lastUpdate: serverTimestamp(),
      isHost: true,
    });

    await setDoc(doc(db, "parties", partyId, "participants", guestUid), {
      uid: guestUid,
      localTime: 0,
      lastUpdate: serverTimestamp(),
      isHost: false,
    });

    console.log(`Created party: ${partyId}`);
    console.log("Test data setup complete!");
    console.log(`PARTY_ID=${partyId}`);
    console.log(`HOST_UID=${hostUid}`);
    console.log(`GUEST_UID=${guestUid}`);

    // Output party ID for test consumption
    process.stdout.write(`PARTY_ID=${partyId}\n`);
  } catch (error) {
    console.error("Failed to setup test data:", error);
    process.exit(1);
  }
}

setupTestData();