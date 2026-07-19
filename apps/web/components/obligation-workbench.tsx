"use client";

import { ARC_ADDRESSES, ARC_TESTNET } from "@netfold/shared";
import { Check, FileSignature, Send, X } from "lucide-react";
import { useState } from "react";
import {
  getAddress,
  isAddress,
  keccak256,
  parseUnits,
  stringToHex,
} from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { obligationBookAbi } from "@/lib/abis";
import { deployment } from "@/lib/deployment";
import { useProtocolAction } from "@/hooks/use-protocol-action";

type TokenSymbol = "USDC" | "EURC";

export function ObligationWorkbench() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { execute, pending } = useProtocolAction();
  const [epochId, setEpochId] = useState("1");
  const [creditor, setCreditor] = useState("");
  const [amount, setAmount] = useState("100");
  const [dueAt, setDueAt] = useState("");
  const [reference, setReference] = useState("INV-2026-001");
  const [token, setToken] = useState<TokenSymbol>("USDC");
  const [obligationId, setObligationId] = useState("1");
  const [feedback, setFeedback] = useState("");

  async function createObligation() {
    if (
      !address ||
      !walletClient ||
      !publicClient ||
      !deployment.obligationBook
    ) {
      setFeedback("Connect a wallet and configure the ObligationBook");
      return;
    }
    if (!isAddress(creditor)) {
      setFeedback("Enter a valid creditor address");
      return;
    }
    try {
      setFeedback("Reading debtor nonce");
      const nonce = await publicClient.readContract({
        address: deployment.obligationBook,
        abi: obligationBookAbi,
        functionName: "debtorNonces",
        args: [address],
      });
      const now = Math.floor(Date.now() / 1_000);
      const dueTimestamp = dueAt
        ? Math.floor(new Date(dueAt).getTime() / 1_000)
        : now + 7 * 24 * 60 * 60;
      const tokenAddress =
        token === "USDC" ? ARC_ADDRESSES.usdc : ARC_ADDRESSES.eurc;
      const input = {
        epochId: BigInt(epochId),
        token: tokenAddress,
        debtor: address,
        creditor: getAddress(creditor),
        amount: parseUnits(amount, 6),
        dueAt: BigInt(dueTimestamp),
        referenceHash: keccak256(stringToHex(reference)),
        memoHash: keccak256(stringToHex(`NETFOLD:${reference}`)),
        debtorNonce: nonce,
        deadline: BigInt(now + 60 * 60),
      } as const;
      setFeedback("Confirm the EIP-712 obligation signature");
      const signature = await walletClient.signTypedData({
        account: address,
        domain: {
          name: "NETFOLD Obligation Book",
          version: "1",
          chainId: ARC_TESTNET.id,
          verifyingContract: deployment.obligationBook,
        },
        types: {
          Obligation: [
            { name: "epochId", type: "uint256" },
            { name: "token", type: "address" },
            { name: "debtor", type: "address" },
            { name: "creditor", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "dueAt", type: "uint64" },
            { name: "referenceHash", type: "bytes32" },
            { name: "memoHash", type: "bytes32" },
            { name: "debtorNonce", type: "uint256" },
            { name: "deadline", type: "uint64" },
          ],
        },
        primaryType: "Obligation",
        message: input,
      });
      const result = await execute({
        label: "Submit signed obligation",
        address: deployment.obligationBook,
        abi: obligationBookAbi,
        functionName: "propose",
        args: [input, signature],
      });
      setFeedback(`Confirmed / ${result.feeEstimate}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Obligation failed");
    }
  }

  async function decide(decision: "accept" | "reject") {
    if (!deployment.obligationBook) return;
    setFeedback("");
    try {
      const result = await execute({
        label: `${decision === "accept" ? "Accept" : "Reject"} obligation`,
        address: deployment.obligationBook,
        abi: obligationBookAbi,
        functionName: decision,
        args: [BigInt(obligationId)],
      });
      setFeedback(`Confirmed / ${result.feeEstimate}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Decision failed");
    }
  }

  return (
    <div className="work-panel">
      <h2>Create a signed obligation</h2>
      <p>
        The debtor signs every immutable field. The creditor must still accept
        it onchain.
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="obligation-epoch">Epoch ID</label>
          <input
            id="obligation-epoch"
            inputMode="numeric"
            value={epochId}
            onChange={(event) => setEpochId(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="obligation-token">Token</label>
          <select
            id="obligation-token"
            value={token}
            onChange={(event) => setToken(event.target.value as TokenSymbol)}
          >
            <option value="USDC">USDC</option>
            <option value="EURC">EURC</option>
          </select>
        </div>
        <div className="field is-wide">
          <label htmlFor="obligation-creditor">Creditor wallet</label>
          <input
            id="obligation-creditor"
            placeholder="0x..."
            value={creditor}
            onChange={(event) => setCreditor(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="obligation-amount">Amount</label>
          <input
            id="obligation-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="obligation-due">Due date</label>
          <input
            id="obligation-due"
            type="date"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </div>
        <div className="field is-wide">
          <label htmlFor="obligation-reference">Reconciliation reference</label>
          <input
            id="obligation-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
          <small>Only its keccak256 hash is written to the contract.</small>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="primary-button"
            disabled={pending || !deployment.obligationBook}
            onClick={() => void createObligation()}
          >
            <FileSignature size={15} aria-hidden="true" />
            Sign and submit
          </button>
        </div>
      </div>

      <div className="decision-desk">
        <div className="field">
          <label htmlFor="decision-id">Obligation ID</label>
          <input
            id="decision-id"
            inputMode="numeric"
            value={obligationId}
            onChange={(event) => setObligationId(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={pending || !deployment.obligationBook}
          onClick={() => void decide("accept")}
        >
          <Check size={15} aria-hidden="true" />
          Accept
        </button>
        <button
          type="button"
          className="exception-button"
          disabled={pending || !deployment.obligationBook}
          onClick={() => void decide("reject")}
        >
          <X size={15} aria-hidden="true" />
          Reject
        </button>
        <Send size={17} aria-hidden="true" />
      </div>

      {feedback ? <div className="action-feedback">{feedback}</div> : null}
    </div>
  );
}
