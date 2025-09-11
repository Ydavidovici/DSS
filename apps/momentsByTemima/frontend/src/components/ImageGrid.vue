<template>
  <div class="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
    <div v-for="(img, i) in images" :key="i" class="group relative overflow-hidden rounded-md ring-1 ring-warmgray-200">
      <img :src="img.src" :alt="img.alt" class="h-40 md:h-56 w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
const images = [
  { src: '/img/feat-1.jpg', alt: 'Featured 1' },
  { src: '/img/feat-2.jpg', alt: 'Featured 2' },
  { src: '/img/feat-3.jpg', alt: 'Featured 3' },
  { src: '/img/feat-4.jpg', alt: 'Featured 4' },
  { src: '/img/feat-5.jpg', alt: 'Featured 5' },
  { src: '/img/feat-6.jpg', alt: 'Featured 6' },
]
</script>
