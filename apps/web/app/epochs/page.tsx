import { ArrowUpRight, Orbit } from "lucide-react";
import Link from "next/link";
import { EpochActions } from "@/components/epoch-actions";
import { ProtocolEmptyState } from "@/components/protocol-empty-state";
import { isProtocolConfigured } from "@/lib/deployment";

export default function EpochsPage() {
  return (
    <div className="page-workspace">
      <header className="page-header">
        <div>
          <span className="eyebrow">Clearing windows</span>
          <h1>Epochs</h1>
          <p>
            One settlement token, bounded participation, deterministic
            positions, and an exact residual funding window.
          </p>
        </div>
      </header>

      <div className="page-grid">
        <section className="work-panel">
          <div className="panel-heading-row">
            <div>
              <span className="eyebrow">Live Arc state</span>
              <h2>Epoch registry</h2>
            </div>
            <Orbit size={22} aria-hidden="true" />
          </div>
          {!isProtocolConfigured ? (
            <ProtocolEmptyState />
          ) : (
            <div className="epoch-list">
              <Link href="/epochs/1">
                <span>
                  <strong>Epoch #1</strong>
                  <small>Read canonical state</small>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
          <div className="reference-callout">
            <span className="fixture-tag">Reference only</span>
            <strong>265.00 USDC gross -&gt; 35.00 USDC residual</strong>
            <p>
              The mandatory fixture is used for solver verification and canvas
              QA. It is never substituted for failed RPC data.
            </p>
          </div>
        </section>
        <EpochActions />
      </div>
    </div>
  );
}
