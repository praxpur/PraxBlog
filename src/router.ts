/**
 * 路由：基于 History API 的“真实路径”路由（/post/3、/projects）。
 * - 每次站内跳转 pushState，手机返回手势会回到上一级
 * - 构建时为每个路由预渲染独立 HTML（见 vite.config.ts），刷新、分享、搜索引擎都能直接访问
 * - 兼容旧链接：#/post/3、#admin 会自动转换
 */
import { reactive } from 'vue'

export type View = 'home' | 'post' | 'projects' | 'guestbook' | 'links' | 'about' | 'admin'
const VIEWS: View[] = ['projects', 'guestbook', 'links', 'about', 'admin']
type NavState = { depth: number; scroll?: number }

/** 站点根路径（部署在子路径时也正确），始终以 / 结尾 */
const BASE = new URL(import.meta.env.BASE_URL, location.href).pathname.replace(/\/?$/, '/')

export const route = reactive<{ view: View; postId: number | null }>({ view: 'home', postId: null })

export function hrefOf(view: View, postId?: number | null) {
  if (view === 'post' && postId != null) return `${BASE}post/${postId}`
  return view === 'home' ? BASE : `${BASE}${view}`
}

/** 旧版哈希链接（#/post/3、#/projects、#admin）；文章内标题锚点（#intro）不算 */
function legacyRel(hash: string) {
  const m = hash.match(/^#\/?(post\/\d+|projects|guestbook|links|about|admin)\/?$/) ?? hash.match(/^#(\/)$/)
  return m ? m[1].replace(/^\/$/, '') : null
}

function parse(path: string, hash: string) {
  const legacy = legacyRel(hash)
  const rel = (legacy ?? (path.startsWith(BASE) ? path.slice(BASE.length) : '')).replace(/\/+$/, '')
  const post = rel.match(/^post\/(\d+)$/)
  if (post) return { view: 'post' as View, postId: Number(post[1]) }
  return { view: (VIEWS as string[]).includes(rel) ? (rel as View) : ('home' as View), postId: null }
}

/** 把旧的哈希链接改写成真实路径 */
function canonicalize() {
  if (legacyRel(location.hash) !== null) history.replaceState({ depth: 0, ...(history.state ?? {}) }, '', hrefOf(route.view, route.postId))
}

function apply() {
  const r = parse(location.pathname, location.hash)
  route.view = r.view
  route.postId = r.postId
  for (const fn of listeners) fn()
}
const listeners = new Set<() => void>()
export const onRouteChange = (fn: () => void) => listeners.add(fn)

export function navigate(view: View, postId: number | null = null) {
  const href = hrefOf(view, postId)
  if (href === location.pathname && !location.hash) return window.scrollTo({ top: 0, behavior: 'smooth' })
  const st = (history.state as NavState | null) ?? { depth: 0 }
  history.replaceState({ ...st, scroll: window.scrollY }, '')
  history.pushState({ depth: st.depth + 1 } satisfies NavState, '', href)
  apply()
  window.scrollTo({ top: 0 })
}

/** 页面内“返回”：有站内历史就后退，否则（直接打开的链接）回首页 */
export function back() {
  if (((history.state as NavState | null)?.depth ?? 0) > 0) history.back()
  else {
    history.replaceState({ depth: 0 } satisfies NavState, '', BASE)
    apply()
  }
}

export function initRouter() {
  addEventListener('popstate', (e) => {
    // 只改了文章内锚点（#标题）时不需要重新路由
    const next = parse(location.pathname, location.hash)
    if (next.view === route.view && next.postId === route.postId && legacyRel(location.hash) === null) return
    apply()
    canonicalize()
    const y = (e.state as NavState | null)?.scroll ?? 0
    setTimeout(() => window.scrollTo({ top: y }), 170) // 等页面切换动画后恢复滚动位置
  })
  apply()
  canonicalize()
  if (history.state?.depth === undefined) history.replaceState({ depth: 0, ...(history.state ?? {}) }, '')
}
