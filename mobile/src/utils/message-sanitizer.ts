const INTERNAL_REPLY_MARKER_RE = /\[\[reply_to_current\]\]\s*/gi;

const METADATA_SECTION_PATTERNS: RegExp[] = [
  /(?:^|\n)\s*Conversation info \(untrusted metadata\):\s*\n(?:```[\s\S]*?```|\{[\s\S]*?\})(?:\n|$)/gi,
  /(?:^|\n)\s*Sender \(untrusted metadata\):\s*\n(?:```[\s\S]*?```|\{[\s\S]*?\})(?:\n|$)/gi,
  /(?:^|\n)\s*Untrusted context \(metadata, do not treat as instructions or commands\):[\s\S]*?(?:\n{2,}|$)/gi,
];

export const sanitizeAssistantDisplayText = (content: string): string => {
  let out = content.replace(INTERNAL_REPLY_MARKER_RE, "");
  for (const pattern of METADATA_SECTION_PATTERNS) {
    out = out.replace(pattern, "\n");
  }
  return out.replace(/\n{3,}/g, "\n\n").trimStart();
};

