<script setup lang="ts">
/**
 * 应用外壳：导航（桌面侧栏 / 手机悬浮底栏）、顶部行、页面切换、全局提示与外观面板。
 * 各页面在 src/views/ 里。
 */
import { computed, ref, watch } from 'vue'
import Logo from './Logo.vue'
import Splash from './Splash.vue'
import TabBar from './TabBar.vue'
import AppearancePanel from './AppearancePanel.vue'
import ShaderBg from './fx/ShaderBg.vue'
import Particles from './fx/Particles.vue'
import Cursor from './fx/Cursor.vue'
import { fx } from './fx/settings'
import HomeView from './views/HomeView.vue'
import PostView from './views/PostView.vue'
import ProjectsView from './views/ProjectsView.vue'
import GuestbookView from './views/GuestbookView.vue'
import LinksView from './views/LinksView.vue'
import AboutView from './views/AboutView.vue'
import AdminView from './views/AdminView.vue'
import { allPosts } from './content'
import { refreshFromGitHub } from './profile'
import { back, initRouter, navigate, onRouteChange, route, type View } from './router'
import { site } from './site.config'
import { adminKey, errorMsg, loadRemotePosts, loadSummary, startAutoRefresh } from './store'
import { dark, toggleDark } from './theme'

initRouter()
refreshFromGitHub()
loadSummary()
loadRemotePosts()
startAutoRefresh()

const views = { home: HomeView, post: PostView, projects: ProjectsView, guestbook: GuestbookView, links: LinksView, about: AboutView, admin: AdminView }
const titles: Record<View, string> = { home: '', post: '', projects: '我的项目', guestbook: '留言板', links: '友情链接', about: '关于我', admin: '管理后台' }

/* 标题与描述随路由更新（分享卡片的静态版本由构建时预渲染生成） */
const currentPost = computed(() => (route.view === 'post' ? allPosts.value.find((p) => p.id === route.postId) : undefined))
watch(
  () => [route.view, currentPost.value?.title],
  () => {
    document.title = currentPost.value ? `${currentPost.value.title} · ${site.name}` : titles[route.view] ? `${titles[route.view]} · ${site.name}` : site.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', currentPost.value?.excerpt ?? site.description)
  },
  { immediate: true },
)

/* 手机底栏：向下滚动隐藏，向上滚动时出现 */
const navHidden = ref(false)
let lastY = window.scrollY
addEventListener('scroll', () => {
  const y = window.scrollY
  if (Math.abs(y - lastY) < 8) return
  navHidden.value = y > lastY && y > 80
  lastY = y
}, { passive: true })
onRouteChange(() => (navHidden.value = false))

const baseNav = [
  { key: 'home', label: '文章', icon: 'article' },
  { key: 'projects', label: '项目', icon: 'deployed_code' },
  { key: 'guestbook', label: '留言', icon: 'forum' },
  { key: 'links', label: '友链', icon: 'link' },
  { key: 'about', label: '关于', icon: 'person' },
] as const
const navItems = computed(() => (adminKey.value ? [...baseNav, { key: 'admin', label: '管理', icon: 'shield_person' } as const] : baseNav))
/** 文章页高亮“文章”导航 */
const activeNav = computed(() => (route.view === 'post' ? 'home' : route.view))
const go = (k: string) => navigate(k as View)

const showAppearance = ref(false)
</script>

