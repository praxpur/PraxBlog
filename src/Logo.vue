<script setup lang="ts">
defineProps<{ mark?: boolean }>()
</script>

<template>
  <svg v-if="mark" class="px-logo px-mark" viewBox="0 0 40 40" role="img" aria-label="Blog">
    <circle cx="20" cy="20" r="18" fill="currentColor" />
    <path d="M13 10h8a7 7 0 0 1 4 12 7 7 0 0 1-5 12h-7V10Zm6 10a3 3 0 1 0 0-6h-2v6h2Zm1 10a3 3 0 1 0 0-6h-3v6h3Z" fill="var(--px-lime, #d6f53a)" />
  </svg>
  <span v-else class="px-logo text-xl font-semibold tracking-[0.18em]" aria-label="Blog">BLOG</span>
</template>

<style scoped>
.px-logo { display: block; }
</style>
