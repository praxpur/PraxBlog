/**
 * Blog 本地后端：零依赖，基于 Node http + JSON 文件存储。
 * 开发时由 Vite 插件挂载到 /api，生产环境由 server/index.ts 独立运行。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

interface CommentRow {
  id: string
  thread: string
  parentId: string | null
  name: string
  text: string
  time: number
  likers: string[]
  /** 缺省视为 approved */
  status?: 'pending' | 'approved'
  /** 发布者访客 ID，用于让待审核评论只对本人可见 */
  visitor?: string
}
interface Settings { moderation: boolean; banned: string[]; serverchan: string; tgToken: string; tgChat: string }
interface PostRow {
  id: number; title: string; excerpt: string; tag: string; date: string; read: number
  tone: string; icon: string; cover?: string; draft?: boolean; markdown: string; updated: number
}
interface DB {
  postLikes: Record<string, string[]>
  comments: CommentRow[]
  posts?: PostRow[]
  settings?: Partial<Settings>
}

/** 与云函数保持一致的接口版本 */
const VERSION = 3
const DEFAULT_SETTINGS: Settings = { moderation: false, banned: [], serverchan: '', tgToken: '', tgChat: '' }
const isPublic = (c: CommentRow) => c.status !== 'pending'
const validThread = (t: string) => t === 'guestbook' || /^post-\d+$/.test(t)

const DATA_FILE = process.env.BLOG_DB ?? path.resolve(process.cwd(), 'data/db.json')
const AUTHOR_KEY = process.env.BLOG_AUTHOR_KEY ?? ''

function seed(): DB {
  const t = Date.now()
  return {
    postLikes: {},
    comments: [
      { id: 'seed1', thread: 'guestbook', parentId: null, name: '路过的设计师', text: '博客的 Material 3 配色好舒服，石灰绿点缀很有记忆点！', time: t - 172800000, likers: [] },
      { id: 'seed1r', thread: 'guestbook', parentId: 'seed1', name: 'Blog', text: '谢谢喜欢～', time: t - 86400000, likers: [] },
    ],
  }
}

let db: DB
function load(): DB {
  if (db) return db
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  } catch {
    db = seed()
    save()
  }
  return db
}
let timer: NodeJS.Timeout | null = null
function save() {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
    const tmp = DATA_FILE + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
    fs.renameSync(tmp, DATA_FILE) // 原子写入，避免写一半损坏
  }, 50)
}

class HttpError extends Error {
  status: number
  constructor(status: number, msg: string) {
    super(msg)
    this.status = status
  }
}

const lastPost = new Map<string, number>()
function rateLimit(key: string, ms: number) {
  const now = Date.now()
  if (now - (lastPost.get(key) ?? 0) < ms) throw new HttpError(429, '操作太频繁，请稍后再试')
  lastPost.set(key, now)
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 300_000) reject(new HttpError(413, '内容过长'))
    })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch { reject(new HttpError(400, 'JSON 格式错误')) }
    })
    req.on('error', reject)
  })
}

/** 公开评论 + 当前访客自己的待审核评论；父评论不可见时其回复也隐藏 */
function tree(all: CommentRow[], visitor: string) {
  const rows = all.filter((r) => isPublic(r) || r.visitor === visitor)
  const map = new Map<string, any>()
  const roots: any[] = []
  for (const r of [...rows].sort((a, b) => a.time - b.time)) {
    map.set(r.id, { id: r.id, name: r.name, text: r.text, time: r.time, likes: r.likers.length, liked: r.likers.includes(visitor), pending: !isPublic(r) || undefined, replies: [] })
  }
  for (const r of rows) {
    if (!r.parentId) roots.push(map.get(r.id))
    else map.get(r.parentId)?.replies.push(map.get(r.id))
  }
  return roots.sort((a, b) => b.time - a.time) // 顶层最新在前，回复按时间正序
}

const settingsOf = (d: DB): Settings => ({ ...DEFAULT_SETTINGS, ...d.settings })

async function notify(s: Settings, title: string, body: string) {
  const opts = (payload: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) })
  const jobs: Promise<unknown>[] = []
  if (s.serverchan) jobs.push(fetch(`https://sctapi.ftqq.com/${encodeURIComponent(s.serverchan)}.send`, opts({ title, desp: body })))
  if (s.tgToken && s.tgChat) jobs.push(fetch(`https://api.telegram.org/bot${s.tgToken}/sendMessage`, opts({ chat_id: s.tgChat, text: `${title}\n\n${body}` })))
  for (const r of await Promise.allSettled(jobs)) if (r.status === 'rejected') console.error('Blog notify failed:', r.reason)
  return jobs.length
}

