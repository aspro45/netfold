# Threat Model

## Protected assets

- participant stablecoin bonds;
- funded residual principal;
- creditor settlement claims;
- debtor default refunds;
- creditor default recoveries;
- signed obligation intent and nonce integrity;
- deterministic epoch dataset and positions;
- protocol availability for exit operations.

## Trust assumptions

- Arc Testnet consensus and RPC responses are correct enough for a prototype.
- Arc USDC and EURC interfaces follow their documented behavior.
- Participants protect their wallet keys.
- The deployer wires the book and clearinghouse to each other correctly.
- The administrator does not intentionally pause all new activity forever.

NETFOLD does not assume that participants, obligation counterparties, token
recipients, or transaction submitters are honest.

## Adversaries

- malicious debtor attempting signature replay or underfunding;
- malicious creditor accepting or cancelling without authorization;
- participant attempting array growth or epoch denial of service;
- token recipient whose transfer reverts or is blocklisted;
- compromised pauser or administrator;
- RPC provider returning errors or rate limiting the client;
- frontend origin serving modified transaction parameters;
- MEV actor observing public obligations and funding.

## Controls

### Signature replay

EIP-712 domain separation, signed chain-specific contract address, debtor
nonces, cancellation nonces, deadlines, and used-digest storage.

### Unauthorized state changes

Creditor-only accept/reject, bilateral cancellation, creator-only lock/cancel,
one-time contract wiring, role-gated pause, and explicit epoch state checks.

### Reentrancy and hostile token behavior

Reentrancy guards protect token and callback surfaces. SafeERC20 handles missing
or false return values. State is updated before outbound transfers. Failed pull
claims revert atomically and remain claimable.

### Insolvency

Every token has an explicit liability ledger. Incoming funds are tracked, exits
decrease liabilities, and post-transfer solvency is asserted.

### Unbounded work

Epochs are capped at 64 unique participants and 256 accepted obligations.
Leave/rejoin cannot inflate participant arrays beyond the unique cap.

### Admin custody

There is no arbitrary token withdrawal, claim reassignment, obligation edit,
epoch token change, or post-setup contract replacement function.

### Client deception

Live RPC state, wallet session state, and the reference fixture are visually and
logically separated. Transaction writes are simulated first, Arc chain ID is
enforced, and confirmed hashes link to Arcscan.

## Residual risks

| Risk | Impact | Current response |
| --- | --- | --- |
| Compromised pauser | New activity unavailable | Exit paths remain open |
| Compromised admin | Role changes | No custody path; use multisig before production |
| Stablecoin blocklist | One recipient cannot receive | Pull claim remains intact |
| Timestamp variance | Small deadline variance | Windows are minutes to days |
| Public obligations | Commercial metadata leakage | Store hashes, not documents |
| RPC rate limit | UI reads fail | Explicit error state and conservative polling |
| Browser compromise | Malicious transaction request | Wallet review and simulation |
| Contract bug | Loss or lock of funds | Testnet only until independent audit |

## Out of scope

- privacy of public addresses, amounts, and contract events;
- stablecoin issuer policy;
- wallet implementation security;
- Arc consensus or explorer correctness;
- legal enforceability of obligations;
- production governance design.

## Production prerequisites

- independent smart-contract audit;
- multisig and timelocked administration;
- incident response and monitored event indexer;
- formal deployment verification;
- stablecoin issuer and blocklist operating procedures;
- economic analysis of bond sizing and default incentives;
- staged value limits and emergency exercises.
