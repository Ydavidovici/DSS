<template>
  <header class="fixed inset-x-0 top-0 z-50 bg-white/70 backdrop-blur">
    <nav class="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
      <RouterLink to="/" class="font-heading text-2xl">Temima</RouterLink>
      <ul class="flex gap-6 text-sm">
        <li><RouterLink to="/portfolio">Portfolio</RouterLink></li>
        <li><RouterLink to="/services">Services</RouterLink></li>
        <li><RouterLink to="/about">About</RouterLink></li>
        <li><RouterLink to="/contact">Contact</RouterLink></li>
      </ul>
    </nav>
  </header>
</template>
