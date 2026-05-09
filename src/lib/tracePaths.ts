import type { AgentInfo } from "@/app/page";
import { join, resolve, sep } from "path";

/** Only resolve trace reads under this tree (filesystem safety). */
const ALLOWED_WORKSPACE_PARENT = resolve("/Users/srpillai/CODING");

function isStrictlyUnderCodingRoot(absResolved: string): boolean {
  if (absResolved === ALLOWED_WORKSPACE_PARENT) return true;
  const prefix = ALLOWED_WORKSPACE_PARENT + sep;
  return absResolved.startsWith(prefix);
}

/**
 * Validates a workspace path from a query/client for trace reads.
 * Returns resolved absolute path, or null if missing or outside the allowed prefix.
 */
export function sanitizeWorkspaceQueryParam(workspace: string | null | undefined): string | null {
  if (workspace == null || typeof workspace !== "string") return null;
  const trimmed = workspace.trim();
  if (!trimmed) return null;
  const resolvedPath = resolve(trimmed);
  if (!isStrictlyUnderCodingRoot(resolvedPath)) return null;
  return resolvedPath;
}

/** `.cursor/traces` for AgentBoard cwd or an explicit validated workspace root. */
export function tracesDirForListing(validatedWorkspace: string | null): string {
  const root = validatedWorkspace ?? process.cwd();
  return join(root, ".cursor", "traces");
}

/**
 * Cursor workspace filesystem root for tracing; prefers `workspace` URI over `projectPath`
 * when the latter has been overwritten with a Cursor project slug (non-absolute).
 */
export function agentTraceWorkspaceRoot(agent: AgentInfo): string | null {
  const w = sanitizeWorkspaceQueryParam(agent.workspace);
  if (w) return w;
  const pp = (agent.projectPath || "").trim();
  if (!pp.startsWith("/")) return null;
  return sanitizeWorkspaceQueryParam(pp);
}
