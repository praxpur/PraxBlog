// 备份：supabase/functions/server/index.tsx 的副本（v3）。若该文件被平台重置，执行 tail -n +2 server/edge-function.backup.tsx > supabase/functions/server/index.tsx 恢复，然后重新部署。
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

/**
 * Blog 博客后端 v3（Supabase Edge Function）。接口与本地 server/api.ts 对应。
 * KV 键设计：
 *   px:pl:<postId>:<visitor>              → { post, v }     文章点赞（每人一条，并发安全）
 *   px:c:<thread>:<commentId>             → CommentRow      评论 / 回复
 *   px:cl:<thread>:<commentId>:<visitor>  → { cid, v }      评论点赞（每人一条）
 *   px:rl:<key>                           → number          发评论限流时间戳
 *   px:post:<id>                          → PostRow         在线文章（Markdown）
 *   px:settings                           → Settings        审核 / 敏感词 / 通知
 */
const VERSION = 3;
const app = new Hono();
const P = "/make-server-ded2b340/api";
const AUTHOR_KEY = Deno.env.get("BLOG_AUTHOR_KEY") ?? "";

interface CommentRow {
  id: string; thread: string; parentId: string | null
  name: string; text: string; time: number; likers?: string[]
  /** 缺省视为 approved（兼容旧数据） */
  status?: "pending" | "approved"
  /** 发布者访客 ID：让待审核评论只对作者本人可见；不会返回给其他访客 */
  visitor?: string
}
interface Settings { moderation: boolean; banned: string[]; serverchan: string; tgToken: string; tgChat: string }
interface PostRow {
  id: number; title: string; excerpt: string; tag: string; date: string; read: number
  tone: string; icon: string; cover?: string; draft?: boolean; markdown: string; updated: number
}

class HttpError extends Error {
  status: number
  constructor(status: number, msg: string) { super(msg); this.status = status }
}

app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization", "X-Visitor", "X-Admin-Key"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

app.onError((e, c) => {
  if (e instanceof HttpError) return c.json({ error: e.message }, e.status as 400);
  console.log("Blog server error:", e);
  return c.json({ error: "服务器错误" }, 500);
});

const visitorOf = (c: any) => String(c.req.header("x-visitor") ?? "").slice(0, 64) || "anon";
const ipOf = (c: any) => String(c.req.header("x-forwarded-for") ?? "unknown").split(",")[0].trim();
const validThread = (t: string) => t === "guestbook" || /^post-\d+$/.test(t);
const isAdminKey = (k: unknown) => !!AUTHOR_KEY && typeof k === "string" && k === AUTHOR_KEY;
const requireAdmin = (c: any) => { if (!isAdminKey(c.req.header("x-admin-key"))) throw new HttpError(401, "管理密钥错误"); };
const isPublic = (r: CommentRow) => r.status !== "pending";

async function rateLimit(key: string, ms: number) {
  const k = "px:rl:" + key, now = Date.now();
  if (now - ((await kv.get(k)) ?? 0) < ms) throw new HttpError(429, "操作太频繁，请稍后再试");
  await kv.set(k, now);
}

const DEFAULT_SETTINGS: Settings = { moderation: false, banned: [], serverchan: "", tgToken: "", tgChat: "" };
const getSettings = async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS, ...((await kv.get("px:settings")) ?? {}) });

/** 推送通知（Server 酱 / Telegram）。失败只记日志，不影响发评论 */
async function notify(s: Settings, title: string, body: string) {
  const jobs: Promise<unknown>[] = [];
  const opts = (payload: unknown) => ({
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000),
  });
  if (s.serverchan) jobs.push(fetch(`https://sctapi.ftqq.com/${encodeURIComponent(s.serverchan)}.send`, opts({ title, desp: body })));
  if (s.tgToken && s.tgChat) jobs.push(fetch(`https://api.telegram.org/bot${s.tgToken}/sendMessage`, opts({ chat_id: s.tgChat, text: `${title}\n\n${body}` })));
  const results = await Promise.allSettled(jobs);
  for (const r of results) if (r.status === "rejected") console.log("Blog notify failed:", r.reason);
  return jobs.length;
}

