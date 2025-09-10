<template>
  <form @submit.prevent="submit" class="space-y-3 max-w-lg">
    <input v-model="name" required placeholder="Name" class="w-full border rounded-md px-4 py-3" />
    <input v-model="email" type="email" required placeholder="Email" class="w-full border rounded-md px-4 py-3" />
    <textarea v-model="message" required placeholder="Message" rows="5" class="w-full border rounded-md px-4 py-3"></textarea>
    <button :disabled="loading" class="px-5 py-3 rounded-md bg-blush-400 hover:bg-blush-500 transition">{{ loading ? 'Sending…' : 'Send' }}</button>
    <p v-if="ok" class="text-green-700">Thanks! I’ll reply soon.</p>
  </form>
</template>
<script setup lang="ts">
import { ref } from 'vue'
const API = import.meta.env.VITE_API_BASE_URL
const name = ref('')
const email = ref('')
const message = ref('')
const loading = ref(false)
const ok = ref(false)
async function submit(){
  loading.value = true; ok.value = false
  try{
    const res = await fetch(`${API}/contact`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({name:name.value, email:email.value, message:message.value})
    })
    if(res.ok){ ok.value = true; name.value=''; email.value=''; message.value=''; }
  } finally { loading.value = false }
}
</script>
