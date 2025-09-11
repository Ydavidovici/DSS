<template>
  <header class="fixed inset-x-0 top-0 z-50 bg-white/70 backdrop-blur border-b border-warmgray-200/60">
    <nav class="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
      <RouterLink to="/" class="font-heading text-2xl">Moments By Temima</RouterLink>

      <ul class="hidden sm:flex gap-6 text-sm">
        <li><RouterLink to="/portfolio">Portfolio</RouterLink></li>
        <li><RouterLink to="/services">Services</RouterLink></li>
        <li><RouterLink to="/about">About</RouterLink></li>
        <li><RouterLink to="/contact">Contact</RouterLink></li>
      </ul>

      <div class="hidden sm:flex gap-2">
        <a :href="`tel:${phone}`" class="px-3 py-2 rounded-md bg-blush-400/80 hover:bg-blush-400 transition">Call</a>
        <a :href="`sms:${phone}`" class="px-3 py-2 rounded-md border border-warmgray-200 hover:bg-sky-200 transition">Text</a>
      </div>
    </nav>
    <!-- thin pastel underline to add color without heaviness -->
    <div class="h-[3px] bg-gradient-to-r from-blush-200 via-sky-200 to-sage-200"></div>
  </header>
</template>

<script setup lang="ts">
const phone = import.meta.env.VITE_PHONE || '7477179328'
</script>
