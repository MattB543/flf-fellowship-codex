<script setup lang="ts">
import { ref, computed, h } from "vue";
import {
  NInput,
  NButton,
  NSelect,
  NDatePicker,
  NSpace,
  NCard,
  NDataTable,
  NTag,
  NEmpty,
  NAlert,
  NSpin,
  NInputGroup,
  NIcon,
  useMessage,
  useLoadingBar,
  NEllipsis,
  NModal,
  NButtonGroup,
  NDrawer,
  NDrawerContent,
} from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import {
  SearchOutline,
  SparklesOutline,
  CopyOutline,
  ChatbubblesOutline,
  BarChartOutline,
  OpenOutline,
  DocumentTextOutline,
} from "@vicons/ionicons5";
import { format } from "date-fns";
import {
  searchMessages,
  summarizeMessages,
  isFullDocument,
  reconstructDocument,
  renderDocumentWithHighlights,
  getDocumentStats,
} from "@/api/client";
import ThreadPreview from "@/components/ThreadPreview.vue";
import AdvancedOptions from "@/components/AdvancedOptions.vue";
import ResultsStats from "@/components/ResultsStats.vue";
import { ingestRow } from "@/stores/threadCache";
import { trackSearchUsage } from "@/utils/searchAnalytics";

type ResultItem = Awaited<ReturnType<typeof searchMessages>> extends {
  results: infer R;
}
  ? R extends Array<infer U>
    ? U
    : never
  : never;

const message = useMessage();
const loadingBar = useLoadingBar();

// State
const query = ref("");
const topK = ref(100);
const dateRange = ref<[number, number] | null>(null);
const channels = ref<string[]>([]);
const results = ref<ResultItem[]>([]);
const loading = ref(false);
const summaryLoading = ref(false);
const summaryText = ref<string | null>(null);
const summaryQuery = ref("");
const errorMessage = ref<string | null>(null);
// Always summarize all results - no longer needed
// const summarizeCount = ref(30);
const showSummaryModal = ref(false);
const showEngagementModal = ref(false);

// New advanced search state
const searchMode = ref<"legacy" | "advanced">("advanced");
const advancedOptions = ref({
  enableRecencyBoost: false,
  enableContextExpansion: true,
  includeDocumentSummaries: true,
});
const sources = ref<Array<"slack" | "document">>(["slack", "document"]);
const rerank = ref(true);
const semanticWeight = ref(0.7);

// Source filter state
const sourceFilter = ref<"all" | "slack" | "docs">("all");

// Slack workspace domain for permalinks
const SLACK_WORKSPACE_BASE = "https://aiforhumanreasoning.slack.com";

// Drawer state - replace hover functionality
const selectedRowId = ref<string | number | null>(null);
const isDrawerOpen = ref(false);
const drawerContent = ref<any>(null);

function buildSlackPermalink(
  channelId: string,
  ts: string,
  threadRootTs?: string | null
): string {
  // Slack permalink format: /archives/{channelId}/p{ts} where ts is 16 digits without dot
  const [secStr, microStrRaw = ""] = ts.split(".");
  const microStr = (microStrRaw + "000000").slice(0, 6);
  const secPadded = secStr.padStart(10, "0");
  const pTs = `${secPadded}${microStr}`;
  const base = `${SLACK_WORKSPACE_BASE}/archives/${channelId}/p${pTs}`;
  if (threadRootTs && threadRootTs !== ts) {
    return `${base}?thread_ts=${threadRootTs}&cid=${channelId}`;
  }
  return base;
}

// Summaries now come back as trusted HTML strings from the API

// Calculate user engagement statistics
const userEngagement = computed(() => {
  const counts = new Map<string, number>();

  for (const result of sortedResults.value) {
    const author = formatAuthorName(result.author);
    counts.set(author, (counts.get(author) || 0) + 1);
  }

  // Convert to array and sort by count descending
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
});

// Calculate max count for chart scaling
const maxMessageCount = computed(() => {
  return Math.max(...userEngagement.value.map((u) => u.count), 1);
});

// Computed
const hasResults = computed(() => results.value.length > 0);
const canSearch = computed(() => query.value.trim().length > 0);
const canSummarize = computed(
  () => hasResults.value && !loading.value && !summaryLoading.value
);

const summaryModalTitle = computed(() => {
  if (!hasResults.value) return "AI Summary";

  const hasSlack = sortedResults.value.some(
    (r) => r.source === "slack" || !!r.channel_id
  );
  const hasDocs = sortedResults.value.some((r) => r.source === "document");

  if (hasSlack && hasDocs) {
    return "AI Summary - Slack & Documents";
  } else if (hasSlack) {
    return "AI Summary - Slack Conversations";
  } else if (hasDocs) {
    return "AI Summary - Documents";
  }

  return "AI Summary";
});

const drawerTitle = computed(() => {
  if (!selectedRowId.value) return "Content Details";

  const selectedResult = results.value.find(
    (r) => r.id === selectedRowId.value
  );
  if (!selectedResult) return "Content Details";

  const isSlack =
    selectedResult.source === "slack" || !!selectedResult.channel_id;
  const hasThread =
    !!selectedResult.thread_root_ts &&
    selectedResult.thread_root_ts !== selectedResult.ts;
  const isDocumentExpanded = isFullDocument(selectedResult);

  if (isSlack && hasThread) {
    return `Thread in #${selectedResult.channel_name || "unknown"}`;
  } else if (isSlack) {
    return `Message in #${selectedResult.channel_name || "unknown"}`;
  } else if (isDocumentExpanded) {
    return selectedResult.metadata?.document_title || "Document";
  } else {
    return selectedResult.metadata?.document_title || "Content Details";
  }
});

