// api/client.ts - Enhanced API client with better error handling and retry logic

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const TOKEN = import.meta.env.VITE_API_TOKEN as string | undefined;

// Custom error class for API errors
export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message);
    this.name = "ApiError";
  }
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // ms
  retryableStatuses: [502, 503, 504],
};

// Sleep utility for retries
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Enhanced fetch with retry logic
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 0
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    if (
      !response.ok &&
      RETRY_CONFIG.retryableStatuses.includes(response.status) &&
      retries < RETRY_CONFIG.maxRetries
    ) {
      await sleep(RETRY_CONFIG.retryDelay * Math.pow(2, retries)); // Exponential backoff
      return fetchWithRetry(url, options, retries + 1);
    }

    return response;
  } catch (error) {
    if (retries < RETRY_CONFIG.maxRetries) {
      await sleep(RETRY_CONFIG.retryDelay * Math.pow(2, retries));
      return fetchWithRetry(url, options, retries + 1);
    }
    throw error;
  }
}

// Main API function with enhanced error handling
async function api(path: string, body?: unknown) {
  const url = `${API_BASE}${path}`;
  const options: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  };

  try {
    const res = await fetchWithRetry(url, options);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let errorMessage = text || res.statusText;

      // Try to parse JSON error message
      try {
        const errorJson = JSON.parse(text);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {}

      throw new ApiError(res.status, errorMessage, text);
    }

    return res.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new ApiError(0, "Network error: Unable to connect to the server");
    }

    throw new ApiError(
      0,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// GET request helper
async function apiGet(
  path: string,
  params?: Record<string, string | number | undefined>
) {
  const query = params ? toQuery(params) : "";
  const url = `${API_BASE}${path}${query}`;
  const options: RequestInit = {
    method: "GET",
    headers: {
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  };

  try {
    const res = await fetchWithRetry(url, options);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let errorMessage = text || res.statusText;

      try {
        const errorJson = JSON.parse(text);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {}

      throw new ApiError(res.status, errorMessage, text);
    }

    return res.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new ApiError(0, "Network error: Unable to connect to the server");
    }

    throw new ApiError(
      0,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Query string builder
function toQuery(params: Record<string, string | number | undefined>) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && `${value}`.length > 0) {
      usp.set(key, String(value));
    }
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

// Type definitions for API responses
export interface SearchResult {
  id: number;
  channel_id: string;
  channel_name: string | null;
  user_id: string | null;
  ts: string;
  text: string;
  author: string;
  score: number;
  // New thread-related fields (additive)
  thread_ts?: string | null;
  parent_ts?: string | null;
  is_reply?: boolean;
  thread_root_ts?: string; // computed on server
  in_thread?: boolean;
  thread?: ThreadMessage[]; // when includeThreads !== false
}

export interface SearchResponse {
  ok: boolean;
  results: SearchResult[];
}

export interface SummarizeResponse {
  ok: boolean;
  summary: string;
}

export interface LinkItem {
  message_id: number;
  channel_id: string;
  channel_name: string | null;
  user_id: string | null;
  author: string;
  ts: string;
  url: string;
  // New thread-related fields (additive)
  thread_ts?: string | null;
  parent_ts?: string | null;
  thread_root_ts?: string;
  in_thread?: boolean;
  thread?: ThreadMessage[]; // when includeThreads=true
}

export interface LinksResponse {
  ok: boolean;
  links: LinkItem[];
}

// Thread types
export interface ThreadMessage {
  id: number;
  channel_id?: string;
  channel_name?: string | null;
  user_id?: string | null;
  ts: string;
  text: string;
  author: string;
}

export interface ThreadResponse {
  ok: boolean;
  channel_id: string;
  thread_root_ts: string;
  messages: ThreadMessage[]; // ordered by ts asc
}

// API Methods with proper typing
export async function searchMessages(payload: {
  query: string;
  topK?: number;
  channels?: string[];
  dateFrom?: string;
  dateTo?: string;
  includeThreads?: boolean; // default true on server
}): Promise<SearchResponse> {
  // Validate input
  if (!payload.query?.trim()) {
    throw new ApiError(400, "Query is required");
  }

  if (payload.topK && (payload.topK < 1 || payload.topK > 100)) {
    throw new ApiError(400, "topK must be between 1 and 100");
  }

  return api("/api/search", payload) as Promise<SearchResponse>;
}

export async function summarizeMessages(
  messageIds: number[]
): Promise<SummarizeResponse> {
  // Validate input
  if (!messageIds || messageIds.length === 0) {
    throw new ApiError(400, "At least one message ID is required");
  }

  if (messageIds.length > 100) {
    throw new ApiError(400, "Cannot summarize more than 100 messages at once");
  }

  return api("/api/summarize", { messageIds }) as Promise<SummarizeResponse>;
}

export async function fetchLinks(params: {
  channel_id?: string;
  user_id?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  includeThreads?: boolean; // default false on server
}): Promise<LinksResponse> {
  // Validate input
  if (params.limit && (params.limit < 1 || params.limit > 2000)) {
    throw new ApiError(400, "Limit must be between 1 and 2000");
  }

  if (params.offset && params.offset < 0) {
    throw new ApiError(400, "Offset must be non-negative");
  }

  return apiGet(
    "/api/links",
    params as Record<string, string | number | undefined>
  ) as Promise<LinksResponse>;
}

// Fetch a single thread lazily
export async function fetchThread(params: {
  channel_id: string;
  root_ts: string;
}): Promise<ThreadResponse> {
  return apiGet(
    "/api/thread",
    params as Record<string, string | number | undefined>
  ) as Promise<ThreadResponse>;
}

// Export utility to check if API is configured
export function isApiConfigured(): boolean {
  return !!TOKEN || !!API_BASE;
}

// Export utility to get API configuration status
export function getApiConfig() {
  return {
    hasToken: !!TOKEN,
    hasBase: !!API_BASE,
    baseUrl: API_BASE || "(using proxy)",
  };
}
