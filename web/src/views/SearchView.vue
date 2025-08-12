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
  NTooltip,
  NEllipsis,
  NBadge,
  NModal,
  NScrollbar,
} from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import {
  SearchOutline,
  SparklesOutline,
  CopyOutline,
  ChatbubblesOutline,
} from "@vicons/ionicons5";
import { format } from "date-fns";
import { searchMessages, summarizeMessages } from "@/api/client";
import ThreadPreview from "@/components/ThreadPreview.vue";
import { ingestRow } from "@/stores/threadCache";

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
const errorMessage = ref<string | null>(null);
// Always summarize all results - no longer needed
// const summarizeCount = ref(30);
const showSummaryModal = ref(false);

// Computed
const hasResults = computed(() => results.value.length > 0);
const canSearch = computed(() => query.value.trim().length > 0);
const canSummarize = computed(
  () => hasResults.value && !loading.value && !summaryLoading.value
);

const topKOptions = [
  { label: "Top 10", value: 10 },
  { label: "Top 20", value: 20 },
  { label: "Top 50", value: 50 },
  { label: "Top 100", value: 100 },
];

// No longer needed - always summarize all results
// const summarizeOptions = [];

// Helper function to format author name
function formatAuthorName(author: string): string {
  if (!author) return author;
  
  // Handle email format (e.g., john.doe@example.com)
  if (author.includes('@')) {
    const [localPart] = author.split('@');
    const parts = localPart.split('.');
    if (parts.length >= 2) {
      const firstName = parts[0];
      const lastName = parts[parts.length - 1];
      return `${firstName.charAt(0).toUpperCase() + firstName.slice(1)} ${lastName.charAt(0).toUpperCase()}.`;
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

// Sort results by score descending
const sortedResults = computed(() => {
  return [...results.value].sort((a, b) => b.score - a.score);
});

// Table columns
const columns: DataTableColumns<ResultItem> = [
  {
    title: "Time",
    key: "ts",
    width: 140,
    render(row) {
      return h(
        NTooltip,
        {},
        {
          trigger: () => h("span", {}, formatLocalTime(row.ts)),
          default: () => formatLocalTimeFull(row.ts),
        }
      );
    },
    sorter: (a, b) => Number.parseFloat(a.ts) - Number.parseFloat(b.ts),
  },
  {
    title: "Author",
    key: "author",
    width: 120,
    render(row) {
      return h("span", {}, formatAuthorName(row.author));
    },
  },
  {
    title: "Channel",
    key: "channel_name",
    width: 100,
    render(row) {
      return h(
        NTag,
        { size: "small" },
        { default: () => `#${row.channel_name || "unknown"}` }
      );
    },
  },
  {
    title: "Message",
    key: "text",
    render(row) {
      const hasThread = !!row.thread_root_ts && row.thread_root_ts !== row.ts;
      
      // Always show thread-style tooltip for consistency
      return h(
        NTooltip,
        {
          placement: "left",
          style: "max-width: 600px",
          contentStyle: "padding: 0",
        },
        {
          trigger: () => h(
            "div",
            { style: "display: flex; align-items: flex-start; gap: 6px; cursor: pointer; width: 100%" },
            [
              hasThread ? h(
                NIcon,
                { 
                  size: 14,
                  color: "var(--n-primary-color)",
                  style: "flex-shrink: 0; margin-top: 2px"
                },
                { default: () => h(ChatbubblesOutline) }
              ) : null,
              h(
                NEllipsis,
                {
                  lineClamp: 2,
                  style: "flex: 1; min-width: 0",
                  tooltip: false  // Disable built-in tooltip
                },
                { default: () => row.text }
              )
            ]
          ),
          default: () => {
            // Show thread preview if in thread, otherwise show single message in thread-style format
            if (hasThread) {
              return h(ThreadPreview, {
                channel_id: row.channel_id,
                thread_root_ts: row.thread_root_ts as string,
                highlight_ts: row.ts,
                eagerRow: row as any,
              });
            } else {
              // Show single message in thread-style container
              return h(
                "div",
                {
                  style: "border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background: var(--n-color); max-height: 400px; overflow: auto; min-width: 400px"
                },
                [
                  h(
                    "div",
                    { style: "padding: 6px 8px; border-radius: 6px" },
                    [
                      h(
                        "div",
                        { style: "font-size: 12px; color: var(--n-text-color-3); display: flex; gap: 8px" },
                        [
                          h("span", { style: "font-weight: 600; color: var(--n-text-color)" }, row.author),
                          h("span", {}, formatLocalTimeFull(row.ts))
                        ]
                      ),
                      h(
                        "div",
                        { style: "margin-top: 2px; white-space: pre-wrap" },
                        row.text
                      )
                    ]
                  )
                ]
              );
            }
          }
        }
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
    };

    const res = await searchMessages({ ...payload, includeThreads: true });
    results.value = res.results || [];

    // Ingest any eagerly returned threads into cache
    for (const r of results.value) {
      try {
        ingestRow(r as any);
      } catch {}
    }

    if (results.value.length === 0) {
      message.info("No results found. Try adjusting your search criteria.");
    } else {
      message.success(`Found ${results.value.length} results`);
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

  summaryLoading.value = true;
  errorMessage.value = null;
  showSummaryModal.value = true;
  loadingBar.start();

  try {
    // Summarize all current results
    const ids = sortedResults.value.map((r) => r.id);
    const res = await summarizeMessages(ids, query.value.trim());
    summaryText.value = res.summary;
    message.success("Summary generated successfully");
    loadingBar.finish();
  } catch (e) {
    console.error("Summarization error:", e);
    const msg = (e as Error).message || "Summarization failed";
    errorMessage.value = msg;
    message.error(msg);
    showSummaryModal.value = false;
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
}
</script>

<template>
  <div class="search-view">
    <!-- Search Controls -->
    <NCard title="Search Parameters" style="margin-bottom: 24px">
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
        <div class="results-header">
          <div class="results-title">
            <span>Search Results</span>
            <NBadge v-if="hasResults" :value="results.length" />
          </div>
          <NButton
            v-if="hasResults"
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
      </template>

      <template v-if="loading">
        <NSpin size="large" style="width: 100%; padding: 60px 0">
          <template #description>Searching messages...</template>
        </NSpin>
      </template>

      <template v-else-if="!hasResults && query">
        <NEmpty description="No results found" style="padding: 40px 0">
          <template #extra>
            <NButton size="small" @click="query = ''">
              Clear search
            </NButton>
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
      title="AI Summary"
      style="width: 600px; max-width: 90vw"
      :mask-closable="!summaryLoading"
      :closable="!summaryLoading"
      @after-leave="summaryText = null"
    >

      <div class="summary-modal-content">
        <template v-if="summaryLoading">
          <NSpin size="medium">
            <template #description> Generating summary... </template>
          </NSpin>
        </template>

        <template v-else-if="summaryText">
          <div class="summary-text">{{ summaryText }}</div>
        </template>
      </div>

      <template #footer>
        <NSpace justify="end">
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
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.search-view {
  max-width: 1400px;
  margin: 0 auto;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
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
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.summary-text {
  white-space: pre-wrap;
  line-height: 1.6;
  width: 100%;
  max-height: 400px;
  overflow-y: auto;
  padding: 12px;
  background: var(--n-color-embedded);
  border-radius: 6px;
}
</style>