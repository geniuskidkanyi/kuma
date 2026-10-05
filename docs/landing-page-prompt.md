# Landing-page generation prompt for Kuma

Paste the prompt below into an AI builder (Claude, v0, Lovable, Bolt, etc.) or
hand it to a designer/developer. It is written to produce a single-page
marketing + collaborator-recruitment site.

---

## PROMPT

You are building the official landing page for **Kuma**, an open-source desktop
app. Produce a single, responsive, production-quality landing page as **one
self-contained `index.html`** (inline CSS + minimal vanilla JS, no build step,
no external frameworks). It must look modern and trustworthy, load fast on slow
connections, and work on low-end phones.

### What Kuma is
Kuma (Mandinka for *"word / speech"*) is a free, open-source, **100% offline**
audio & video transcription app for macOS, Linux, and Windows. It runs OpenAI's
Whisper speech-recognition models locally on the user's own machine via
whisper.cpp — no internet, no API keys, no per-minute fees, nothing leaves the
device. It is built with Tauri (Rust) and React.

### The mission (make this the emotional core of the page)
Speech-to-text barely works for most African languages because the models are
starved of training data. Kuma's mission is to change that. It lets anyone
**import community-trained models** for languages like Yoruba, Swahili, Amharic,
Hausa, Wolof, Luganda and more, and it turns every user into a contributor by
letting them correct transcripts and donate that data back to open language
projects. Built in The Gambia, for Africa and the world.

### Primary audiences
1. **Users** who need transcription: journalists, researchers, students,
   radio/media houses, NGOs, podcasters, courts, and anyone documenting
   interviews or oral history in an African language.
2. **Collaborators** we want to recruit: developers (Rust/React), ML/ASR
   engineers who can fine-tune Whisper on African languages, linguists and
   native speakers who can validate output and contribute voice data, and
   translators to localize the app's UI.

### Page sections (in order)
1. **Hero** — product name "Kuma", a one-line tagline (e.g. *"Speech to text for
   every African language — offline, free, and open."*), a short subhead, and
   two buttons: **Download** (primary) and **Contribute on GitHub** (secondary).
   Include a small badge line: "Offline · Open source · No account · macOS /
   Linux / Windows". Show a clean mockup/screenshot placeholder of the app UI (a
   dark window with a transcript and timestamps).
2. **The problem** — a short, honest block: stock Whisper supports only a handful
   of African languages and does them poorly; dozens of major languages aren't
   covered at all. State it plainly, with empathy, not jargon.
3. **How Kuma helps** — 3–4 feature cards with simple icons:
   - *Offline & private* — runs entirely on your device.
   - *Bring any model* — import community fine-tunes for your language from a
     file or a Hugging Face link.
   - *Edit & export* — fix the transcript, export SRT / VTT / TXT.
   - *Give back* — correct transcripts and help build open datasets for African
     ASR.
4. **Who it's for** — a row of use cases: journalism, research, education, radio,
   NGOs, language preservation.
5. **Join us / Collaborators** — the recruitment section. Four clear "ways to
   contribute" cards, each with a one-line ask and a call-to-action link:
   - **Code** — "Help build Kuma in Rust & React." → GitHub repo / good-first-issues.
   - **Train models** — "Fine-tune Whisper on your language." → a CONTRIBUTING / models guide link.
   - **Validate & record** — "Native speakers: check output and contribute voice data." → a sign-up / form link.
   - **Translate the app** — "Localize Kuma's interface." → a translation guide link.
   Add an email capture / "Join the mailing list" input and a prominent GitHub
   link. Use placeholder links: `GITHUB_URL`, `DISCORD_URL`, `CONTRIBUTE_URL`,
   `SIGNUP_URL`, `MAILTO` — clearly marked so they're easy to swap.
6. **FAQ** — 4–5 short Q&As: Is it free? (Yes, open source.) Does it need
   internet? (No.) Which languages? (Any with a community model; growing.) Can I
   use it for my radio station / NGO? (Yes.) How do I add my language?
7. **Footer** — license (MIT or similar — leave as placeholder), "Made in The
   Gambia 🇬🇲", links to GitHub, and a short line crediting Whisper / whisper.cpp.

### Design direction
- Tone: hopeful, pan-African, practical, credible — not corporate, not hypey.
- Dark theme by default, with an accent color. Draw from warm, African-inspired
  accents (e.g. a terracotta/amber or a deep green-gold) rather than generic
  tech blue; keep strong contrast and WCAG-AA legibility.
- Clean typography (system fonts or a single Google Font), generous spacing,
  rounded cards, subtle borders. Mobile-first; everything must reflow to a
  single column and stay readable at 360px wide with a 16px gutter.
- Keep total page weight small; use inline SVG for icons; no heavy images.
- Add tasteful, subtle scroll/hover animation only — nothing that hurts
  performance on low-end devices. Respect `prefers-reduced-motion`.

### Deliverable
Return the complete `index.html`. Use clearly labeled placeholder links and a
placeholder hero screenshot (an inline SVG or a styled mock of the app window).
Do not invent fake statistics, testimonials, logos, or download counts.
