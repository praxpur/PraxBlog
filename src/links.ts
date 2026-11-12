export interface FriendLink {
  name: string
  url: string
  desc: string
  icon: string
  tone: "primary" | "secondary" | "tertiary"
}

export const links: FriendLink[] = [
  {
    name: "Vue.js",
    url: "https://vuejs.org",
    desc: "渐进式 JavaScript 框架",
    icon: "deployed_code",
    tone: "primary",
  },
  {
    name: "Material Design",
    url: "https://m3.material.io",
    desc: "Google 开源设计系统",
    icon: "palette",
    tone: "tertiary",
  },
  {
    name: "Tailwind CSS",
    url: "https://tailwindcss.com",
    desc: "原子化 CSS 框架",
    icon: "air",
    tone: "secondary",
  },
  {
    name: "Vite",
    url: "https://vite.dev",
    desc: "下一代前端构建工具",
    icon: "bolt",
    tone: "primary",
  },
  {
    name: "MDN Web Docs",
    url: "https://developer.mozilla.org",
    desc: "Web 开发者的百科全书",
    icon: "menu_book",
    tone: "secondary",
  },
]
