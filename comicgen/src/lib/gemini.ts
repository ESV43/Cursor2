import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY as string | undefined;

export const TEXT_MODEL_ID = process.env.TEXT_MODEL || "gemini-2.0-flash-exp";
export const IMAGE_MODEL_ID = process.env.IMAGE_MODEL || "gemini-2.0-flash-preview-image-generation";

let genAIInstance: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment");
  }
  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI({ apiKey });
  }
  return genAIInstance;
}

export async function generateText(options: { system?: string; input: string; jsonSchema?: any; temperature?: number }) {
  const model = getGenAI().getGenerativeModel({ model: TEXT_MODEL_ID, systemInstruction: options.system });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: options.input }]}],
    generationConfig: {
      maxOutputTokens: Number(process.env.MAX_OUTPUT_TOKENS || 8192),
      temperature: options.temperature ?? 0.8,
      responseMimeType: options.jsonSchema ? "application/json" : undefined,
      responseSchema: options.jsonSchema ?? undefined,
    },
  });
  return result.response;
}

export type ImageRef = { inlineData?: { data: string; mimeType: string } } | { fileData: { fileUri: string; mimeType?: string } };

export async function generateImage(options: {
  prompt: string;
  references?: ImageRef[];
  size?: { width: number; height: number };
  stylePreset?: string;
  seed?: number;
}) {
  const model = getGenAI().getGenerativeModel({ model: IMAGE_MODEL_ID });
  const parts: any[] = [];
  if (options.references?.length) {
    for (const ref of options.references) {
      parts.push(ref.inlineData ? { inlineData: ref.inlineData } : { fileData: ref.fileData });
    }
  }
  parts.push({ text: options.prompt });

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.6,
      seed: options.seed,
    } as any,
  });

  const images: { mimeType: string; data: string }[] = [];
  for (const cand of result.response.candidates ?? []) {
    for (const part of cand.content.parts ?? []) {
      const inline = (part as any).inlineData;
      if (inline?.data && inline?.mimeType) {
        images.push({ mimeType: inline.mimeType, data: inline.data });
      }
    }
  }
  return images;
}