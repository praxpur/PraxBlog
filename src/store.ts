import { reactive, ref } from 'vue'
import { projectId, publicAnonKey } from '../utils/supabase/info'
import { setRemotePosts, type RemotePost } from './content'
import type { PostMeta } from './markdown'

/** 前端期望的后端版本；云函数返回的版本不一致时，管理后台会提示重新部署 */
export const API_VERSION = 3

/** 后端地址：默认使用 Supabase Edge Function；设置 VITE_API=local 时改用本地 server/api.ts */
const useLocal = import.meta.env.VITE_API === 'local'
const API_BASE = useLocal ? import.meta.env.BASE_URL + 'api' : `https://${projectId}.supabase.co/functions/v1/make-server-ded2b340/api`

export interface Comment {
  id: string
  name: string
  text: string
  time: number
  likes: number
  liked: boolean
  /** 待审核（只有作者本人和管理员能看到） */
  pending?: boolean
  replies: Comment[]
}

/** 匿名访客 ID：用于点赞去重，不含任何个人信息 */
const visitorId = (() => {
  let id = localStorage.getItem('px-visitor')
  if (!id) localStorage.setItem('px-visitor', (id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)))
  return id
})()

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Visitor': visitorId,
      ...(useLocal ? {} : { Authorization: `Bearer ${publicAnonKey}` }),
      ...(adminKey.value ? { 'X-Admin-Key': adminKey.value } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => {
    // 网络错误 / CORS 被拒（函数被重置、项目暂停）：给出可读的提示，而不是浏览器原文 “Failed to fetch”
    if (apiStatus.value !== 'missing') apiStatus.value = 'down'
    throw new Error('评论服务暂不可用')
  })
  // 静态部署（无后端）时 /api 可能返回 HTML，需当作失败处理
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json().catch(() => null) : null
  if (res.status === 404 && !isJson) apiStatus.value = 'missing' // 云函数在、但接口不在：多半是函数文件被重置后部署了
  if (!res.ok || !data) throw new Error(data?.error ?? '评论服务暂不可用')
  return data
}

/**
 * 后端状态：
 * ok 正常 / outdated 云函数版本落后（需要重新部署）/ missing 接口缺失（函数文件被重置）/ down 无法连接
 */
export const apiStatus = ref<'unknown' | 'ok' | 'outdated' | 'missing' | 'down'>('unknown')
export async function checkApi() {
  try {
    const v = await api<{ version: number }>('/version')
    apiStatus.value = v.version >= API_VERSION ? 'ok' : 'outdated'
  } catch {
    if (apiStatus.value !== 'missing') apiStatus.value = 'down'
  }
  return apiStatus.value
}

/** 在线文章 */
export async function loadRemotePosts() {
  try { setRemotePosts(await api<RemotePost[]>('/posts')) } catch { /* 后端不可用时只显示本地文章 */ }
}

/** 管理密钥：仅保存在本标签页（sessionStorage），关闭即失效 */
export const adminKey = ref(sessionStorage.getItem('px-admin') ?? '')

export const likeCounts = ref<Record<string, number>>({})
export const likedIds = ref<number[]>([])
export const commentCounts = ref<Record<string, number>>({})
export const threads = reactive<Record<string, Comment[]>>({})
export const loading = reactive<Record<string, boolean>>({})
export const errorMsg = ref('')

const name = ref(localStorage.getItem('px-name') ?? '')
export const visitorName = {
  get value() { return name.value },
  set value(v: string) { name.value = v; localStorage.setItem('px-name', v) },
}

/** 底部提示条（成功提示与错误共用） */
export function notify(msg: string) {
  errorMsg.value = msg
  setTimeout(() => errorMsg.value === msg && (errorMsg.value = ''), 3000)
}
function fail(e: unknown) {
  errorMsg.value = e instanceof Error ? e.message : String(e)
  setTimeout(() => (errorMsg.value = ''), 3000)
}

