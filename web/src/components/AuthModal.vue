<script setup lang="ts">
import { ref } from 'vue';
import { 
  NModal, 
  NCard, 
  NInput, 
  NButton, 
  NSpace, 
  NIcon,
  NText,
  useMessage 
} from 'naive-ui';
import { LockClosedOutline, KeyOutline } from '@vicons/ionicons5';
import { authenticate, needsAuth } from '@/stores/authStore';

const message = useMessage();
const password = ref('');
const loading = ref(false);
const error = ref(false);

async function handleSubmit() {
  if (!password.value.trim()) {
    message.warning('Please enter a password');
    return;
  }

  loading.value = true;
  error.value = false;

  // Simulate slight delay for UX
  await new Promise(resolve => setTimeout(resolve, 300));

  const success = authenticate(password.value);
  
  if (success) {
    message.success('Authentication successful');
    password.value = '';
  } else {
    error.value = true;
    message.error('Invalid password');
  }
  
  loading.value = false;
}

function handleKeypress(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleSubmit();
  }
}
</script>

<template>
  <NModal
    :show="needsAuth"
    :mask-closable="false"
    :closable="false"
    transform-origin="center"
  >
    <NCard
      style="width: 400px; max-width: 90vw"
      title="Authentication Required"
      :bordered="false"
      size="large"
      role="dialog"
      aria-modal="true"
    >
      <template #header>
        <NSpace align="center" :size="12">
          <NIcon :size="24" color="var(--n-primary-color)">
            <LockClosedOutline />
          </NIcon>
          <span>Authentication Required</span>
        </NSpace>
      </template>

      <NSpace vertical :size="20">
        <NText depth="3">
          Please enter the access password to continue
        </NText>

        <NInput
          v-model:value="password"
          type="password"
          placeholder="Enter password"
          size="large"
          :status="error ? 'error' : undefined"
          @keypress="handleKeypress"
          :disabled="loading"
          autofocus
        >
          <template #prefix>
            <NIcon :component="KeyOutline" />
          </template>
        </NInput>

        <NButton
          type="primary"
          size="large"
          block
          :loading="loading"
          @click="handleSubmit"
        >
          {{ loading ? 'Authenticating...' : 'Unlock' }}
        </NButton>
      </NSpace>
    </NCard>
  </NModal>
</template>