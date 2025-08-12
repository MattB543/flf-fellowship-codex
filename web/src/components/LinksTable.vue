<script setup lang="ts">
const props = defineProps<{
  links: Array<{
    message_id: number;
    channel_id: string;
    channel_name: string | null;
    user_id: string | null;
    author: string;
    ts: string;
    url: string;
  }>;
}>();

function formatTs(ts: string) {
  const seconds = Number.parseFloat(ts);
  if (Number.isNaN(seconds)) return ts;
  return new Date(seconds * 1000).toUTCString();
}
</script>

<template>
  <table class="results">
    <thead>
      <tr>
        <th>Channel</th>
        <th>Author</th>
        <th>Time (UTC)</th>
        <th>URL</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in props.links" :key="row.message_id">
        <td>#{{ row.channel_name ?? "unknown" }}</td>
        <td>{{ row.author }}</td>
        <td class="mono">{{ formatTs(row.ts) }}</td>
        <td class="url">
          <a :href="row.url" target="_blank" rel="noopener noreferrer">{{
            row.url
          }}</a>
        </td>
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
.url {
  max-width: 640px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