/** 首次运行时写入示例留言 */
async function ensureSeed() {
  if (await kv.get("px:seeded")) return;
  const t = Date.now();
  await kv.mset(
    ["px:c:guestbook:seed1", "px:c:guestbook:seed1r", "px:seeded"],
    [
      { id: "seed1", thread: "guestbook", parentId: null, name: "路过的设计师", text: "博客的 Material 3 配色好舒服，石灰绿点缀很有记忆点！", time: t - 172800000 },
      { id: "seed1r", thread: "guestbook", parentId: "seed1", name: "Blog", text: "谢谢喜欢～", time: t - 86400000 },
      true,
    ],
  );
}

/** 组装评论树：只包含公开评论 + 当前访客自己的待审核评论；父评论不可见时其回复也隐藏 */
function tree(rows: CommentRow[], likes: Map<string, Set<string>>, visitor: string) {
  const visible = rows.filter((r) => isPublic(r) || r.visitor === visitor);
  const map = new Map<string, any>(), roots: any[] = [];
  for (const r of [...visible].sort((a, b) => a.time - b.time)) {
    const set = likes.get(r.id) ?? new Set();
    map.set(r.id, { id: r.id, name: r.name, text: r.text, time: r.time, likes: set.size, liked: set.has(visitor), pending: !isPublic(r) || undefined, replies: [] });
  }
  for (const r of visible) {
    if (!r.parentId) roots.push(map.get(r.id));
    else map.get(r.parentId)?.replies.push(map.get(r.id));
  }
  return roots.sort((a, b) => b.time - a.time);
}

app.get("/make-server-ded2b340/health", (c) => c.json({ status: "ok" }));
app.get(`${P}/version`, (c) => c.json({ version: VERSION }));

app.get(`${P}/summary`, async (c) => {
  await ensureSeed();
  const visitor = visitorOf(c);
  const [likeRows, comments] = await Promise.all([kv.getByPrefix("px:pl:"), kv.getByPrefix("px:c:")]);
  const likes: Record<string, number> = {}, liked: number[] = [], counts: Record<string, number> = {};
  for (const r of likeRows as { post?: string; v?: string }[]) {
    if (!r?.post) continue; // 跳过旧格式数据
    likes[r.post] = (likes[r.post] ?? 0) + 1;
    if (r.v === visitor) liked.push(Number(r.post));
  }
  for (const r of comments as CommentRow[]) if (isPublic(r)) counts[r.thread] = (counts[r.thread] ?? 0) + 1;
  return c.json({ likes, liked, comments: counts });
});

/** 已发布的在线文章（不含草稿） */
app.get(`${P}/posts`, async (c) => {
  const rows = (await kv.getByPrefix("px:post:")) as PostRow[];
  return c.json(rows.filter((p) => !p.draft).map(({ updated: _u, ...p }) => p));
});

/** 设置文章点赞。body.liked 为目标状态（幂等：重复发送结果相同）；省略则切换 */
app.post(`${P}/posts/:id/like`, async (c) => {
  const id = c.req.param("id");
  if (!/^\d+$/.test(id)) throw new HttpError(400, "无效的文章");
  const visitor = visitorOf(c);
  const body = await c.req.json().catch(() => ({}));
  const key = `px:pl:${id}:${visitor}`;
  const had = !!(await kv.get(key));
  const want = typeof body.liked === "boolean" ? body.liked : !had;
  if (want && !had) await kv.set(key, { post: id, v: visitor });
  if (!want && had) await kv.del(key);
  return c.json({ liked: want, count: (await kv.getByPrefix(`px:pl:${id}:`)).length });
});

app.get(`${P}/threads/:thread`, async (c) => {
  const thread = c.req.param("thread");
  if (!validThread(thread)) throw new HttpError(400, "无效的讨论区");
  await ensureSeed();
  const [rows, likeRows] = await Promise.all([kv.getByPrefix(`px:c:${thread}:`), kv.getByPrefix(`px:cl:${thread}:`)]);
  const likes = new Map<string, Set<string>>();
  const add = (cid: string, v: string) => likes.set(cid, (likes.get(cid) ?? new Set()).add(v));
  for (const l of likeRows as { cid: string; v: string }[]) add(l.cid, l.v);
  for (const r of rows as CommentRow[]) for (const v of r.likers ?? []) add(r.id, v); // 兼容旧数据
  return c.json(tree(rows, likes, visitorOf(c)));
});

