import { ExternalLink, ShieldCheck } from "lucide-react";

const equations = `position[p] = accepted credits[p] - accepted debits[p]
sum(position[p]) = 0
total net debit = total net credit
liquidity saved = gross volume - total net debit`;

export default function DocsPage() {
  return (
    <div className="page-workspace docs-workspace">
      <header className="page-header">
        <div>
          <span className="eyebrow">Protocol reference</span>
          <h1>How NETFOLD clears</h1>
          <p>
            A concise operating and trust model for the Arc Testnet
            implementation.
          </p>
        </div>
        <ShieldCheck size={28} aria-hidden="true" />
      </header>
      <div className="docs-grid">
        <section>
          <span className="eyebrow">01 / Record</span>
          <h2>Mutually accepted obligations</h2>
          <p>
            The debtor signs every obligation with EIP-712. The creditor
            accepts onchain. Chain ID, verifying contract, nonce, token, amount,
            parties, epoch, and deadline are bound into the signature.
          </p>
        </section>
        <section>
          <span className="eyebrow">02 / Fold</span>
          <h2>Deterministic net positions</h2>
          <p>
            Accepted debits reduce a participant position and accepted credits
            increase it. An epoch locks only when the full signed position set
            sums to zero.
          </p>
          <pre>{equations}</pre>
        </section>
        <section>
          <span className="eyebrow">03 / Fund</span>
          <h2>Residual deposits only</h2>
          <p>
            Negative positions fund their exact absolute debit through the
            6-decimal token interface. Gross prefunding is never required.
          </p>
        </section>
        <section>
          <span className="eyebrow">04 / Settle</span>
          <h2>Independent pull claims</h2>
          <p>
            Complete funding creates creditor balances. A blocked recipient
            cannot stop another creditor because each transfer is claimed
            independently.
          </p>
        </section>
        <section>
          <span className="eyebrow">05 / Default</span>
          <h2>Principal stays refundable</h2>
          <p>
            Funded deposits are returned if another debtor misses the deadline.
            Only the defaulting debtor bond is slashed, then allocated
            pro-rata to net creditors.
          </p>
        </section>
        <section>
          <span className="eyebrow">06 / Arc</span>
          <h2>Stablecoin-native execution</h2>
          <p>
            Gas uses native USDC at 18-decimal precision. Application transfers
            use USDC or EURC ERC-20 units at 6 decimals. Raw values are never
            mixed.
          </p>
          <a
            className="text-action"
            href="https://docs.arc.io/arc/references/evm-differences"
            target="_blank"
            rel="noreferrer"
          >
            Read Arc EVM differences
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </section>
      </div>
    </div>
  );
}
