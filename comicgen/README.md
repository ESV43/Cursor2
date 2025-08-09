# AI Comic Generator

Create high-quality comics from user stories using Gemini for story planning and Gemini 2.0 Flash Preview for native image generation. Supports style selection, captions/dialogues placement, character reference images for consistency, and fixed seed for repeatability.

## Setup

1. Copy `.env.example` to `.env.local` and set values:

```
GEMINI_API_KEY=your_key
TEXT_MODEL=gemini-2.0-flash-exp
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

## Features

- Story analysis into panel prompts, captions, dialogues
- Style selector: photorealism, comic, manga, anime, watercolor, pixel, 3D
- Toggle in-image text vs. text below panels
- Character reference uploads for consistency (multimodal prompting)
- Fixed seed option for consistency across runs
- Returns base64 images; ready to export or print

## Notes

- Model IDs can change; adjust `TEXT_MODEL` and `IMAGE_MODEL` in env.
- For production, consider persisting uploads, caching, and adding PDF export.
