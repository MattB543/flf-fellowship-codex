import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import SearchView from "./views/SearchView.vue";
import LinksView from "./views/LinksView.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", name: "search", component: SearchView },
  { path: "/links", name: "links", component: LinksView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
