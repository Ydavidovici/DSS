<template>
  <section class="pt-20 sm:pt-28">
    <div class="mx-auto max-w-6xl px-4 grid md:grid-cols-2 gap-10 items-center">
      <div>
        <h1 class="font-heading text-4xl sm:text-5xl mb-4">Soft, natural-light photography—warm, real, you.</h1>
        <p class="text-warmgray-600 mb-6">Outdoor and on-location sessions, Sun–Fri. Call or text to book.</p>
        <div class="flex gap-3">
          <a :href="`tel:${phone}`" class="px-5 py-3 rounded-md bg-blush-400 hover:bg-blush-500 transition">Call</a>
          <a :href="`sms:${phone}`" class="px-5 py-3 rounded-md border border-warmgray-200 hover:bg-warmgray-200/50 transition">Text</a>
        </div>
      </div>
      <div class="aspect-[4/3] rounded-lg overflow-hidden shadow-card">
        <img :src="heroUrl" alt="Hero" class="w-full h-full object-cover" />
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
const phone = import.meta.env.VITE_PHONE
const heroUrl = "/placeholder-hero.jpg" // replace with client asset
</script>
