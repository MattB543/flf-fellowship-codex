<script setup lang="ts">
import { NCard, NSpace, NIcon } from "naive-ui";
import { SearchOutline, SparklesOutline } from "@vicons/ionicons5";

export interface QueryInsight {
  type: string;
  strategy: string;
  slackWeight: number;
  docWeight: number;
}

defineProps<{
  insights: QueryInsight | null;
}>();
</script>

<template>
  <div v-if="insights" class="query-insights">
    <NCard size="small">
      <NSpace :size="12" align="center" style="flex-wrap: wrap">
        <div class="insight-badge">
          <NIcon :component="SearchOutline" size="16" />
          <span>Query Type: {{ insights.type }}</span>
        </div>
        <div class="insight-badge">
          <NIcon :component="SparklesOutline" size="16" />
          <span>Strategy: {{ insights.strategy }}</span>
        </div>
        <div class="source-weights">
          <span class="weight slack">
            Slack: {{ insights.slackWeight }}%
          </span>
          <span class="weight docs">
            Docs: {{ insights.docWeight }}%
          </span>
        </div>
      </NSpace>
    </NCard>
  </div>
</template>

<style scoped>
.query-insights {
  margin-bottom: 16px;
}

.insight-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--n-color-embedded);
  border-radius: 6px;
  font-size: 13px;
  color: var(--n-text-color);
}

.source-weights {
  display: flex;
  gap: 12px;
  margin-left: 8px;
}

.weight {
  font-size: 13px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
}

.weight.slack {
  background: rgba(74, 144, 226, 0.1);
  color: #4a90e2;
}

.weight.docs {
  background: rgba(46, 160, 67, 0.1);
  color: #2ea043;
}

@media (max-width: 768px) {
  .source-weights {
    display: flex;
    gap: 8px;
    font-size: 12px;
    margin-left: 0;
    margin-top: 8px;
    width: 100%;
  }
}
</style>