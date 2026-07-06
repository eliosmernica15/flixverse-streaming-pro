export class NTPClient {
  private static offset = 0;
  private static calibrated = false;

  static async calibrate() {
    if (this.calibrated) return;
    try {
      const start = Date.now();
      const res = await fetch("https://worldtimeapi.org/api/timezone/Etc/UTC");
      const end = Date.now();
      const data = await res.json();
      const serverTime = new Date(data.utc_datetime).getTime();
      const roundTrip = end - start;
      const exactServerTime = serverTime + roundTrip / 2;
      this.offset = exactServerTime - end;
      this.calibrated = true;
    } catch (e) {
      console.warn("NTP calibration failed, falling back to local clock.");
      this.offset = 0;
      this.calibrated = true;
    }
  }

  static now(): number {
    return Date.now() + this.offset;
  }
}
