export interface HistoryLog {
  timestamp: string;
  from_status: string;
  to_status: string;
  user_name: string;
  resolved_hours?: number;
  recheck_reason?: string;
}

export interface BugMetadata {
  resolved_hours?: number;
  recheck_reason?: string;
  priority?: 'Low' | 'Medium' | 'High';
  history?: HistoryLog[];
}

export function parseBugMetadata(description: string): { cleanDescription: string; metadata: BugMetadata } {
  const metadataRegex = /\n\n\[Metadata: ({.*?})\]$/s;
  const match = description.match(metadataRegex);
  if (match) {
    try {
      const metadata = JSON.parse(match[1]);
      const cleanDescription = description.replace(metadataRegex, '');
      return { cleanDescription, metadata };
    } catch (e) {
      console.error("Failed to parse bug metadata JSON", e);
    }
  }
  return { cleanDescription: description, metadata: {} };
}

export function stringifyBugMetadata(cleanDescription: string, metadata: BugMetadata): string {
  if (Object.keys(metadata).length === 0) {
    return cleanDescription;
  }
  return `${cleanDescription}\n\n[Metadata: ${JSON.stringify(metadata)}]`;
}
