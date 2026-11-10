import { describe, expect, it } from "vitest";
import { classifyNetwork } from "../useNetworkQuality";

describe("classifyNetwork", () => {
  it("returns high when no connection info", () => {
    expect(classifyNetwork(null)).toBe("high");
  });

  it("returns low for slow-2g/2g", () => {
    expect(classifyNetwork({ effectiveType: "2g" })).toBe("low");
    expect(classifyNetwork({ effectiveType: "slow-2g" })).toBe("low");
  });

  it("returns medium for 3g", () => {
    expect(classifyNetwork({ effectiveType: "3g" })).toBe("medium");
  });

  it("returns low when saveData is true", () => {
    expect(classifyNetwork({ effectiveType: "4g", saveData: true })).toBe("low");
  });

  it("classifies by downlink", () => {
    expect(classifyNetwork({ downlink: 0.5 })).toBe("low");
    expect(classifyNetwork({ downlink: 3 })).toBe("medium");
    expect(classifyNetwork({ downlink: 10 })).toBe("high");
  });
});