# REA Reverse Engineering & Tech-Stack Report: `https://www.ssemble.com/`

## 1. REA Evidence Ledger & Cryptographic Digests

| Evidence ID / Unknown ID | Operation / Domain | Provider | Confidence / Authority | Summary |
| :--- | :--- | :--- | :--- | :--- |
| `ev_b46dcd49822027f6739206b5b30b07147734590c9feee9e14e72bd2b600f2bd7` | `capture_browser_scenario` | `rea-playwright-browser-scenario` (Chromium `155.0.8059.85`) | `observed` / `controlled-replay` | Complete controlled replay of `https://www.ssemble.com/`; `scenario_sha256: c0e9f352a7ca6bc3ece191b77ceb2d3208e7165f996e306323b2e005fc026e03`; DOM (`652,558` bytes, SHA-256 `fcfb0430...`), Accessibility Tree (`25,761` bytes, SHA-256 `04b32d19...`), Storage, and 107 first-party network transactions. |
| `ev_bc80bc5d3163ca2311d1df13b348cb8039166d685a1c2ad20b6937906b6737fe` | `record_unknown` (`unk_f9da2eb7...`) | `rea-unknown-registry` | `derived` / `analyst-inference` | Documents the server-side boundary behind `https://aiclipping.ssemble.com/api/v1/shorts/create` and `https://plugin-shortsmaker.ssemble.com`. |
| `ev_a2d8e778f71cf92ec3f55df56c893f65ddf376029d0c34d00f54e2e7a40c0344` | `record_unknown` (`unk_d7ee08ab...`) | `rea-unknown-registry` | `derived` / `analyst-inference` | Documents third-party iframe subrequests beyond the 120-transaction scenario capture budget. |

---

## 2. Observed Frontend & Backend Tech Stack

### A. Marketing & SEO Application (`https://www.ssemble.com/`)
- **Framework:** Next.js (App Router, React 18 Server Components + Webpack chunks `/_next/static/chunks/webpack-1d14888339a71363.js`).
- **Hosting / Edge:** Vercel (`Server: Vercel`, `X-Matched-Path: /en`).
- **Styling & UI:** Tailwind CSS (`tailwind-merge` + `clsx`), `next-themes`, `styled-jsx`, `framer-motion`, `embla-carousel-react`, `react-fast-marquee`, `lucide-react`, `react-wrap-balancer`.
- **Internationalization:** `next-intl` (15 locales) + Google Translate Element fallback.
- **Analytics & Attribution:** PostHog (`phc_jFehf3fSlrC8UB7XH6VaaxiN6Ksdzsdoa3yS8HhngCu`), GA4 (`G-D8SSW0G3GH`), Google Ads (`AW-18008141156`), TikTok Pixel (`D6B8D5RC77UCIF8JKASG`), Meta Pixel (`1086652617227185`), and `#ad-click-capture` cookie/localStorage synchronizer.

### B. Logged-In Studio SPA (`https://app.ssemble.com/`)
- **Framework & Bundler:** React 18 SPA bundled with Vite (`/assets/index-250c6a68.js`, `8,880,067` bytes, SHA-256 `c31f03ee8316422f8cb5b458aaece600a263aa28e58139692d01e90b590e44cd`), served behind Cloudflare.
- **Routing & State:** `react-router-dom` v6 (`/projects`, `/dashboard`, `/shorts/:requestId/:shortId`, `/clip-rewards`, `/channel-automation`), Zustand, Recoil, Axios, Formik.
- **Editor Media Libraries:**
  - `wavesurfer.js` for audio waveform rendering
  - `fabric.js` + HTML5 `<canvas>` for interactive 9:16 crop/framing (`offset_x`) and caption overlay positioning
  - `hls.js` + `plyr` for video playback
  - `gsap` + `three.js` for animations

### C. Backend Microservices & Cloud Rendering Pipeline
- **AI Clipping API (`https://aiclipping.ssemble.com`):** Express.js service exposing `/api/v1/shorts/create`, `/api/v1/templates` (Hormozi 1 & 2, MrBeast, Karaoke, Ali, Iman, Box), `/api/v1/game-videos`, `/api/v1/music`, `/api/v1/meme-hooks`, and `/api/stripe/pricing`.
- **ShortsMaker Plugin Service (`https://plugin-shortsmaker.ssemble.com`):** Manages clip generation jobs (`/userRequests/${id}`, `/shorts/${requestId}`). Editar changes trigger server-side VM recompilation (`recompiling === true`), polled every `5000` ms by the React client, with rendered MP4s stored on Azure Blob Storage (`ssembleshorts.blob.core.windows.net`) and delivered via Cloudflare CDN (`cf.ssemble.com`).
- **Social Uploader (`https://plugin-socialuploader-api.shortscreator.online`):** Handles geo-IP (`/api/user-location`), multi-platform scheduling (`/api/schedule-upload/multi`), and YouTube Channel Automation.
