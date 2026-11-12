<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { allPosts, localPosts, nextPostId } from '../content'
import { buildPost, type Tone } from '../markdown'
import {
  adminApprove, adminComments, adminDelete, adminDeletePost, adminGetSettings, adminKey, adminListPosts, adminLogin, adminLogout,
  adminReply, adminSavePost, adminSaveSettings, adminTestNotify, API_VERSION, apiStatus, checkApi, notify, timeAgo, visitorName,
  type AdminComment, type AdminPost, type AdminSettings,
} from '../store'

const tab = ref<'comments' | 'posts' | 'settings'>('comments')
const keyInput = ref('')
const busy = ref(false)

async function login() {
  if (!keyInput.value.trim()) return
  busy.value = true
  if (await adminLogin(keyInput.value)) { keyInput.value = ''; visitorName.value = 'Blog' }
  busy.value = false
}
watch(adminKey, (k) => { if (k) { checkApi(); loadComments() } }, { immediate: true })

/* ---------------- 评论 ---------------- */
const list = ref<AdminComment[]>([])
const filter = ref('all')
const q = ref('')
const confirming = ref<string | null>(null)
const replyTo = ref<string | null>(null)
const replyText = ref('')
const threadName = (t: string) => (t === 'guestbook' ? '留言板' : allPosts.value.find((p) => 'post-' + p.id === t)?.title ?? t)
const threadsAvail = computed(() => [...new Set(list.value.map((c) => c.thread))])
const pendingCount = computed(() => list.value.filter((c) => c.status === 'pending').length)
const shown = computed(() =>
  list.value.filter((c) =>
    (filter.value === 'all' || (filter.value === 'pending' ? c.status === 'pending' : c.thread === filter.value)) &&
    (c.name + c.text).toLowerCase().includes(q.value.trim().toLowerCase()),
  ),
)
const parentOf = (c: AdminComment) => (c.parentId ? list.value.find((x) => x.id === c.parentId) : undefined)
async function loadComments() {
  busy.value = true
  list.value = (await adminComments()) ?? list.value
  busy.value = false
}
async function remove(c: AdminComment) {
  if (confirming.value !== c.id) return (confirming.value = c.id)
  confirming.value = null
  if (await adminDelete(c.thread, c.id)) loadComments()
}
async function approve(c: AdminComment) { if (await adminApprove(c.thread, c.id)) { c.status = 'approved'; notify('已通过') } }
async function sendReply(c: AdminComment) {
  if (!replyText.value.trim()) return
  if (await adminReply(c.thread, c.id, replyText.value.trim())) {
    replyText.value = ''; replyTo.value = null
    if (c.status === 'pending') await approve(c) // 回复即视为通过
    loadComments()
  }
}

/* ---------------- 文章 ---------------- */
const posts = ref<AdminPost[]>([])
const editing = ref<AdminPost | null>(null)
const preview = ref(false)
const blank = (): AdminPost => ({
  id: nextPostId(posts.value.map((p) => p.id)), title: '', excerpt: '', tag: '随笔', date: new Date().toISOString().slice(0, 10),
  read: 0, tone: 'primary', icon: 'article', cover: '', draft: true, markdown: '## 小标题\n\n正文……',
})
async function loadPosts() { posts.value = (await adminListPosts()) ?? posts.value }
watch(tab, (t) => {
  if (t === 'posts') loadPosts()
  if (t === 'settings') loadSettings()
})
const previewHtml = computed(() => (editing.value ? buildPost({ ...editing.value }, editing.value.markdown, 'remote').html : ''))
async function save() {
  const p = editing.value!
  if (!p.title.trim()) return notify('请填写标题')
  busy.value = true
  if (await adminSavePost({ ...p, cover: p.cover || undefined })) { notify(p.draft ? '草稿已保存' : '已发布'); editing.value = null; loadPosts() }
  busy.value = false
}
const delConfirm = ref<number | null>(null)
async function delPost(id: number) {
  if (delConfirm.value !== id) return (delConfirm.value = id)
  delConfirm.value = null
  if (await adminDeletePost(id)) loadPosts()
}
const tones: Tone[] = ['primary', 'secondary', 'tertiary']

