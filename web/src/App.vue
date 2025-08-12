<script setup lang="ts">
import { h, computed, ref, onMounted } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  NConfigProvider,
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NSpace,
  NMenu,
  NButton,
  NIcon,
  NMessageProvider,
  NNotificationProvider,
  NDialogProvider,
  NLoadingBarProvider,
  darkTheme,
  lightTheme,
  GlobalThemeOverrides,
  MenuOption,
} from "naive-ui";
import {
  SearchOutline,
  LinkOutline,
  MoonOutline,
  SunnyOutline,
} from "@vicons/ionicons5";
import { useLocalStorage } from "@vueuse/core";
import AuthModal from "@/components/AuthModal.vue";
import { initAuth, isAuthenticated } from "@/stores/authStore";

const route = useRoute();
const isDark = useLocalStorage("theme-dark", false);

const theme = computed(() => (isDark.value ? darkTheme : lightTheme));

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#4F46E5",
    primaryColorHover: "#4338CA",
    primaryColorPressed: "#3730A3",
    borderRadius: "8px",
  },
};

const menuOptions: MenuOption[] = [
  {
    label: () =>
      h(
        RouterLink,
        {
          to: "/",
        },
        { default: () => "Search" }
      ),
    key: "search",
    icon: () => h(NIcon, null, { default: () => h(SearchOutline) }),
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: "/links",
        },
        { default: () => "Links" }
      ),
    key: "links",
    icon: () => h(NIcon, null, { default: () => h(LinkOutline) }),
  },
];

const activeKey = computed(() => {
  if (route.path === "/") return "search";
  if (route.path === "/links") return "links";
  return null;
});

function toggleTheme() {
  isDark.value = !isDark.value;
}

// Initialize auth on mount
onMounted(() => {
  initAuth();
});
</script>

<template>
  <NConfigProvider :theme="theme" :theme-overrides="themeOverrides">
    <NLoadingBarProvider>
      <NMessageProvider>
        <NNotificationProvider>
          <NDialogProvider>
            <NLayout style="height: 100vh">
              <NLayoutHeader bordered style="height: 64px; padding: 0 24px">
                <div class="header-content">
                  <div class="header-left">
                    <h2 class="app-title">FLF Fellowship Codex</h2>
                    <NMenu
                      mode="horizontal"
                      :value="activeKey"
                      :options="menuOptions"
                      style="margin-left: 32px"
                    />
                  </div>
                  <NButton
                    circle
                    quaternary
                    @click="toggleTheme"
                    style="font-size: 18px"
                  >
                    <template #icon>
                      <NIcon>
                        <SunnyOutline v-if="isDark" />
                        <MoonOutline v-else />
                      </NIcon>
                    </template>
                  </NButton>
                </div>
              </NLayoutHeader>
              <NLayoutContent
                content-style="padding: 24px; height: calc(100vh - 64px); overflow: auto;"
              >
                <router-view v-slot="{ Component }" v-if="isAuthenticated">
                  <transition name="fade" mode="out-in">
                    <component :is="Component" />
                  </transition>
                </router-view>
                <div v-else style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--n-text-color-3)">
                  Please authenticate to continue
                </div>
              </NLayoutContent>
            </NLayout>
            <AuthModal />
          </NDialogProvider>
        </NNotificationProvider>
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>

<style scoped>
.header-content {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
}

.app-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
}

* {
  box-sizing: border-box;
}
</style>
