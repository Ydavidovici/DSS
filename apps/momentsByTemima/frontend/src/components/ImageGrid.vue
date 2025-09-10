<template>
  <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
    <img v-for="img in images" :key="img.id" :src="img.url"
         class="w-full h-auto rounded-md shadow-card"
         :alt="img.alt || 'portfolio image'" />
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
const images = ref<{ id:number, url:string, alt?:string }[]>([])
const API = import.meta.env.VITE_API_BASE_URL
onMounted(async () => {
  try {
    const res = await fetch(`${API}/portfolio`)
    const data = await res.json()
    images.value = data.images || []
  } catch (e) { console.error(e) }
})
</script>
