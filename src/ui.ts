import type { Tone } from './markdown'

/** 文章配色：完整类名写在这里，Tailwind 才能扫描到 */
export const toneClass: Record<Tone, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
}
