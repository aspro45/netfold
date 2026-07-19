"use client";

import { ARC_ADDRESSES } from "@netfold/shared";
import {
  ArrowDownToLine,
  BadgeCheck,
  CircleDollarSign,
  Coins,
  LockKeyhole,
  Orbit,
  RotateCcw,
  ShieldPlus,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { keccak256, maxUint256, parseUnits, stringToHex } from "viem";
import { clearinghouseAbi, erc20Abi, registryAbi } from "@/lib/abis";
import { deployment, isProtocolConfigured } from "@/lib/deployment";
import { useProtocolAction } from "@/hooks/use-protocol-action";

type TokenSymbol = "USDC" | "EURC";

const actionDefinitions = [
  { id: "join", label: "Join epoch", icon: UserPlus },
  { id: "lock", label: "Lock positions", icon: LockKeyhole },
  { id: "fund", label: "Fund net debit", icon: ArrowDownToLine },
  { id: "finalize", label: "Finalize", icon: BadgeCheck },
  { id: "claimCredit", label: "Claim credit", icon: Coins },
  { id: "withdrawRefund", label: "Withdraw refund", icon: RotateCcw },
  { id: "claimRecovery", label: "Claim recovery", icon: ShieldPlus },
  { id: "withdrawBond", label: "Withdraw bond", icon: CircleDollarSign },
] as const;

export function EpochActions({ initialEpoch = "1" }: { initialEpoch?: string }) {
  const [epochId, setEpochId] = useState(initialEpoch);
  const [token, setToken] = useState<TokenSymbol>("USDC");
  const [duration, setDuration] = useState("86400");
  const [bond, setBond] = useState("2");
  const [metadata, setMetadata] = useState("NETFOLD participant");
  const [feedback, setFeedback] = useState("");
  const { execute, pending } = useProtocolAction();

  const tokenAddress =
    token === "USDC" ? ARC_ADDRESSES.usdc : ARC_ADDRESSES.eurc;

  async function run(
    label: string,
    functionName: string,
    args: readonly unknown[],
  ) {
    if (!deployment.clearinghouse) return;
    setFeedback("");
    try {
      const result = await execute({
        label,
        address: deployment.clearinghouse,
        abi: clearinghouseAbi,
        functionName,
        args,
      });
      setFeedback(`Confirmed / est. fee ${result.feeEstimate}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Transaction failed");
    }
  }

  return (
    <div className="work-panel">
      <h2>Protocol actions</h2>
      <p>
        Every write is simulated against Arc before the wallet request opens.
      </p>
      {!isProtocolConfigured ? (
        <div className="inline-exception">
          Contract addresses are not configured. Actions stay disabled.
        </div>
      ) : null}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="action-epoch">Epoch ID</label>
          <input
            id="action-epoch"
            inputMode="numeric"
            value={epochId}
            onChange={(event) => setEpochId(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="action-token">Settlement token</label>
          <select
            id="action-token"
            value={token}
            onChange={(event) => setToken(event.target.value as TokenSymbol)}
          >
            <option value="USDC">USDC</option>
            <option value="EURC">EURC</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="action-duration">Funding window / seconds</label>
          <input
            id="action-duration"
            inputMode="numeric"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="action-bond">Default bond</label>
          <input
            id="action-bond"
            inputMode="decimal"
            value={bond}
            onChange={(event) => setBond(event.target.value)}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={pending || !deployment.registry}
            onClick={() => {
              if (!deployment.registry) return;
              void execute({
                label: "Register participant",
                address: deployment.registry,
                abi: registryAbi,
                functionName: "register",
                args: [keccak256(stringToHex(metadata))],
              }).catch((error: unknown) =>
                setFeedback(
                  error instanceof Error ? error.message : "Registration failed",
                ),
              );
            }}
          >
            <UserPlus size={15} aria-hidden="true" />
            Register
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={pending || !deployment.clearinghouse}
            onClick={() =>
              void run("Create epoch", "createEpoch", [
                tokenAddress,
                BigInt(duration),
                parseUnits(bond, 6),
              ])
            }
          >
            <Orbit size={15} aria-hidden="true" />
            Create epoch
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={pending || !deployment.clearinghouse}
            onClick={() => {
              if (!deployment.clearinghouse) return;
              void execute({
                label: `Approve ${token}`,
                address: tokenAddress,
                abi: erc20Abi,
                functionName: "approve",
                args: [deployment.clearinghouse, maxUint256],
              }).catch((error: unknown) =>
                setFeedback(
                  error instanceof Error ? error.message : "Approval failed",
                ),
              );
            }}
          >
            <CircleDollarSign size={15} aria-hidden="true" />
            Approve {token}
          </button>
        </div>
      </div>

      <div className="action-matrix">
        {actionDefinitions.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            disabled={pending || !deployment.clearinghouse || !/^[0-9]+$/.test(epochId)}
            onClick={() => void run(label, id, [BigInt(epochId)])}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="field metadata-field">
        <label htmlFor="participant-metadata">Participant metadata label</label>
        <input
          id="participant-metadata"
          value={metadata}
          onChange={(event) => setMetadata(event.target.value)}
        />
        <small>The registry stores only a bytes32 metadata hash.</small>
      </div>

      {feedback ? <div className="action-feedback">{feedback}</div> : null}
    </div>
  );
}
