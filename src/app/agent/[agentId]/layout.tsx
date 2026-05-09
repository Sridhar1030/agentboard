import { Suspense, type ReactNode } from "react";

export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-muted">Loading session…</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