app.post(`${P}/threads/:thread`, async (c) => {
  const thread = c.req.param("thread");
  if (!validThread(thread)) throw new HttpError(400, "无效的讨论区");
  const body = await c.req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 20);
  const text = String(body.text ?? "").trim().slice(0, 500);
  if (!name || !text) throw new HttpError(400, "昵称和内容不能为空");
  const admin = isAdminKey(body.authorKey);
  if (name === "Blog" && !admin) throw new HttpError(403, "该昵称为作者保留");
  const parentId = body.parentId ? String(body.parentId) : null;
  if (parentId && !(await kv.get(`px:c:${thread}:${parentId}`))) throw new HttpError(404, "回复的评论不存在");
  if (!admin) await rateLimit("post:" + ipOf(c), 10_000);

  const s = await getSettings();
  const lower = (name + " " + text).toLowerCase();
  const flagged = s.banned.some((w) => w && lower.includes(w.toLowerCase()));
  const status = !admin && (s.moderation || flagged) ? "pending" : "approved";
  const row: CommentRow = { id: crypto.randomUUID(), thread, parentId, name, text, time: Date.now(), status, visitor: visitorOf(c) };
  await kv.set(`px:c:${thread}:${row.id}`, row);
  if (!admin) await notify(s, status === "pending" ? "Blog 博客：新评论待审核" : "Blog 博客：新评论", `${name}（${thread}）：${text}`);
  return c.json({ id: row.id, name, text, time: row.time, likes: 0, liked: false, pending: status === "pending" || undefined, replies: [] });
});

/** 设置评论点赞，语义同文章点赞 */
app.post(`${P}/comments/:thread/:id/like`, async (c) => {
  const { thread, id } = c.req.param();
  const rowKey = `px:c:${thread}:${id}`;
  const row: CommentRow | null = validThread(thread) ? await kv.get(rowKey) : null;
  if (!row || !isPublic(row)) throw new HttpError(404, "评论不存在");
  const visitor = visitorOf(c);
  const body = await c.req.json().catch(() => ({}));
  const key = `px:cl:${thread}:${id}:${visitor}`;
  const legacy = row.likers?.includes(visitor) ?? false;
  const had = legacy || !!(await kv.get(key));
  const want = typeof body.liked === "boolean" ? body.liked : !had;
  if (want && !had) await kv.set(key, { cid: id, v: visitor });
  if (!want && had) {
    await kv.del(key);
    if (legacy) await kv.set(rowKey, { ...row, likers: row.likers!.filter((x) => x !== visitor) });
  }
  const others = (row.likers ?? []).filter((x) => x !== visitor).length;
  const likes = (await kv.getByPrefix(`px:cl:${thread}:${id}:`)).length + others;
  return c.json({ liked: want, likes });
});

/* ---------- 管理接口：请求头 X-Admin-Key 必须等于 Secret BLOG_AUTHOR_KEY ---------- */

app.get(`${P}/admin/verify`, (c) => { requireAdmin(c); return c.json({ ok: true }); });

/** 所有评论（扁平列表，最新在前） */
app.get(`${P}/admin/comments`, async (c) => {
  requireAdmin(c);
  const rows = (await kv.getByPrefix("px:c:")) as CommentRow[];
  return c.json(rows.sort((a, b) => b.time - a.time).map(({ likers: _l, visitor: _v, ...r }) => ({ ...r, status: r.status ?? "approved" })));
});

app.post(`${P}/admin/approve`, async (c) => {
  requireAdmin(c);
  const { thread, id } = await c.req.json().catch(() => ({}));
  const key = `px:c:${thread}:${id}`;
  const row: CommentRow | null = validThread(String(thread)) ? await kv.get(key) : null;
  if (!row) throw new HttpError(404, "评论不存在");
  await kv.set(key, { ...row, status: "approved" });
  return c.json({ ok: true });
});

