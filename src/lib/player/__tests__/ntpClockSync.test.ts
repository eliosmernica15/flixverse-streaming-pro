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
    const base = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(base);
    expect(NTPClient.now()).toBe(base);
    vi.restoreAllMocks();
  });

  it("applies a positive offset when the local clock runs behind", () => {
    const base = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(base);
    internals.offset = 1500;
    expect(NTPClient.now()).toBe(base + 1500);
    vi.restoreAllMocks();
  });

  it("applies a negative offset when the local clock runs ahead", () => {
    const base = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(base);
    internals.offset = -2000;
    expect(NTPClient.now()).toBe(base - 2000);
    vi.restoreAllMocks();
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
