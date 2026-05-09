/** Shared client/server types for agent transcript rows */

export interface ConversationToolCall {
  name: string;
  detail?: string;
}

export interface FileTouch {
  path: string;
  op: "read" | "write";
}

export interface ConversationEntry {
  role: string;
  content: string;
  toolCalls?: ConversationToolCall[];
  /** Parsed from `<timestamp>...</timestamp>` when present */
  timestamp?: string;
  filesTouched?: FileTouch[];
}
