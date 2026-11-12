<script setup lang="ts">
// 全屏 WebGL 背景：fbm 域扭曲模拟流体，鼠标附近产生涡旋扰动
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { cssColor, mouse, reducedMotion, useThemeVersion } from './util'

const props = defineProps<{ lite?: boolean }>()
const el = ref<HTMLCanvasElement>()
const theme = useThemeVersion()
let raf = 0

const FRAG = `precision mediump float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uDark;
uniform vec3 uBase, uA, uB, uC;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; vec2 p = uv * vec2(uRes.x/uRes.y, 1.) * 2.2;
  vec2 m = uMouse * vec2(uRes.x/uRes.y, 1.) * 2.2;
  // 鼠标涡旋：绕鼠标旋转坐标，强度随距离衰减
  vec2 d = p - m; float r = length(d); float sw = 1.2 * exp(-r * r * 1.6);
  float cs = cos(sw), sn = sin(sw); p = m + mat2(cs, -sn, sn, cs) * d;
  float t = uTime * .06;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 w = vec2(fbm(p + 3.5*q + vec2(1.7, 9.2) + t*1.4), fbm(p + 3.5*q + vec2(8.3, 2.8) - t));
  float f = fbm(p + 3.*w);
  vec3 col = mix(uA, uB, smoothstep(.2, .9, length(q)));
  col = mix(col, uC, smoothstep(.55, .95, w.x) * .7);
  float strength = mix(.22, .35, uDark) * smoothstep(.25, .85, f);
  gl_FragColor = vec4(mix(uBase, col, strength), 1.);
}`

onMounted(() => {
  const c = el.value!
  const gl = c.getContext('webgl', { antialias: false, alpha: false })
  if (!gl) return
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s }
  const prog = gl.createProgram()!
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}'))
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog); gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const u = (k: string) => gl.getUniformLocation(prog, k)

  const setColors = () => {
    gl.uniform3fv(u('uBase'), cssColor('--md-surface'))
    gl.uniform3fv(u('uA'), cssColor('--md-primary'))
    gl.uniform3fv(u('uB'), cssColor('--md-tertiary-container'))
    gl.uniform3fv(u('uC'), cssColor('--px-lime'))
    gl.uniform1f(u('uDark'), document.documentElement.classList.contains('dark') ? 1 : 0)
  }
  setColors()
  watch(theme, () => requestAnimationFrame(setColors))

  const scale = props.lite ? 0.3 : 0.5 // 半分辨率渲染（精简模式更低），背景足够柔和且省电
  const resize = () => { c.width = innerWidth * scale; c.height = innerHeight * scale; gl.viewport(0, 0, c.width, c.height); gl.uniform2f(u('uRes'), c.width, c.height) }
  resize(); addEventListener('resize', resize)

  const sm = { x: 0.5, y: 0.5 }
  const t0 = performance.now()
  const still = reducedMotion()
  let lastDraw = 0
  const frame = (now = 0) => {
    if (props.lite && now - lastDraw < 33) { raf = requestAnimationFrame(frame); return } // 精简模式约 30fps
    lastDraw = now
    sm.x += (mouse.x / innerWidth - sm.x) * 0.05
    sm.y += (1 - mouse.y / innerHeight - sm.y) * 0.05
    gl.uniform2f(u('uMouse'), sm.x, sm.y)
    gl.uniform1f(u('uTime'), still ? 20 : (performance.now() - t0) / 1000)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    if (!still) raf = requestAnimationFrame(frame)
  }
  frame()
  onBeforeUnmount(() => { cancelAnimationFrame(raf); removeEventListener('resize', resize) })
})
</script>

<template>
  <canvas ref="el" aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 size-full"></canvas>
</template>
