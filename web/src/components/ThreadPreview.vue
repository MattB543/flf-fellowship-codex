<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { ensureThread, getCached, type ThreadKey } from "@/stores/threadCache";
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

function formatTs(ts: string) {
  const seconds = Number.parseFloat(ts);
  if (Number.isNaN(seconds)) return ts;
  return new Date(seconds * 1000).toLocaleString();
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
          <span class="author">{{ m.author }}</span>
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
  max-height: 320px;
  overflow: auto;
}
.msg {
  padding: 6px 8px;
  border-radius: 6px;
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
