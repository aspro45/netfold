# Verification Report

Date: 2026-07-19

## Toolchain

| Tool | Version or configuration |
| --- | --- |
| Solidity | 0.8.30 |
| Foundry | 1.7.1 |
| OpenZeppelin | 5.4.0 |
| Slither | 0.11.5 |
| Optimizer | enabled, 10,000 runs |
| IR | enabled for deployment builds |
| EVM | Prague |

## Test results

| Suite | Result |
| --- | --- |
| Foundry local | 100 passed, 0 failed |
| Arc fork | 4 passed, 0 failed |
| Solver Vitest | 6 passed, 0 failed |
| Fuzz | 8 properties, 512 runs each |
| Invariant | 4 properties, 128 runs, 8,192 calls each |
| Dependency audit | 0 known production vulnerabilities |
| Web typecheck | passed |
| Web lint | passed |
| Web production build | passed |

The Arc fork tests verify:

- chain ID `5042002`;
- deployed code at stablecoin and extension addresses;
- USDC and EURC 6-decimal interfaces;
- block base fee at or above the documented 20 gwei floor.

## Coverage

| Contract | Lines | Statements | Branches | Functions |
| --- | ---: | ---: | ---: | ---: |
| NetfoldClearinghouse | 97.24% | 94.43% | 69.64% | 93.10% |
| ObligationBook | 87.84% | 86.87% | 52.00% | 90.91% |
| ParticipantRegistry | 96.88% | 90.32% | 66.67% | 100.00% |

Foundry coverage mode disables optimizer and IR. Deployment builds use the
settings in `packages/contracts/foundry.toml`.

## Differential result

Foundry and TypeScript independently calculate:

```text
gross = 265000000
net debit = 35000000
net credit = 35000000
liquidity saved = 230000000
dataset hash =
0xe7f3e6efd7eb10e17a6411e96c0e088f98466cfdccb9b73cd87e2ee92a93a243
```

## Static analysis

After filtering dependency, test, and script paths, Slither reports no
medium/high application issue. Remaining notes:

- strict enum equality in `isEpochOpen`;
- timestamp comparisons for signature and funding deadlines;
- cyclomatic complexity in deterministic default allocation.

These are intentional protocol controls, not ignored security defects. Default
allocation is covered by order, pro-rata, dust, solvency, and recovery tests.

During review, a real edge case was found and fixed: a net-zero participant
with accepted obligations could leave before lock and alter canonical
enumeration. `leaveEpoch` now requires both zero position and zero accepted
obligation touch count, with a dedicated regression test.

Signed position conversions are enforced with OpenZeppelin `SafeCast`, and
negative position magnitudes use `SignedMath.abs`. Direct clearinghouse and
signed-obligation regression tests reject values above the `int256` range.

## Frontend QA

Playwright checks passed at `1440x900` and `390x844` for:

- clearing floor graph, gross/folded transition, and nonblank Pixi pixels;
- `/obligations`, `/epochs`, `/epochs/1`, `/fund`, `/activity`, `/docs`,
  and the participant ledger route;
- mobile Graph, Ledger, Actions, and Wallet tabs;
- text containment and horizontal overflow;
- wallet-independent empty, reference-fixture, and unconfigured-contract states.

The browser console reported zero errors. Development screenshots are kept
outside the repository under `output/playwright/`.

## Pending live checks

- Memo and Multicall3From require a signed direct-EOA smoke transaction.

No independent audit claim is made.

## Arc Testnet deployment

- Deployer: `0xf6d02F13D7BB5fC24aB6A3D662619641958A3Cf6`
- ParticipantRegistry: `0xCab227dfaf88503Eb85a54FD5fc704fC21C534A0`
- ObligationBook: `0xeE5fd63D152E1362499C332E8CcbF01134a68E0D`
- NetfoldClearinghouse: `0xfd1bD9c625b617116FC65aA0386De5376Ed23ca0`
- First deployment block: `52542421`
- Transactions: 5 confirmed, 0 reverted
- Actual deployment and wiring cost: `0.137535376` native USDC

Direct Arc RPC reads confirmed deployed bytecode, bidirectional book and
clearinghouse wiring, canonical USDC and EURC addresses, and deployer admin
roles on all three contracts.
