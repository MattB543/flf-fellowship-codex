<script setup lang="ts">
import { ref, h } from "vue";
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
  NSpin,
  NInputNumber,
  NGrid,
  NGridItem,
  NIcon,
  useMessage,
  useLoadingBar,
  NTooltip,
  NEllipsis,
} from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import {
  LinkOutline,
  PersonOutline,
  TimeOutline,
  OpenOutline,
  SearchOutline,
  RefreshOutline,
} from "@vicons/ionicons5";
import { format } from "date-fns";
import { fetchLinks } from "@/api/client";
import ThreadPreview from "@/components/ThreadPreview.vue";
import { ingestRow } from "@/stores/threadCache";

type LinkItem = Awaited<ReturnType<typeof fetchLinks>> extends {
  links: infer R;
}
  ? R extends Array<infer U>
    ? U
    : never
  : never;

const message = useMessage();
const loadingBar = useLoadingBar();

// State
const channelId = ref("");
const userId = ref("");
const dateRange = ref<[number, number] | null>(null);
const limit = ref(100);
const offset = ref(0);
const loading = ref(false);
const links = ref<LinkItem[]>([]);
const hasSearched = ref(false);

const limitOptions = [
  { label: "50 links", value: 50 },
  { label: "100 links", value: 100 },
  { label: "200 links", value: 200 },
  { label: "500 links", value: 500 },
  { label: "1000 links", value: 1000 },
];

// Hardcoded user ID mappings
const USER_ID_MAPPINGS: Record<string, string> = {
  'U09934RTP4J': 'TownCrier Bot',
  'U097861Q495': 'Jay Baxter',
};

function formatAuthorName(author: string): string {
  if (!author) return author;
  return USER_ID_MAPPINGS[author] || author;
}

// Table columns
const columns: DataTableColumns<LinkItem> = [
  {
    type: "expand",
    expandable: (row) => !!row.thread_root_ts,
    renderExpand: (row) =>
      h(ThreadPreview, {
        channel_id: row.channel_id,
        thread_root_ts: row.thread_root_ts as string,
        highlight_ts: row.ts,
        eagerRow: row as any,
      }),
  },
  {
    title: "Channel",
    key: "channel_name",
    width: 150,
    render(row) {
      return h(
        NTag,
        { size: "small" },
        { default: () => `#${row.channel_name || "unknown"}` }
      );
    },
    filterOptions: [],
    filter: true,
  },
  {
    title: "Author",
    key: "author",
    width: 150,
    render(row) {
      return h(
        NSpace,
        { size: 4, align: "center" },
        {
          default: () => [
            h(NIcon, { size: 14 }, { default: () => h(PersonOutline) }),
            h("span", {}, formatAuthorName(row.author)),
          ],
        }
      );
    },
    filterOptions: [],
    filter: true,
  },
  {
    title: "Time",
    key: "ts",
    width: 180,
    render(row) {
      const seconds = Number.parseFloat(row.ts);
      if (Number.isNaN(seconds)) return row.ts;
      const date = new Date(seconds * 1000);
      return h(
        NTooltip,
        {},
        {
          trigger: () =>
            h(
              NSpace,
              { size: 4, align: "center" },
              {
                default: () => [
                  h(NIcon, { size: 14 }, { default: () => h(TimeOutline) }),
                  h("span", {}, format(date, "MMM d, yyyy HH:mm")),
                ],
              }
            ),
          default: () => format(date, "PPpp"),
        }
      );
    },
    sorter: (a, b) => Number.parseFloat(a.ts) - Number.parseFloat(b.ts),
    defaultSortOrder: "descend",
  },
  {
    title: "URL",
    key: "url",
    render(row) {
      // Extract domain from URL for display
      try {
        const url = new URL(row.url);
        url.hostname; // Just to validate URL
      } catch {}

      return h(
        NSpace,
        { align: "center" },
        {
          default: () => [
            h(
              NEllipsis,
              {
                style: "max-width: 400px",
                tooltip: true,
              },
              { default: () => row.url }
            ),
            h(
              "a",
              {
                href: row.url,
                target: "_blank",
                rel: "noopener noreferrer",
              },
              [h(NIcon, { size: 16 }, { default: () => h(OpenOutline) })]
            ),
          ],
        }
      );
    },
  },
];

