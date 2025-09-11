<template>
  <div class="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 sm:hidden">
    <div class="rounded-full shadow-card ring-1 ring-warmgray-200 bg-pearl/95 backdrop-blur px-2 py-2 flex gap-2">
      <a
          :href="`tel:${phone}`"
          class="rounded-full px-4 py-2 text-sm bg-blush-400/80 hover:bg-blush-400 transition"
      >
        Call
      </a>
      <a
          :href="`sms:${phone}`"
          class="rounded-full px-4 py-2 text-sm border border-warmgray-200 hover:bg-sky-200 transition"
      >
        Text
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
const phone = import.meta.env.VITE_PHONE || '7477179328'
</script>
