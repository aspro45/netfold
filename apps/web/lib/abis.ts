export const registryAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "metadataHash", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isActive",
    stateMutability: "view",
    inputs: [{ name: "participant", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const clearinghouseAbi = [
  {
    type: "function",
    name: "nextEpochId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createEpoch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "fundingDuration", type: "uint64" },
      { name: "bondAmount", type: "uint256" },
    ],
    outputs: [{ name: "epochId", type: "uint256" }],
  },
  {
    type: "function",
    name: "joinEpoch",
    stateMutability: "nonpayable",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "lockEpoch",
    stateMutability: "nonpayable",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "fundDebit",
    stateMutability: "nonpayable",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "finalize",
    stateMutability: "nonpayable",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimCredit",
    stateMutability: "nonpayable",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawRefund",
    stateMutability: "nonpayable",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimRecovery",
    stateMutability: "nonpayable",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawBond",
    stateMutability: "nonpayable",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getEpoch",
    stateMutability: "view",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "creator", type: "address" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint64" },
          { name: "fundingDuration", type: "uint64" },
          { name: "fundingDeadline", type: "uint64" },
          { name: "participantCount", type: "uint16" },
          { name: "obligationCount", type: "uint16" },
          { name: "bondAmount", type: "uint256" },
          { name: "grossVolume", type: "uint256" },
          { name: "totalNetDebit", type: "uint256" },
          { name: "totalNetCredit", type: "uint256" },
          { name: "totalFunded", type: "uint256" },
          { name: "liquiditySaved", type: "uint256" },
          { name: "datasetHash", type: "bytes32" },
        ],
      },
    ],
  },
] as const;

export const obligationBookAbi = [
  {
    type: "function",
    name: "debtorNonces",
    stateMutability: "view",
    inputs: [{ name: "debtor", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "propose",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "input",
        type: "tuple",
        components: [
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
      { name: "debtorSignature", type: "bytes" },
    ],
    outputs: [{ name: "obligationId", type: "uint256" }],
  },
  {
    type: "function",
    name: "accept",
    stateMutability: "nonpayable",
    inputs: [{ name: "obligationId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "reject",
    stateMutability: "nonpayable",
    inputs: [{ name: "obligationId", type: "uint256" }],
    outputs: [],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

