<script setup lang="ts">
import { NBadge, NSpace } from "naive-ui";

export interface SearchStats {
  total: number;
  slackCount: number;
  docCount: number;
  avgScore: number;
}

defineProps<{
  stats: SearchStats | null;
  isAdvancedMode: boolean;
  isLoading?: boolean;
}>();

</script>

<template>
  <div class="results-stats">
    <div class="stats-title">
      <span>Search Results</span>
      <NSpace v-if="stats" :size="8">
        <NBadge :value="stats.slackCount" color="#4a90e2">
          <template #value>{{ stats.slackCount }}</template>
        </NBadge>
        <span class="badge-label">Slack</span>
        <NBadge :value="stats.docCount" color="#2ea043">
          <template #value>{{ stats.docCount }}</template>
        </NBadge>
        <span class="badge-label">Docs</span>
      </NSpace>
    </div>
    
    <div v-if="isLoading" class="loading-indicator">
      Searching...
    </div>
  </div>
</template>

<style scoped>
.results-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stats-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
  font-size: 16px;
}

.badge-label {
  font-size: 12px;
  color: var(--n-text-color-2);
  margin-left: -4px;
}

.stats-breakdown {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: var(--n-text-color-2);
}

.stat-item {
  color: var(--n-text-color-2);
}


.loading-indicator {
  font-size: 13px;
  color: var(--n-text-color-3);
  font-style: italic;
}

@media (max-width: 768px) {
  .stats-breakdown {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .stats-title {
    font-size: 14px;
  }
}
</style>