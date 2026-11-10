import { FullConfig } from "@playwright/test";

export default async function globalTeardown(config: FullConfig) {
  if (process.env.PLAYWRIGHT_PARTY_E2E !== "1") {
    return;
  }

  console.log("Stopping Firebase emulators...");

  const emulatorProcess = (global as any).__EMULATOR_PROCESS__;

  if (emulatorProcess) {
    return new Promise<void>((resolve) => {
      emulatorProcess.kill("SIGTERM");
      emulatorProcess.on("exit", () => {
        console.log("Firebase emulators stopped");
        resolve();
      });
      // Force kill after 5 seconds
      setTimeout(() => {
        if (emulatorProcess.exitCode === null) {
          emulatorProcess.kill("SIGKILL");
          console.log("Firebase emulators force killed");
          resolve();
        }
      }, 5_000);
    });
  }
}