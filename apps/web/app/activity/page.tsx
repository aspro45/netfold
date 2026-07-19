"use client";

import { Activity, ExternalLink } from "lucide-react";
import { useProtocolEvents } from "@/hooks/use-protocol-events";
import { isProtocolConfigured } from "@/lib/deployment";
import { useInterfaceStore } from "@/store/interface-store";

export default function ActivityPage() {
  const transactions = useInterfaceStore((state) => state.transactions);
  const events = useProtocolEvents();

  return (
    <div className="page-workspace">
      <header className="page-header">
        <div>
          <span className="eyebrow">Wallet transaction state</span>
          <h1>Activity</h1>
          <p>
            Simulation, signature, submission, confirmation, and revert stages
            for this browser session.
          </p>
        </div>
        <Activity size={28} aria-hidden="true" />
      </header>
      <section className="work-panel activity-panel">
        <div className="panel-heading-row">
          <div>
            <span className="eyebrow">Canonical chain history</span>
            <h2>Protocol events</h2>
          </div>
        </div>
        {events.error ? (
          <div className="inline-exception">
            Arc event query failed. No cached or fixture records were shown.
          </div>
        ) : events.data && events.data.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Block</th>
                <th>Event</th>
                <th>Detail</th>
                <th>Proof</th>
              </tr>
            </thead>
            <tbody>
              {events.data.map((event) => (
                <tr key={event.id}>
                  <td>
                    <code>{event.blockNumber.toString()}</code>
                  </td>
                  <td>{event.name}</td>
                  <td>{event.detail}</td>
                  <td>
                    <a
                      className="table-link"
                      href={`https://testnet.arcscan.app/tx/${event.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Arcscan
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <Activity size={26} aria-hidden="true" />
            <h3>No indexed contract events</h3>
            <p>
              {isProtocolConfigured
                ? "The configured deployment block has no matching NETFOLD events yet."
                : "Contract addresses and a deployment block are required before indexing."}
            </p>
          </div>
        )}
      </section>
      <section className="work-panel activity-panel">
        <div className="panel-heading-row">
          <div>
            <span className="eyebrow">Current browser only</span>
            <h2>Wallet session</h2>
          </div>
        </div>
        {transactions.length === 0 ? (
          <div className="empty-state">
            <Activity size={26} aria-hidden="true" />
            <h3>No wallet transactions yet</h3>
            <p>
              Reference fixture events are not mixed into this live activity
              log.
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Stage</th>
                <th>Detail</th>
                <th>Proof</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>
                    <code>
                      {new Date(transaction.timestamp).toLocaleTimeString()}
                    </code>
                  </td>
                  <td>{transaction.label}</td>
                  <td>
                    <span
                      className={`status-chip ${
                        transaction.stage === "confirmed"
                          ? "is-settled"
                          : transaction.stage === "reverted" ||
                              transaction.stage === "rejected"
                            ? "is-exception"
                            : "is-open"
                      }`}
                    >
                      {transaction.stage}
                    </span>
                  </td>
                  <td>{transaction.message}</td>
                  <td>
                    {transaction.hash ? (
                      <a
                        className="table-link"
                        href={`https://testnet.arcscan.app/tx/${transaction.hash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Arcscan
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    ) : (
                      "No proof"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
