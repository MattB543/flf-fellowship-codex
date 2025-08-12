<script setup lang="ts">
import { ref, watch, computed } from "vue";

export type Filters = {
  query: string;
  topK: number;
  dateFrom?: string;
  dateTo?: string;
  channels?: string[];
};

const props = defineProps<{
  modelValue: Filters;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: Filters): void;
  (e: "submit"): void;
}>();

const local = ref<Filters>({ ...props.modelValue });

watch(
  () => props.modelValue,
  (v) => {
    local.value = { ...v };
  },
  { deep: true }
);

watch(local, (v) => emit("update:modelValue", { ...v }), { deep: true });

const canSubmit = computed(() => local.value.query.trim().length > 0);

function onSubmit(e: Event) {
  e.preventDefault();
  if (canSubmit.value) emit("submit");
}
</script>

<template>
  <form class="filters" @submit="onSubmit">
    <input
      class="query"
      v-model="local.query"
      type="text"
      placeholder="Search Slack..."
      required
    />
    <select v-model.number="local.topK" class="topk">
      <option :value="10">Top 10</option>
      <option :value="20">Top 20</option>
      <option :value="50">Top 50</option>
      <option :value="100">Top 100</option>
    </select>
    <input v-model="local.dateFrom" type="datetime-local" class="from" />
    <input v-model="local.dateTo" type="datetime-local" class="to" />
    <button class="go" type="submit" :disabled="!canSubmit">Search</button>
  </form>
  <div class="hint">Press Enter to search</div>
  <div class="tz-hint">Dates are interpreted in your local timezone.</div>
  <slot />
</template>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: 1fr auto auto auto auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}
.query {
  padding: 8px 10px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
}
.topk,
.from,
.to,
.go {
  height: 36px;
}
.hint {
  color: #6b7280;
  font-size: 12px;
  margin-bottom: 8px;
}
.tz-hint {
  color: #9ca3af;
  font-size: 12px;
  margin-bottom: 12px;
}
</style>
