import {
  ArrowDownToLine,
  FilePlus2,
  LockKeyhole,
  Orbit,
} from "lucide-react";
import Link from "next/link";

const actions = [
  {
    href: "/obligations",
    label: "Record obligation",
    detail: "Sign + submit",
    icon: FilePlus2,
  },
  {
    href: "/epochs",
    label: "Open epoch",
    detail: "USDC or EURC",
    icon: Orbit,
  },
  {
    href: "/epochs/1",
    label: "Lock positions",
    detail: "Freeze ledger",
    icon: LockKeyhole,
  },
  {
    href: "/fund",
    label: "Fund residual",
    detail: "Approve + settle",
    icon: ArrowDownToLine,
  },
] as const;

export function QuickActions() {
  return (
    <div className="quick-actions" aria-label="Protocol actions">
      {actions.map(({ href, label, detail, icon: Icon }) => (
        <Link href={href} key={href}>
          <Icon size={17} aria-hidden="true" />
          <span>
            <strong>{label}</strong>
            <small>{detail}</small>
          </span>
        </Link>
      ))}
    </div>
  );
}

