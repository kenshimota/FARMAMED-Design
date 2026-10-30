"use client";

import { useRef, type KeyboardEvent } from "react";

export type TabItem = {
  id: string;
  label: string;
  count?: number;
};

type TabsProps = {
  idPrefix: string;
  label: string;
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
};

export function getTabId(idPrefix: string, id: string) {
  return `${idPrefix}-tab-${id}`;
}

export function getTabPanelId(idPrefix: string, id: string) {
  return `${idPrefix}-panel-${id}`;
}

export function Tabs({ idPrefix, label, tabs, value, onChange }: TabsProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusTab(index: number) {
    const target = tabs[index];
    if (!target) return;
    onChange(target.id);
    window.requestAnimationFrame(() => tabRefs.current[target.id]?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab((index + 1) % tabs.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab((index - 1 + tabs.length) % tabs.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(tabs.length - 1);
    }
  }

  return (
    <div
      aria-label={label}
      className="flex gap-2 overflow-x-auto border-b border-line pb-3"
      role="tablist"
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            aria-controls={getTabPanelId(idPrefix, tab.id)}
            aria-selected={selected}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors ${
              selected
                ? "border-brand bg-brand text-white shadow-[0_10px_28px_rgba(11,100,184,0.18)]"
                : "border-ink/15 bg-surface text-ink hover:border-brand/40 hover:text-brand"
            }`}
            id={getTabId(idPrefix, tab.id)}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(element) => {
              tabRefs.current[tab.id] = element;
            }}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  selected ? "bg-white text-brand" : "bg-soft-blue text-brand"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
