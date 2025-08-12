## Frontend Plan: Embedding Search + Summarization for Slack Messages

This plan explains how to access the backend data and APIs, and how to build a minimal but robust Vue 3 web app that lets users search Slack messages semantically and summarize the results.

### Overview

- Backend already ingests Slack exports and stores messages in `slack_message`.
- We added an `embedding` column to `slack_message` and a backfill script to compute per-message embeddings using OpenAI.
- Two HTTP endpoints exist for the FE:
  - `POST /api/search` to retrieve most relevant messages via vector similarity.
  - `POST /api/summarize` to summarize a set of message IDs via GPT-5.

### Prerequisites and Backend Readiness

- Ensure database schema is up to date (`npm run setup-db`).
- Backfill message embeddings before using search:
  - `npm run backfill-message-embeddings`
- Optional: after backfill, enable a HNSW index on `slack_message.embedding` in `database/schema.sql` for faster search (currently commented out).

### Authentication

- Endpoints are protected by a bearer token if the server has `EXTERNAL_POST_BEARER_TOKEN` (or `BEARER_TOKEN`) set.
- Frontend must include the header:

```http
Authorization: Bearer <EXTERNAL_POST_BEARER_TOKEN>
```

### API Reference

#### POST `/api/search`

- Body JSON:

```json
{
  "query": "string (required)",
  "topK": 20,
  "channels": ["C123", "C456"],
  "dateFrom": "2024-08-01T00:00:00Z",
  "dateTo": "2024-08-31T23:59:59Z"
}
```

- Behavior:

  - Generates an embedding for `query` and vector-searches `slack_message` by cosine distance.
  - Excludes `subtype = 'channel_join'` and messages without text.
  - `topK` default 20, capped at 100.
  - Filters are optional.

- Response JSON:

```json
{
  "ok": true,
  "results": [
    {
      "id": 1234,
      "channel_id": "C0ABCDEF",
      "channel_name": "general",
      "user_id": "U0ABCDE",
      "ts": "1754894653.454789",
      "text": "First 300 chars of message text...",
      "author": "Display Name or user_id fallback",
      "score": 0.86
    }
  ]
}
```

Notes:

- `score = 1 - distance`, roughly 0..1, higher is better.
- `ts` is Slack-style string (epoch.seconds with microseconds). Use UTC rendering.

#### POST `/api/summarize`

- Body JSON:

```json
{
  "messageIds": [123, 456, 789]
}
```

- Behavior: Loads the message texts for the provided IDs (max 100) and returns a concise summary with GPT-5 using the existing summarizer. Internal filters exclude `channel_join`.

- Response JSON:

```json
{
  "ok": true,
  "summary": "One to a few sentences summarizing the content set."
}
```

### Data Model Cheat-Sheet (read-only for FE context)

- `slack_message(id, channel_id, channel_name, user_id, ts, text, subtype, thread_ts, is_reply, parent_ts, embedding, created_at)`
- `people(user_id, display_name, slack_user_id, ...)` used to resolve `author` display names in search response.
- `slack_channel_profiles(channel_id, channel_name, summary, member_ids, ...)` exists but is not required for V1.

### CORS and Dev Proxy

- If the FE runs on a different origin than the backend, either:
  - Add CORS middleware on the server (not enabled by default), or
  - Use Vite dev server proxy to forward `/api/*` to `http://localhost:3000`.

Vite example (`vite.config.ts`):

```ts
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

### Suggested Vue 3 App Structure

- Stack: Vue 3 + Vite + TypeScript + minimal component library (optional).
- Files:
  - `src/api/client.ts` — fetch wrapper that injects bearer token and base URL.
  - `src/views/SearchView.vue` — main page with search + results + summary.
  - `src/components/ResultTable.vue` — table for results.
  - `src/components/SummaryPanel.vue` — renders summary text.
  - `src/components/FiltersBar.vue` — query input, channel multi-select, date range, topK.

### Fetch Client (example)

```ts
// src/api/client.ts
const API_BASE = import.meta.env.VITE_API_BASE ?? ""; // leave empty when using Vite proxy
const TOKEN = import.meta.env.VITE_API_TOKEN; // set to EXTERNAL_POST_BEARER_TOKEN