<template>
  <Splash />
  <ShaderBg v-if="fx.level !== 'off'" :key="'bg-' + fx.level" :lite="fx.level === 'lite'" />
  <Particles v-if="fx.level !== 'off'" :key="'pt-' + fx.level" :lite="fx.level === 'lite'" />
  <Cursor v-if="fx.level === 'full'" />

  <div class="min-h-screen md:pl-20">
    <!-- 桌面侧栏 -->
    <nav class="fixed inset-y-0 left-0 z-20 hidden w-20 flex-col items-center gap-3 bg-surface/80 py-6 backdrop-blur-xl md:flex" aria-label="主导航">
      <button class="group mb-6 grid size-12 place-items-center rounded-2xl bg-surface-container p-2.5 text-on-surface" aria-label="首页" @click="go('home')"><Logo mark class="size-full" /></button>
      <button v-for="n in navItems" :key="n.key" class="group flex flex-col items-center gap-1" @click="go(n.key)">
        <span class="state grid h-8 w-14 place-items-center rounded-full transition-colors duration-300" :class="activeNav === n.key ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'">
          <span class="icon" :class="{ fill: activeNav === n.key }">{{ n.icon }}</span>
        </span>
        <span class="text-xs font-medium" :class="activeNav === n.key ? 'text-on-surface' : 'text-on-surface-variant'">{{ n.label }}</span>
      </button>
      <button class="state mt-auto grid size-12 place-items-center rounded-full text-on-surface-variant" aria-label="外观设置" @click="showAppearance = true"><span class="icon">palette</span></button>
      <button class="state grid size-12 place-items-center rounded-full text-on-surface-variant" :aria-label="dark ? '浅色模式' : '深色模式'" @click="toggleDark"><span class="icon">{{ dark ? 'light_mode' : 'dark_mode' }}</span></button>
    </nav>

    <main class="mx-auto max-w-5xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:px-8 md:pb-12">
      <!-- 顶部行：不吸顶、无背景，作为页面内容的开头 -->
      <div class="flex h-16 items-center gap-1 pt-[env(safe-area-inset-top)] md:h-24">
        <button v-if="route.view === 'post'" class="state -ml-2 flex h-10 items-center gap-1 rounded-full pr-4 pl-2 text-sm font-medium text-on-surface-variant" @click="back">
          <span class="icon">arrow_back</span>返回
        </button>
        <h1 v-else-if="route.view === 'home'" class="text-on-surface"><Logo class="h-7 w-auto md:h-10" /><span class="sr-only">{{ site.title }}</span></h1>
        <button class="state ml-auto grid size-10 place-items-center rounded-full text-on-surface-variant md:hidden" aria-label="外观设置" @click="showAppearance = true"><span class="icon">palette</span></button>
        <button class="state -mr-2 grid size-10 place-items-center rounded-full text-on-surface-variant md:hidden" :aria-label="dark ? '浅色模式' : '深色模式'" @click="toggleDark"><span class="icon">{{ dark ? 'light_mode' : 'dark_mode' }}</span></button>
      </div>

      <Transition mode="out-in" enter-from-class="opacity-0 translate-y-3" leave-to-class="opacity-0" enter-active-class="transition duration-300 ease-emphasized" leave-active-class="transition duration-150">
        <component :is="views[route.view]" :key="route.view + (route.postId ?? '')" />
      </Transition>
    </main>

    <!-- 提示条 -->
    <Transition enter-from-class="opacity-0 translate-y-4" leave-to-class="opacity-0" enter-active-class="transition duration-200" leave-active-class="transition duration-150">
      <div v-if="errorMsg" role="status" class="fixed bottom-[calc(92px+env(safe-area-inset-bottom))] left-1/2 z-50 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-lg bg-on-surface px-4 py-3 text-sm text-surface shadow-lg md:bottom-6">{{ errorMsg }}</div>
    </Transition>

    <!-- 手机底栏：跟手滑动的玻璃胶囊 -->
    <div
      class="fixed left-1/2 z-20 w-[min(calc(100vw-24px),420px)] -translate-x-1/2 transition-transform duration-300 ease-emphasized md:hidden"
      :class="navHidden ? 'translate-y-[calc(100%+24px+env(safe-area-inset-bottom))]' : ''"
      style="bottom: calc(12px + env(safe-area-inset-bottom))"
    >
      <TabBar :items="navItems" :active="activeNav" @select="go" />
    </div>

    <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition duration-200" leave-active-class="transition duration-150">
      <AppearancePanel v-if="showAppearance" @close="showAppearance = false" />
    </Transition>
  </div>
</template>
