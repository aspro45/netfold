# Protocol Invariants

The following properties define correct NETFOLD behavior.

## Accounting

1. Accepted obligations conserve position:

   ```text
   debtor position -= amount
   creditor position += amount
   ```

2. At epoch lock:

   ```text
   sum(position[p]) = 0
   totalNetDebit = totalNetCredit
   totalNetDebit > 0
   liquiditySaved = grossVolume - totalNetDebit
   ```

3. A debtor funds exactly `abs(position)` once.
4. Total funded principal never exceeds total net debit.
5. A settled creditor claim equals the positive locked position.
6. Claim order cannot change another creditor's entitlement.
7. For each token:

   ```text
   clearinghouse balance >= total liability
   ```

## State transitions

- Only registered participants create or join open epochs.
- Only the epoch creator locks or cancels an epoch.
- An epoch with accepted obligations cannot be cancelled.
- Positions and the canonical dataset hash cannot change after lock.
- Settlement requires complete residual funding.
- Default requires an elapsed funding deadline and incomplete funding.
- A final epoch cannot return to an earlier state.

## Signatures

- The recovered EIP-712 signer equals the declared debtor.
- The signed nonce equals the debtor's current nonce.
- A valid proposal increments the nonce exactly once.
- Used digests cannot be replayed.
- Expired proposals and cancellations revert.
- Accepted obligations require explicit action by the creditor.
- Accepted cancellation requires both debtor and creditor signatures.

## Membership and bounds

- Active participant count never exceeds 64.
- Unique historical participant count never exceeds 64.
- Accepted obligation count never exceeds 256.
- Leave requires zero position and zero accepted-obligation touch count.
- Leave/rejoin cannot duplicate the participant in canonical enumeration.

## Default and exits

- Funded debtors receive their principal back after default.
- Only unfunded net-debtor bonds are slashed.
- Recovery allocation never exceeds the slashed pool.
- Rounding dust is deterministic.
- A failed token transfer leaves the pull claim intact.
- Pausing never blocks claims, refunds, recoveries, or bond withdrawals.
- No administrator function transfers participant funds.

## Test mapping

| Invariant class | Evidence |
| --- | --- |
| Position conservation | Unit, differential, fuzz, invariant |
| Funding bound | Unit, fuzz, invariant |
| Solvency | Unit, fuzz, invariant |
| Epoch bounds | Unit, invariant |
| Signature replay and expiry | Unit, fuzz |
| Claim order and failed transfer | Unit |
| Solver/contract equivalence | Foundry plus Vitest differential |

The invariant harness executes 128 runs with 64 calls per run. Fuzz properties
execute 512 runs each.