/* ---------------- 设置 ---------------- */
const settings = reactive<AdminSettings>({ moderation: false, banned: [], serverchan: '', tgToken: '', tgChat: '' })
const bannedText = ref('')
async function loadSettings() {
  const s = await adminGetSettings()
  if (s) { Object.assign(settings, s); bannedText.value = s.banned.join('\n') }
}
async function saveSettings() {
  settings.banned = bannedText.value.split(/[\n,，]/).map((w) => w.trim()).filter(Boolean)
  if (await adminSaveSettings({ ...settings })) notify('设置已保存')
}
async function testNotify() { if (await adminTestNotify()) notify('测试通知已发送，请查看手机') }

const restoreCmd = 'tail -n +2 server/edge-function.backup.tsx > supabase/functions/server/index.tsx'
</script>

<template>
  <section class="mx-auto max-w-3xl">
    <div class="mb-6 rounded-[28px] bg-surface-container p-8">
      <span class="icon fill !text-5xl text-primary">shield_person</span>
      <h2 class="mt-3 text-[28px]">管理后台</h2>
      <p class="mt-1 text-on-surface-variant">评论审核与回复、在线写文章、反垃圾与通知设置。</p>
    </div>

    <form v-if="!adminKey" class="flex flex-wrap gap-3 rounded-[20px] bg-surface-low p-4" @submit.prevent="login">
      <input v-model="keyInput" type="password" autocomplete="current-password" placeholder="管理密钥（BLOG_AUTHOR_KEY）" class="field h-12 min-w-0 flex-1" />
      <button class="state flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-on-primary disabled:opacity-40" :disabled="busy"><span class="icon !text-lg">login</span>登录</button>
    </form>

    <template v-else>
      <!-- 后端状态提示：云函数文件被重置或未部署时给出明确的处理办法 -->
      <div v-if="apiStatus === 'missing' || apiStatus === 'outdated' || apiStatus === 'down'" class="mb-4 rounded-[20px] bg-[#f9dedc] p-4 text-[#410e0b] dark:bg-[#8c1d18] dark:text-[#f9dedc]">
        <p class="flex items-center gap-2 font-medium"><span class="icon">warning</span>
          {{ apiStatus === 'missing' ? '云函数接口缺失' : apiStatus === 'outdated' ? `云函数版本过旧（需要 v${API_VERSION}）` : '无法连接云函数' }}
        </p>
        <p class="mt-2 text-sm leading-6">
          {{ apiStatus === 'down'
            ? '可能原因：① 函数文件被平台重置成空模板后又部署了（浏览器会报跨域错误）；② Supabase 免费项目被暂停（登录 Supabase 后台点击 Restore）。若是 ①，在终端执行下面的命令恢复，再到 Figma Make 设置页重新部署 Edge Function：'
            : '函数文件可能被平台重置。请在终端执行下面的命令恢复，然后到 Figma Make 设置页重新部署 Edge Function：' }}
        </p>
        <code class="mt-2 block overflow-x-auto rounded-lg bg-black/10 px-3 py-2 text-xs">{{ restoreCmd }}</code>
      </div>

      <div class="mb-4 flex items-center gap-1 rounded-full bg-surface-low p-1">
        <button v-for="t in [{ k: 'comments', l: '评论', i: 'forum' }, { k: 'posts', l: '文章', i: 'edit_note' }, { k: 'settings', l: '设置', i: 'tune' }] as const" :key="t.k"
          class="state flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-medium"
          :class="tab === t.k ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'" @click="tab = t.k">
          <span class="icon !text-lg">{{ t.i }}</span>{{ t.l }}
          <span v-if="t.k === 'comments' && pendingCount" class="rounded-full bg-[#b3261e] px-1.5 text-[11px] text-white">{{ pendingCount }}</span>
        </button>
        <button class="state grid size-10 place-items-center rounded-full text-on-surface-variant" aria-label="退出" @click="adminLogout"><span class="icon">logout</span></button>
      </div>

      <!-- ============ 评论 ============ -->
      <div v-if="tab === 'comments'">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <div class="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface-high px-4">
            <span class="icon !text-xl text-on-surface-variant">search</span>
            <input v-model="q" placeholder="搜索昵称或内容" class="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
          <select v-model="filter" class="h-10 rounded-full border border-outline-variant bg-surface px-4 text-sm">
            <option value="all">全部（{{ list.length }}）</option>
            <option value="pending">待审核（{{ pendingCount }}）</option>
            <option v-for="t in threadsAvail" :key="t" :value="t">{{ threadName(t) }}</option>
          </select>
          <button class="state grid size-10 place-items-center rounded-full text-on-surface-variant" aria-label="刷新" @click="loadComments"><span class="icon" :class="{ 'animate-spin': busy }">refresh</span></button>
        </div>
        <TransitionGroup tag="ul" class="space-y-2" leave-active-class="transition duration-200" leave-to-class="opacity-0 -translate-x-4">
          <li v-for="c in shown" :key="c.id" class="rounded-xl bg-surface-low p-4" :class="{ 'ring-2 ring-[#b3261e]/40': c.status === 'pending' }">
            <div class="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span class="font-medium">{{ c.name }}</span>
              <span v-if="c.status === 'pending'" class="rounded bg-[#b3261e] px-1.5 text-[10px] text-white">待审核</span>
              <span class="text-xs text-on-surface-variant">{{ timeAgo(c.time) }} · {{ threadName(c.thread) }}</span>
            </div>
            <p v-if="parentOf(c)" class="mt-1 truncate text-xs text-on-surface-variant">回复 {{ parentOf(c)!.name }}：{{ parentOf(c)!.text }}</p>
            <p class="mt-1 text-[15px] break-words whitespace-pre-wrap">{{ c.text }}</p>
            <div class="mt-2 flex flex-wrap gap-1 text-sm">
              <button v-if="c.status === 'pending'" class="state flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-on-primary" @click="approve(c)"><span class="icon !text-base">check</span>通过</button>
              <button class="state flex h-8 items-center gap-1 rounded-full px-3 text-primary" @click="replyTo = replyTo === c.id ? null : c.id"><span class="icon !text-base">reply</span>回复</button>
              <button class="state flex h-8 items-center gap-1 rounded-full px-3 transition-colors" :class="confirming === c.id ? 'bg-[#b3261e] text-white' : 'text-[#b3261e]'" @click="remove(c)" @blur="confirming = null">
                <span class="icon !text-base">delete</span>{{ confirming === c.id ? '确认删除' : '删除' }}
              </button>
            </div>
            <form v-if="replyTo === c.id" class="mt-2 flex gap-2" @submit.prevent="sendReply(c)">
              <input v-model="replyText" placeholder="以 Blog 身份回复" class="field h-10 min-w-0 flex-1 text-sm" />
              <button class="state h-10 rounded-full bg-primary px-5 text-sm text-on-primary">发送</button>
            </form>
          </li>
        </TransitionGroup>
        <p v-if="!shown.length && !busy" class="py-12 text-center text-on-surface-variant">没有评论</p>
        <p class="mt-4 text-xs text-on-surface-variant">删除一条评论会同时删除它下面的所有回复。回复待审核的评论会自动通过它。</p>
      </div>

      <!-- ============ 文章 ============ -->
      <div v-else-if="tab === 'posts'">
        <template v-if="!editing">
          <button class="state mb-4 flex h-10 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-on-primary" @click="editing = blank()"><span class="icon !text-lg">add</span>写新文章</button>
          <p class="mb-2 text-sm font-medium text-on-surface-variant">在线文章（存在 Supabase，发布后立即生效）</p>
          <ul class="space-y-2">
            <li v-for="p in posts" :key="p.id" class="flex items-center gap-3 rounded-xl bg-surface-low p-4">
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{{ p.title }} <span v-if="p.draft" class="ml-1 rounded border border-outline px-1.5 text-[10px] text-on-surface-variant">草稿</span></p>
                <p class="text-xs text-on-surface-variant">#{{ p.id }} · {{ p.tag }} · {{ p.date }}</p>
              </div>
              <button class="state grid size-9 place-items-center rounded-full text-primary" aria-label="编辑" @click="editing = { ...p }"><span class="icon !text-xl">edit</span></button>
              <button class="state flex h-9 items-center rounded-full px-3 text-sm transition-colors" :class="delConfirm === p.id ? 'bg-[#b3261e] text-white' : 'text-[#b3261e]'" @click="delPost(p.id)" @blur="delConfirm = null">
                <span class="icon !text-xl">delete</span><span v-if="delConfirm === p.id" class="ml-1">确认</span>
              </button>
            </li>
            <li v-if="!posts.length" class="py-6 text-center text-sm text-on-surface-variant">还没有在线文章</li>
          </ul>
          <p class="mt-6 mb-2 text-sm font-medium text-on-surface-variant">仓库文章（content/posts/*.md，修改需重新发布网站）</p>
          <ul class="space-y-1 text-sm text-on-surface-variant">
            <li v-for="p in localPosts" :key="p.id" class="truncate">#{{ p.id }} {{ p.title }}</li>
          </ul>
        </template>

        <form v-else class="space-y-3" @submit.prevent="save">
          <div class="flex items-center gap-2">
            <button type="button" class="state grid size-10 place-items-center rounded-full" aria-label="返回列表" @click="editing = null"><span class="icon">arrow_back</span></button>
            <span class="text-sm text-on-surface-variant">文章 #{{ editing.id }}</span>
            <label class="ml-auto flex items-center gap-2 text-sm"><input v-model="editing.draft" type="checkbox" class="size-4 accent-[var(--md-primary)]" />草稿</label>
          </div>
          <input v-model="editing.title" placeholder="标题" class="field h-12 w-full text-lg" />
          <input v-model="editing.excerpt" placeholder="摘要（留空自动截取正文）" class="field h-11 w-full text-sm" />
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <input v-model="editing.tag" placeholder="分类" class="field h-11 text-sm" />
            <input v-model="editing.date" type="date" class="field h-11 text-sm" />
            <input v-model="editing.icon" placeholder="图标名" class="field h-11 text-sm" />
            <select v-model="editing.tone" class="field h-11 text-sm"><option v-for="t in tones" :key="t" :value="t">{{ t }}</option></select>
          </div>
          <input v-model="editing.cover" placeholder="题图 URL（可选）" class="field h-11 w-full text-sm" />
          <div class="flex gap-1 rounded-full bg-surface-low p-1 text-sm">
            <button type="button" class="state h-9 flex-1 rounded-full" :class="!preview ? 'bg-secondary-container text-on-secondary-container' : ''" @click="preview = false">编辑 Markdown</button>
            <button type="button" class="state h-9 flex-1 rounded-full" :class="preview ? 'bg-secondary-container text-on-secondary-container' : ''" @click="preview = true">预览</button>
          </div>
          <textarea v-if="!preview" v-model="editing.markdown" rows="16" class="field w-full p-4 font-mono text-sm leading-6"></textarea>
          <div v-else class="prose-px min-h-64 rounded-xl bg-surface-low p-5" v-html="previewHtml"></div>
          <button class="state flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-on-primary disabled:opacity-40" :disabled="busy">
            <span class="icon !text-lg">{{ editing.draft ? 'save' : 'publish' }}</span>{{ editing.draft ? '保存草稿' : '发布' }}
          </button>
        </form>
      </div>

      <!-- ============ 设置 ============ -->
      <form v-else class="space-y-6" @submit.prevent="saveSettings">
        <div class="rounded-xl bg-surface-low p-4">
          <label class="flex items-center gap-3">
            <span class="flex-1"><span class="block font-medium">评论需审核</span><span class="text-sm text-on-surface-variant">开启后新评论需要你在后台通过才公开显示。</span></span>
            <button type="button" role="switch" :aria-checked="settings.moderation" class="relative h-8 w-13 shrink-0 rounded-full border-2 transition-colors" :class="settings.moderation ? 'border-primary bg-primary' : 'border-outline bg-surface-high'" @click="settings.moderation = !settings.moderation">
              <span class="absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-300" :class="settings.moderation ? 'left-[22px] size-6 bg-on-primary' : 'left-1.5 size-4 bg-outline'"></span>
            </button>
          </label>
        </div>
        <div class="rounded-xl bg-surface-low p-4">
          <p class="font-medium">敏感词</p>
          <p class="text-sm text-on-surface-variant">每行一个（也可用逗号分隔）。命中的评论自动进入待审核，不会公开。</p>
          <textarea v-model="bannedText" rows="4" class="field mt-3 w-full p-3 text-sm"></textarea>
        </div>
        <div class="space-y-3 rounded-xl bg-surface-low p-4">
          <p class="font-medium">新评论通知</p>
          <p class="text-sm text-on-surface-variant">有新评论时推送到手机。两种方式可任选其一，留空即关闭。密钥只保存在服务器上。</p>
          <input v-model="settings.serverchan" placeholder="Server 酱 SendKey（微信推送，sct.ftqq.com 获取）" class="field h-11 w-full text-sm" />
          <div class="grid gap-3 sm:grid-cols-2">
            <input v-model="settings.tgToken" placeholder="Telegram Bot Token" class="field h-11 text-sm" />
            <input v-model="settings.tgChat" placeholder="Telegram Chat ID" class="field h-11 text-sm" />
          </div>
          <button type="button" class="state h-9 rounded-full border border-outline px-4 text-sm text-primary" @click="testNotify">发送测试通知</button>
        </div>
        <button class="state flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-on-primary"><span class="icon !text-lg">save</span>保存设置</button>
      </form>
    </template>
  </section>
</template>
