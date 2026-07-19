import { ARC_ADDRESSES } from "@netfold/shared";
import { describe, expect, it } from "vitest";
import {
  arcExtensionStatus,
  encodeArcMemo,
  encodeAtomicArcBatch,
} from "../lib/arc-extensions";
import { formatPosition, formatStable, shortAddress } from "../lib/format";

describe("display formatters", () => {
  it("formats stablecoin values and signed positions", () => {
    expect(formatStable(35_000_000n)).toBe("35.00 USDC");
    expect(formatPosition(-35_000_000n)).toBe("-35.00");
    expect(formatPosition(25_000_000n)).toBe("+25.00");
    expect(formatPosition(0n)).toBe("0.00");
  });

  it("shortens addresses without Unicode-dependent glyphs", () => {
    expect(
      shortAddress("0x00000000000000000000000000000000000000A1"),
    ).toBe("0x0000...00A1");
  });
});

describe("isolated Arc extension encoders", () => {
  it("keeps the product adapter disabled before a live EOA smoke", () => {
    expect(arcExtensionStatus.enabled).toBe(false);
  });

  it("encodes Memo and atomic Multicall3From destinations", () => {
    const target = "0x00000000000000000000000000000000000000A1";
    const memo = encodeArcMemo({
      target,
      callData: "0x12345678",
      memoText: "NETFOLD test",
    });
    const batch = encodeAtomicArcBatch([
      { target, callData: "0x12345678" },
      { target, callData: "0x90abcdef" },
    ]);

    expect(memo.to).toBe(ARC_ADDRESSES.memo);
    expect(memo.data.startsWith("0x")).toBe(true);
    expect(memo.data.length).toBeGreaterThan(10);
    expect(batch.to).toBe(ARC_ADDRESSES.multicall3From);
    expect(batch.data.startsWith("0x")).toBe(true);
    expect(batch.data.length).toBeGreaterThan(memo.data.length);
  });
});
