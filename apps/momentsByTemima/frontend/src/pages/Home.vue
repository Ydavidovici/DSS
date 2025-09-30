<template>
  <main class="pt-20 sm:pt-24">
    <!-- Pastel wash behind hero -->
    <div class="relative">
      <div class="absolute inset-0 -z-10 bg-gradient-to-br from-blush-100 via-sky-200 to-sage-200"></div>
      <Hero />
    </div>

    <section class="mt-20 mx-auto max-w-3xl px-4 text-center">
      <h2 class="font-heading text-3xl sm:text-4xl mb-4 text-pink-700">
        About Moments by Temima
      </h2>
      <p class="text-gray-800 text-lg leading-relaxed">
        At Moments by Temima, we specialize in capturing natural-light portraits that highlight your authentic self. Whether you're celebrating a milestone or simply want to preserve a beautiful moment, our goal is to create timeless images that feel real, warm, and uniquely you.
      </p>
    </section>


    <section class="mt-16 mx-auto max-w-6xl px-4">
      <div class="mb-6">
        <h2 class="font-heading text-3xl">Recent Work</h2>
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
