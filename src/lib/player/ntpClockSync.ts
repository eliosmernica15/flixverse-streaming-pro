export class NTPClient {
  private static offset = 0;
  private static calibrated = false;
  private static calibrating = false;

  /** Use local clock immediately; refine offset in background (no join blocking). */
  static async calibrate() {
    if (this.calibrated || this.calibrating) return;
    this.calibrated = true;
    this.calibrating = true;
    void this.refineOffset();
  }

  private static async refineOffset() {
    try {
      const start = performance.now();
      const res = await fetch("https://worldtimeapi.org/api/timezone/Etc/UTC", {
        signal: AbortSignal.timeout(2500),
      });
      const end = performance.now();
      const data = await res.json();
      const serverTime = new Date(data.utc_datetime).getTime();
      const roundTrip = end - start;
      this.offset = serverTime + roundTrip / 2 - Date.now();
    } catch {
      this.offset = 0;
    } finally {
      this.calibrating = false;
    }
  }

  static now(): number {
    return Date.now() + this.offset;
  }
}