export async function loadSummary() {
  try {
    const s = await api<{ likes: Record<string, number>; liked: number[]; comments: Record<string, number> }>('/summary')
    likeCounts.value = s.likes ?? {}
    likedIds.value = s.liked ?? []
    commentCounts.value = s.comments ?? {}
  } catch { /* 后台同步失败不打扰访客：计数保持现状，评论区会单独提示 */ }
}

export async function loadThread(thread: string, silent = false) {
  if (!silent) loading[thread] = true
  try { const list = await api<Comment[]>('/threads/' + thread)
    threads[thread] = Array.isArray(list) ? list : [] } catch (e) { if (!silent) fail(e) } finally { loading[thread] = false }
}

/**
 * 乐观更新 + 合并请求：
 * 点击立即改界面；400ms 内的连续点击只发最后一次“目标状态”；失败则回滚。
 */
function debounced(key: string, run: () => Promise<void>) {
  clearTimeout(timers.get(key))
  timers.set(key, setTimeout(() => { timers.delete(key); run() }, 400))
}
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const syncedPost = new Map<number, { liked: boolean; count: number }>()

export function toggleLike(id: number) {
  const was = likedIds.value.includes(id)
  if (!syncedPost.has(id)) syncedPost.set(id, { liked: was, count: likeCounts.value[id] ?? 0 })
  const want = !was
  likedIds.value = want ? [...likedIds.value, id] : likedIds.value.filter((x) => x !== id)
  likeCounts.value = { ...likeCounts.value, [id]: Math.max(0, (likeCounts.value[id] ?? 0) + (want ? 1 : -1)) }
  debounced('post' + id, async () => {
    const before = syncedPost.get(id)!
    syncedPost.delete(id)
    const target = likedIds.value.includes(id)
    if (target === before.liked) return // 点了偶数次，等于没点
    try {
      const r = await api<{ liked: boolean; count: number }>(`/posts/${id}/like`, { liked: target })
      if (timers.has('post' + id)) return // 期间又被点击，以下一次为准
      likeCounts.value = { ...likeCounts.value, [id]: r.count }
    } catch (e) {
      likedIds.value = before.liked ? [...new Set([...likedIds.value, id])] : likedIds.value.filter((x) => x !== id)
      likeCounts.value = { ...likeCounts.value, [id]: before.count }
      fail(e)
    }
  })
}

const syncedComment = new WeakMap<Comment, { liked: boolean; likes: number }>()
export function likeComment(thread: string, c: Comment) {
  if (!syncedComment.has(c)) syncedComment.set(c, { liked: c.liked, likes: c.likes })
  c.liked = !c.liked
  c.likes = Math.max(0, c.likes + (c.liked ? 1 : -1))
  debounced('c' + c.id, async () => {
    const before = syncedComment.get(c)!
    syncedComment.delete(c)
    if (c.liked === before.liked) return
    try {
      const r = await api<{ liked: boolean; likes: number }>(`/comments/${thread}/${c.id}/like`, { liked: c.liked })
      if (!timers.has('c' + c.id)) c.likes = r.likes
    } catch (e) {
      Object.assign(c, before)
      fail(e)
    }
  })
}

/** 自动刷新：回到页面时、以及每 30 秒（页面可见时）同步最新点赞与评论 */
const openThreads = new Set<string>()
export function watchThread(thread: string) { openThreads.add(thread); return () => openThreads.delete(thread) }
export function startAutoRefresh() {
  const refresh = () => {
    if (document.visibilityState !== 'visible' || timers.size) return // 有未发送的点赞时先不刷新，避免界面跳动
    loadSummary()
    openThreads.forEach((t) => loadThread(t, true))
  }
  document.addEventListener('visibilitychange', refresh)
  setInterval(refresh, 30_000)
}

