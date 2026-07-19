# Security Policy

NETFOLD is an unaudited Arc Testnet prototype. Do not use the current contracts
with production funds or assets of real-world value.

## Supported scope

Security reports are welcome for:

- `packages/contracts/src/`
- `packages/solver/src/`
- transaction construction and chain validation in `apps/web/`
- deployment scripts and public deployment records

Generated files, test fixtures, third-party dependencies, and purely visual
issues are outside the core smart-contract scope unless they produce a direct
security impact.

## Reporting

Do not publish an exploitable issue before maintainers have had a reasonable
opportunity to investigate. Include:

- affected commit and file;
- reproducible steps or a minimal test;
- expected and observed behavior;
- impact on funds, availability, signatures, or accounting;
- a suggested remediation when possible.

Until a dedicated private disclosure channel is published, open a GitHub issue
without exploit details and request a private contact path. Never include
private keys, seed phrases, or sensitive user data.

## Security posture

- Solidity `0.8.30`, optimizer enabled, `viaIR` enabled.
- OpenZeppelin `5.4.0` primitives.
- EIP-712 signatures, nonces, digest replay protection, and deadlines.
- Reentrancy guards around token transfers and obligation callbacks.
- SafeERC20 for token operations.
- Pull claims, refunds, bond withdrawals, and default recoveries.
- Per-token liability ledger and solvency assertions.
- Finite epoch bounds and deterministic canonical sorting.
- No administrator withdrawal function for participant funds.

## Known limitations

- No independent audit.
- Testnet only.
- Centralized pause and role administration.
- No timelock or multisig requirement in contract code.
- Arc stablecoin and extension behavior is external to NETFOLD.
- Timestamp deadlines tolerate normal block timestamp variance.
- Browser event indexing is not a consensus component.

Read [docs/threat-model.md](docs/threat-model.md) and
[docs/protocol-invariants.md](docs/protocol-invariants.md) before reviewing or
deploying the system.
