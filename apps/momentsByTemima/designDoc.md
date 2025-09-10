# Temima Photography — Internal UI Brief v0.2

**Owner:** Yaakov Davidovici
**Client:** Temima Edgar
**Last updated:** v0.2

---

## A) TL;DR — Text this for fast confirmation (copy/paste)

**Yo! Quick confirm before I start building:**

1. **Look & feel:** Soft pastels on a **light** background, warm/friendly/calm vibe, tiny/subtle animations only. Fonts: **Cormorant Garamond** (headings) + **Inter** (body).
2. **Pages & flow:** Home, Portfolio, Services (says **“Call for pricing”**), About, Contact/Book. Home hero uses your photos with **Call** + **Text** buttons; Portfolio is a grid with a tap-to-expand gallery; Contact form has **Name, Email, Message** only.
3. **Booking & policies:** Primary booking = **Call/Text** (form optional). Availability **Sun–Fri**, mostly **outdoor/on‑location**; no fixed hours and **no travel radius** listed (moving soon). **No cancellation fee** for now. Offer **discount** if photos can be used in portfolio. Delivery via **online gallery**.

**Reply “Yes” or tell me what to tweak.**

---

## B) Locked Decisions (from client answers)

* **Primary actions:** Call/Text to book; form as secondary path.

    * **Tel:** 747‑717‑9328
    * **Email:** [temimaedgar@gmail.com](mailto:temimaedgar@gmail.com)
* **Vibe keywords:** Warm, Friendly, Calm
* **Theme:** Light background, soft pastels, nothing bright
* **Motion:** Subtle only (≤250ms fades/lifts; respect `prefers-reduced-motion`)
* **Service model:** Outdoor/on‑location; **no travel radius** shown
* **Availability:** Sun–Fri; **no strict hours**
* **Pricing:** “**Call for pricing**” (hide exact numbers for now)
* **Policies:** No cancellation fee; **portfolio‑use discount** available
* **Delivery:** **Online gallery**
* **Likes:** rivkakindermanphotography.com, meltzphotography.com
* **Dislikes:** elanalouis.com ("not as clean/put together")
* **Assets:** 2 logo ideas + client photos for hero/portfolio

---

## C) IA / Pages

```
/
├─ /portfolio (All; categories can come later)
├─ /services (no prices; bullet inclusions + “Call for pricing”)
├─ /about
└─ /contact (call, text, 3‑field form)
```

**Home**

* Hero (client photo) + headline/subline + **Call**/**Text** buttons
* Featured images (3–6)
* Services snapshot + link
* CTA bar (mobile sticky): Call/Text

**Portfolio**

* Responsive grid; **lightbox** with arrows/swipe
* Optional tags later (Portraits / Couples/Family / Events)

**Services**

* What you shoot; inclusions (shoot length, edited images, typical turnaround)
* **Call for pricing** prominent (tel/sms links)
* Portfolio‑discount sentence

**About**

* Friendly headshot + short, calm bio

**Contact**

* Big **Call**/**Text** buttons (tel/sms)
* **Form:** name\* / email\* / message\* (+ optional preferred date/time)
* Notes: Sun–Fri; outdoor/on‑location; delivery via online gallery

---

## D) Visual Direction (dev‑ready tokens)

**Palette (soft, low‑saturation pastels + warm neutrals)**

* `background`: #FAFAF8 (Pearl)
* `text`: #2B2B2B (Charcoal)
* `primary/50-500`: #FEF7FA → #F4E6EC (Blush)
* `accentSky/100-400`: #F5F9FF → #E6F0FA
* `accentSage/100-400`: #F3F8F6 → #E8F3EE
* `neutral/200`: #EAE6E3; `neutral/600`: #6B6460

**Type**

* Headings: **Cormorant Garamond** (600/700)
* Body/UI: **Inter** (400/500/600)

**Spacing/Radius/Shadow/Motion**

* 4px scale; base `16`
* Radius: `12–16`
* Shadow: soft `md`
* Motion: `200–250ms`, ease‑out; hover lift ≤4px

**Tokens JSON (drop into codebase)**

```json
{
  "color": {
    "background": "#FAFAF8",
    "text": "#2B2B2B",
    "primary": {"100": "#FBEFF4", "200": "#F8E9EF", "300": "#F6E3EA", "400": "#F5DCE6", "500": "#F4E6EC"},
    "sky": {"200": "#EEF5FD", "300": "#EAF2FB", "400": "#E6F0FA"},
    "sage": {"200": "#EEF6F3", "300": "#ECF4F1", "400": "#E8F3EE"},
    "neutral": {"200": "#EAE6E3", "600": "#6B6460"}
  },
  "font": {
    "heading": "Cormorant Garamond",
    "body": "Inter",
    "scale": {"h1": 42, "h2": 34, "h3": 28, "body": 16, "button": 15}
  },
  "radius": {"md": 12, "lg": 16},
  "shadow": {"card": "0 8px 24px rgba(0,0,0,0.06)"},
  "motion": {"fast": 200, "base": 250}
}
```

---

## E) Component Inventory (MVP)

* **Nav** (transparent → solid on scroll)
* **Buttons** (primary, outline)
* **Inputs** (text, email, textarea + error)
* **Hero** slice (image + text + CTAs)
* **Image grid** + **Lightbox**
* **Card** (service/feature)
* **Sticky mobile CTA** (Call/Text)
* **Footer** (contact + socials)
* **Toast/confirmation** for form submit

---

## F) Copy Stubs (internal placeholders)

* **Hero H1:** "Soft, natural‑light photography—warm, real, you."
* **Subline:** "Outdoor and on‑location sessions, Sun–Fri. Call or text to book."
* **Services blurb:** "Portraits, couples & family sessions. Delivery via online gallery. Call for pricing."
* **Discount note:** "Beginner rate available when images may be used in portfolio."

---

## G) Performance & A11y

* LCP < 2.7s (optimize hero; AVIF/WebP; responsive `srcset`/`sizes`)
* CLS < 0.1; explicit image sizes
* Keyboard reachable nav; visible focus rings; alt text
* Respect reduced‑motion

---

## H) Build Plan

* **Stack:** Next.js + Tailwind
* **Routes:** `/`, `/portfolio`, `/services`, `/about`, `/contact`
* **Images:** `/public/img` with responsive variants; next/image
* **Form:** Simple serverless email handler to start (upgrade later)
* **Links:** `tel:7477179328`, `sms:7477179328`

---

## I) Open Items

* Pick **Logo** (Logo vs Logo 2 vs simplified mark)
* Portfolio categories (v1 can be "All" only)
* Social links (IG assumed)
* Optional: typical turnaround time to display

---

## J) Versioning

* v0.2 — Converted to **internal** brief + added SMS confirmation block; added tokens JSON.
