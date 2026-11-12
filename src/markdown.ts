/**
 * 文章解析：Front Matter + Markdown → Post。
 * 浏览器（content.ts / 在线文章）和构建脚本（vite.config.ts 预渲染、RSS）共用这一份逻辑。
 */
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import cpp from 'highlight.js/lib/languages/cpp'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'

for (const [n, l] of Object.entries({ bash, cpp, css, javascript, json, python, typescript, xml })) hljs.registerLanguage(n, l)
hljs.registerAliases(['sh', 'shell'], { languageName: 'bash' })
hljs.registerAliases(['js'], { languageName: 'javascript' })
hljs.registerAliases(['ts'], { languageName: 'typescript' })
hljs.registerAliases(['html', 'vue'], { languageName: 'xml' })
hljs.registerAliases(['py'], { languageName: 'python' })
hljs.registerAliases(['c', 'c++'], { languageName: 'cpp' })

export type Tone = 'primary' | 'secondary' | 'tertiary'
export interface TocItem { id: string; text: string; level: 2 | 3 }
export interface PostMeta {
  id: number
  title: string
  excerpt: string
  tag: string
  date: string
  /** 阅读分钟数；不写则按字数自动估算 */
  read: number
  tone: Tone
  icon: string
  /** 可选题图 URL */
  cover?: string
  /** 草稿不会出现在列表中（仅在线文章使用） */
  draft?: boolean
}
export interface Post extends PostMeta {
  html: string
  toc: TocItem[]
  /** 纯文本（用于搜索） */
  text: string
  /** local = 仓库里的 .md 文件；remote = 后台在线发布 */
  source: 'local' | 'remote'
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function createMd() {
  const md = new MarkdownIt({
    html: false, // 不允许原始 HTML：在线文章也安全
    linkify: true,
    typographer: true,
    highlight(code, lang) {
      const l = lang && hljs.getLanguage(lang) ? lang : ''
      const body = l ? hljs.highlight(code, { language: l, ignoreIllegals: true }).value : escape(code)
      return `<pre class="hljs"${l ? ` data-lang="${l}"` : ''}><code>${body}</code></pre>`
    },
  })
  // 外链新窗口打开
  const link = md.renderer.rules.link_open ?? ((t, i, o, _e, self) => self.renderToken(t, i, o))
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    const href = String(tokens[idx].attrGet('href') ?? '')
    if (/^https?:/.test(href)) { tokens[idx].attrSet('target', '_blank'); tokens[idx].attrSet('rel', 'noopener') }
    return link(tokens, idx, opts, env, self)
  }
  // 图片懒加载
  const image = md.renderer.rules.image!
  md.renderer.rules.image = (tokens, idx, opts, env, self) => { tokens[idx].attrSet('loading', 'lazy'); return image(tokens, idx, opts, env, self) }
  return md
}
const md = createMd()

/** 给 h2 / h3 加 id 并收集目录 */
function renderWithToc(src: string) {
  const env = {}
  const tokens = md.parse(src, env)
  const toc: TocItem[] = []
  const used = new Map<string, number>()
  tokens.forEach((t, i) => {
    if (t.type !== 'heading_open' || (t.tag !== 'h2' && t.tag !== 'h3')) return
    const text = tokens[i + 1].children?.map((c) => c.content).join('') ?? ''
    let id = text.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section'
    const n = used.get(id) ?? 0
    used.set(id, n + 1)
    if (n) id += '-' + n
    t.attrSet('id', id)
    toc.push({ id, text, level: t.tag === 'h2' ? 2 : 3 })
  })
  return { html: md.renderer.render(tokens, md.options, env), toc }
}

/** 解析极简 YAML Front Matter（key: value，每行一项） */
export function parseFrontMatter(raw: string): { data: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { data: {}, body: raw }
  const data: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (kv) data[kv[1]] = kv[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return { data, body: m[2] }
}

const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&\w+;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim()

/** 由元数据 + Markdown 正文生成 Post */
export function buildPost(meta: Partial<PostMeta> & { id: number; title: string }, body: string, source: Post['source']): Post {
  const { html, toc } = renderWithToc(body)
  const text = plain(html)
  return {
    excerpt: text.slice(0, 60),
    tag: '未分类',
    date: new Date().toISOString().slice(0, 10),
    tone: 'primary',
    icon: 'article',
    ...meta,
    read: meta.read || Math.max(1, Math.round(text.length / 400)), // 中文约每分钟 400 字
    html,
    toc,
    text,
    source,
  }
}

/** 解析一个 .md 文件 */
export function parsePostFile(raw: string, source: Post['source'] = 'local'): Post {
  const { data, body } = parseFrontMatter(raw)
  const id = Number(data.id)
  if (!Number.isInteger(id) || !data.title) throw new Error(`文章缺少 id 或 title：${raw.slice(0, 80)}`)
  return buildPost(
    {
      id,
      title: data.title,
      excerpt: data.excerpt,
      tag: data.tag,
      date: data.date,
      read: Number(data.read) || 0,
      tone: (['primary', 'secondary', 'tertiary'].includes(data.tone) ? data.tone : 'primary') as Tone,
      icon: data.icon,
      cover: data.cover || undefined,
      draft: data.draft === 'true',
    },
    body,
    source,
  )
}

export const byDateDesc = (a: Post, b: Post) => b.date.localeCompare(a.date) || b.id - a.id
