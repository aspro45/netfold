# Arc Integration

## Network

```text
Name: Arc Testnet
Chain ID: 5042002
RPC: https://rpc.testnet.arc.network
WebSocket: wss://rpc.testnet.arc.network
Explorer: https://testnet.arcscan.app
```

The client enforces chain ID `5042002` before writes. It uses at least `20 gwei`
as the maximum-fee floor and displays a pre-signature fee estimate.

## Stablecoins

```text
USDC interface: 0x3600000000000000000000000000000000000000
EURC:           0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
Decimals:       6
```

The clearinghouse accepts only these immutable addresses. The native Arc gas
currency is also named USDC, but its gas accounting uses 18 decimals. Contract
amounts use each ERC-20 interface's 6-decimal units.

## Memo

```text
Memo: 0x5294E9927c3306DcBaDb03fe70b92e01cCede505

memo(address target, bytes data, bytes32 memoId, bytes memoData)
```

Arc documents this extension for direct EOA calls with sender preservation.
Calls through an intermediary or smart-contract account are not treated as a
supported path. NETFOLD therefore:

- keeps Memo outside the core settlement contracts;
- checks that the intended sender has no deployed code;
- exposes only an isolated encoder;
- keeps the product integration disabled until a signed testnet smoke passes.

## Multicall3From

```text
Multicall3From: 0x522fAf9A91c41c443c66765030741e4AaCe147D0

aggregate3((address target, bool allowFailure, bytes callData)[] calls)
```

The adapter sets `allowFailure = false` for every call so a batch is atomic.
The same direct-EOA restriction applies. Core protocol correctness never
depends on batching.

## Smoke script

`packages/contracts/script/ArcExtensionsSmoke.s.sol`:

1. deploys a sender recorder;
2. calls the recorder through Memo;
3. calls it twice through Multicall3From;
4. verifies behavior through the resulting state and transaction traces.

Run only with a funded direct EOA:

```bash
forge script \
  packages/contracts/script/ArcExtensionsSmoke.s.sol:ArcExtensionsSmoke \
  --rpc-url "$ARC_RPC_URL" \
  --broadcast \
  -vvvv
```

Foundry fork tests verify the chain ID, stablecoin decimals, extension code
presence, and documented fee floor. They do not claim to emulate Arc's
top-level sender-preservation extension semantics. That behavior requires a
real signed Arc Testnet transaction.

## Client RPC policy

- block read every 12 seconds;
- configured contract reads every 15 seconds;
- event index refresh every 30 seconds;
- one retry;
- no fixture fallback after an RPC error.

This is intentionally conservative because the public endpoint can rate limit
bursting clients.
