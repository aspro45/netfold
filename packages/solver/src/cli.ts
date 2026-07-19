#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { addressSchema } from "@netfold/shared";
import { z } from "zod";
import { solveObligations } from "./solve.js";

const inputSchema = z.array(
  z.object({
    id: z.string().transform(BigInt),
    epochId: z.string().transform(BigInt),
    debtor: addressSchema,
    creditor: addressSchema,
    amount: z.string().transform(BigInt),
  }),
);

const path = process.argv[2];
if (!path) {
  console.error("Usage: netfold-solve <obligations.json>");
  process.exit(1);
}

const input = inputSchema.parse(JSON.parse(await readFile(path, "utf8")));
const result = solveObligations(input);
console.log(
  JSON.stringify(
    result,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  ),
);

