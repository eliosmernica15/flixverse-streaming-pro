import { describe, expect, it } from "vitest";
import { strengthForEnergy } from "../haptics";

describe("strengthForEnergy", () => {
  it("returns null for silence/speech (< 0.55)", () => {
    expect(strengthForEnergy(0)).toBeNull();
    expect(strengthForEnergy(0.3)).toBeNull();
    expect(strengthForEnergy(0.54)).toBeNull();
  });

  it("returns light for 0.55–0.72", () => {
    expect(strengthForEnergy(0.55)).toBe("light");
    expect(strengthForEnergy(0.7)).toBe("light");
  });

  it("returns medium for 0.72–0.88", () => {
    expect(strengthForEnergy(0.72)).toBe("medium");
    expect(strengthForEnergy(0.85)).toBe("medium");
  });

  it("returns heavy for >= 0.88", () => {
    expect(strengthForEnergy(0.88)).toBe("heavy");
    expect(strengthForEnergy(1.0)).toBe("heavy");
  });
});