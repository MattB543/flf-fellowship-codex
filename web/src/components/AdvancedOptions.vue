<script setup lang="ts">
import { NTooltip, NIcon } from "naive-ui";
import { InformationCircleOutline } from "@vicons/ionicons5";

export interface AdvancedSearchOptions {
  enableRecencyBoost: boolean;
  enableContextExpansion: boolean;
  includeDocumentSummaries: boolean;
}

defineProps<{
  modelValue: AdvancedSearchOptions;
  visible: boolean;
  inline?: boolean;
}>();

defineEmits<{
  (e: "update:modelValue", value: AdvancedSearchOptions): void;
}>();

function updateOption<K extends keyof AdvancedSearchOptions>(
  key: K,
  value: AdvancedSearchOptions[K],
  currentValue: AdvancedSearchOptions
) {
  const updated = { ...currentValue, [key]: value };
  return updated;
}

const tooltips = {
  enableRecencyBoost: "When enabled, search results will prioritize newer messages and documents over older ones. This is particularly useful when looking for the latest discussions, recent decisions, or up-to-date information. Newer content gets a scoring boost based on its creation date.",
  enableContextExpansion: "Includes surrounding context when retrieving search results, such as messages before and after the matched content, or related document sections. This helps you understand the full conversation flow or document structure, providing better context for decision-making rather than isolated snippets.",
  includeDocumentSummaries: "Adds document summary content to the searchable index, allowing you to discover relevant documents based on their overall themes and topics. This means you can find documents even when your exact search terms don't appear in the main content, but are covered in the document's summary or abstract."
};
</script>

<template>
  <div v-if="visible" :class="['advanced-options', { inline }]">
    <div v-if="!inline" class="options-title">Advanced Options:</div>
    <div :class="inline ? 'options-inline' : 'options-grid'">
      <label class="checkbox-option">
        <input
          type="checkbox"
          :checked="modelValue.enableRecencyBoost"
          @change="$emit('update:modelValue', updateOption('enableRecencyBoost', ($event.target as HTMLInputElement).checked, modelValue))"
        />
        <span class="option-label">Boost Recent Content</span>
        <NTooltip 
          trigger="hover" 
          placement="bottom"
          style="max-width: 300px"
        >
          <template #trigger>
            <NIcon 
              :component="InformationCircleOutline" 
              size="14" 
              class="info-icon"
            />
          </template>
          {{ tooltips.enableRecencyBoost }}
        </NTooltip>
      </label>
      
      <label class="checkbox-option">
        <input
          type="checkbox"
          :checked="modelValue.enableContextExpansion"
          @change="$emit('update:modelValue', updateOption('enableContextExpansion', ($event.target as HTMLInputElement).checked, modelValue))"
        />
        <span class="option-label">Expand Context</span>
        <NTooltip 
          trigger="hover" 
          placement="bottom"
          style="max-width: 300px"
        >
          <template #trigger>
            <NIcon 
              :component="InformationCircleOutline" 
              size="14" 
              class="info-icon"
            />
          </template>
          {{ tooltips.enableContextExpansion }}
        </NTooltip>
      </label>
      
      <label class="checkbox-option">
        <input
          type="checkbox"
          :checked="modelValue.includeDocumentSummaries"
          @change="$emit('update:modelValue', updateOption('includeDocumentSummaries', ($event.target as HTMLInputElement).checked, modelValue))"
        />
        <span class="option-label">Include Document Summaries</span>
        <NTooltip 
          trigger="hover" 
          placement="bottom"
          style="max-width: 300px"
        >
          <template #trigger>
            <NIcon 
              :component="InformationCircleOutline" 
              size="14" 
              class="info-icon"
            />
          </template>
          {{ tooltips.includeDocumentSummaries }}
        </NTooltip>
      </label>
    </div>
  </div>
</template>

<style scoped>
.advanced-options {
  padding: 16px;
  background: var(--n-color-embedded);
  border-radius: 8px;
  border: 1px solid var(--n-border-color);
  margin-top: 8px;
}

.advanced-options.inline {
  padding: 0;
  background: none;
  border: none;
  margin: 0;
}

.options-title {
  font-weight: 500;
  font-size: 14px;
  color: var(--n-text-color);
  margin-bottom: 12px;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.options-inline {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.checkbox-option {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background-color 0.2s;
  gap: 8px;
}

.checkbox-option:hover {
  background-color: var(--n-color);
}

.checkbox-option input[type="checkbox"] {
  margin: 0;
  flex-shrink: 0;
}

.option-label {
  font-weight: 500;
  color: var(--n-text-color);
  font-size: 14px;
  flex: 1;
}

.advanced-options.inline .option-label {
  font-size: 13px;
}

.info-icon {
  color: var(--n-text-color-3);
  cursor: help;
  flex-shrink: 0;
  transition: color 0.2s;
}

.info-icon:hover {
  color: var(--n-primary-color);
}

@media (max-width: 768px) {
  .advanced-options {
    padding: 12px;
  }
  
  .advanced-options.inline {
    padding: 0;
  }
  
  .options-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .options-inline {
    flex-direction: column;
    gap: 8px;
  }
  
  .checkbox-option {
    padding: 6px 8px;
  }
  
  .option-label {
    font-size: 13px;
  }
  
  .advanced-options.inline .option-label {
    font-size: 12px;
  }
}
</style>