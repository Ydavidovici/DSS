<template>
  <section class="relative pt-20 sm:pt-28 overflow-hidden" aria-labelledby="heroTitle" ref="sectionEl">
    <div class="absolute inset-0 -z-10 bg-gradient-to-br from-blush-100 via-sky-200 to-sage-200"></div>
    <div class="pointer-events-none absolute -top-24 -right-16 w-[360px] h-[360px] rounded-full bg-blush-300/60 blur-3xl" />
    <div class="pointer-events-none absolute -bottom-24 -left-16 w-[340px] h-[340px] rounded-full bg-sage-300/60 blur-3xl" />

    <div class="mx-auto max-w-6xl px-4 grid md:grid-cols-2 gap-10 items-center">
      <div>
        <h1 id="heroTitle" class="font-heading text-4xl sm:text-5xl mb-4">
          Soft, natural-light photography—<span class="bg-gradient-to-r from-blush-400 to-sky-400 bg-clip-text text-transparent">warm, real, you.</span>
        </h1>
        <p class="text-warmgray-600 mb-6">Outdoor and on-location sessions, Sun–Fri. Call or text to book.</p>
        <div class="flex gap-3">
          <a :href="`tel:${phone}`" class="px-5 py-3 rounded-md bg-blush-400/80 hover:bg-blush-400 shadow-card transition">Call</a>
          <a :href="`sms:${phone}`" class="px-5 py-3 rounded-md border border-warmgray-200 hover:bg-sky-200 transition">Text</a>
        </div>
      </div>

      <div class="relative">
        <div class="aspect-[4/3] rounded-lg overflow-hidden ring-1 ring-warmgray-200 shadow-card">
          <img :src="heroUrl" alt="Natural‑light portrait" class="w-full h-full object-cover transition-transform duration-200 hover:scale-[1.02]" />
        </div>

        <div class="hidden md:block absolute -right-6 -bottom-8 w-32 aspect-square rounded-lg overflow-hidden ring-1 ring-warmgray-200 shadow-card">
          <img :src="thumbUrl" alt="Detail shot" class="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { assetUrl, bestAssetUrl } from '@/lib/api'

const phone = import.meta.env.VITE_PHONE || '7477179328'

// the relative path inside backend media dir
const heroRel = 'grass.png'

// state
const heroUrl = ref(assetUrl(heroRel))   // optimistic fallback: original
const thumbUrl = ref(assetUrl(heroRel))  // will switch to a small derivative
const sectionEl = ref<HTMLElement | null>(null)

async function pickImages() {
  await nextTick()
  const container = sectionEl.value?.querySelector('.aspect-[4/3]') as HTMLElement | null
  const maxW = Math.min( // sensible guess for hero width
      1600,
      container?.clientWidth || 1280,
      window.innerWidth
  )

  // prefer AVIF; backend falls back if none
  heroUrl.value = await bestAssetUrl(heroRel, maxW, 'avif')
  thumbUrl.value = await bestAssetUrl(heroRel, 480, 'avif')
}

onMounted(pickImages)
</script>
