<template>
  <section
      class="relative overflow-hidden h-[80vh] sm:h-screen flex items-center"
      aria-labelledby="heroTitle"
  >
    <img
        :src="heroUrl"
        alt="Natural‑light portrait"
        class="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-200"
    />

    <div class="relative z-20 mx-auto max-w-6xl px-4 grid md:grid-cols-2 gap-10 items-center">
      <div>
        <h1 id="heroTitle" class="font-heading text-4xl sm:text-5xl mb-4 text-rose-300 drop-shadow-md">
          Soft, natural-light photography—<span class="bg-gradient-to-r from-blush-400 to-sky-400 bg-clip-text text-rose-200">warm, real, you.</span>
        </h1>
        <p class="text-black mb-6 drop-shadow">Outdoor and on-location sessions, Sun–Fri. Call or text to book.</p>
        <div class="flex gap-3">
          <a :href="`tel:${phone}`" class="px-5 py-3 rounded-md bg-blush-400/80 hover:bg-blush-400 shadow-card transition text-white">Call</a>
          <a :href="`sms:${phone}`" class="px-5 py-3 rounded-md border border-white/40 hover:bg-white/10 transition text-white">Text</a>
        </div>
      </div>
    </div>
  </section></template>

<script setup lang="ts">
import { ref } from 'vue'
import { assetUrl } from '@/lib/api'

const phone = import.meta.env.VITE_PHONE || '7477179328'
const heroRel = 'SHLOMO.png'

const heroUrl = ref(assetUrl(heroRel))
</script>
