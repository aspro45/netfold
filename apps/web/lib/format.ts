import { formatUnits } from "viem";

export function formatStable(value: bigint, symbol = "USDC"): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(Number(formatUnits(value, 6)))} ${symbol}`;
}

export function shortAddress(address: string, size = 4): string {
  return `${address.slice(0, 2 + size)}...${address.slice(-size)}`;
}

export function formatPosition(position: bigint): string {
  if (position === 0n) return "0.00";
  const sign = position > 0n ? "+" : "-";
  return `${sign}${formatStable(position > 0n ? position : -position).replace(" USDC", "")}`;
}