export async function addComment(thread: string, name: string, text: string, parent?: Comment) {
  try {
    const c = await api<Comment>('/threads/' + thread, { name, text, parentId: parent?.id, authorKey: adminKey.value || undefined })
    if (parent) parent.replies.push(c)
    else threads[thread] = [c, ...(threads[thread] ?? [])]
    if (c.pending) notify('已提交，审核通过后会公开显示')
    else commentCounts.value = { ...commentCounts.value, [thread]: (commentCounts.value[thread] ?? 0) + 1 }
    return true
  } catch (e) { fail(e); return false }
}

export function countComments(list: Comment[] = []): number {
  return list.reduce((n, c) => n + 1 + countComments(c.replies), 0)
}

export function timeAgo(t: number) {
  const s = (Date.now() - t) / 1000
  if (s < 60) return '刚刚'
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} 天前`
  return new Date(t).toLocaleDateString('zh-CN')
}

/* ---------------- 管理 ---------------- */
export interface AdminComment { id: string; thread: string; parentId: string | null; name: string; text: string; time: number; status?: 'pending' | 'approved' }
export interface AdminSettings {
  /** 开启后所有新评论需审核才显示 */
  moderation: boolean
  /** 命中这些词的评论自动进入待审核 */
  banned: string[]
  /** Server 酱 SendKey（微信推送） */
  serverchan: string
  /** Telegram 机器人 Token 与 Chat ID */
  tgToken: string
  tgChat: string
}

export async function adminGetSettings() {
  try { return await api<AdminSettings>('/admin/settings') } catch (e) { fail(e); return null }
}
export async function adminSaveSettings(s: AdminSettings) {
  try { await api('/admin/settings', s); return true } catch (e) { fail(e); return false }
}
export async function adminTestNotify() {
  try { await api('/admin/notify-test', {}); return true } catch (e) { fail(e); return false }
}
export async function adminApprove(thread: string, id: string) {
  try { await api('/admin/approve', { thread, id }); return true } catch (e) { fail(e); return false }
}
/** 在后台直接以作者身份回复 */
export async function adminReply(thread: string, parentId: string, text: string) {
  try {
    await api<Comment>('/threads/' + thread, { name: 'Blog', text, parentId, authorKey: adminKey.value })
    if (threads[thread]) loadThread(thread, true)
    return true
  } catch (e) { fail(e); return false }
}

export interface AdminPost extends PostMeta { markdown: string; updated?: number }
export async function adminListPosts() {
  try { return await api<AdminPost[]>('/admin/posts') } catch (e) { fail(e); return null }
}
export async function adminSavePost(p: AdminPost) {
  try { await api('/admin/posts', p); await loadRemotePosts(); return true } catch (e) { fail(e); return false }
}
export async function adminDeletePost(id: number) {
  try { await api('/admin/posts/delete', { id }); await loadRemotePosts(); return true } catch (e) { fail(e); return false }
}

export async function adminLogin(key: string) {
  adminKey.value = key.trim()
  try {
    await api('/admin/verify')
    sessionStorage.setItem('px-admin', adminKey.value)
    return true
  } catch (e) {
    adminKey.value = ''
    fail(e)
    return false
  }
}
export function adminLogout() {
  adminKey.value = ''
  sessionStorage.removeItem('px-admin')
}
export async function adminComments() {
  try { return await api<AdminComment[]>('/admin/comments') } catch (e) { fail(e); return null }
}
export async function adminDelete(thread: string, id: string) {
  try {
    const r = await api<{ deleted: number }>('/admin/delete', { thread, id })
    commentCounts.value = { ...commentCounts.value, [thread]: Math.max(0, (commentCounts.value[thread] ?? 0) - r.deleted) }
    const prune = (list: Comment[]): Comment[] => list.filter((c) => c.id !== id).map((c) => ({ ...c, replies: prune(c.replies) }))
    if (threads[thread]) threads[thread] = prune(threads[thread])
    return r.deleted
  } catch (e) { fail(e); return 0 }
}
