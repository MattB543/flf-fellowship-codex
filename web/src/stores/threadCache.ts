import { fetchThread, type ThreadMessage } from "@/api/client";

export type ThreadKey = string; // `${channel_id}:${thread_root_ts}`

type AnyRowWithThread = {
  channel_id: string;
  thread_root_ts?: string | null;
  thread?: ThreadMessage[] | undefined;
};

type CacheEntry = {
  messages: ThreadMessage[];
  lastFetchedAt: number;
};

const threadCache = new Map<ThreadKey, CacheEntry>();

export function keyFor(row: {
  channel_id: string;
  thread_root_ts?: string | null;
}): ThreadKey {
  if (!row.thread_root_ts) return "";
  return `${row.channel_id}:${row.thread_root_ts}`;
}

function sortAndDedupe(messages: ThreadMessage[]): ThreadMessage[] {
  const byId = new Map<number, ThreadMessage>();
  for (const m of messages) {
    byId.set(m.id, m);
  }
  const unique = Array.from(byId.values());
  unique.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
  return unique;
}

export function ingestRow(row: AnyRowWithThread): void {
  const { channel_id, thread_root_ts, thread } = row;
  if (!thread_root_ts || !thread || thread.length === 0) return;
  const k = `${channel_id}:${thread_root_ts}`;
  threadCache.set(k, {
    messages: sortAndDedupe(thread),
    lastFetchedAt: Date.now(),
  });
}

export function getCached(row: {
  channel_id: string;
  thread_root_ts?: string | null;
}): ThreadMessage[] | null {
  const k = keyFor(row);
  if (!k) return null;
  const cached = threadCache.get(k);
  return cached ? cached.messages : null;
}

export async function ensureThread(row: {
  channel_id: string;
  thread_root_ts?: string | null;
  thread?: ThreadMessage[];
}): Promise<ThreadMessage[]> {
  const k = keyFor(row);
  if (!k) return [];

  if (row.thread && row.thread.length) {
    ingestRow(row);
    return row.thread;
  }

  const cached = threadCache.get(k);
  if (cached) return cached.messages;

  const res = await fetchThread({
    channel_id: row.channel_id,
    root_ts: row.thread_root_ts!,
  });
  const sorted = sortAndDedupe(res.messages || []);
  threadCache.set(k, { messages: sorted, lastFetchedAt: Date.now() });
  return sorted;
}

export function replaceWithLongerThread(
  row: { channel_id: string; thread_root_ts: string },
  messages: ThreadMessage[]
) {
  const k = keyFor(row);
  if (!k) return;
  threadCache.set(k, {
    messages: sortAndDedupe(messages),
    lastFetchedAt: Date.now(),
  });
}

export function clearThreadCache() {
  threadCache.clear();
}