// Methods
async function loadLinks() {
  loading.value = true;
  hasSearched.value = true;
  loadingBar.start();

  try {
    const res = await fetchLinks({
      channel_id: channelId.value || undefined,
      user_id: userId.value || undefined,
      dateFrom: dateRange.value?.[0]
        ? new Date(dateRange.value[0]).toISOString()
        : undefined,
      dateTo: dateRange.value?.[1]
        ? new Date(dateRange.value[1]).toISOString()
        : undefined,
      limit: limit.value,
      offset: offset.value,
      includeThreads: false,
    });

    links.value = res.links ?? [];

    // Ingest any eagerly returned threads if we ever toggle includeThreads=true
    for (const r of links.value) {
      try {
        ingestRow(r as any);
      } catch {}
    }

    if (links.value.length === 0) {
      message.info("No links found with the current filters");
    } else {
      message.success(`Loaded ${links.value.length} links`);
    }

    loadingBar.finish();
  } catch (e) {
    console.error(e);
    const msg = (e as Error).message || "";

    if (msg.startsWith("401")) {
      message.error(
        "Authentication failed. Please check your API token configuration."
      );
    } else {
      message.error(msg || "Failed to load links");
    }

    links.value = [];
    loadingBar.error();
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  channelId.value = "";
  userId.value = "";
  dateRange.value = null;
  limit.value = 100;
  offset.value = 0;
}

// Extract unique domains for statistics
function getUniqueDomains() {
  const domains = new Set<string>();
  links.value.forEach((link) => {
    try {
      const url = new URL(link.url);
      domains.add(url.hostname);
    } catch {}
  });
  return domains.size;
}
</script>

<template>
  <div class="links-view">
    <!-- Filter Controls -->
    <NCard title="Filter Links" style="margin-bottom: 24px">
      <NGrid :cols="24" :x-gap="12" :y-gap="16">
        <NGridItem :span="6">
          <NInput
            v-model:value="channelId"
            placeholder="Channel ID (optional)"
            clearable
          >
            <template #prefix>
              <NIcon :component="LinkOutline" />
            </template>
          </NInput>
        </NGridItem>

        <NGridItem :span="6">
          <NInput
            v-model:value="userId"
            placeholder="User ID (optional)"
            clearable
          >
            <template #prefix>
              <NIcon :component="PersonOutline" />
            </template>
          </NInput>
        </NGridItem>

        <NGridItem :span="12">
          <NDatePicker
            v-model:value="dateRange"
            type="datetimerange"
            clearable
            style="width: 100%"
            placeholder="Select date range (optional)"
          />
        </NGridItem>

        <NGridItem :span="4">
          <NSelect
            v-model:value="limit"
            :options="limitOptions"
            placeholder="Limit"
          />
        </NGridItem>

        <NGridItem :span="4">
          <NInputNumber
            v-model:value="offset"
            :min="0"
            placeholder="Offset"
            style="width: 100%"
          />
        </NGridItem>

        <NGridItem :span="8">
          <NSpace>
            <NButton type="primary" :loading="loading" @click="loadLinks">
              <template #icon>
                <NIcon :component="SearchOutline" />
              </template>
              Load Links
            </NButton>

            <NButton quaternary @click="resetFilters">
              <template #icon>
                <NIcon :component="RefreshOutline" />
              </template>
              Reset
            </NButton>
          </NSpace>
        </NGridItem>

        <NGridItem :span="8">
          <div class="filter-hint">
            💡 Leave filters empty to load all links
          </div>
        </NGridItem>
      </NGrid>
    </NCard>

    <!-- Statistics -->
    <NCard v-if="links.length > 0" style="margin-bottom: 24px">
      <NSpace :size="24">
        <div class="stat">
          <div class="stat-value">{{ links.length }}</div>
          <div class="stat-label">Total Links</div>
        </div>
        <div class="stat">
          <div class="stat-value">{{ getUniqueDomains() }}</div>
          <div class="stat-label">Unique Domains</div>
        </div>
        <div class="stat" v-if="links.length > 0">
          <div class="stat-value">
            {{
              format(
                new Date(Number.parseFloat(links[0].ts) * 1000),
                "MMM d, yyyy"
              )
            }}
          </div>
          <div class="stat-label">Most Recent</div>
        </div>
      </NSpace>
    </NCard>

    <!-- Results Table -->
    <NCard title="Links">
      <template v-if="loading">
        <NSpin size="large" style="width: 100%; padding: 60px 0">
          <template #description>Loading links...</template>
        </NSpin>
      </template>

      <template v-else-if="!hasSearched">
        <NEmpty
          description="Configure filters and click 'Load Links' to get started"
          style="padding: 40px 0"
        >
          <template #icon>
            <NIcon :component="LinkOutline" size="48" />
          </template>
        </NEmpty>
      </template>

      <template v-else-if="links.length === 0">
        <NEmpty description="No links found" style="padding: 40px 0">
          <template #extra>
            <NButton size="small" @click="resetFilters">
              Reset filters
            </NButton>
          </template>
        </NEmpty>
      </template>

      <NDataTable
        v-else
        :columns="columns"
        :data="links"
        :pagination="{
          pageSize: 20,
          showSizePicker: true,
          pageSizes: [20, 50, 100, 200],
        }"
        :bordered="false"
        striped
      />
    </NCard>
  </div>
</template>

<style scoped>
.links-view {
  max-width: 1400px;
  margin: 0 auto;
}

.filter-hint {
  padding: 6px 10px;
  background: rgba(64, 158, 255, 0.1);
  border-radius: 6px;
  font-size: 13px;
  color: var(--n-text-color);
}

.stat {
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--n-primary-color);
}

.stat-label {
  font-size: 13px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}
</style>
