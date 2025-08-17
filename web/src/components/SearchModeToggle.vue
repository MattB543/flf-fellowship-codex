<script setup lang="ts">
import { NSpace, NTag } from "naive-ui";

defineProps<{
  modelValue: "legacy" | "advanced";
}>();

defineEmits<{
  (e: "update:modelValue", value: "legacy" | "advanced"): void;
}>();
</script>

<template>
  <div class="search-mode-toggle">
    <span class="toggle-label">Search Mode:</span>
    <NSpace :size="16">
      <label class="toggle-option">
        <input
          type="radio"
          :value="'legacy'"
          :checked="modelValue === 'legacy'"
          @change="$emit('update:modelValue', 'legacy')"
          name="searchMode"
        />
        <span>Legacy Search</span>
      </label>
      <label class="toggle-option">
        <input
          type="radio"
          :value="'advanced'"
          :checked="modelValue === 'advanced'"
          @change="$emit('update:modelValue', 'advanced')"
          name="searchMode"
        />
        <span>Advanced Hybrid</span>
        <NTag size="small" type="success" style="margin-left: 6px">
          NEW
        </NTag>
      </label>
    </NSpace>
  </div>
</template>

<style scoped>
.search-mode-toggle {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.toggle-label {
  font-weight: 500;
  color: var(--n-text-color);
}

.toggle-option {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: background-color 0.2s;
  gap: 8px;
}

.toggle-option:hover {
  background-color: var(--n-color-embedded);
}

.toggle-option input[type="radio"] {
  margin: 0;
}
</style>