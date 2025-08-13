<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { ensureThread } from "@/stores/threadCache";
import type { ThreadMessage } from "@/api/client";

const props = defineProps<{
  channel_id: string;
  thread_root_ts: string;
  highlight_ts?: string | null;
  eagerRow?: { thread?: ThreadMessage[] } | null;
}>();

const loading = ref(false);
const messages = ref<ThreadMessage[]>([]);

async function load() {
  loading.value = true;
  try {
    const row = {
      channel_id: props.channel_id,
      thread_root_ts: props.thread_root_ts,
      thread: props.eagerRow?.thread,
    } as any;
    const msgs = (await ensureThread(row)) as ThreadMessage[];
    messages.value = msgs;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => [props.channel_id, props.thread_root_ts], load);

function isHighlighted(ts: string) {
  return props.highlight_ts && props.highlight_ts === ts;
}

// Hardcoded user ID mappings
const USER_ID_MAPPINGS: Record<string, string> = {
  U09934RTP4J: "TownCrier Bot",
  U097861Q495: "Jay Baxter",
};

function formatAuthor(author: string): string {
  if (!author) return author;
  return USER_ID_MAPPINGS[author] || author;
}

function formatTs(ts: string) {
  const seconds = Number.parseFloat(ts);
  if (Number.isNaN(seconds)) return ts;
  const date = new Date(seconds * 1000);
  // Render without seconds for a cleaner look
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
</script>

<template>
  <div class="thread-preview">
    <div v-if="loading" class="loading">Loading thread…</div>
    <div v-else>
      <div
        v-for="m in messages"
        :key="m.id"
        class="msg"
        :class="{ hl: isHighlighted(m.ts) }"
      >
        <div class="meta">
          <span class="author">{{ formatAuthor(m.author) }}</span>
          <span class="time">{{ formatTs(m.ts) }}</span>
        </div>
        <div class="text">{{ m.text }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.thread-preview {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px;
  background: var(--n-color);
  max-height: 540px;
  overflow: auto;
}
.msg {
  padding: 6px 8px;
  border-radius: 6px;
}
.msg:not(.hl) {
  background: rgba(255, 255, 255, 0.12);
}
.msg + .msg {
  margin-top: 4px;
}
.msg.hl {
  background: rgba(99, 102, 241, 0.12);
}
.meta {
  font-size: 12px;
  color: var(--n-text-color-3);
  display: flex;
  gap: 8px;
}
.author {
  font-weight: 600;
  color: var(--n-text-color);
}
.text {
  margin-top: 2px;
  white-space: pre-wrap;
}
.loading {
  color: var(--n-text-color-3);
}
</style>
