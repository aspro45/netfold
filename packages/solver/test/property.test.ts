import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { solveObligations } from "../src/index.js";

const addressArb = fc
  .uint8Array({ minLength: 20, maxLength: 20 })
  .map(
    (bytes) =>
      getAddress(
        `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
      ) as `0x${string}`,
  );

describe("solver properties", () => {
  it("conserves positions and reports equal debits and credits", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc
            .tuple(addressArb, addressArb, fc.bigInt({ min: 1n, max: 10n ** 18n }))
            .filter(([debtor, creditor]) => debtor !== creditor),
          { maxLength: 256 },
        ),
        (rows) => {
          const result = solveObligations(
            rows.map(([debtor, creditor, amount], index) => ({
              id: BigInt(index + 1),
              epochId: 1n,
              debtor,
              creditor,
              amount,
            })),
          );
          expect(result.positions.reduce((sum, row) => sum + row.position, 0n)).toBe(0n);
          expect(result.totalNetDebit).toBe(result.totalNetCredit);
          expect(result.liquiditySaved).toBe(
            result.grossVolume - result.netSettlementVolume,
          );
        },
      ),
      { numRuns: 500 },
    );
  });
});

