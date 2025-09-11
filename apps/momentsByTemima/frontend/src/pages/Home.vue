<template>
  <main class="pt-20 sm:pt-24">
    <!-- Pastel wash behind hero -->
    <div class="relative">
      <div class="absolute inset-0 -z-10 bg-gradient-to-br from-blush-100 via-sky-200 to-sage-200"></div>
      <Hero />
    </div>

    <section class="mt-16 mx-auto max-w-6xl px-4">
      <div class="mb-6">
        <h2 class="font-heading text-3xl">Recent Work</h2>
        <!-- subtle accent bar -->
        <div class="mt-2 h-1 w-24 rounded-full bg-gradient-to-r from-blush-300 via-sky-300 to-sage-300"></div>
      </div>
      <ImageGrid />
    </section>
  </main>
</template>

<script setup lang="ts">
import Hero from '../components/Hero.vue'
import ImageGrid from '../components/ImageGrid.vue'
</script>
