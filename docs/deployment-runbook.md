# Arc Testnet Deployment Runbook

## 1. Preflight

```bash
pnpm install --frozen-lockfile
pnpm audit:deps
pnpm lint
pnpm typecheck
pnpm test
pnpm build

forge fmt --root packages/contracts --check
forge test --root packages/contracts
```

Run Slither and review only application paths:

```bash
slither packages/contracts \
  --compile-force-framework foundry \
  --filter-paths "lib/|test/|script/"
```

Expected application notes are timestamp-based deadlines, enum equality in
`isEpochOpen`, and default-allocation complexity. Any new medium/high finding is
a deployment blocker.

## 2. Wallet

Use a dedicated Arc Testnet EOA. Never reuse a production key.

```bash
ARC_RPC_URL=https://rpc.testnet.arc.network
DEPLOYER_PRIVATE_KEY=0x...
```

Keep `.env` outside version control. Verify:

```bash
cast chain-id --rpc-url "$ARC_RPC_URL"
cast balance "$DEPLOYER" --rpc-url "$ARC_RPC_URL"
cast call 0x3600000000000000000000000000000000000000 \
  "balanceOf(address)(uint256)" "$DEPLOYER" \
  --rpc-url "$ARC_RPC_URL"
```

Chain ID must be `5042002`. Obtain testnet funds from the official Circle
faucet. Browser CAPTCHA completion is a manual user action.

## 3. Simulate

```bash
forge script packages/contracts/script/Deploy.s.sol:DeployNetfold \
  --rpc-url "$ARC_RPC_URL" \
  -vvvv
```

Confirm the constructor arguments:

- admin equals the dedicated deployer;
- registry is the newly deployed registry;
- USDC is `0x3600...0000`;
- EURC is `0x89B5...D72a`;
- book and clearinghouse point to each other after configuration.

## 4. Broadcast

```bash
forge script packages/contracts/script/Deploy.s.sol:DeployNetfold \
  --rpc-url "$ARC_RPC_URL" \
  --broadcast \
  -vvvv
```

Store the broadcast artifact locally until public deployment records are
written.

## 5. Verify deployment

Check code and wiring:

```bash
cast code "$REGISTRY" --rpc-url "$ARC_RPC_URL"
cast code "$BOOK" --rpc-url "$ARC_RPC_URL"
cast code "$CLEARINGHOUSE" --rpc-url "$ARC_RPC_URL"

cast call "$BOOK" "clearinghouse()(address)" --rpc-url "$ARC_RPC_URL"
cast call "$CLEARINGHOUSE" "obligationBook()(address)" --rpc-url "$ARC_RPC_URL"
cast call "$CLEARINGHOUSE" "usdc()(address)" --rpc-url "$ARC_RPC_URL"
cast call "$CLEARINGHOUSE" "eurc()(address)" --rpc-url "$ARC_RPC_URL"
```

Then execute a minimal lifecycle with low-value test units:

1. register;
2. create epoch;
3. join participants;
4. sign/propose/accept reciprocal obligations;
5. lock;
6. fund exact residual;
7. finalize;
8. claim and withdraw bond;
9. confirm clearinghouse solvency.

## 6. Arc extension smoke

Run the direct-EOA Memo and Multicall3From script from
[arc-integration.md](arc-integration.md). Do not enable the frontend adapter if
the signed smoke fails.

## 7. Publish records

Update `deployments/arc-testnet.json` with:

- chain ID and RPC;
- deployer public address;
- deployment block;
- contract addresses;
- transaction hashes;
- Arcscan links;
- compiler, optimizer, IR, and EVM settings;
- ABI arrays from the exact build artifacts;
- git commit once a repository exists.

Do not include a private key, seed phrase, raw environment file, or wallet
backup.

## 8. Configure web app

```text
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_OBLIGATION_BOOK_ADDRESS=0x...
NEXT_PUBLIC_CLEARINGHOUSE_ADDRESS=0x...
NEXT_PUBLIC_DEPLOYMENT_BLOCK=...
```

Rebuild, run local browser QA, and confirm that every explorer link points to
the recorded deployment.

## Rollback

Contracts are not upgradeable. A bad deployment is abandoned, documented, and
replaced with a fresh deployment. Never overwrite old public records. Pausing
may stop new risk while preserving exits, but it is not an upgrade mechanism.
