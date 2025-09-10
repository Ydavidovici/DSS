<template>
  <main class="mx-auto max-w-6xl px-4 pt-24">
    <h1 class="font-heading text-4xl mb-6">Contact / Book</h1>
    <div class="flex gap-4 mb-6">
      <a :href="`tel:${phone}`" class="px-5 py-3 rounded-md bg-blush-400 hover:bg-blush-500 transition">Call</a>
      <a :href="`sms:${phone}`" class="px-5 py-3 rounded-md border border-warmgray-200 hover:bg-warmgray-200/50 transition">Text</a>
      <a :href="`mailto:${email}`" class="px-5 py-3 rounded-md border border-warmgray-200 hover:bg-warmgray-200/50 transition">Email</a>
    </div>
    <ContactForm />
  </main>
</template>
<script setup lang="ts">
import ContactForm from '../components/ContactForm.vue'
const phone = import.meta.env.VITE_PHONE
const email = import.meta.env.VITE_EMAIL
</script>
