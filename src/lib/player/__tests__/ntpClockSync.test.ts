import { afterEach, describe, expect, it, vi } from "vitest";
import { NTPClient } from "../ntpClockSync";

// NTPClient keeps its state in private statics; reach them through typed
// brackets so tests stay isolated from the network calibration path.
const internals = NTPClient as unknown as {
  offset: number;
  calibrated: boolean;
  calibrating: boolean;
};

describe("NTPClient", () => {
  afterEach(() => {
    internals.offset = 0;
    internals.calibrated = false;
    internals.calibrating = false;
    vi.unstubAllGlobals();
  });

  it("now() mirrors Date.now() with a zero offset", () => {
    const before = Date.now();
    const t = NTPClient.now();
    const after = Date.now();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });

  it("applies a positive offset when the local clock runs behind", () => {
    internals.offset = 1500;
    expect(NTPClient.now()).toBeGreaterThanOrEqual(Date.now() + 1500);
  });

  it("applies a negative offset when the local clock runs ahead", () => {
    internals.offset = -2000;
    expect(NTPClient.now()).toBeLessThanOrEqual(Date.now() - 2000 + 5);
  });

  it("calibrate() only performs one background refinement across repeated calls", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("ip=1.2.3.4\nts=1700000000\n", { status: 200 }))
    );
    vi.stubGlobal("fetch", fetchMock);

    await NTPClient.calibrate();
    await NTPClient.calibrate();
    await NTPClient.calibrate();

    // refineOffset is fire-and-forget; wait for the single fetch it issues.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