/** 删除评论及其全部回复（连同它们的点赞） */
app.post(`${P}/admin/delete`, async (c) => {
  requireAdmin(c);
  const { thread, id } = await c.req.json().catch(() => ({}));
  if (!validThread(String(thread))) throw new HttpError(400, "无效的讨论区");
  const [rows, likes] = await Promise.all([kv.getByPrefix(`px:c:${thread}:`), kv.getByPrefix(`px:cl:${thread}:`)]);
  const doomed = new Set<string>([String(id)]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const r of rows as CommentRow[]) if (r.parentId && doomed.has(r.parentId) && !doomed.has(r.id)) { doomed.add(r.id); grew = true; }
  }
  // 只统计公开评论的数量，前端用它更新计数
  const deleted = (rows as CommentRow[]).filter((r) => doomed.has(r.id) && isPublic(r)).length;
  const keys = [...doomed].map((x) => `px:c:${thread}:${x}`);
  for (const l of likes as { cid: string; v: string }[]) if (doomed.has(l.cid)) keys.push(`px:cl:${thread}:${l.cid}:${l.v}`);
  await kv.mdel(keys);
  return c.json({ deleted });
});

app.get(`${P}/admin/settings`, async (c) => { requireAdmin(c); return c.json(await getSettings()); });
app.post(`${P}/admin/settings`, async (c) => {
  requireAdmin(c);
  const b = await c.req.json().catch(() => ({}));
  const s: Settings = {
    moderation: !!b.moderation,
    banned: (Array.isArray(b.banned) ? b.banned : []).map((w: unknown) => String(w).trim().slice(0, 40)).filter(Boolean).slice(0, 200),
    serverchan: String(b.serverchan ?? "").trim().slice(0, 100),
    tgToken: String(b.tgToken ?? "").trim().slice(0, 100),
    tgChat: String(b.tgChat ?? "").trim().slice(0, 40),
  };
  await kv.set("px:settings", s);
  return c.json(s);
});
app.post(`${P}/admin/notify-test`, async (c) => {
  requireAdmin(c);
  const n = await notify(await getSettings(), "Blog 博客：测试通知", "收到这条消息说明通知配置正确。");
  if (!n) throw new HttpError(400, "还没有配置任何通知方式");
  return c.json({ ok: true });
});

/** 在线文章：列表（含草稿）/ 新建或更新 / 删除 */
app.get(`${P}/admin/posts`, async (c) => {
  requireAdmin(c);
  const rows = (await kv.getByPrefix("px:post:")) as PostRow[];
  return c.json(rows.sort((a, b) => b.id - a.id));
});
app.post(`${P}/admin/posts`, async (c) => {
  requireAdmin(c);
  const b = await c.req.json().catch(() => ({}));
  const id = Number(b.id);
  if (!Number.isInteger(id) || id < 1 || id > 999999) throw new HttpError(400, "文章编号无效");
  const title = String(b.title ?? "").trim().slice(0, 120);
  const markdown = String(b.markdown ?? "").slice(0, 200_000);
  if (!title) throw new HttpError(400, "标题不能为空");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ? String(b.date) : new Date().toISOString().slice(0, 10);
  const row: PostRow = {
    id, title, markdown, date,
    excerpt: String(b.excerpt ?? "").trim().slice(0, 300),
    tag: String(b.tag ?? "随笔").trim().slice(0, 20) || "随笔",
    read: Math.max(0, Math.min(999, Number(b.read) || 0)),
    tone: ["primary", "secondary", "tertiary"].includes(b.tone) ? b.tone : "primary",
    icon: String(b.icon ?? "article").replace(/[^a-z0-9_]/g, "").slice(0, 40) || "article",
    cover: /^https:\/\//.test(String(b.cover ?? "")) ? String(b.cover).slice(0, 500) : undefined,
    draft: !!b.draft,
    updated: Date.now(),
  };
  await kv.set(`px:post:${id}`, row);
  return c.json(row);
});
app.post(`${P}/admin/posts/delete`, async (c) => {
  requireAdmin(c);
  const { id } = await c.req.json().catch(() => ({}));
  await kv.del(`px:post:${Number(id)}`);
  return c.json({ ok: true });
});

Deno.serve(app.fetch);
