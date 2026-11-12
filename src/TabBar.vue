<script setup lang="ts">
/**
 * 跟手滑动的悬浮底栏（参考 iOS 液态玻璃 Tab Bar 的交互）：
 * - 按住底栏任意位置，玻璃指示器“浮起”并跟随手指左右滑动，经过的标签会高亮
 * - 松手后指示器以弹簧曲线吸附到最近的标签并切换页面
 * - 轻点依旧直接切换；键盘（Tab + Enter）同样可用
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ items: readonly { key: string; label: string; icon: string }[]; active: string }>()
const emit = defineEmits<{ select: [key: string] }>()

const bar = ref<HTMLElement>()
const itemEls = ref<HTMLElement[]>([])
const x = ref(0) // 指示器左边位置（相对底栏）
const w = ref(0) // 指示器宽度
const dragging = ref(false)
const hoverIdx = ref(-1)
const stretch = ref(1) // 按滑动速度横向拉伸，营造“被拖动的液体”手感
const ready = ref(false)

const activeIdx = computed(() => props.items.findIndex((i) => i.key === props.active))
const litIdx = computed(() => (dragging.value ? hoverIdx.value : activeIdx.value))

function snap() {
  const el = itemEls.value[activeIdx.value]
  if (!el) return
  x.value = el.offsetLeft
  w.value = el.offsetWidth
}
watch(() => [props.active, props.items.length], () => nextTick(snap))

let ro: ResizeObserver
onMounted(() => {
  snap()
  requestAnimationFrame(() => (ready.value = true)) // 首次定位不播放动画
  ro = new ResizeObserver(snap)
  ro.observe(bar.value!)
})
onBeforeUnmount(() => ro?.disconnect())

let startX = 0, lastX = 0, lastT = 0, moved = false
function follow(clientX: number) {
  const els = itemEls.value
  const b = bar.value!.getBoundingClientRect()
  const first = els[0], last = els[els.length - 1]
  const min = first.offsetLeft + first.offsetWidth / 2
  const max = last.offsetLeft + last.offsetWidth / 2
  const center = Math.min(max, Math.max(min, clientX - b.left))
  // 指示器宽度取手指所在标签的宽度
  let idx = 0, best = Infinity
  els.forEach((el, i) => {
    const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center)
    if (d < best) { best = d; idx = i }
  })
  w.value = els[idx].offsetWidth
  x.value = center - w.value / 2
  if (idx !== hoverIdx.value) {
    if (hoverIdx.value !== -1) navigator.vibrate?.(6) // 安卓上经过标签时轻微震动
    hoverIdx.value = idx
  }
  const now = performance.now()
  const v = Math.abs(clientX - lastX) / Math.max(1, now - lastT) // px/ms
  stretch.value = 1 + Math.min(v * 0.12, 0.28)
  lastX = clientX
  lastT = now
}

function down(e: PointerEvent) {
  if (e.button !== 0) return
  bar.value!.setPointerCapture(e.pointerId)
  startX = lastX = e.clientX
  lastT = performance.now()
  moved = false
  hoverIdx.value = -1
  dragging.value = true
  follow(e.clientX)
}
function move(e: PointerEvent) {
  if (!dragging.value) return
  if (Math.abs(e.clientX - startX) > 4) moved = true
  follow(e.clientX)
}
function up() {
  if (!dragging.value) return
  dragging.value = false
  stretch.value = 1
  const item = props.items[hoverIdx.value]
  if (item && item.key !== props.active) emit('select', item.key)
  else if (item && !moved) emit('select', item.key) // 轻点当前标签：回到顶部
  snap()
}
function cancel() {
  dragging.value = false
  stretch.value = 1
  snap()
}

const indicatorStyle = computed(() => ({
  width: w.value + 'px',
  transform: `translateX(${x.value}px) scale(${(dragging.value ? 1.12 : 1) * stretch.value}, ${dragging.value ? 1.12 / Math.sqrt(stretch.value) : 1})`,
  transition: !ready.value
    ? 'none'
    : dragging.value
      ? 'transform 90ms ease-out, width 200ms ease-out, background-color 200ms'
      : 'transform 520ms cubic-bezier(0.34, 1.45, 0.64, 1), width 400ms cubic-bezier(0.34, 1.45, 0.64, 1), background-color 300ms',
}))
</script>

<template>
  <nav
    ref="bar"
    class="tabbar relative flex h-16 touch-none items-stretch rounded-full p-1.5 select-none"
    aria-label="主导航"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="cancel"
    @lostpointercapture="cancel"
  >
    <!-- 玻璃指示器 -->
    <span
      aria-hidden="true"
      class="indicator pointer-events-none absolute top-1.5 bottom-1.5 left-0 rounded-full"
      :class="{ lifted: dragging }"
      :style="indicatorStyle"
    ></span>

    <button
      v-for="(n, i) in items"
      :key="n.key"
      :ref="(el) => (itemEls[i] = el as HTMLElement)"
      class="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary"
      :class="litIdx === i ? 'text-on-secondary-container' : 'text-on-surface-variant'"
      :aria-current="activeIdx === i ? 'page' : undefined"
      @click="(e) => e.detail === 0 && emit('select', n.key)"
    >
      <span class="icon !text-[22px] transition-transform duration-300" :class="{ fill: litIdx === i, 'scale-110': dragging && litIdx === i }">{{ n.icon }}</span>
      <span class="text-[10px] leading-3 font-medium">{{ n.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
/* 玻璃质感：半透明 + 背景模糊 + 提亮饱和度 + 顶部高光描边 */
.tabbar {
  background: color-mix(in srgb, var(--md-surface-container) 62%, transparent);
  backdrop-filter: blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.45),
    inset 0 0 0 1px color-mix(in srgb, var(--md-outline-variant) 45%, transparent),
    0 10px 30px -10px rgb(0 0 0 / 0.35);
}
:global(.dark) .tabbar { box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12), inset 0 0 0 1px rgb(255 255 255 / 0.06), 0 10px 30px -10px rgb(0 0 0 / 0.7); }

.indicator {
  transform-origin: center;
  background: color-mix(in srgb, var(--md-secondary-container) 85%, transparent);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.5);
}
/* 拖动时：变成更通透的“镜片”，带高光和外发光 */
.indicator.lifted {
  background: color-mix(in srgb, var(--md-secondary-container) 55%, rgb(255 255 255 / 0.25));
  backdrop-filter: blur(2px) saturate(1.8) brightness(1.08);
  -webkit-backdrop-filter: blur(2px) saturate(1.8) brightness(1.08);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 0.7),
    inset 0 -1px 1px rgb(0 0 0 / 0.08),
    0 6px 18px -6px color-mix(in srgb, var(--md-primary) 45%, transparent);
}
@media (prefers-reduced-motion: reduce) { .indicator { transition: none !important; } }
</style>
