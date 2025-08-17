<script setup lang="ts">
import { computed } from "vue";
import { NIcon, NTag } from "naive-ui";
import { ChatbubblesOutline, DocumentTextOutline } from "@vicons/ionicons5";

export interface SourceMetadata {
  chunk_type?: string;
  document_title?: string;
  section_title?: string;
  has_code?: boolean;
  has_tables?: boolean;
  hierarchy_level?: number;
}

const props = defineProps<{
  source: "slack" | "document" | string;
  metadata?: SourceMetadata;
  showDetails?: boolean;
}>();

const isSlack = computed(() => props.source === "slack");
const sourceLabel = computed(() => isSlack.value ? "Slack" : "Document");
const sourceIcon = computed(() => isSlack.value ? ChatbubblesOutline : DocumentTextOutline);
const sourceClass = computed(() => `source-${isSlack.value ? "slack" : "document"}`);
</script>

<template>
  <div :class="['source-badge', sourceClass]">
    <div class="badge-main">
      <NIcon :component="sourceIcon" size="16" />
      <span class="source-label">{{ sourceLabel }}</span>
      
      <!-- Document chunk type -->
      <NTag 
        v-if="!isSlack && metadata?.chunk_type" 
        size="tiny" 
        type="info"
        class="chunk-tag"
      >
        {{ metadata.chunk_type }}
      </NTag>
    </div>
    
    <!-- Document features -->
    <div v-if="!isSlack && showDetails && metadata" class="doc-features">
      <NTag 
        v-if="metadata.has_code" 
        size="tiny" 
        type="warning"
      >
        Code
      </NTag>
      <NTag 
        v-if="metadata.has_tables" 
        size="tiny" 
        type="success"
      >
        Tables
      </NTag>
      <NTag 
        v-if="metadata.hierarchy_level !== undefined" 
        size="tiny" 
        type="default"
      >
        Level {{ metadata.hierarchy_level }}
      </NTag>
    </div>
  </div>
</template>

<style scoped>
.source-badge {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.badge-main {
  display: flex;
  align-items: center;
  gap: 6px;
}

.source-badge.source-slack {
  border-left: 3px solid #4a90e2;
  padding-left: 8px;
}

.source-badge.source-document {
  border-left: 3px solid #2ea043;
  padding-left: 8px;
}

.source-label {
  font-weight: 500;
  font-size: 13px;
}

.chunk-tag {
  margin-left: 4px;
}

.doc-features {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-left: 22px;
}

.source-badge.source-slack .source-label {
  color: #4a90e2;
}

.source-badge.source-document .source-label {
  color: #2ea043;
}

@media (max-width: 768px) {
  .badge-main {
    font-size: 12px;
  }
  
  .doc-features {
    margin-left: 16px;
  }
}
</style>