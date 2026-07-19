"use client";

import { CircleAlert, DatabaseZap } from "lucide-react";
import { useEffect } from "react";
import { formatStable, shortAddress } from "@/lib/format";
import { ProtocolEmptyState } from "@/components/protocol-empty-state";
import { useLiveProtocol } from "@/hooks/use-live-protocol";
import { useInterfaceStore } from "@/store/interface-store";

const statusNames = [
  "NONE",
  "OPEN",
  "LOCKED",
  "FUNDING",
  "SETTLED",
  "DEFAULTED",
  "CANCELLED",
] as const;

export function LiveEpochSummary({ epochId }: { epochId: bigint }) {
  const setSelectedEpoch = useInterfaceStore((state) => state.setSelectedEpoch);
  const live = useLiveProtocol();

  useEffect(() => {
    setSelectedEpoch(epochId);
  }, [epochId, setSelectedEpoch]);

  if (!live.configured || live.rpcUnavailable) {
    return <ProtocolEmptyState rpcUnavailable={live.rpcUnavailable} />;
  }

  if (live.loading) {
    return (
      <div className="empty-state">
        <DatabaseZap size={26} aria-hidden="true" />
        <h3>Reading epoch {epochId.toString()}</h3>
        <p>Fetching canonical contract state from Arc Testnet.</p>
      </div>
    );
  }

  const epoch = live.epoch;
  if (!epoch || epoch.status === 0) {
    return (
      <div className="empty-state">
        <CircleAlert size={26} aria-hidden="true" />
        <h3>Epoch does not exist</h3>
        <p>No invented record is rendered for this identifier.</p>
      </div>
    );
  }

  return (
    <>
      <div className="live-state-line">
        <span className="status-chip is-open">
          {statusNames[epoch.status] ?? "UNKNOWN"}
        </span>
        <code>{shortAddress(epoch.token, 6)}</code>
        <span>{epoch.participantCount} participants</span>
        <span>{epoch.obligationCount} obligations</span>
      </div>
      <div className="metric-row">
        <div>
          <span>Gross volume</span>
          <strong>{formatStable(epoch.grossVolume)}</strong>
        </div>
        <div>
          <span>Net debit</span>
          <strong>{formatStable(epoch.totalNetDebit)}</strong>
        </div>
        <div>
          <span>Funded</span>
          <strong>{formatStable(epoch.totalFunded)}</strong>
        </div>
        <div>
          <span>Liquidity saved</span>
          <strong>{formatStable(epoch.liquiditySaved)}</strong>
        </div>
      </div>
      <div className="mono-block">
        datasetHash {epoch.datasetHash}
        {"\n"}creator {epoch.creator}
        {"\n"}fundingDeadline {epoch.fundingDeadline.toString()}
      </div>
    </>
  );
}

