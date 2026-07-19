import { CircleAlert, RadioTower } from "lucide-react";

export function ProtocolEmptyState({
  rpcUnavailable = false,
}: {
  rpcUnavailable?: boolean;
}) {
  return (
    <div className={rpcUnavailable ? "error-state" : "empty-state"}>
      {rpcUnavailable ? (
        <CircleAlert size={26} aria-hidden="true" />
      ) : (
        <RadioTower size={26} aria-hidden="true" />
      )}
      <h3>
        {rpcUnavailable ? "Arc RPC is unavailable" : "Live contracts not configured"}
      </h3>
      <p>
        {rpcUnavailable
          ? "No fallback records are shown. Retry the RPC before submitting a transaction."
          : "Deploy NETFOLD and add the three public contract addresses to the frontend environment."}
      </p>
    </div>
  );
}

