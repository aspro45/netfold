import { describe, expect, it } from "vitest";
import {
  ARC_ADDRESSES,
  ARC_MIN_MAX_FEE_PER_GAS,
  ARC_TESTNET,
  addressSchema,
  baseUnitAmountSchema,
  bytes32Schema,
} from "../src/index";

describe("Arc configuration", () => {
  it("pins the expected Arc Testnet identity", () => {
    expect(ARC_TESTNET.id).toBe(5_042_002);
    expect(ARC_TESTNET.rpcUrls.default.http).toContain(
      "https://rpc.testnet.arc.network",
    );
    expect(ARC_ADDRESSES.usdc).toBe(
      "0x3600000000000000000000000000000000000000",
    );
    expect(ARC_MIN_MAX_FEE_PER_GAS).toBe(20_000_000_000n);
  });
});

describe("shared schemas", () => {
  it("normalizes valid addresses and rejects invalid ones", () => {
    expect(
      addressSchema.parse("0x00000000000000000000000000000000000000a1"),
    ).toBe("0x00000000000000000000000000000000000000A1");
    expect(() => addressSchema.parse("0xnot-an-address")).toThrow();
  });

  it("accepts only positive integer token units", () => {
    expect(baseUnitAmountSchema.parse("1000000")).toBe(1_000_000n);
    expect(() => baseUnitAmountSchema.parse("0")).toThrow();
    expect(() => baseUnitAmountSchema.parse("1.5")).toThrow();
  });

  it("validates bytes32 values", () => {
    expect(bytes32Schema.parse(`0x${"ab".repeat(32)}`)).toHaveLength(66);
    expect(() => bytes32Schema.parse("0xab")).toThrow();
  });
});
