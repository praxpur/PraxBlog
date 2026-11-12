/**
 * 动效等级：full 完整 / lite 精简（降分辨率、降帧率、减少粒子）/ off 关闭
 * 未手动设置时自动判断：系统开启“减少动态效果”→ off；弱设备或省流量模式 → lite
 */
import { reactive, watch } from 'vue'

export type FxLevel = 'full' | 'lite' | 'off'
const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }

function autoLevel(): FxLevel {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off'
  const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || nav.connection?.saveData
  return weak ? 'lite' : 'full'
}

const saved = localStorage.getItem('px-fx') as FxLevel | null
export const fx = reactive({ level: saved ?? autoLevel(), auto: !saved })

export function setFx(level: FxLevel | 'auto') {
  if (level === 'auto') {
    localStorage.removeItem('px-fx')
    fx.auto = true
    fx.level = autoLevel()
  } else {
    localStorage.setItem('px-fx', level)
    fx.auto = false
    fx.level = level
  }
}

// 供 CSS 使用：[data-fx="off"] 下关闭文字动画等
watch(() => fx.level, (l) => (document.documentElement.dataset.fx = l), { immediate: true })
