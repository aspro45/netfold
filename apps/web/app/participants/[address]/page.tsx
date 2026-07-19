import { isAddress } from "viem";
import { notFound } from "next/navigation";
import { UserRoundCheck } from "lucide-react";
import { shortAddress } from "@/lib/format";
import { referenceParticipants } from "@/lib/reference";

export default async function ParticipantPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  if (!isAddress(address)) notFound();
  const reference = referenceParticipants.find(
    (participant) => participant.address.toLowerCase() === address.toLowerCase(),
  );

  return (
    <div className="page-workspace">
      <header className="page-header">
        <div>
          <span className="eyebrow">Participant ledger</span>
          <h1>{reference?.label ?? shortAddress(address, 7)}</h1>
          <p>
            Signed positions and epoch membership for one validated EVM
            address.
          </p>
        </div>
        <UserRoundCheck size={28} aria-hidden="true" />
      </header>
      <section className="work-panel participant-panel">
        <div className="mono-block">{address}</div>
        {reference ? (
          <div className="reference-callout">
            <span className="fixture-tag">Reference fixture</span>
            <strong>{reference.role}</strong>
            <p>
              This identity is part of the deterministic 265-to-35 solver
              fixture, not a live participant registry claim.
            </p>
          </div>
        ) : (
          <div className="empty-state">
            <UserRoundCheck size={26} aria-hidden="true" />
            <h3>No indexed activity in this browser</h3>
            <p>
              The URL is valid. No fabricated participant history is shown.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

