import { describe, expect, it } from "vitest";
import { demoObligations, participants, solveObligations } from "../src/index.js";

describe("solveObligations", () => {
  it("folds the mandatory 265 USDC fixture into 35 USDC", () => {
    const result = solveObligations(demoObligations);
    expect(result.grossVolume).toBe(265_000_000n);
    expect(result.netSettlementVolume).toBe(35_000_000n);
    expect(result.liquiditySaved).toBe(230_000_000n);
    expect(Object.fromEntries(result.positions.map((row) => [row.participant, row.position]))).toEqual({
      [participants.A]: -35_000_000n,
      [participants.B]: 25_000_000n,
      [participants.C]: 0n,
      [participants.D]: 10_000_000n,
    });
  });

  it("is deterministic across input order", () => {
    const forward = solveObligations(demoObligations);
    const reverse = solveObligations([...demoObligations].reverse());
    expect(reverse).toEqual(forward);
  });

  it("rejects zero amounts", () => {
    expect(() =>
      solveObligations([{ ...demoObligations[0]!, amount: 0n }]),
    ).toThrow(/positive/);
  });

  it("rejects self obligations", () => {
    expect(() =>
      solveObligations([
        {
          ...demoObligations[0]!,
          creditor: demoObligations[0]!.debtor,
        },
      ]),
    ).toThrow(/Self/);
  });
});

