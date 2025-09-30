<template>
  <div class="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
    <div v-for="(img, i) in images" :key="i" class="group relative overflow-hidden rounded-md ring-1 ring-warmgray-200">
      <img :src="img.src" :alt="img.alt" class="h-40 md:h-56 w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { assetUrl } from '@/lib/api'

const images = [
  { src: assetUrl('Oelbaum-020 (1).jpg'), alt: 'Featured 1' },
  { src: assetUrl('SHLOMO.png'), alt: 'Featured 2' },
  { src: assetUrl('Shlomo-001.jpg'), alt: 'Featured 3' },
  { src: assetUrl('Shlomo-001-3.jpg'), alt: 'Featured 4' },
  { src: assetUrl('Shlomo-001-4.jpg'), alt: 'Featured 5' },
  { src: assetUrl('shlomo-002.jpg'), alt: 'Featured 6' },
]
</script>
