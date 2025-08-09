# AI Comic Generator

Create high-quality comics from user stories using Gemini for story planning and Gemini 2.0 Flash Preview for native image generation. Supports style selection, captions/dialogues placement, character reference images for consistency, and fixed seed for repeatability.

## Setup

1. Copy `.env.example` to `.env.local` and set values (optional if you plan to enter API key in the UI):

```
GEMINI_API_KEY=your_key
TEXT_MODEL=gemini-2.5-flash-lite
IMAGE_MODEL=gemini-2.0-flash-preview-image-generation
MAX_OUTPUT_TOKENS=8192
```

2. Install dependencies:

```
pnpm install
```

3. Run dev server:

```
pnpm dev
```

Open http://localhost:3000

## Using your API key

- You can enter your Gemini API key in the UI (stored locally in your browser) or set it as `GEMINI_API_KEY` on the server.
- If both are present, the UI-provided key is used for your requests.

## Deploying to Vercel

- Set the following environment variables in your Vercel project (Project Settings → Environment Variables):
  - `GEMINI_API_KEY` (optional if users will enter in the UI)
  - `TEXT_MODEL` (default `gemini-2.5-flash-lite`)
  - `IMAGE_MODEL` (default `gemini-2.0-flash-preview-image-generation`)
  - `MAX_OUTPUT_TOKENS` (optional)
- This repo includes `vercel.json` to run API routes on Node.js 20 with a longer timeout.
- Ensure the Build Command is `pnpm build` (or `next build`) and Output Directory is `.next` (default for Next.js).
- On first deploy, add your env vars to Vercel, then redeploy.

## Features

- Story analysis into panel prompts, captions, dialogues
- Style selector: photorealism, comic, manga, anime, watercolor, pixel, 3D
- Toggle in-image text vs. text below panels
- Character reference uploads for consistency (multimodal prompting)
- Fixed seed option for consistency across runs
- Multimodal chat mode: single-pass interleaved text + image outputs
- Returns base64 images; ready to export or print

## Notes

- Model IDs can change; adjust `TEXT_MODEL` and `IMAGE_MODEL` in env.
- For production, consider persisting uploads, caching, and adding PDF export.
