<template>
  <footer class="mt-24 border-t border-warmgray-200">
    <div class="mx-auto max-w-6xl px-4 py-10 text-sm text-warmgray-600">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p>&copy; {{ new Date().getFullYear() }} Temima Photography</p>
        <div class="flex gap-4">
          <a :href="`tel:${phone}`">Call</a>
          <a :href="`sms:${phone}`">Text</a>
          <a :href="`mailto:${email}`">Email</a>
        </div>
      </div>
    </div>
  </footer>
</template>
<script setup lang="ts">
const phone = import.meta.env.VITE_PHONE
const email = import.meta.env.VITE_EMAIL
</script>
