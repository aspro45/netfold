import { notFound } from "next/navigation";
import { EpochActions } from "@/components/epoch-actions";
import { LiveEpochSummary } from "@/components/live-epoch-summary";

export default async function EpochDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[1-9][0-9]*$/.test(id)) notFound();
  const epochId = BigInt(id);

  return (
    <div className="page-workspace">
      <header className="page-header">
        <div>
          <span className="eyebrow">Canonical epoch state</span>
          <h1>Epoch #{id}</h1>
          <p>
            Contract metrics, funding state, claims, and deadline for one
            settlement token.
          </p>
        </div>
        <span className="status-chip is-open">Arc Testnet</span>
      </header>
      <div className="page-grid">
        <section className="work-panel">
          <h2>Settlement ledger</h2>
          <p>Reads are refreshed from the clearinghouse contract.</p>
          <LiveEpochSummary epochId={epochId} />
        </section>
        <EpochActions initialEpoch={id} />
      </div>
    </div>
  );
}

