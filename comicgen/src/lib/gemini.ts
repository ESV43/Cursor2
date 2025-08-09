import { GoogleGenerativeAI } from "@google/generative-ai";

const envApiKey = process.env.GEMINI_API_KEY as string | undefined;

export const TEXT_MODEL_ID = process.env.TEXT_MODEL || "gemini-2.5-flash-lite";
export const IMAGE_MODEL_ID = process.env.IMAGE_MODEL || "gemini-2.0-flash-preview-image-generation";

let envGenAIInstance: GoogleGenerativeAI | null = null;
const apiKeyToClient = new Map<string, GoogleGenerativeAI>();

function getGenAI(overrideApiKey?: string): GoogleGenerativeAI {
  const key = overrideApiKey || envApiKey;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set in environment and no override was provided");
  }
  if (overrideApiKey) {
    const cached = apiKeyToClient.get(overrideApiKey);
    if (cached) return cached;
    const client = new GoogleGenerativeAI({ apiKey: overrideApiKey });
    apiKeyToClient.set(overrideApiKey, client);
    return client;
  }
  if (!envGenAIInstance) {
    envGenAIInstance = new GoogleGenerativeAI({ apiKey: key });
  }
  return envGenAIInstance;
}

export async function generateText(options: { system?: string; input: string; jsonSchema?: Record<string, unknown>; temperature?: number; apiKeyOverride?: string }) {
  const model = getGenAI(options.apiKeyOverride).getGenerativeModel({ model: TEXT_MODEL_ID, systemInstruction: options.system });
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

type TextPart = { text: string };
type InlineDataPart = { inlineData: { data: string; mimeType: string } };
type FileDataPart = { fileData: { fileUri: string; mimeType?: string } };
type ContentPart = TextPart | InlineDataPart | FileDataPart;

type CandidatePart = { text?: string; inlineData?: { data?: string; mimeType?: string } };

export async function generateImage(options: {
  prompt: string;
  references?: ImageRef[];
  size?: { width: number; height: number };
  stylePreset?: string;
  seed?: number;
  apiKeyOverride?: string;
}) {
  const model = getGenAI(options.apiKeyOverride).getGenerativeModel({ model: IMAGE_MODEL_ID });
  const parts: ContentPart[] = [];
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
    },
  });

  const images: { mimeType: string; data: string }[] = [];
  for (const cand of result.response.candidates ?? []) {
    for (const part of cand.content.parts ?? []) {
      const p = part as CandidatePart;
      if (p.inlineData?.data && p.inlineData?.mimeType) {
        images.push({ mimeType: p.inlineData.mimeType, data: p.inlineData.data });
      }
    }
  }
  return images;
}