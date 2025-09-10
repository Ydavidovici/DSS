<template>
  <main class="pt-20 sm:pt-24">
    <Hero />
    <section class="mt-16 mx-auto max-w-6xl px-4">
      <h2 class="font-heading text-3xl mb-6">Recent Work</h2>
      <ImageGrid />
    </section>
  </main>
</template>
<script setup lang="ts">
import Hero from '../components/Hero.vue'
import ImageGrid from '../components/ImageGrid.vue'
</script>
