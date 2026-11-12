/**
 * 外观：深色模式 + MD3 动态取色。
 * 动态取色用 Google 官方 material-color-utilities，从一个种子色生成整套浅色/深色颜色角色，
 * 以 <style id="px-theme"> 覆盖 index.css 里的默认变量。
 */
import { computed, ref, watch } from 'vue'
import { argbFromHex, hexFromArgb, Hct, MaterialDynamicColors as C, SchemeTonalSpot, sourceColorFromImage } from '@material/material-color-utilities'
import { site } from './site.config'

/* ---------- 深色模式 ---------- */
export type Mode = 'light' | 'dark' | 'system'
export const mode = ref<Mode>((localStorage.getItem('px-mode') as Mode) ?? 'system')
const sysDark = ref(matchMedia('(prefers-color-scheme: dark)').matches)
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => (sysDark.value = e.matches))
export const dark = computed(() => (mode.value === 'system' ? sysDark.value : mode.value === 'dark'))
watch(dark, (v) => document.documentElement.classList.toggle('dark', v), { immediate: true })
watch(mode, (m) => (m === 'system' ? localStorage.removeItem('px-mode') : localStorage.setItem('px-mode', m)))
export const toggleDark = () => (mode.value = dark.value ? 'light' : 'dark')

/* ---------- 动态取色 ---------- */
const ROLES = {
  '--md-primary': C.primary, '--md-on-primary': C.onPrimary,
  '--md-primary-container': C.primaryContainer, '--md-on-primary-container': C.onPrimaryContainer,
  '--md-secondary-container': C.secondaryContainer, '--md-on-secondary-container': C.onSecondaryContainer,
  '--md-tertiary-container': C.tertiaryContainer, '--md-on-tertiary-container': C.onTertiaryContainer,
  '--md-surface': C.surface, '--md-on-surface': C.onSurface, '--md-on-surface-variant': C.onSurfaceVariant,
  '--md-surface-container-low': C.surfaceContainerLow, '--md-surface-container': C.surfaceContainer,
  '--md-surface-container-high': C.surfaceContainerHigh, '--md-outline': C.outline, '--md-outline-variant': C.outlineVariant,
}

export const presets = [site.seedColor, '#006A6A', '#8B5000', '#B3261E', '#386A20', '#0061A4']
export const seed = ref(localStorage.getItem('px-seed') || site.seedColor)

function cssFor(hex: string) {
  const hct = Hct.fromInt(argbFromHex(hex))
  const block = (isDark: boolean) => {
    const s = new SchemeTonalSpot(hct, isDark, 0)
    return Object.entries(ROLES).map(([v, role]) => `${v}:${hexFromArgb(role.getArgb(s))}`).join(';')
  }
  return `:root{${block(false)}}.dark{${block(true)}}`
}

watch(
  seed,
  (hex) => {
    let el = document.getElementById('px-theme')
    const isDefault = hex.toLowerCase() === site.seedColor.toLowerCase()
    if (isDefault) {
      el?.remove() // 默认色使用 index.css 中手工校对过的配色
      localStorage.removeItem('px-seed')
    } else {
      if (!el) { el = document.createElement('style'); el.id = 'px-theme'; document.head.appendChild(el) }
      el.textContent = cssFor(hex)
      localStorage.setItem('px-seed', hex)
    }
    document.documentElement.dataset.seed = hex // 通知 Shader / 粒子重新读取颜色
  },
  { immediate: true },
)

/** 从图片（如 GitHub 头像）提取主色 */
export async function seedFromImage(url: string) {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  await img.decode()
  return hexFromArgb(await sourceColorFromImage(img))
}
