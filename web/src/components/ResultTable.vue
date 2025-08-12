<script setup lang="ts">
const props = defineProps<{
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
}>();

defineEmits<{
  (e: "toggleSelect", id: number): void;
}>();

function formatScore(score: number) {
  return (Math.round(score * 1000) / 1000).toFixed(3);
}

function formatTs(ts: string) {
  // Slack ts like "1754894653.454789": seconds.microseconds
  const seconds = Number.parseFloat(ts);
  if (Number.isNaN(seconds)) return ts;
  return new Date(seconds * 1000).toUTCString();
}
</script>

<template>
  <table class="results">
    <thead>
      <tr>
        <th>Score</th>
        <th>Channel</th>
        <th>Author</th>
        <th>Time (UTC)</th>
        <th>Snippet</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in props.results" :key="row.id">
        <td class="mono">{{ formatScore(row.score) }}</td>
        <td>#{{ row.channel_name ?? "unknown" }}</td>
        <td>{{ row.author }}</td>
        <td class="mono">{{ formatTs(row.ts) }}</td>
        <td class="snippet" :title="row.text">{{ row.text }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.results {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 8px;
  border-bottom: 1px solid #eee;
  vertical-align: top;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
}
.snippet {
  max-width: 640px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
