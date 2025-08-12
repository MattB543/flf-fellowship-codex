<script setup lang="ts">
const props = defineProps<{
  loading: boolean;
  summary: string | null;
}>();

async function onCopy() {
  try {
    if (props.summary) {
      await window.navigator.clipboard.writeText(props.summary);
    }
  } catch (e) {
    console.error(e);
  }
}
</script>

<template>
  <div class="panel">
    <div v-if="props.loading" class="loading">Summarizing…</div>
    <div v-else-if="props.summary" class="content">
      <pre>{{ props.summary }}</pre>
      <button class="copy" @click="onCopy">Copy</button>
    </div>
    <div v-else class="placeholder">No summary yet</div>
  </div>
</template>

<style scoped>
.panel {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  background: #fafafa;
}
.loading {
  color: #6b7280;
}
.placeholder {
  color: #9ca3af;
}
.content pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}
.copy {
  margin-top: 8px;
}
</style>
