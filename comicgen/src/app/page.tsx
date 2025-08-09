"use client";
import { useEffect, useState } from "react";

type CharacterRef = { name: string; file?: File; preview?: string; base64?: string; mimeType?: string };

type OutputItem = { type: "text" | "image"; text?: string; image?: { mimeType: string; data: string } };

type PanelImage = { mimeType: string; data: string };

type Panel = {
  index: number;
  caption: string;
  dialogues: { speaker: string; text: string }[];
  images: PanelImage[];
};

type PlanRenderResult = { panels: Panel[] };

type ChatResponse = { mode: "multimodal-chat"; outputs: OutputItem[] };

type ErrorResponse = { error: string };

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [story, setStory] = useState("");
  const [numPages, setNumPages] = useState(4);
  const [style, setStyle] = useState("photorealism");
  const [includeInImageText, setIncludeInImageText] = useState(false);
  const [includeBelowText, setIncludeBelowText] = useState(true);
  const [seed, setSeed] = useState<number | "">("");
  const [characterRefs, setCharacterRefs] = useState<CharacterRef[]>([]);
  const [mode, setMode] = useState<"plan+render" | "multimodal-chat">("plan+render");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanRenderResult | null>(null);
  const [chatOutputs, setChatOutputs] = useState<OutputItem[] | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("gemini_api_key") || "";
    if (stored) setApiKey(stored);
  }, []);

  function persistApiKey(val: string) {
    setApiKey(val);
    if (val) localStorage.setItem("gemini_api_key", val);
    else localStorage.removeItem("gemini_api_key");
  }

  async function fileToBase64(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function onGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setChatOutputs(null);
    try {
      const refsPayload = await Promise.all(
        characterRefs.map(async (c) => ({
          name: c.name,
          imageBase64: c.base64 || (c.file ? await fileToBase64(c.file) : ""),
          mimeType: c.mimeType || (c.file ? c.file.type : "image/png"),
        }))
      );

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          apiKey: apiKey || undefined,
          story,
          numPages: Number(numPages),
          style,
          includeInImageText,
          includeBelowText,
          characterRefs: refsPayload.filter((r) => r.imageBase64),
          seed: seed === "" ? undefined : Number(seed),
        }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const errMsg = typeof json === "object" && json !== null && "error" in json ? (json as ErrorResponse).error : "Failed";
        throw new Error(errMsg);
      }
      if (mode === "multimodal-chat") {
        if (typeof json === "object" && json !== null && "outputs" in json) {
          setChatOutputs((json as ChatResponse).outputs);
        } else {
          setError("Unexpected response for chat mode");
        }
      } else {
        setResult(json as PlanRenderResult);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function addCharacter() {
    setCharacterRefs((prev) => [...prev, { name: "", preview: "" }]);
  }
  function updateCharacterName(index: number, name: string) {
    setCharacterRefs((prev) => prev.map((c, i) => (i === index ? { ...c, name } : c)));
  }
  function updateCharacterFile(index: number, file: File) {
    const url = URL.createObjectURL(file);
    setCharacterRefs((prev) => prev.map((c, i) => (i === index ? { ...c, file, preview: url, mimeType: file.type } : c)));
  }
  function removeCharacter(index: number) {
    setCharacterRefs((prev) => prev.filter((_, i) => i !== index));
  }

  const generateDisabled = loading || !story.trim() || !(apiKey || process.env.NEXT_PUBLIC_FAKE);

  return (
    <div className="min-h-screen p-6 sm:p-10 max-w-6xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-4">AI Comic Generator</h1>
      <p className="text-sm text-gray-600 mb-6">Enter a story, choose style and options, optionally upload character references, then generate.</p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Gemini API Key</label>
            <input
              type="password"
              className="w-full border rounded p-2"
              value={apiKey}
              onChange={(e) => persistApiKey(e.target.value)}
              placeholder="Enter your Gemini API key"
            />
            <p className="text-xs text-gray-500 mt-1">Stored locally in your browser. Used only for your requests.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mode</label>
            <select className="w-full border rounded p-2" value={mode} onChange={(e) => setMode(e.target.value as "plan+render" | "multimodal-chat")}>
              <option value="plan+render">Plan + Render (two-step)</option>
              <option value="multimodal-chat">Multimodal Chat (text + image stream)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Story</label>
            <textarea
              className="w-full border rounded p-3 h-48"
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Write your story here..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Pages</label>
              <input
                type="number"
                min={1}
                max={20}
                className="w-full border rounded p-2"
                value={numPages}
                onChange={(e) => setNumPages(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Style</label>
              <select className="w-full border rounded p-2" value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="photorealism">Photorealism</option>
                <option value="comic">Comic</option>
                <option value="manga">Manga</option>
                <option value="anime">Anime</option>
                <option value="watercolor">Watercolor</option>
                <option value="pixel">Pixel</option>
                <option value="3d">3D</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={includeInImageText} onChange={(e) => setIncludeInImageText(e.target.checked)} /> Include text inside images</label>
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={includeBelowText} onChange={(e) => setIncludeBelowText(e.target.checked)} /> Show text below images</label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Seed (optional)</label>
            <input
              type="number"
              className="w-full border rounded p-2"
              value={seed}
              onChange={(e) => setSeed(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Use a fixed seed for consistency"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Character references</h2>
            <button className="px-3 py-1.5 text-sm rounded bg-black text-white" onClick={addCharacter}>Add</button>
          </div>
          <div className="space-y-3">
            {characterRefs.map((c, idx) => (
              <div key={idx} className="border rounded p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    className="flex-1 border rounded p-2 text-sm"
                    placeholder="Character name"
                    value={c.name}
                    onChange={(e) => updateCharacterName(idx, e.target.value)}
                  />
                  <button className="px-2 py-1 text-xs rounded border" onClick={() => removeCharacter(idx)}>Remove</button>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) updateCharacterFile(idx, file);
                  }}
                />
                {c.preview && (
                  <img src={c.preview} alt="preview" className="h-28 w-auto object-cover rounded border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          className="px-5 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          onClick={onGenerate}
          disabled={generateDisabled}
        >
          {loading ? "Generating..." : "Generate Comic"}
        </button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>

      {mode === "plan+render" && result && (
        <div className="mt-10 space-y-6">
          {result.panels.map((p) => (
            <div key={p.index} className="border rounded p-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  {(p.images || []).map((img, i) => (
                    <img key={i} src={`data:${img.mimeType};base64,${img.data}`} alt={`panel-${p.index}-${i}`} className="w-full rounded border" />
                  ))}
                </div>
                <div className="space-y-2">
                  {p.caption && <p className="text-sm italic text-gray-700">{p.caption}</p>}
                  {(p.dialogues || []).length > 0 && (
                    <div className="text-sm">
                      <h3 className="font-semibold mb-1">Dialogues</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {p.dialogues.map((d, j) => (
                          <li key={j}><span className="font-semibold">{d.speaker}:</span> {d.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === "multimodal-chat" && chatOutputs && (
        <div className="mt-10 space-y-6">
          <div className="border rounded p-4 space-y-4">
            {chatOutputs.map((o, i) => (
              <div key={i}>
                {o.type === "text" && <p className="text-sm leading-6 whitespace-pre-wrap">{o.text}</p>}
                {o.type === "image" && o.image && (
                  <img src={`data:${o.image.mimeType};base64,${o.image.data}`} alt={`out-${i}`} className="w-full rounded border" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
