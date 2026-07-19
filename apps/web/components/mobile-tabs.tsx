"use client";

import {
  BookOpenText,
  CircleDollarSign,
  House,
  Network,
  Orbit,
  Rows3,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type MobileTab,
  useInterfaceStore,
} from "@/store/interface-store";

const tabs: { id: MobileTab; label: string; icon: typeof Network }[] = [
  { id: "graph", label: "Graph", icon: Network },
  { id: "ledger", label: "Ledger", icon: Rows3 },
  { id: "actions", label: "Actions", icon: CircleDollarSign },
  { id: "wallet", label: "Wallet", icon: WalletCards },
];

const routeTabs = [
  { href: "/", label: "Overview", icon: House },
  { href: "/clearing", label: "Floor", icon: Network },
  { href: "/epochs", label: "Epochs", icon: Orbit },
  { href: "/docs", label: "Docs", icon: BookOpenText },
] as const;

export function MobileTabs() {
  const pathname = usePathname();
  const active = useInterfaceStore((state) => state.mobileTab);
  const setActive = useInterfaceStore((state) => state.setMobileTab);

  if (pathname !== "/clearing") {
    return (
      <nav className="mobile-tabs mobile-route-tabs" aria-label="Mobile navigation">
        {routeTabs.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link href={href} key={href} className={isActive ? "is-active" : ""}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="mobile-tabs" aria-label="Mobile workspace tabs">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          type="button"
          key={id}
          className={active === id ? "is-active" : ""}
          onClick={() => setActive(id)}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
