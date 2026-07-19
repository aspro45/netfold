"use client";

import {
  Activity,
  BookOpenText,
  CircleDollarSign,
  FileSignature,
  House,
  LayoutDashboard,
  Orbit,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview", icon: House },
  { href: "/clearing", label: "Clearing floor", icon: LayoutDashboard },
  { href: "/obligations", label: "Obligations", icon: FileSignature },
  { href: "/epochs", label: "Epochs", icon: Orbit },
  { href: "/fund", label: "Fund & claim", icon: CircleDollarSign },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/docs", label: "Protocol docs", icon: BookOpenText },
] as const;

export function NavRail() {
  const pathname = usePathname();

  return (
    <aside className="nav-rail">
      <nav aria-label="Primary navigation">
        <p className="rail-label">Workspace</p>
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rail-link ${active ? "is-active" : ""}`}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="rail-epoch">
        <div className="rail-label-row">
          <p className="rail-label">Reference epoch</p>
          <span className="fixture-tag">Fixture</span>
        </div>
        <strong>USDC / #001</strong>
        <span>4 participants / 6 obligations</span>
        <dl>
          <div>
            <dt>Gross</dt>
            <dd>265.00</dd>
          </div>
          <div>
            <dt>Residual</dt>
            <dd>35.00</dd>
          </div>
          <div>
            <dt>Saved</dt>
            <dd>86.8%</dd>
          </div>
        </dl>
      </div>

      <Link className="participant-shortcut" href="/participants/0x00000000000000000000000000000000000000A1">
        <Users size={16} aria-hidden="true" />
        Inspect participant
      </Link>
    </aside>
  );
}