async function api(path: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function searchMessages(payload: {
  query: string;
  topK?: number;
  channels?: string[];
  dateFrom?: string; // ISO
  dateTo?: string; // ISO
}) {
  return api("/api/search", payload) as Promise<{
    ok: boolean;
    results: Array<{
      id: number;
      channel_id: string;
      channel_name: string | null;
      user_id: string | null;
      ts: string;
      text: string;
      author: string;
      score: number;
    }>;
  }>;
}

export async function summarizeMessages(messageIds: number[]) {
  return api("/api/summarize", { messageIds }) as Promise<{
    ok: boolean;
    summary: string;
  }>;
}
```

### UI/UX Spec

- Layout: two-column responsive grid.

  - Left: results table.
  - Right: summary panel.

- Controls (top bar):

  - Search input (`query`, required); Enter submits.
  - `topK` select (10, 20, 50, 100) default 20.
  - Date range (from/to). Optional.
  - Channel multi-select (optional; see note below).
  - Button: "Summarize top N" (configurable N, default 30).

- Results table columns:

  - Score (percent or 0..1)
  - Channel (show `#channel_name` if present, else `#unknown`)
  - Author (display name)
  - Time (format Slack `ts` as UTC time)
  - Snippet (first 300 chars from API; show full text on hover/expand)

- Summary panel:
  - Shows loading state while fetching.
  - Displays the returned summary text.
  - If the summary is long, allow copy.

### Channel Filter Options

- Recommended small server addition (if needed): `GET /api/channels`
  - Returns `{ channel_id, channel_name, count }` sorted by count.
  - If not available, omit channel filter in V1 or predefine a static list.

### Result Rendering Considerations

- Message text may include Slack-style link formatting (`<https://...>`). Optionally convert to clickable anchors client-side.
- We don’t currently return thread context; V1 shows only the single message text.

### State Flow

1. On submit:
   - Validate `query` non-empty.
   - Call `searchMessages` with filters.
   - Render table from `results`.
2. Summarize:
   - Take top N message IDs from current `results`.
   - Call `summarizeMessages(ids)`; show spinner.
   - Render summary text.

### Error Handling

- If 401: show "Unauthorized" and a config hint to set `VITE_API_TOKEN`.
- If 500: show a toast and log error detail to console.
- Network errors: retry button on the panel.

### Performance & Limits

- Search uses vector similarity; you can increase `topK` up to 100.
- Summarization should use at most ~30–50 messages to keep the prompt size reasonable; we cap the backend to 100 IDs.
- For larger corpora, enable HNSW index on `slack_message.embedding`.

### Environment Configuration (FE)

- `.env`:

```
VITE_API_BASE=
VITE_API_TOKEN=
```

- When using Vite proxy, leave `VITE_API_BASE` empty.

### Testing Checklist

- With embeddings backfilled, verify queries return results and scores look sane (>0.5 for relevant content).
- Verify date filters reduce the set correctly.
- Verify summarize returns content and handles empty selection gracefully.
- Verify 401 handling by removing token and retrying.

### Future Enhancements

- Add `/api/channels` endpoint and channel dropdown.
- Add pagination/offset support to `/api/search` (currently single-page by `topK`).
- Add Slack deep links (requires team/workspace context and message permalinks).
- Add thread context expansion endpoint (`/api/thread?channel_id=...&root_ts=...`).
- Persist and tag user queries for analytics.

---

Hand-off summary:

- Use `POST /api/search` and `POST /api/summarize` with bearer auth.
- Build a Vue page with a search bar, results table, and a summarize button/panel.
- Respect `topK` and optional date/channel filters.
- Keep summarization inputs to a reasonable N (30–50) to control cost/latency.