// Search statistics (use total results for counts, filtered results for display)
const searchStats = computed(() => {
  if (!hasResults.value) return null;

  const filteredResults = sortedResults.value;
  const allResults = results.value; // Use all results for constant counts

  const slackCount = allResults.filter(
    (r) => r.source === "slack" || !!r.channel_id
  ).length;
  const docCount = allResults.filter(
    (r) => r.source === "document" && !r.channel_id
  ).length;

  return {
    total: filteredResults.length,
    slackCount,
    docCount,
    avgScore:
      filteredResults.length > 0
        ? filteredResults.reduce((sum, r) => sum + r.score, 0) /
          filteredResults.length
        : 0,
  };
});

const topKOptions = [
  { label: "Top 10", value: 10 },
  { label: "Top 20", value: 20 },
  { label: "Top 50", value: 50 },
  { label: "Top 100", value: 100 },
];

// No longer needed - always summarize all results
// const summarizeOptions = [];

// Hardcoded user ID mappings
const USER_ID_MAPPINGS: Record<string, string> = {
  U09934RTP4J: "TownCrier Bot",
  U097861Q495: "Jay Baxter",
};

// Helper function to format author name
function formatAuthorName(author: string): string {
  if (!author) return "Unknown";

  // Check for hardcoded user ID mappings first
  if (USER_ID_MAPPINGS[author]) {
    return USER_ID_MAPPINGS[author];
  }

  // Handle email format (e.g., john.doe@example.com)
  if (author.includes("@")) {
    const [localPart] = author.split("@");
    const parts = localPart.split(".");
    if (parts.length >= 2) {
      const firstName = parts[0];
      const lastName = parts[parts.length - 1];
      return `${
        firstName.charAt(0).toUpperCase() + firstName.slice(1)
      } ${lastName.charAt(0).toUpperCase()}.`;
    }
    return localPart;
  }

  // Handle display names
  const parts = author.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  } else if (parts.length >= 2) {
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstName} ${lastInitial}.`;
  }

  return author;
}

// Helper function to format timestamp to local time
function formatLocalTime(ts: string): string {
  const seconds = Number.parseFloat(ts);
  if (Number.isNaN(seconds)) return ts;
  const date = new Date(seconds * 1000);
  return format(date, "MMM d, h:mm a");
}

function formatLocalTimeFull(ts: string): string {
  const seconds = Number.parseFloat(ts);
  if (Number.isNaN(seconds)) return ts;
  const date = new Date(seconds * 1000);
  return format(date, "PPpp");
}

// Sort and filter results
const sortedResults = computed(() => {
  let filtered = results.value;

  // Apply source filter - Fixed logic
  if (sourceFilter.value === "slack") {
    filtered = filtered.filter(
      (r) => r.source === "slack" || (r.source !== "document" && !!r.channel_id)
    );
  } else if (sourceFilter.value === "docs") {
    filtered = filtered.filter(
      (r) => r.source === "document" || (!r.channel_id && r.source !== "slack")
    );
  }

  return [...filtered].sort((a, b) => b.score - a.score);
});

// Table columns
const columns: DataTableColumns<ResultItem> = [
  {
    title: "Source",
    key: "source",
    width: 120,
    render(row) {
      // More permissive Slack detection - match the filter logic
      const isSlack =
        row.source === "slack" ||
        (row.source !== "document" && !!row.channel_id);
      const hasPermalinkData = !!row.channel_id && !!row.ts;
      const source = isSlack ? "slack" : "document";

      // For Slack with complete permalink data, make entire cell clickable
      if (isSlack && hasPermalinkData) {
        return h(
          "a",
          {
            href: buildSlackPermalink(
              row.channel_id!,
              row.ts!,
              row.thread_root_ts
            ),
            target: "_blank",
            rel: "noopener noreferrer",
            class: `result-source-badge source-${source}`,
            style:
              "display: flex; align-items: center; gap: 6px; color: inherit; text-decoration: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background-color 0.2s;",
            title: "Open in Slack",
          },
          [
            h(NIcon, { size: 16 }, { default: () => h(ChatbubblesOutline) }),
            h("span", {}, "Slack"),
            h(
              NIcon,
              {
                size: 12,
                style: "margin-left: auto; color: var(--n-primary-color);",
              },
              { default: () => h(OpenOutline) }
            ),
          ]
        );
      } else {
        // Non-clickable for documents or Slack messages without complete permalink data
        const displaySource = isSlack ? "Slack" : "Doc";
        const icon = isSlack ? ChatbubblesOutline : DocumentTextOutline;

        return h(
          "div",
          {
            class: `result-source-badge source-${source}`,
            style:
              "display: flex; align-items: center; gap: 6px; padding: 4px 8px;",
          },
          [
            h(NIcon, { size: 16 }, { default: () => h(icon) }),
            h("span", {}, displaySource),
          ]
        );
      }
    },
  },
  {
    title: "Score",
    key: "score",
    width: 80,
    render(row) {
      const scorePercent = Math.round(row.score * 100);
      const isHighConfidence = row.score > 0.8;

      return h(
        "span",
        {
          style: `font-size: 13px; font-weight: 500; color: ${
            isHighConfidence ? "#18a058" : "var(--n-text-color)"
          };`,
          class: isHighConfidence ? "high-confidence-score" : "",
        },
        `${scorePercent}%`
      );
    },
    sorter: (a, b) => b.score - a.score,
  },
  {
    title: "Metadata",
    key: "metadata",
    width: 200,
    render(row) {
      const isSlack =
        row.source === "slack" ||
        (row.source !== "document" && !!row.channel_id);

      if (isSlack) {
        return h("div", { class: "slack-metadata" }, [
          // Use align-items: flex-start to prevent stretching
          h(
            "div",
            {
              style:
                "display: flex; flex-direction: column; gap: 4px; align-items: flex-start;",
            },
            [
              h(
                NTag,
                {
                  size: "small",
                  type: "default",
                  style: "width: fit-content;",
                },
                {
                  default: () =>
                    formatAuthorName(
                      row.author || row.metadata?.user_name || "Unknown"
                    ),
                }
              ),
              h(
                NTag,
                {
                  size: "small",
                  type: "default",
                  style: "width: fit-content;",
                },
                {
                  default: () =>
                    `#${
                      row.channel_name ||
                      row.metadata?.channel_name ||
                      "unknown"
                    }`,
                }
              ),
            ]
          ),
          h(
            "div",
            {
              style:
                "margin-top: 4px; font-size: 12px; color: var(--n-text-color-2); display: flex; align-items: center; gap: 8px;",
            },
            [
              row.ts && h("span", {}, formatLocalTime(row.ts)),
              row.thread_root_ts &&
                row.thread_root_ts !== row.ts &&
                h(
                  NTag,
                  { size: "tiny", style: "width: fit-content;" },
                  { default: () => "Thread" }
                ),
              // More prominent Slack permalink
              row.channel_id &&
                row.ts &&
                h(
                  "a",
                  {
                    href: buildSlackPermalink(
                      row.channel_id!,
                      row.ts!,
                      row.thread_root_ts
                    ),
                    target: "_blank",
                    rel: "noopener noreferrer",
                    style:
                      "display: inline-flex; align-items: center; gap: 4px; color: var(--n-primary-color); text-decoration: none; font-size: 12px;",
                    title: "Open in Slack",
                  },
                  [
                    h(NIcon, { size: 14 }, { default: () => h(OpenOutline) }),
                    h("span", {}, "Open"),
                  ]
                ),
            ]
          ),
        ]);
      } else {
        // Document metadata remains the same
        return h("div", { class: "doc-metadata" }, [
          h(
            "div",
            { style: "font-weight: 500; font-size: 13px;" },
            row.metadata?.document_title || "Document"
          ),
          row.metadata?.section_title &&
            h(
              "div",
              {
                style:
                  "font-size: 12px; color: var(--n-text-color-2); margin-top: 2px;",
              },
              `§ ${row.metadata.section_title}`
            ),
          ...(row.metadata?.has_tables
            ? [
                h(
                  "div",
                  {
                    style:
                      "margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;",
                  },
                  [
                    h(
                      NTag,
                      { size: "tiny", type: "success" },
                      { default: () => "Tables" }
                    ),
                  ]
                ),
              ]
            : []),
        ]);
      }
    },
  },
  {
    title: "Content (click row to read full content)",
    key: "text",
    render(row) {
      const hasThread = !!row.thread_root_ts && row.thread_root_ts !== row.ts;
      const content = row.content || row.text;
      const isSlack = row.source === "slack" || !!row.channel_id;
      const isDocumentExpanded = isFullDocument(row);

      // Preview content for trigger
      let previewContent = content;
      let docStats = null;

      if (isDocumentExpanded) {
        docStats = getDocumentStats(row);
        previewContent = `${docStats?.documentTitle || "Document"} - ${
          docStats?.relevantSections || 0
        } relevant sections`;
      }

      return h(
        "div",
        {
          style:
            "display: flex; align-items: flex-start; gap: 6px; cursor: pointer; width: 100%; height: 100%; padding: 8px 0; position: relative;",
          class: `result-content-preview source-${
            isSlack ? "slack" : "document"
          } ${isDocumentExpanded ? "document-expanded" : ""} ${
            selectedRowId.value === row.id ? "selected" : ""
          }`,
          onClick: () => {
            console.log("Row clicked:", row.id);
            selectedRowId.value = row.id;
            isDrawerOpen.value = true;

            // Set drawer content based on row type
            if (isSlack && hasThread && row.channel_id && row.ts) {
              drawerContent.value = h(ThreadPreview, {
                channel_id: row.channel_id,
                thread_root_ts: row.thread_root_ts as string,
                highlight_ts: row.ts,
                eagerRow: row as any,
              });
            } else if (isDocumentExpanded) {
              // Document expansion content
              const documentData = reconstructDocument(row);
              if (documentData) {
                const renderedChunks =
                  renderDocumentWithHighlights(documentData);
                drawerContent.value = h(
                  "div",
                  {
                    style:
                      "padding: 0; background: white; max-height: 100%; overflow: auto;",
                    class: "document-preview-modal",
                  },
                  [
                    // Document header with stats
                    h(
                      "div",
                      {
                        style:
                          "padding: 16px; border-bottom: 1px solid var(--n-border-color); background: var(--n-color-embedded);",
                      },
                      [
                        h(
                          "div",
                          {
                            style:
                              "font-weight: 600; font-size: 16px; margin-bottom: 8px;",
                          },
                          documentData.documentTitle
                        ),
                        h(
                          "div",
                          {
                            style:
                              "font-size: 12px; color: var(--n-text-color-2); display: flex; gap: 16px;",
                          },
                          [
                            h(
                              "span",
                              {},
                              `${documentData.highlightedCount} relevant sections`
                            ),
                            h(
                              "span",
                              {},
                              `${documentData.totalChunks} total sections`
                            ),
                            ...(documentData.filePath
                              ? [h("span", {}, documentData.filePath)]
                              : []),
                          ]
                        ),
                      ]
                    ),
                    // Document chunks
                    h(
                      "div",
                      { style: "padding: 16px;" },
                      renderedChunks.map((chunk) =>
                        h(
                          "div",
                          {
                            key: chunk.id,
                            id: `chunk_${chunk.id}`,
                            class: chunk.className,
                            style: chunk.isHighlighted
                              ? "margin: 8px 0; background-color: rgba(255, 193, 7, 0.15); border-left: 4px solid #ffc107; padding: 12px; color: var(--n-text-color); border-radius: 4px;"
                              : "margin: 8px 0; opacity: 0.7; padding: 8px; color: var(--n-text-color);",
                          },
                          [
                            ...(chunk.sectionTitle && chunk.hierarchyLevel <= 3
                              ? [
                                  h(
                                    `h${Math.min(chunk.hierarchyLevel + 2, 6)}`,
                                    {
                                      style:
                                        "margin: 0 0 8px 0; font-weight: 600; color: var(--n-text-color);",
                                    },
                                    chunk.sectionTitle
                                  ),
                                ]
                              : []),
                            h("div", {
                              style:
                                "white-space: pre-wrap; line-height: 1.4; color: inherit;",
                              innerHTML: chunk.content,
                            }),
                            ...(chunk.isHighlighted && chunk.relevanceScore > 0
                              ? [
                                  h(
                                    "div",
                                    {
                                      style:
                                        "margin-top: 8px; font-size: 11px; color: var(--n-text-color-3);",
                                    },
                                    `Relevance: ${Math.round(
                                      chunk.relevanceScore * 100
                                    )}%`
                                  ),
                                ]
                              : []),
                          ]
                        )
                      )
                    ),
                  ]
                );
              }
            } else {
              // Regular content preview
              console.log("Setting regular content preview for row:", row.id);
              drawerContent.value = h(
                "div",
                {
                  style:
                    "padding: 16px; background: white; max-height: 100%; overflow: auto;",
                  class: `content-preview ${
                    isSlack ? "slack-content" : "document-content"
                  }`,
                },
                [
                  h("div", { style: "padding: 6px 8px; border-radius: 6px" }, [
                    h(
                      "div",
                      {
                        style:
                          "font-size: 12px; color: var(--n-text-color-3); display: flex; gap: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--n-border-color); padding-bottom: 6px;",
                      },
                      [
                        h(
                          "span",
                          {
                            style:
                              "font-weight: 600; color: var(--n-text-color);",
                          },
                          formatAuthorName(
                            row.author || row.metadata?.user_name || "Unknown"
                          )
                        ),
                        ...(isSlack && row.ts
                          ? [h("span", {}, formatLocalTimeFull(row.ts))]
                          : []),
                        ...(!isSlack && row.metadata?.document_title
                          ? [
                              h(
                                "span",
                                { style: "font-style: italic;" },
                                `from ${row.metadata.document_title}`
                              ),
                            ]
                          : []),
                      ]
                    ),
                    h("div", {
                      style:
                        "margin-top: 8px; white-space: pre-wrap; line-height: 1.4;",
                      innerHTML: content, // Allow for potential HTML highlighting
                    }),
                  ]),
                ]
              );
            }
          },
        },
        [
          h(
            NEllipsis,
            {
              lineClamp: 2,
              style: "flex: 1; min-width: 0",
              tooltip: false,
            },
            { default: () => previewContent }
          ),
          ...(isDocumentExpanded && docStats
            ? [
                h(
                  NTag,
                  {
                    size: "tiny",
                    type: "info",
                    style: "margin-left: 8px;",
                  },
                  {
                    default: () =>
                      `${docStats.relevantSections}/${docStats.totalSections}`,
                  }
                ),
              ]
            : []),
        ]
      );
    },
  },
];

// Methods
async function runSearch() {
  if (!canSearch.value || loading.value) return;

  loading.value = true;
  summaryText.value = null;
  errorMessage.value = null;
  loadingBar.start();

  try {
    const payload = {
      query: query.value.trim(),
      topK: topK.value,
      channels: channels.value.length > 0 ? channels.value : undefined,
      dateFrom: dateRange.value?.[0]
        ? new Date(dateRange.value[0]).toISOString()
        : undefined,
      dateTo: dateRange.value?.[1]
        ? new Date(dateRange.value[1]).toISOString()
        : undefined,
      includeThreads: true,
      // New advanced search parameters
      ...(searchMode.value === "advanced" && {
        useAdvancedRetrieval: true,
        enableContextExpansion: advancedOptions.value.enableContextExpansion,
        enableRecencyBoost: advancedOptions.value.enableRecencyBoost,
        includeDocumentSummaries:
          advancedOptions.value.includeDocumentSummaries,
        sources: sources.value,
        rerank: rerank.value,
        semanticWeight: semanticWeight.value,
      }),
    };

    const res = await searchMessages(payload);
    results.value = res.results || [];

    // Ingest any eagerly returned threads into cache
    for (const r of results.value) {
      try {
        ingestRow(r as any);
      } catch {}
    }

    if (results.value.length === 0) {
      message.info("No results found. Try adjusting your search criteria.");
      // Close drawer if no results
      isDrawerOpen.value = false;
      selectedRowId.value = null;
      drawerContent.value = null;
    } else {
      message.success(`Found ${results.value.length} results`);

      // Track search analytics
      const avgScore =
        results.value.reduce((sum, r) => sum + r.score, 0) /
        results.value.length;
      trackSearchUsage(
        searchMode.value,
        query.value.trim(),
        results.value,
        avgScore
      );
    }

    loadingBar.finish();
  } catch (e) {
    console.error("Search error:", e);
    const msg = (e as Error).message || "Search failed";

    if (msg.includes("401")) {
      errorMessage.value =
        "Authentication failed. Please check your API token configuration.";
      message.error("Authentication failed");
    } else if (msg.includes("NetworkError") || msg.includes("fetch")) {
      errorMessage.value =
        "Network error. Please check your connection and server status.";
      message.error("Network error");
    } else {
      errorMessage.value = msg;
      message.error(msg);
    }

    results.value = [];
    loadingBar.error();
  } finally {
    loading.value = false;
  }
}

async function runSummarize() {
  if (!canSummarize.value) return;

  // Open modal with query input first
  summaryQuery.value = query.value.trim(); // Pre-fill with search query
  summaryText.value = null; // Clear any previous summary
  errorMessage.value = null;
  showSummaryModal.value = true;
}

async function generateSummary() {
  if (!summaryQuery.value.trim()) {
    message.warning("Please enter a summary query.");
    return;
  }

  summaryLoading.value = true;
  loadingBar.start();

  try {
    // Summarize all current results (now supports both Slack messages and documents)
    const resultIds = sortedResults.value.map((r) => r.id);

    if (resultIds.length === 0) {
      message.warning("No results to summarize.");
      summaryLoading.value = false;
      loadingBar.error();
      return;
    }

    const res = await summarizeMessages(resultIds, summaryQuery.value.trim());
    summaryText.value = res.summary;

    // Show contextual success message based on result types
    const hasSlack = sortedResults.value.some(
      (r) => r.source === "slack" || !!r.channel_id
    );
    const hasDocs = sortedResults.value.some((r) => r.source === "document");

    let successMsg = "Summary generated successfully";
    if (hasSlack && hasDocs) {
      successMsg =
        "Unified summary generated from Slack conversations and documents";
    } else if (hasSlack) {
      successMsg = "Summary generated from Slack conversations";
    } else if (hasDocs) {
      successMsg = "Summary generated from documents";
    }

    message.success(successMsg);
    loadingBar.finish();
  } catch (e) {
    console.error("Summarization error:", e);
    const msg = (e as Error).message || "Summarization failed";
    errorMessage.value = msg;
    message.error(msg);
    loadingBar.error();
  } finally {
    summaryLoading.value = false;
  }
}

async function copySummary() {
  if (!summaryText.value) return;

  try {
    await navigator.clipboard.writeText(summaryText.value);
    message.success("Summary copied to clipboard");
  } catch (e) {
    message.error("Failed to copy summary");
  }
}

function handleEnterKey(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    runSearch();
  }
}

function closeSummaryModal() {
  showSummaryModal.value = false;
  summaryText.value = null;
  summaryQuery.value = "";
}
</script>

<template>
  <div class="search-view">
    <!-- Search Controls -->
    <NCard style="margin-bottom: 24px">
      <template #header>
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
          "
        >
          <span>Search Parameters</span>
          <AdvancedOptions
            v-model="advancedOptions"
            :visible="true"
            :inline="true"
          />
        </div>
      </template>

      <NSpace vertical :size="16">
        <div style="display: flex; gap: 12px; align-items: center">
          <NInputGroup style="flex: 1">
            <NInput
              v-model:value="query"
              placeholder="Search for messages... (Press Enter to search)"
              size="large"
              clearable
              @keydown="handleEnterKey"
            >
              <template #prefix>
                <NIcon :component="SearchOutline" />
              </template>
            </NInput>
            <NButton
              type="primary"
              size="large"
              :disabled="!canSearch"
              :loading="loading"
              @click="runSearch"
            >
              Search
            </NButton>
          </NInputGroup>

          <NSelect
            v-model:value="topK"
            :options="topKOptions"
            style="width: 120px; flex-shrink: 0"
            size="large"
            placeholder="Limit"
          />

          <NDatePicker
            v-model:value="dateRange"
            type="datetimerange"
            clearable
            size="large"
            style="width: 350px; flex-shrink: 0"
            placeholder="Date Filter"
          />
        </div>
      </NSpace>
    </NCard>

    <!-- Error Alert -->
    <NAlert
      v-if="errorMessage"
      type="error"
      closable
      style="margin-bottom: 24px"
      @close="errorMessage = null"
    >
      {{ errorMessage }}
    </NAlert>

    <!-- Results Section -->
    <NCard>
      <template #header>
        <!-- Results title with right-aligned button group -->
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
          "
        >
          <ResultsStats
            :stats="searchStats"
            :is-advanced-mode="searchMode === 'advanced'"
            :is-loading="loading"
          />

          <div
            v-if="hasResults"
            style="display: flex; align-items: center; gap: 12px"
          >
            <!-- Source Filter Buttons -->
            <NButtonGroup size="small">
              <NButton
                :type="sourceFilter === 'all' ? 'primary' : 'default'"
                @click="sourceFilter = 'all'"
              >
                All
              </NButton>
              <NButton
                :type="sourceFilter === 'slack' ? 'primary' : 'default'"
                @click="sourceFilter = 'slack'"
              >
                Slack
              </NButton>
              <NButton
                :type="sourceFilter === 'docs' ? 'primary' : 'default'"
                @click="sourceFilter = 'docs'"
              >
                Docs
              </NButton>
            </NButtonGroup>

            <!-- Action Buttons -->
            <NButton size="small" @click="showEngagementModal = true">
              <template #icon>
                <NIcon :component="BarChartOutline" />
              </template>
              User Engagement
            </NButton>
            <NButton
              type="primary"
              size="small"
              :disabled="!canSummarize"
              :loading="summaryLoading"
              @click="runSummarize"
            >
              <template #icon>
                <NIcon :component="SparklesOutline" />
              </template>
              Summarize
            </NButton>
          </div>
        </div>
      </template>

      <template v-if="loading">
        <NSpin size="large" style="width: 100%; padding: 60px 0">
          <template #description>Searching messages...</template>
        </NSpin>
      </template>

      <template v-else-if="!hasResults && query">
        <NEmpty description="No results found" style="padding: 40px 0">
          <template #extra>
            <NButton size="small" @click="query = ''"> Clear search </NButton>
          </template>
        </NEmpty>
      </template>

      <template v-else-if="!hasResults">
        <NEmpty
          description="Enter a search query to get started"
          style="padding: 40px 0"
        />
      </template>

      <NDataTable
        v-else
        :columns="columns"
        :data="sortedResults"
        :pagination="{
          pageSize: 100,
          showSizePicker: true,
          pageSizes: [10, 20, 50, 100],
        }"
        :bordered="false"
        :single-line="false"
        striped
        style="margin-top: 0"
      />
    </NCard>

    <!-- Summary Modal -->
    <NModal
      v-model:show="showSummaryModal"
      preset="card"
      :title="summaryModalTitle"
      style="width: 750px; max-width: 90vw"
      :mask-closable="!summaryLoading"
      :closable="!summaryLoading"
      @after-leave="summaryText = null"
    >
      <div class="summary-modal-content">
        <template v-if="!summaryText && !summaryLoading">
          <!-- Query Input Phase -->
          <div class="summary-query-section">
            <div class="summary-instruction">
              <strong>Customize your summary:</strong> You can be more specific
              than your search query to focus the summary on particular
              projects, people, or topics.
            </div>
            <NSpace vertical :size="12">
              <NInput
                v-model:value="summaryQuery"
                type="textarea"
                placeholder="What would you like the summary to focus on? (e.g., 'progress on the authentication system', 'feedback from users about the new UI', 'decisions made about the deployment pipeline')"
                :rows="3"
                clearable
                @keydown.ctrl.enter="generateSummary"
                @keydown.meta.enter="generateSummary"
              />
              <div class="query-hint">
                Pre-filled with your search query. Edit to be more specific.
                Press Ctrl+Enter to generate.
              </div>
            </NSpace>
          </div>
        </template>

        <template v-if="summaryLoading">
          <NSpin size="medium">
            <template #description>
              Generating summary....
              <br />
              (GPT-5 is a lil slow)
            </template>
          </NSpin>
        </template>

        <template v-if="summaryText">
          <div class="summary-tip">
            <strong>Tip:</strong> you can copy something from the summary and
            search again to find the relevant Slack messages
          </div>
          <div class="summary-content" v-html="summaryText"></div>
        </template>
      </div>

      <template #footer>
        <NSpace justify="space-between">
          <div>
            <NButton
              v-if="summaryText"
              quaternary
              size="small"
              @click="summaryText = null"
            >
              ← Back to Query
            </NButton>
          </div>
          <NSpace>
            <NButton
              v-if="!summaryText && !summaryLoading"
              type="primary"
              size="small"
              :disabled="!summaryQuery.trim()"
              @click="generateSummary"
            >
              <template #icon>
                <NIcon :component="SparklesOutline" />
              </template>
              Generate Summary
            </NButton>
            <NButton
              v-if="summaryText"
              quaternary
              size="small"
              @click="copySummary"
            >
              <template #icon>
                <NIcon :component="CopyOutline" />
              </template>
              Copy Summary
            </NButton>
            <NButton
              size="small"
              :disabled="summaryLoading"
              @click="closeSummaryModal"
            >
              Close
            </NButton>
          </NSpace>
        </NSpace>
      </template>
    </NModal>

    <!-- User Engagement Modal -->
    <NModal
      v-model:show="showEngagementModal"
      preset="card"
      title="User Engagement"
      style="width: 700px; max-width: 90vw"
      :mask-closable="true"
      :closable="true"
    >
      <div class="engagement-content">
        <div class="engagement-stats">
          <NSpace justify="space-between" style="margin-bottom: 20px">
            <div>
              <div class="stat-value">{{ userEngagement.length }}</div>
              <div class="stat-label">Active Users</div>
            </div>
            <div>
              <div class="stat-value">{{ sortedResults.length }}</div>
              <div class="stat-label">Total Messages</div>
            </div>
            <div>
              <div class="stat-value">
                {{
                  (
                    sortedResults.length / Math.max(userEngagement.length, 1)
                  ).toFixed(1)
                }}
              </div>
              <div class="stat-label">Avg Messages/User</div>
            </div>
          </NSpace>
        </div>

        <div class="chart-container">
          <div class="chart-title">Messages per User</div>
          <div class="bar-chart">
            <div
              v-for="(user, index) in userEngagement.slice(0, 15)"
              :key="index"
              class="chart-row"
            >
              <div class="user-name">{{ user.name }}</div>
              <div class="bar-wrapper">
                <div
                  class="bar"
                  :style="{
                    width: `${(user.count / maxMessageCount) * 100}%`,
                    background: `hsl(${220 - index * 8}, 70%, 55%)`,
                  }"
                >
                  <span class="bar-value">{{ user.count }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="userEngagement.length > 15" class="chart-note">
            Showing top 15 of {{ userEngagement.length }} users
          </div>
        </div>
      </div>
    </NModal>

    <!-- Right-side Drawer -->
    <NDrawer
      v-model:show="isDrawerOpen"
      :width="650"
      placement="right"
      :mask-closable="true"
      :close-on-esc="true"
    >
      <NDrawerContent :title="drawerTitle" closable>
        <component v-if="drawerContent" :is="drawerContent" />
        <div
          v-else
          style="
            padding: 20px;
            text-align: center;
            color: var(--n-text-color-3);
          "
        >
          Select a row to view its content
        </div>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.search-view {
  max-width: 1400px;
  margin: 0 auto;
}

.results-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-hint {
  padding: 8px 12px;
  background: rgba(64, 158, 255, 0.1);
  border-radius: 6px;
  font-size: 13px;
  color: var(--n-text-color);
}

.summary-modal-content {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.summary-query-section {
  width: 100%;
  padding: 20px 0;
}

.summary-instruction {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--n-color-embedded);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  border-left: 4px solid var(--n-primary-color);
}

.query-hint {
  font-size: 12px;
  color: var(--n-text-color-3);
  font-style: italic;
}

.summary-tip {
  width: 100%;
  margin-bottom: 10px;
  padding: 10px 12px;
  background: var(--n-color);
  border: 1px dashed #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  color: var(--n-text-color-2);
}

.summary-content {
  line-height: 1.6;
  width: 100%;
  max-height: 480px;
  overflow-y: auto;
  padding: 20px;
  background: var(--n-color-embedded);
  border-radius: 6px;
  font-size: 14px;
}

.summary-content ul.top-level-list {
  margin: 8px 0;
  padding-left: 0;
  list-style-type: none;
}

.summary-content ul.top-level-list > li {
  position: relative;
  padding-left: 20px;
}

.summary-content ul.top-level-list > li::before {
  content: "•";
  position: absolute;
  left: 0;
  font-weight: bold;
}

.summary-content ul ul {
  margin: 4px 0 4px 0;
  padding-left: 24px;
  list-style-type: disc;
}

.summary-content ul ul ul {
  list-style-type: circle;
}

.summary-content ul ul ul ul {
  list-style-type: square;
}

.summary-content li {
  margin: 6px 0;
  line-height: 1.5;
}

.summary-content p {
  margin: 12px 0;
}

.summary-content p:first-child {
  margin-top: 0;
}

.summary-content p:last-child {
  margin-bottom: 0;
}

.summary-content strong {
  font-weight: 600;
  color: var(--n-text-color);
}

.summary-content em {
  font-style: italic;
}

.summary-content code {
  padding: 2px 4px;
  background: var(--n-code-color);
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}

.summary-content h3 {
  font-size: 1.2em;
  font-weight: 600;
  margin: 16px 0 8px 0;
  color: var(--n-text-color);
}

.summary-content h4 {
  font-size: 1.1em;
  font-weight: 600;
  margin: 14px 0 6px 0;
  color: var(--n-text-color);
}

.summary-content h5 {
  font-size: 1em;
  font-weight: 600;
  margin: 12px 0 4px 0;
  color: var(--n-text-color);
}

.summary-content h3:first-child,
.summary-content h4:first-child,
.summary-content h5:first-child {
  margin-top: 0;
}

.engagement-content {
  padding: 8px 0;
}

.engagement-stats {
  text-align: center;
  padding: 16px;
  background: var(--n-color-embedded);
  border-radius: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--n-primary-color);
}

.stat-label {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}

.chart-container {
  margin-top: 24px;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--n-text-color);
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-name {
  flex: 0 0 120px;
  font-size: 13px;
  text-align: right;
  color: var(--n-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-wrapper {
  flex: 1;
  height: 24px;
  background: var(--n-color-embedded);
  border-radius: 4px;
  position: relative;
}

.bar {
  height: 100%;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  transition: width 0.3s ease;
  min-width: 30px;
}

.bar-value {
  color: white;
  font-size: 12px;
  font-weight: 600;
}

.chart-note {
  margin-top: 12px;
  font-size: 12px;
  color: var(--n-text-color-3);
  text-align: center;
}

/* New styles for advanced search features */
.search-mode-selector {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.toggle-group {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.toggle-group:hover {
  background-color: var(--n-color-embedded);
}

.checkbox-group {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.checkbox-group:hover {
  background-color: var(--n-color-embedded);
}

.advanced-options {
  padding: 16px;
  background: var(--n-color-embedded);
  border-radius: 8px;
  border: 1px solid var(--n-border-color);
}

.query-insights .insight-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--n-color-embedded);
  border-radius: 6px;
  font-size: 13px;
  color: var(--n-text-color);
}

.query-insights .source-weights {
  display: flex;
  gap: 12px;
  margin-left: 8px;
}

.query-insights .weight {
  font-size: 13px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
}

.query-insights .weight.slack {
  background: rgba(74, 144, 226, 0.1);
  color: #4a90e2;
}

.query-insights .weight.docs {
  background: rgba(46, 160, 67, 0.1);
  color: #2ea043;
}

.result-breakdown {
  font-size: 13px;
  color: var(--n-text-color-2);
  margin-left: 8px;
}

.advanced-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--n-primary-color);
  background: rgba(24, 160, 88, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
}

/* Better hover for source badges */
.result-source-badge {
  transition: all 0.2s ease;
  user-select: none;
}

.result-source-badge.source-slack {
  border-left: 3px solid #4a90e2;
  padding-left: 8px !important;
}

a.result-source-badge.source-slack:hover {
  background-color: rgba(74, 144, 226, 0.1) !important;
  transform: translateX(2px);
}

.result-source-badge.source-document {
  border-left: 3px solid #2ea043;
  padding-left: 8px !important;
}

.high-confidence-score {
  font-weight: 600;
}

.score-bar {
  position: relative;
  overflow: hidden;
}

/* Ensure badges don't stretch */
.slack-metadata {
  line-height: 1.3;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slack-metadata .n-tag {
  width: fit-content !important;
  flex-shrink: 0;
}

/* Add hover effect for Slack links */
.slack-metadata a:hover {
  text-decoration: underline;
}

.doc-metadata {
  line-height: 1.3;
}

.result-content-preview.source-slack {
  border-left: 2px solid rgba(74, 144, 226, 0.3);
  padding-left: 8px;
}

.result-content-preview.source-document {
  border-left: 2px solid rgba(46, 160, 67, 0.3);
  padding-left: 8px;
}

.content-preview.slack-content {
  background: white;
}

.content-preview.document-content {
  background: white;
}

/* Content preview hover effect */
.result-content-preview {
  transition: background-color 0.2s;
}

.result-content-preview:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.result-content-preview.selected {
  background-color: rgba(24, 160, 88, 0.08);
  border-left-color: var(--n-primary-color);
  border-left-width: 3px;
}

/* Document expansion styles */
.document-expanded {
  position: relative;
}

.document-expanded::after {
  content: "📄";
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 12px;
}

/* Ensure document preview text is always readable */
.document-preview-modal {
  font-family: inherit;
  color: var(--n-text-color) !important;
}

.document-preview-modal * {
  color: inherit;
}

/* Fix chunk highlighting colors */
.chunk-highlighted {
  background-color: rgba(
    255,
    193,
    7,
    0.15
  ) !important; /* Semi-transparent gold */
  border-left: 4px solid #ffc107;
  padding: 12px;
  margin: 8px 0;
  border-radius: 4px;
  color: var(--n-text-color) !important; /* Ensure text uses theme color */
}

.chunk-normal {
  opacity: 0.7;
  padding: 8px;
  margin: 8px 0;
  border-radius: 4px;
  border-left: 4px solid transparent;
  color: var(--n-text-color) !important;
}

.chunk-normal:hover {
  opacity: 0.9;
  background-color: var(--n-color-embedded);
}

.document-stats {
  font-size: 0.9em;
  color: #666;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: var(--n-color-embedded);
  border-radius: 6px;
  border: 1px solid var(--n-border-color);
}

.document-stats .stat-item {
  display: inline-block;
  margin-right: 16px;
}

.document-stats .stat-label {
  font-weight: 500;
  color: var(--n-text-color);
}

.document-stats .stat-value {
  color: var(--n-text-color-2);
}

/* Section navigation */
.section-nav {
  position: sticky;
  top: 0;
  background: var(--n-color);
  border-bottom: 1px solid var(--n-border-color);
  padding: 8px 16px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  z-index: 10;
}

.section-nav-item {
  font-size: 11px;
  padding: 4px 8px;
  background: var(--n-color-embedded);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.section-nav-item:hover {
  background: var(--n-primary-color-hover);
  color: white;
}

.section-nav-item.highlighted {
  background: #ffc107;
  color: #000;
  font-weight: 500;
}

/* Relevance indicators */
.relevance-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.relevance-high {
  background-color: #18a058;
}

.relevance-medium {
  background-color: #f0a020;
}

.relevance-low {
  background-color: #d93026;
}

/* Hierarchy styling for section headers */
.chunk-header-1 {
  font-size: 1.4em;
  font-weight: 700;
  margin: 16px 0 12px 0;
  color: var(--n-text-color);
  border-bottom: 2px solid var(--n-border-color);
  padding-bottom: 4px;
}

.chunk-header-2 {
  font-size: 1.2em;
  font-weight: 600;
  margin: 14px 0 10px 0;
  color: var(--n-text-color);
}

.chunk-header-3 {
  font-size: 1.1em;
  font-weight: 600;
  margin: 12px 0 8px 0;
  color: var(--n-text-color);
}

.chunk-header-4,
.chunk-header-5,
.chunk-header-6 {
  font-size: 1em;
  font-weight: 600;
  margin: 10px 0 6px 0;
  color: var(--n-text-color);
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
  .result-source-badge {
    font-size: 12px;
  }

  .slack-metadata,
  .doc-metadata {
    font-size: 11px;
  }

  .content-preview {
    min-width: 300px !important;
  }

  .document-preview-modal {
    min-width: 400px !important;
    max-height: 500px;
  }

  .section-nav {
    padding: 6px 12px;
  }

  .section-nav-item {
    font-size: 10px;
    padding: 3px 6px;
  }
}
</style>
