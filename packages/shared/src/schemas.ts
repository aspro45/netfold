import { getAddress, isAddress } from "viem";
import { z } from "zod";

export const addressSchema = z
  .string()
  .refine(isAddress, "Invalid EVM address")
  .transform((address) => getAddress(address));

export const baseUnitAmountSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/, "Amount must be a positive integer")
  .transform(BigInt);

export const bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Expected bytes32");

export const epochIdSchema = z.coerce.bigint().nonnegative();
