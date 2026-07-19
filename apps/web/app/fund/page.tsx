import { CircleDollarSign, ShieldCheck } from "lucide-react";
import { EpochActions } from "@/components/epoch-actions";

export default function FundPage() {
  return (
    <div className="page-workspace">
      <header className="page-header">
        <div>
          <span className="eyebrow">Residual settlement</span>
          <h1>Fund & claim</h1>
          <p>
            Debtors fund only their negative net position. Creditors withdraw
            independently after finalization.
          </p>
        </div>
        <CircleDollarSign size={28} aria-hidden="true" />
      </header>
      <div className="page-grid">
        <EpochActions />
        <section className="work-panel">
          <h2>Funding controls</h2>
          <div className="control-notes">
            <div>
              <span>1</span>
              <p>
                Approve the epoch token through its 6-decimal ERC-20 interface.
              </p>
            </div>
            <div>
              <span>2</span>
              <p>
                Fund exactly the absolute value of your negative position.
              </p>
            </div>
            <div>
              <span>3</span>
              <p>
                Finalize after every debit is funded, then claim pull balances.
              </p>
            </div>
          </div>
          <div className="trust-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <p>
              Pausing never blocks credit claims, default recoveries, refunds,
              or bond withdrawals.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

