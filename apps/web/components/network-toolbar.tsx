"use client";

import { ArrowRightLeft, ListFilter } from "lucide-react";
import { useInterfaceStore } from "@/store/interface-store";

export function NetworkToolbar() {
  const mode = useInterfaceStore((state) => state.networkMode);
  const setMode = useInterfaceStore((state) => state.setNetworkMode);

  return (
    <div className="network-toolbar">
      <div>
        <span className="eyebrow">Reference fixture / not onchain</span>
        <h1>Obligation network</h1>
      </div>
      <div className="toolbar-actions">
        <div className="segmented-control" aria-label="Network display">
          <button
            type="button"
            className={mode === "gross" ? "is-active" : ""}
            onClick={() => setMode("gross")}
          >
            <ListFilter size={14} aria-hidden="true" />
            Gross
          </button>
          <button
            type="button"
            className={mode === "folded" ? "is-active" : ""}
            onClick={() => setMode("folded")}
          >
            <ArrowRightLeft size={14} aria-hidden="true" />
            Folded
          </button>
        </div>
      </div>
    </div>
  );
}
