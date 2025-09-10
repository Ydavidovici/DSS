import { createRouter, createWebHistory } from 'vue-router'
import Home from './pages/Home.vue'
import Portfolio from './pages/Portfolio.vue'
import Services from './pages/Services.vue'
import About from './pages/About.vue'
import Contact from './pages/Contact.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/portfolio', component: Portfolio },
    { path: '/services', component: Services },
    { path: '/about', component: About },
    { path: '/contact', component: Contact },
  ],
  scrollBehavior() { return { top: 0 } }
})
