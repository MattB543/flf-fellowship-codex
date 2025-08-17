// api/client.ts - Enhanced API client with better error handling and retry logic

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const TOKEN = import.meta.env.VITE_API_TOKEN as string | undefined;

// Custom error class for API errors
export class ApiError extends Error {
  status: number;
  details?: any;
  
  constructor(status: number, message: string, details?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
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

// Type definitions for document chunks
export interface DocumentChunk {
  id: string;
  content: string;
  order: number;
  is_highlighted: boolean;
  section_title: string;
  hierarchy_level: number;
  chunk_type: "header" | "content" | "code" | "table";
  score: number;
}

// Type definitions for API responses
export interface SearchResult {
  id: number | string; // Can be "doc_123" for full documents or number for chunks/messages
  source: "slack" | "document";
  // Slack-specific fields
  channel_id?: string;
  channel_name?: string | null;
  user_id?: string | null;
  ts?: string;
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
  // Enhanced metadata for both sources
  metadata?: {
    // Slack metadata
    channel_name?: string;
    user_name?: string;
    created_at?: string;
    thread_ts?: string | null;
    // Document metadata (legacy chunk format)
    document_title?: string;
    section_title?: string;
    chunk_type?: string;
    has_code?: boolean;
    has_tables?: boolean;
    hierarchy_level?: number;
    // Full document metadata (new format)
    file_path?: string;
    total_chunks?: number;
    highlighted_chunks?: number;
    primary_chunk_id?: string;
    chunks?: DocumentChunk[];
  };
  // Content can be either message text or document content
  content?: string;
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
  // New advanced search parameters
  sources?: Array<"slack" | "document">;
  includeDocumentSummaries?: boolean;
  rerank?: boolean;
  semanticWeight?: number;
  useAdvancedRetrieval?: boolean;
  enableContextExpansion?: boolean;
  enableRecencyBoost?: boolean;
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
  resultIds: (number | string)[],
  searchQuery?: string
): Promise<SummarizeResponse> {
  // Validate input
  if (!resultIds || resultIds.length === 0) {
    throw new ApiError(400, "At least one result ID is required");
  }

  if (resultIds.length > 100) {
    throw new ApiError(400, "Cannot summarize more than 100 results at once");
  }

  const payload: { messageIds: (number | string)[]; searchQuery?: string } = { messageIds: resultIds };
  if (searchQuery) {
    payload.searchQuery = searchQuery;
  }

  return api("/api/summarize", payload) as Promise<SummarizeResponse>;
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

// Document utility functions
export interface DocumentData {
  fullContent: string;
  chunks: DocumentChunk[];
  highlightedChunks: DocumentChunk[];
  primaryChunkId?: string;
  documentTitle: string;
  filePath?: string;
  totalChunks: number;
  highlightedCount: number;
}

export function isFullDocument(result: SearchResult): boolean {
  return (
    result.source === "document" &&
    typeof result.id === "string" &&
    result.id.startsWith("doc_") &&
    !result.id.startsWith("doc_chunk_") &&
    !!result.metadata?.chunks &&
    result.metadata.chunks.length > 0
  );
}

export function isLegacyChunk(result: SearchResult): boolean {
  return result.source === 'document' && 
         typeof result.id === 'string' && 
         result.id.startsWith('doc_chunk_');
}

export function reconstructDocument(result: SearchResult): DocumentData | null {
  if (!isFullDocument(result) || !result.metadata?.chunks) {
    return null;
  }

  // Sort chunks by order
  const sortedChunks = result.metadata.chunks.sort((a, b) => a.order - b.order);
  
  // Identify highlighted chunks
  const highlightedChunks = sortedChunks.filter(chunk => chunk.is_highlighted);
  
  return {
    fullContent: result.content || result.text,
    chunks: sortedChunks,
    highlightedChunks: highlightedChunks,
    primaryChunkId: result.metadata.primary_chunk_id,
    documentTitle: result.metadata.document_title || 'Untitled Document',
    filePath: result.metadata.file_path,
    totalChunks: result.metadata.total_chunks || sortedChunks.length,
    highlightedCount: result.metadata.highlighted_chunks || highlightedChunks.length
  };
}

export function renderDocumentWithHighlights(documentData: DocumentData) {
  return documentData.chunks.map(chunk => ({
    id: chunk.id,
    content: chunk.content,
    isHighlighted: chunk.is_highlighted,
    sectionTitle: chunk.section_title,
    relevanceScore: chunk.score || 0,
    hierarchyLevel: chunk.hierarchy_level,
    chunkType: chunk.chunk_type,
    className: chunk.is_highlighted ? 'chunk-highlighted' : 'chunk-normal'
  }));
}

export function getDocumentStats(result: SearchResult) {
  if (isFullDocument(result) && result.metadata) {
    return {
      totalSections: result.metadata.total_chunks || 0,
      relevantSections: result.metadata.highlighted_chunks || 0,
      documentTitle: result.metadata.document_title || 'Untitled Document',
      filePath: result.metadata.file_path,
      primaryChunkId: result.metadata.primary_chunk_id
    };
  }
  return null;
}
