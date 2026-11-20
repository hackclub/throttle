"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import type { Tier } from "@/lib/tiers";
import { DecisionPanel, type DecisionHandle } from "./DecisionPanel";

const TABS = [
  { key: "journal", label: "Journal" },
  { key: "bom", label: "BOM" },
  { key: "submission", label: "Submission" },
  { key: "history", label: "History" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const SHORTCUTS: [string, string][] = [
  ["A", "Approve"],
  ["R", "Return"],
  ["X", "Reject"],
  ["S", "Skip to next"],
  ["1-4", "Switch tab"],
  ["g f", "Focus feedback"],
  ["g j", "Focus justification"],
  ["o r", "Open repo"],
  ["?", "Toggle this sheet"],
  ["Esc", "Close / leave field"],
];

type Props = {
  submissionId: string;
  kind: "design" | "flight";
  title: string;
  makerName: string;
  makerEmail: string;
  waiting: string;
  repoUrl: string | null;
  queueHref: string;
  skipHref: string;
  /** Yellow "someone else is reviewing" banner, if any. */
  banner?: ReactNode;
  panels: Record<TabKey, ReactNode>;
  /** Null while pending; otherwise the panel shows this instead of the form. */
  decidedNote: ReactNode | null;
  hoursSubmitted: number;
  projectTier: Tier;
};

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || !!target.closest("input, textarea, select"))
  );
}

export function ReviewWorkspace(props: Props) {
  const { kind, repoUrl, skipHref } = props;
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("journal");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<DecisionHandle>(null);
  // The key handler is bound once; it reads the sheet state through this ref.
  const sheetOpenRef = useRef(sheetOpen);
  useEffect(() => {
    sheetOpenRef.current = sheetOpen;
  }, [sheetOpen]);

  useEffect(() => {
    let prefix: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clearPrefix = () => {
      prefix = null;
      clearTimeout(timer);
    };

    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        clearPrefix();
        if (sheetOpenRef.current) setSheetOpen(false);
        else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        return;
      }
      if (isTyping(e.target)) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (prefix) {
        const p = prefix;
        clearPrefix();
        if (p === "g" && key === "f") {
          e.preventDefault();
          panelRef.current?.focusFeedback();
        } else if (p === "g" && key === "j") {
          e.preventDefault();
          panelRef.current?.focusJustification();
        } else if (p === "o" && key === "r" && repoUrl) {
          e.preventDefault();
          window.open(repoUrl, "_blank", "noopener,noreferrer");
        }
        return;
      }

      if (key === "?") {
        e.preventDefault();
        setSheetOpen((o) => !o);
        return;
      }
      if (sheetOpenRef.current) return;

      switch (key) {
        case "g":
        case "o":
          prefix = key;
          timer = setTimeout(clearPrefix, 1200);
          return;
        case "a":
          e.preventDefault();
          panelRef.current?.trigger("approved");
          return;
        case "r":
          e.preventDefault();
          panelRef.current?.trigger("returned");
          return;
        case "x":
          e.preventDefault();
          panelRef.current?.trigger("rejected");
          return;
        case "s":
          e.preventDefault();
          router.push(skipHref);
          return;
        case "1":
        case "2":
        case "3":
        case "4":
          e.preventDefault();
          setTab(TABS[Number(key) - 1].key);
          return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [repoUrl, skipHref, router]);

  async function copyRepo() {
    if (!repoUrl) return;
    try {
      await navigator.clipboard.writeText(repoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy the repo URL:", repoUrl);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-line bg-white px-4 py-3">
        <Link
          href={props.queueHref}
          className="font-mono text-xs text-hc-muted transition-colors hover:text-hc-dark"
        >
          ← Queue
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="truncate text-lg font-bold">{props.title}</h1>
          <span className="truncate font-mono text-xs text-hc-muted">
            {props.makerName} · {props.makerEmail}
          </span>
          <span className="rounded border border-line px-1.5 py-px font-mono text-[10px] tracking-wide text-hc-muted">
            {kind === "design" ? "DESIGN" : "FLIGHT"}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-hc-dark/80">
            <Icon name="clock" size={13} />
            {props.waiting}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {repoUrl ? (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-medium text-hc-dark transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hc-blue/40"
            >
              Repo
              <Icon name="external" size={13} />
            </a>
          ) : (
            <span className="font-mono text-xs text-hc-muted">no repo</span>
          )}
          {repoUrl && (
            <Button variant="secondary" size="sm" onClick={copyRepo}>
              {copied ? "Copied" : "Copy repo URL"}
            </Button>
          )}
          <Button href={skipHref} variant="secondary" size="sm">
            Skip
            <kbd className="rounded border border-line px-1 font-mono text-[10px] leading-4 text-hc-muted">
              S
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSheetOpen((o) => !o)}
            aria-label="Keyboard shortcuts"
            className="font-mono"
          >
            ?
          </Button>
        </div>
      </header>

      {props.banner}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <div role="tablist" aria-label="Review sections" className="flex gap-6 border-b border-line">
            {TABS.map((t, i) => {
              const current = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`tab-${t.key}`}
                  aria-selected={current}
                  aria-controls={`panel-${t.key}`}
                  onClick={() => setTab(t.key)}
                  className={cx(
                    "-mb-px border-b-2 pb-2.5 font-mono text-sm transition-colors",
                    current
                      ? "border-hc-blue text-hc-dark"
                      : "border-transparent text-hc-muted hover:text-hc-dark",
                  )}
                >
                  <span className="mr-1.5 text-[10px] text-hc-muted">{i + 1}</span>
                  {t.label}
                </button>
              );
            })}
          </div>
          {TABS.map((t) => (
            <div
              key={t.key}
              role="tabpanel"
              id={`panel-${t.key}`}
              aria-labelledby={`tab-${t.key}`}
              hidden={t.key !== tab}
            >
              {props.panels[t.key]}
            </div>
          ))}
        </div>

        <aside className="lg:sticky lg:top-6">
          {props.decidedNote ?? (
            <DecisionPanel
              ref={panelRef}
              submissionId={props.submissionId}
              kind={kind}
              hoursSubmitted={props.hoursSubmitted}
              projectTier={props.projectTier}
            />
          )}
        </aside>
      </div>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-hc-dark/20 px-4"
          onClick={() => setSheetOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-lg border border-line bg-white px-5 py-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Shortcuts</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-hc-muted hover:text-hc-dark"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            <dl className="mt-3 space-y-1.5 font-mono text-xs">
              {SHORTCUTS.map(([keys, what]) => (
                <div key={keys} className="flex items-center justify-between gap-4">
                  <dt>
                    <kbd className="rounded border border-line px-1.5 py-px text-hc-dark">{keys}</kbd>
                  </dt>
                  <dd className="text-hc-dark/80">{what}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-hc-muted">Ignored while typing, except Esc.</p>
          </div>
        </div>
      )}
    </div>
  );
}
