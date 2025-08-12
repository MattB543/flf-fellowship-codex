import { ref, computed } from 'vue';

const STORAGE_KEY = 'flf_auth_token';
const AUTH_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD;

// State
const isAuthenticated = ref(false);
const isChecking = ref(true);

// Initialize from localStorage
function initAuth() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === AUTH_PASSWORD) {
    isAuthenticated.value = true;
  }
  isChecking.value = false;
}

// Authenticate with password
function authenticate(password: string): boolean {
  if (password === AUTH_PASSWORD) {
    localStorage.setItem(STORAGE_KEY, password);
    isAuthenticated.value = true;
    return true;
  }
  return false;
}

// Logout
function logout() {
  localStorage.removeItem(STORAGE_KEY);
  isAuthenticated.value = false;
}

// Computed
const needsAuth = computed(() => !isAuthenticated.value && !isChecking.value);

export {
  isAuthenticated,
  isChecking,
  needsAuth,
  initAuth,
  authenticate,
  logout,
};