function toggle(list: string[], v: string) {
  const i = list.indexOf(v)
  i >= 0 ? list.splice(i, 1) : list.push(v)
  return i < 0
}

async function route(req: IncomingMessage, url: URL, visitor: string, ip: string) {
  const d = load()
  const m = req.method ?? 'GET'
  const p = url.pathname.replace(/^\/api/, '')
  let g: RegExpMatchArray | null

  if (m === 'GET' && p === '/version') return { version: VERSION }
  if (m === 'GET' && p === '/posts') return (d.posts ?? []).filter((x) => !x.draft).map(({ updated: _u, ...x }) => x)

  if (m === 'GET' && p === '/summary') {
    const likes: Record<string, number> = {}
    const liked: number[] = []
    for (const [id, l] of Object.entries(d.postLikes)) {
      likes[id] = l.length
      if (l.includes(visitor)) liked.push(Number(id))
    }
    const comments: Record<string, number> = {}
    for (const c of d.comments) if (isPublic(c)) comments[c.thread] = (comments[c.thread] ?? 0) + 1
    return { likes, liked, comments }
  }

  if (m === 'POST' && (g = p.match(/^\/posts\/(\d+)\/like$/))) {
    const list = (d.postLikes[g[1]] ??= [])
    const body = await readBody(req)
    const liked = typeof body.liked === 'boolean' && body.liked === list.includes(visitor) ? body.liked : toggle(list, visitor)
    save()
    return { liked, count: list.length }
  }

  if (m === 'GET' && (g = p.match(/^\/threads\/([\w-]{1,40})$/))) {
    return tree(d.comments.filter((c) => c.thread === g![1]), visitor)
  }

  if (m === 'POST' && (g = p.match(/^\/threads\/([\w-]{1,40})$/))) {
    const thread = g[1]
    if (!validThread(thread)) throw new HttpError(400, '无效的讨论区')
    const body = await readBody(req)
    const name = String(body.name ?? '').trim().slice(0, 20)
    const text = String(body.text ?? '').trim().slice(0, 500)
    if (!name || !text) throw new HttpError(400, '昵称和内容不能为空')
    const admin = !!AUTHOR_KEY && body.authorKey === AUTHOR_KEY
    if (name === 'Blog' && !admin) throw new HttpError(403, '该昵称为作者保留')
    const parentId = body.parentId ? String(body.parentId) : null
    if (parentId && !d.comments.some((c) => c.id === parentId && c.thread === thread)) throw new HttpError(404, '回复的评论不存在')
    if (!admin) rateLimit('post:' + ip, 10_000)
    const s = settingsOf(d)
    const lower = (name + ' ' + text).toLowerCase()
    const status = !admin && (s.moderation || s.banned.some((w) => w && lower.includes(w.toLowerCase()))) ? 'pending' : 'approved'
    const row: CommentRow = { id: crypto.randomUUID(), thread, parentId, name, text, time: Date.now(), likers: [], status, visitor }
    d.comments.push(row)
    save()
    if (!admin) await notify(s, status === 'pending' ? 'Blog 博客：新评论待审核' : 'Blog 博客：新评论', `${name}（${thread}）：${text}`)
    return { id: row.id, name, text, time: row.time, likes: 0, liked: false, pending: status === 'pending' || undefined, replies: [] }
  }

  if (m === 'POST' && (g = p.match(/^\/comments\/(?:[\w-]+\/)?([\w-]+)\/like$/))) {
    const c = d.comments.find((x) => x.id === g![1])
    if (!c || !isPublic(c)) throw new HttpError(404, '评论不存在')
    const body = await readBody(req)
    const liked = typeof body.liked === 'boolean' && body.liked === c.likers.includes(visitor) ? body.liked : toggle(c.likers, visitor)
    save()
    return { liked, likes: c.likers.length }
  }

  if (p.startsWith('/admin/')) return admin(req, m, p, d)
  throw new HttpError(404, '接口不存在')
}

