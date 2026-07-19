import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { demoObligations, solveObligations } from "../src/index.js";

const expectedDatasetHash =
  "0xe7f3e6efd7eb10e17a6411e96c0e088f98466cfdccb9b73cd87e2ee92a93a243";

describe("contract differential", () => {
  it("matches the authoritative Foundry fixture and canonical hash", () => {
    const workspace = path.resolve(import.meta.dirname, "../../..");
    const bundledForge = path.join(
      workspace,
      ".tools",
      "foundry",
      process.platform === "win32" ? "forge.exe" : "forge",
    );
    const forge = existsSync(bundledForge) ? bundledForge : "forge";

    const result = solveObligations(demoObligations);
    expect(result.datasetHash).toBe(expectedDatasetHash);
    expect(result.grossVolume).toBe(265_000_000n);
    expect(result.netSettlementVolume).toBe(35_000_000n);
    expect(result.liquiditySaved).toBe(230_000_000n);

    execFileSync(
      forge,
      [
        "test",
        "--root",
        path.join(workspace, "packages", "contracts"),
        "--match-contract",
        "ContractSolverDifferentialTest",
        "--quiet",
      ],
      { cwd: workspace, stdio: "pipe" },
    );
  });
});
