<template>
  <main class="">
    <div class="relative">
      <div class="absolute inset-0 -z-10 bg-gradient-to-br from-blush-100 via-sky-200 to-sage-200"></div>
      <Hero />
    </div>

    <section class=" mx-auto max-w-3xl px-4 py-10 mt-10 text-center">
      <h2 class="font-heading text-3xl sm:text-4xl mb-4 text-pink-700">
        About Moments by Temima
      </h2>
      <p class="text-gray-800 text-lg leading-relaxed ">
        At Moments by Temima, we specialize in capturing natural-light portraits that highlight your
        authentic self. Whether you're celebrating a milestone or simply want to preserve a beautiful
        moment, our goal is to create timeless images that feel real, warm, and uniquely you.
      </p>
    </section>


    <section class="mt-16 mx-auto max-w-6xl px-4">
      <div class="mb-6">
        <h2 class="font-heading text-3xl">Recent Work</h2>
        <div class="mt-2 h-1 w-24 rounded-full bg-gradient-to-r from-blush-300 via-sky-300 to-sage-300"></div>
      </div>
      <ImageGrid />
    </section>

    <section class="mt-20 bg-pink-50 py-16 text-center">
      <h2 class="font-heading text-3xl text-pink-700 mb-4">Let's Capture Your Moment</h2>
      <p class="text-gray-700 max-w-xl mx-auto mb-6">
        Whether it's a milestone or an everyday smile, We'd love to help you preserve it beautifully.
      </p>
      <RouterLink
          to="/contact"
          class="inline-block bg-pink-600 text-white px-6 py-2 rounded-md hover:bg-pink-700 transition">
        Get in Touch
      </RouterLink>
    </section>

    <section class="mt-20 mx-auto max-w-4xl px-4 text-center">
      <h2 class="font-heading text-3xl mb-8 text-sky-700">Testimonials</h2>
      <div class="grid gap-8 sm:grid-cols-2">
        <blockquote class="bg-white p-6 rounded-2xl shadow">
          <p class="italic text-gray-700">
            “Temima made us feel so comfortable — and the photos are stunning.”
          </p>
          <footer class="mt-4 text-sm font-medium text-gray-600">
            — Sarah &amp; Eli
          </footer>
        </blockquote>
        <blockquote class="bg-white p-6 rounded-2xl shadow">
          <p class="italic text-gray-700">
            “Every shot looked natural and effortless. A true artist.”
          </p>
          <footer class="mt-4 text-sm font-medium text-gray-600">
            — Miriam L.
          </footer>
        </blockquote>
      </div>
    </section>

    <section class="mt-20 bg-sage-50 py-16">
      <h2 class="font-heading text-3xl text-center mb-8 text-sage-800">How It Works</h2>
      <div class="grid gap-8 sm:grid-cols-3 text-center">
        <div>
          <h3 class="font-semibold text-lg mb-2 text-sage-700">1. Book a Session</h3>
          <p class="text-gray-600">Pick your preferred date and package — we’ll confirm details right away.</p>
        </div>
        <div>
          <h3 class="font-semibold text-lg mb-2 text-sage-700">2. Enjoy the Shoot</h3>
          <p class="text-gray-600">Relax and be yourself; we’ll handle lighting, posing, and magic.</p>
        </div>
        <div>
          <h3 class="font-semibold text-lg mb-2 text-sage-700">3. Receive Your Gallery</h3>
          <p class="text-gray-600">Your edited photos arrive via a private gallery — ready to share or print.</p>
        </div>
      </div>
    </section>

  </main>
</template>

<script setup lang="ts">
import Hero from '../components/Hero.vue'
import ImageGrid from '../components/ImageGrid.vue'
</script>
