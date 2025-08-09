import { NextRequest } from "next/server";
import { z } from "zod";
import { generateText, generateImage, ImageRef } from "@/lib/gemini";

export const runtime = "nodejs";
export const preferredRegion = ["iad1"]; // adjust as needed

const StyleEnum = z.enum([
  "photorealism",
  "comic",
  "manga",
  "anime",
  "watercolor",
  "pixel",
  "3d",
]);

const PayloadSchema = z.object({
  story: z.string().min(1),
  numPages: z.number().int().min(1).max(20),
  style: StyleEnum,
  includeInImageText: z.boolean().default(false),
  includeBelowText: z.boolean().default(true),
  characterRefs: z
    .array(
      z.object({
        name: z.string().min(1),
        imageBase64: z.string().min(1),
        mimeType: z.string().default("image/png"),
      })
    )
    .optional(),
  seed: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { story, numPages, style, includeInImageText, includeBelowText, characterRefs, seed } =
      PayloadSchema.parse(json);

    const panelPlanSchema = {
      type: "object",
      properties: {
        panels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              prompt: { type: "string" },
              caption: { type: "string" },
              dialogues: {
                type: "array",
                items: { type: "object", properties: { speaker: { type: "string" }, text: { type: "string" } } },
              },
            },
            required: ["prompt", "caption", "dialogues"],
          },
        },
        globalStylePrompt: { type: "string" },
        characterGuidance: { type: "string" },
      },
      required: ["panels", "globalStylePrompt", "characterGuidance"],
      additionalProperties: false,
    } as const;

    const styleInstructions: Record<z.infer<typeof StyleEnum>, string> = {
      photorealism:
        "photorealistic, high dynamic range, cinematic lighting, sharp details, consistent lens and color grading",
      comic: "western comic style, bold inks, halftone shading, flat colors, dynamic composition",
      manga: "manga style, screentone textures, black and white ink, expressive linework",
      anime: "anime style, clean lineart, cel shading, vibrant colors, cinematic",
      watercolor: "watercolor wash, soft edges, painterly textures",
      pixel: "pixel art, 64x64 upscale, crisp pixel edges, NES era palette",
      "3d": "3D render, physically based materials, realistic lighting, raytraced reflections",
    };

    const characterHints = (characterRefs || [])
      .map((c) => `Character ${c.name} is provided via reference image. Keep their look consistent.`)
      .join("\n");

    const planningPrompt = `You are an expert comic director. Analyze the user's story and create a page-by-page, panel-by-panel plan for ${numPages} images. For each panel, write:
- prompt: a detailed image prompt that describes characters (by name), scene, action, camera, mood. Do NOT include in-image text unless requested.
- caption: a short narration (1-2 sentences) of the panel.
- dialogues: list of {speaker, text} for character speech (0 or more).

Global constraints:
- Maintain strict character consistency by referencing named characters; images will include their photo references.
- Overall art style: ${style} (${styleInstructions[style]}).
- If includeInImageText = ${includeInImageText}, then weave short text callouts into the prompt in [IN-IMAGE-TEXT:] sections; otherwise omit.
- Captions/dialogues may be rendered below the image if includeBelowText = ${includeBelowText}.
- Output JSON only.

Story:\n${story}

Additional character guidance:\n${characterHints}`;

    const planResponse = await generateText({
      input: planningPrompt,
      jsonSchema: panelPlanSchema as any,
      temperature: 0.5,
    });

    const planText = planResponse.text();
    let plan: any;
    try {
      plan = JSON.parse(planText);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Failed to parse plan", raw: planText }), { status: 500 });
    }

    const images: { mimeType: string; data: string }[][] = [];

    const referenceParts: ImageRef[] = (characterRefs || []).map((c) => ({
      inlineData: { data: c.imageBase64, mimeType: c.mimeType || "image/png" },
    }));

    for (let i = 0; i < Math.min(plan.panels.length, numPages); i++) {
      const panel = plan.panels[i];
      const prompt = [
        plan.globalStylePrompt,
        plan.characterGuidance,
        `Panel ${i + 1}: ${panel.prompt}`,
        includeInImageText ? "Render any [IN-IMAGE-TEXT:] snippets as clean, readable text within the image." : "Do not render any text in the image.",
        "Maintain character consistency using the provided reference images.",
      ]
        .filter(Boolean)
        .join("\n");

      const imgs = await generateImage({
        prompt,
        references: referenceParts,
        seed,
      });
      images.push(imgs);
    }

    const result = {
      panels: plan.panels.slice(0, numPages).map((p: any, idx: number) => ({
        index: idx,
        caption: includeBelowText ? p.caption : "",
        dialogues: includeBelowText ? p.dialogues : [],
        images: images[idx] || [],
      })),
      meta: {
        style,
        includeInImageText,
        includeBelowText,
        seed: seed || null,
      },
    };

    return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), { status: 500 });
  }
}