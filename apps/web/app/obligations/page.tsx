import { ExternalLink, FileStack } from "lucide-react";
import { ObligationWorkbench } from "@/components/obligation-workbench";
import { formatStable } from "@/lib/format";
import {
  referenceObligations,
  referenceParticipants,
} from "@/lib/reference";

function labelFor(id: string) {
  return referenceParticipants.find((participant) => participant.id === id)
    ?.label;
}

export default function ObligationsPage() {
  return (
    <div className="page-workspace">
      <header className="page-header">
        <div>
          <span className="eyebrow">Signed payment legs</span>
          <h1>Obligations</h1>
          <p>
            Debtor-signed, creditor-accepted records become immutable when
            their epoch locks.
          </p>
        </div>
        <a
          className="secondary-button"
          href="https://docs.arc.io/arc/concepts/transaction-memos"
          target="_blank"
          rel="noreferrer"
        >
          Arc memo docs
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </header>

      <div className="page-grid">
        <section className="work-panel">
          <div className="panel-heading-row">
            <div>
              <span className="eyebrow">Reference fixture / not onchain</span>
              <h2>Six accepted legs</h2>
            </div>
            <FileStack size={22} aria-hidden="true" />
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Debtor</th>
                <th>Creditor</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {referenceObligations.map((obligation) => (
                <tr key={obligation.id}>
                  <td>
                    <code>OB-{obligation.id.padStart(3, "0")}</code>
                  </td>
                  <td>{labelFor(obligation.from)}</td>
                  <td>{labelFor(obligation.to)}</td>
                  <td>{formatStable(obligation.amount)}</td>
                  <td>
                    <span className="status-chip is-open">Accepted</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <ObligationWorkbench />
      </div>
    </div>
  );
}