/** 管理接口：请求头 X-Admin-Key 必须等于 BLOG_AUTHOR_KEY */
async function admin(req: IncomingMessage, m: string, p: string, d: DB) {
  if (!AUTHOR_KEY || req.headers['x-admin-key'] !== AUTHOR_KEY) throw new HttpError(401, '管理密钥错误')
  const body = m === 'POST' ? await readBody(req) : {}
  const find = () => {
    const c = d.comments.find((x) => x.thread === body.thread && x.id === body.id)
    if (!c) throw new HttpError(404, '评论不存在')
    return c
  }
  switch (`${m} ${p}`) {
    case 'GET /admin/verify':
      return { ok: true }
    case 'GET /admin/comments':
      return [...d.comments].sort((a, b) => b.time - a.time).map(({ likers: _l, visitor: _v, ...r }) => ({ ...r, status: r.status ?? 'approved' }))
    case 'POST /admin/approve':
      find().status = 'approved'
      save()
      return { ok: true }
    case 'POST /admin/delete': {
      find()
      const doomed = new Set<string>([body.id])
      for (let grew = true; grew; ) {
        grew = false
        for (const r of d.comments) if (r.thread === body.thread && r.parentId && doomed.has(r.parentId) && !doomed.has(r.id)) { doomed.add(r.id); grew = true }
      }
      const deleted = d.comments.filter((r) => r.thread === body.thread && doomed.has(r.id) && isPublic(r)).length
      d.comments = d.comments.filter((r) => !(r.thread === body.thread && doomed.has(r.id)))
      save()
      return { deleted }
    }
    case 'GET /admin/settings':
      return settingsOf(d)
    case 'POST /admin/settings':
      d.settings = {
        moderation: !!body.moderation,
        banned: (Array.isArray(body.banned) ? body.banned : []).map((w: unknown) => String(w).trim().slice(0, 40)).filter(Boolean).slice(0, 200),
        serverchan: String(body.serverchan ?? '').trim(),
        tgToken: String(body.tgToken ?? '').trim(),
        tgChat: String(body.tgChat ?? '').trim(),
      }
      save()
      return d.settings
    case 'POST /admin/notify-test':
      if (!(await notify(settingsOf(d), 'Blog 博客：测试通知', '收到这条消息说明通知配置正确。'))) throw new HttpError(400, '还没有配置任何通知方式')
      return { ok: true }
    case 'GET /admin/posts':
      return [...(d.posts ?? [])].sort((a, b) => b.id - a.id)
    case 'POST /admin/posts': {
      const id = Number(body.id)
      if (!Number.isInteger(id) || id < 1 || id > 999999) throw new HttpError(400, '文章编号无效')
      const title = String(body.title ?? '').trim().slice(0, 120)
      if (!title) throw new HttpError(400, '标题不能为空')
      const row: PostRow = {
        id, title,
        markdown: String(body.markdown ?? '').slice(0, 200_000),
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(body.date)) ? body.date : new Date().toISOString().slice(0, 10),
        excerpt: String(body.excerpt ?? '').trim().slice(0, 300),
        tag: String(body.tag ?? '').trim().slice(0, 20) || '随笔',
        read: Math.max(0, Math.min(999, Number(body.read) || 0)),
        tone: ['primary', 'secondary', 'tertiary'].includes(body.tone) ? body.tone : 'primary',
        icon: String(body.icon ?? '').replace(/[^a-z0-9_]/g, '').slice(0, 40) || 'article',
        cover: /^https:\/\//.test(String(body.cover ?? '')) ? String(body.cover).slice(0, 500) : undefined,
        draft: !!body.draft,
        updated: Date.now(),
      }
      d.posts = [...(d.posts ?? []).filter((x) => x.id !== id), row]
      save()
      return row
    }
    case 'POST /admin/posts/delete':
      d.posts = (d.posts ?? []).filter((x) => x.id !== Number(body.id))
      save()
      return { ok: true }
  }
  throw new HttpError(404, '接口不存在')
}

/** Connect 风格中间件：处理 /api/*，其他请求交给 next */
export async function apiMiddleware(req: IncomingMessage, res: ServerResponse, next?: () => void) {
  const url = new URL(req.url ?? '/', 'http://local')
  if (!url.pathname.startsWith('/api/')) return next?.()
  const visitor = String(req.headers['x-visitor'] ?? '').slice(0, 64) || 'anon'
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0]
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  try {
    res.end(JSON.stringify(await route(req, url, visitor, ip)))
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, '服务器错误')
    if (!(e instanceof HttpError)) console.error(e)
    res.statusCode = err.status
    res.end(JSON.stringify({ error: err.message }))
  }
}
