"use client";

import type { ConversationEntry } from "@/app/page";

interface TraceViewProps {
  entries: ConversationEntry[];
  /** Shown in the subtitle (e.g. how many transcript lines sampled) */
  caption?: string;
}

function fileBasename(full: string): string {
  const s = full.replace(/^~\//, "~/");
  const parts = s.split(/[/\\]/);
  const last = parts[parts.length - 1];
  return last && last.length > 0 ? last : full;
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function RailDot({
  variant,
}: {
  variant: "user" | "assistant" | "tools-only";
}) {
  if (variant === "user") {
    return (
      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center">
        <span
          className="h-3 w-3 rounded-full shadow-[0_0_14px_-2px_rgba(59,130,246,0.7)] ring-2 ring-[#3b82f6]/50 bg-[#3b82f6]"
          aria-hidden
        />
      </div>
    );
  }

  if (variant === "tools-only") {
    return (
      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-running/18 text-running ring-1 ring-running/35"
          aria-hidden
        >
          <GearIcon className="text-running" />
        </span>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center">
      <span
        className="h-3 w-3 rounded-full bg-[#a855f7] shadow-[0_0_14px_-2px_rgba(168,85,247,0.65)] ring-2 ring-[#a855f7]/45"
        aria-hidden
      />
    </div>
  );
}

export function TraceView({ entries, caption }: TraceViewProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-card-border bg-card/40 px-4 py-12 text-center text-xs text-muted">
        No trace steps in this excerpt.
      </div>
    );
  }

  return (
    <div className="relative pl-1" role="list" aria-label="Agent reasoning trace">
      <header className="mb-6 flex flex-col gap-0.5 pl-14 pr-1 sm:pl-14 sm:pr-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold tracking-tight text-foreground">
            Reasoning trace
          </h4>
          <p className="mt-1 text-[11px] text-muted leading-relaxed max-w-[18rem] sm:max-w-none">
            Conversation flow — each card is one transcript row: prompts, reasoning
            excerpts, tooling, and file touches.
            {caption ? (
              <>
                {" "}
                <span className="text-foreground/70">{caption}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="mt-3 sm:mt-0 rounded-md border border-card-border bg-background/70 px-2.5 py-1 font-mono text-[10px] text-muted uppercase tracking-widest tabular-nums">
          {entries.length} step{entries.length === 1 ? "" : "s"}
        </div>
      </header>

      <div className="relative">
        <div
          className="absolute left-[17px] top-4 bottom-4 w-px bg-gradient-to-b from-card-border via-card-border/70 to-transparent"
          aria-hidden
        />

        <ul className="relative space-y-0">
          {entries.map((entry, idx) => {
            const stepNo = idx + 1;
            const isUser = entry.role === "user";
            const hasText = Boolean(entry.content?.trim());
            const hasTools = Boolean(entry.toolCalls?.length);

            let railVariant: "user" | "assistant" | "tools-only" = "assistant";
            if (isUser) railVariant = "user";
            else if (!hasText && hasTools) railVariant = "tools-only";

            return (
              <li
                key={idx}
                className={`trace-step-enter relative flex gap-3 pb-10 last:pb-2`}
                style={{ animationDelay: `${idx * 48}ms` }}
                role="listitem"
              >
                <div className="flex shrink-0 flex-col items-center">
                  <RailDot variant={railVariant} />
                </div>

                <article className="trace-card-glow min-w-0 flex-1 rounded-xl border border-card-border bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-sm overflow-hidden">
                  <div
                    className={`flex flex-wrap items-center gap-2 border-b border-card-border/80 px-3.5 py-2 ${isUser ? "bg-accent/[0.06]" : "bg-background/45"}`}
                  >
                    <span className="font-mono text-[10px] text-muted tabular-nums opacity-70">
                      #{String(stepNo).padStart(2, "0")}
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        isUser
                          ? "bg-accent/20 text-accent"
                          : hasTools && !hasText
                            ? "bg-running/12 text-running"
                            : "bg-[#a855f7]/15 text-[#c4b5fd]"
                      }`}
                    >
                      {entry.role}
                    </span>
                    {entry.timestamp ? (
                      <time
                        className="ml-auto font-mono text-[10px] text-muted"
                        dateTime={entry.timestamp}
                      >
                        {entry.timestamp}
                      </time>
                    ) : (
                      <span className="ml-auto font-mono text-[10px] text-muted/60">
                        —
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 px-3.5 py-3">
                    {hasText && (
                      <p className="line-clamp-3 text-[13px] leading-relaxed text-foreground/90">
                        {entry.content}
                      </p>
                    )}

                    {hasTools && (
                      <div className="flex flex-wrap gap-1.5">
                        {entry.toolCalls!.map((t, j) => (
                          <span
                            key={j}
                            title={
                              t.detail
                                ? `${t.name}: ${t.detail}`
                                : t.name
                            }
                            className="inline-flex max-w-full items-center gap-1 rounded-md border border-running/35 bg-running/12 py-1 pl-2 pr-2 font-mono text-[10px] text-running"
                          >
                            <GearIcon className="shrink-0 opacity-90" />
                            <span className="font-semibold tracking-tight text-running">
                              {t.name}
                            </span>
                            {t.detail ? (
                              <span className="truncate text-[10px] opacity-90 ml-0.5 font-normal break-all max-w-[14rem] sm:max-w-[18rem] text-running/85">
                                · {t.detail}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    )}

                    {entry.filesTouched && entry.filesTouched.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                          Files
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.filesTouched.map((f, fi) => (
                            <span
                              key={`${f.path}-${fi}`}
                              title={f.path}
                              className={`inline-flex max-w-[min(100%,20rem)] items-center gap-1.5 truncate rounded-md border px-2 py-1 font-mono text-[10px] ${
                                f.op === "read"
                                  ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-200/95"
                                  : "border-running/35 bg-running/12 text-amber-100/90"
                              }`}
                            >
                              <span
                                className={`shrink-0 rounded px-0.5 text-[9px] font-bold uppercase ${
                                  f.op === "read"
                                    ? "text-emerald-400/95"
                                    : "text-running"
                                }`}
                              >
                                {f.op === "read" ? "RD" : "WR"}
                              </span>
                              <span className="truncate opacity-90">
                                {fileBasename(f.path)}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {!hasText && !hasTools && (
                      <p className="text-xs italic text-muted">Empty step.</p>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
