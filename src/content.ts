/**
 * 文章数据源：
 * - 本地：content/posts/*.md（随代码发布，可被预渲染、进入 RSS）
 * - 在线：管理后台发布到 Supabase 的文章（无需重新发布网站）
 */
import { computed, ref } from 'vue'
import { buildPost, byDateDesc, parsePostFile, type Post, type PostMeta } from './markdown'

const files = import.meta.glob('/content/posts/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
export const localPosts: Post[] = Object.values(files).map((raw) => parsePostFile(raw, 'local'))

/** 在线文章原始数据（来自后端） */
export interface RemotePost extends PostMeta { markdown: string }
export const remotePosts = ref<Post[]>([])
export function setRemotePosts(list: RemotePost[]) {
  const localIds = new Set(localPosts.map((p) => p.id))
  remotePosts.value = list.filter((p) => !p.draft && !localIds.has(p.id)).map((p) => buildPost(p, p.markdown, 'remote'))
}

export const allPosts = computed(() => [...localPosts, ...remotePosts.value].sort(byDateDesc))
export const nextPostId = (extra: number[] = []) => Math.max(0, ...allPosts.value.map((p) => p.id), ...extra) + 1
export type { Post }
