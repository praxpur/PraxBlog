import { reactive } from 'vue'
import { site } from './site.config'

export const GITHUB_USER = site.github

export interface Repo {
  name: string
  desc: string
  lang: string | null
  stars: number
  topics: string[]
  url: string
  homepage?: string
  updated: string
  fork: boolean
}

export const profile = reactive({
  login: '',
  name: site.author.name,
  bio: '',
  company: '',
  location: '',
  blog: '',
  twitter: '',
  avatar: '/favicon.svg',
  url: '#',
  followers: 0,
  following: 0,
  publicRepos: 0,
  since: new Date().getFullYear().toString(),
})

export const repos = reactive<Repo[]>([])
export const featured = site.featured
export const langColor: Record<string, string> = {
  Vue: '#41b883', Python: '#3572A5', 'C#': '#178600', JavaScript: '#f1e05a', TypeScript: '#3178c6',
  'C++': '#f34b7d', C: '#555555', 'Jupyter Notebook': '#DA5B0B',
}

export async function refreshFromGitHub() {
  // Add your own GitHub integration here if desired.
}
