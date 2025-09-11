<template>
  <NavBar />
  <RouterView />
  <FooterBar />
  <StickyCTA />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import NavBar from './components/NavBar.vue'
import FooterBar from './components/FooterBar.vue'
import StickyCTA from './components/StickyCTA.vue'
</script>
