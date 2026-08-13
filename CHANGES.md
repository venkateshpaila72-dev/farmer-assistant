# What changed (direct)

## 1) Background image for landing page
Put your image at: `frontend/public/bg.jpg` (I copied hero.png there as demo).

Added inside `<header>` in `frontend/src/pages/public/Home.jsx`:
```jsx
{/* Background image for landing page */}
<div className="absolute inset-0 z-0">
  <img src="/bg.jpg" alt="" className="w-full h-full object-cover opacity-30" />
  <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg/60 to-bg/95" />
</div>
```
Also added `z-20` to the content grid so text stays above it.

## 2) Framer Motion (frame motion) animations
Already installed. Edited these components:
- `frontend/src/components/motion/FadeUp.jsx` → added `scale: 0.97 -> 1` fade-in
- `frontend/src/components/motion/RevealOnScroll.jsx` → added `scale: 0.98 -> 1` scroll reveal

So every `FadeUp` and `RevealOnScroll` now animates with scale + fade.

## 3) Animation while scrolling
Already handled by `<RevealOnScroll>` wrapping feature/news sections. If you want to add your own anywhere else, paste this:

```jsx
import { motion } from "framer-motion";

<motion.div
  initial={{ opacity: 0, y: 30, scale: 0.95 }}
  whileInView={{ opacity: 1, y: 0, scale: 1 }}
  viewport={{ once: true, amount: 0.2 }}
  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
>
  your content
</motion.div>
```

Quick copy-paste for hero text animation (already done via FadeUp):
```jsx
<FadeUp as="h1" delay={0.08}>...</FadeUp>
```

Done — just replace `frontend/public/bg.jpg` with your actual background image and run `npm run dev` in `frontend/`.
