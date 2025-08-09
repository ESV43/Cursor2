const state = {
  apiKey: '',
  textModel: 'gemini-2.0-flash',
  imageModel: 'gemini-2.0-flash-preview-image-generation',
  story: '',
  panels: [],
  characters: {}, // name -> [{name, dataUrl, bytes, mime}]
};

const els = {
  apiKey: document.getElementById('apiKey'),
  saveKeyBtn: document.getElementById('saveKeyBtn'),
  story: document.getElementById('story'),
  numPages: document.getElementById('numPages'),
  language: document.getElementById('language'),
  aspect: document.getElementById('aspect'),
  stylePreset: document.getElementById('stylePreset'),
  styleNotes: document.getElementById('styleNotes'),
  includeBalloons: document.getElementById('includeBalloons'),
  captionsBelow: document.getElementById('captionsBelow'),
  globalSeed: document.getElementById('globalSeed'),
  textModel: document.getElementById('textModel'),
  imageModel: document.getElementById('imageModel'),
  maxParallel: document.getElementById('maxParallel'),
  status: document.getElementById('status'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  generateBtn: document.getElementById('generateBtn'),
  panels: document.getElementById('panels'),
  exportZipBtn: document.getElementById('exportZipBtn'),
  // characters
  charList: document.getElementById('charList'),
  newCharName: document.getElementById('newCharName'),
  newCharFiles: document.getElementById('newCharFiles'),
  addCharBtn: document.getElementById('addCharBtn'),
};

(function init() {
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) {
    state.apiKey = savedKey;
    els.apiKey.value = '••••••••••••';
  }
  const savedChars = localStorage.getItem('comic_characters');
  if (savedChars) {
    try { state.characters = JSON.parse(savedChars) || {}; } catch {}
    renderCharacters();
  }
})();

els.saveKeyBtn.addEventListener('click', () => {
  const v = els.apiKey.value.trim();
  if (!v) {
    setStatus('Enter an API key.');
    return;
  }
  state.apiKey = v;
  localStorage.setItem('gemini_api_key', v);
  els.apiKey.value = '••••••••••••';
  setStatus('API key saved locally.');
});

els.addCharBtn.addEventListener('click', async () => {
  const name = (els.newCharName.value || '').trim();
  const files = Array.from(els.newCharFiles.files || []);
  if (!name || files.length === 0) {
    setStatus('Provide character name and at least one image.');
    return;
  }
  const items = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dataUrl = await blobToDataUrl(file);
    items.push({ name, dataUrl, bytes: Array.from(bytes), mime: file.type || 'image/png' });
  }
  state.characters[name] = (state.characters[name] || []).concat(items);
  localStorage.setItem('comic_characters', JSON.stringify(state.characters));
  els.newCharFiles.value = '';
  els.newCharName.value = '';
  renderCharacters();
  setStatus(`Added ${items.length} reference image(s) for ${name}.`);
});

function renderCharacters() {
  els.charList.innerHTML = '';
  const names = Object.keys(state.characters);
  if (names.length === 0) return;
  for (const name of names) {
    const card = document.createElement('div');
    card.className = 'char-card';
    const h = document.createElement('h3');
    h.textContent = name;
    card.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'char-previews';
    for (const ref of state.characters[name]) {
      const img = document.createElement('img');
      img.src = ref.dataUrl;
      grid.appendChild(img);
    }
    card.appendChild(grid);
    els.charList.appendChild(card);
  }
}

function setStatus(msg) {
  els.status.textContent = msg || '';
}

function getCommonOptions() {
  return {
    numPages: parseInt(els.numPages.value || '6', 10),
    language: els.language.value || 'English',
    aspect: els.aspect.value || '1024x1536',
    stylePreset: els.stylePreset.value,
    styleNotes: els.styleNotes.value || '',
    includeBalloons: els.includeBalloons.value === 'yes',
    captionsBelow: els.captionsBelow.value === 'yes',
    globalSeed: els.globalSeed.value ? parseInt(els.globalSeed.value, 10) : undefined,
    textModel: els.textModel.value || state.textModel,
    imageModel: els.imageModel.value || state.imageModel,
    maxParallel: Math.max(1, Math.min(6, parseInt(els.maxParallel.value || '2', 10))),
  };
}

els.analyzeBtn.addEventListener('click', async () => {
  try {
    const options = getCommonOptions();
    const story = (els.story.value || '').trim();
    if (!state.apiKey) throw new Error('Missing API key');
    if (!story) throw new Error('Enter a story');
    setStatus('Analyzing story...');
    const panels = await analyzeStoryToPanels(state.apiKey, story, options);
    state.panels = panels;
    renderPanels();
    setStatus(`Planned ${panels.length} panel(s).`);
  } catch (e) {
    console.error(e);
    setStatus(`Error: ${e.message || e}`);
  }
});

els.generateBtn.addEventListener('click', async () => {
  try {
    if (!state.apiKey) throw new Error('Missing API key');
    if (!state.panels || state.panels.length === 0) {
      els.analyzeBtn.click();
      return;
    }
    const options = getCommonOptions();
    setStatus('Generating images...');
    await generateAllPanelImages(state.apiKey, state.panels, options);
    renderPanels();
    setStatus('Done.');
  } catch (e) {
    console.error(e);
    setStatus(`Error: ${e.message || e}`);
  }
});

els.exportZipBtn.addEventListener('click', async () => {
  try {
    if (!state.panels || state.panels.length === 0) {
      setStatus('Nothing to export.');
      return;
    }
    const zip = new JSZip();
    const meta = [];
    for (let i = 0; i < state.panels.length; i++) {
      const p = state.panels[i];
      const name = `panel_${String(i + 1).padStart(2, '0')}.png`;
      if (p.imageBytes) {
        zip.file(name, new Uint8Array(p.imageBytes));
      }
      meta.push({
        index: i + 1,
        title: p.title,
        caption: p.caption,
        prompt: p.prompt,
        references: p.references || [],
      });
    }
    zip.file('panels.json', JSON.stringify(meta, null, 2));
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'comic.zip');
    setStatus('ZIP exported.');
  } catch (e) {
    console.error(e);
    setStatus(`Error: ${e.message || e}`);
  }
});

function renderPanels() {
  els.panels.innerHTML = '';
  for (let i = 0; i < state.panels.length; i++) {
    const p = state.panels[i];
    const card = document.createElement('div');
    card.className = 'panel';
    if (p.imageDataUrl) {
      const img = document.createElement('img');
      img.src = p.imageDataUrl;
      card.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.style.height = '280px';
      placeholder.style.display = 'grid';
      placeholder.style.placeItems = 'center';
      placeholder.style.color = '#6b7280';
      placeholder.textContent = 'No image yet';
      card.appendChild(placeholder);
    }
    const meta = document.createElement('div');
    meta.className = 'meta';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = p.title || `Panel ${i + 1}`;
    meta.appendChild(title);
    if (p.caption && getCommonOptions().captionsBelow) {
      const cap = document.createElement('div');
      cap.className = 'caption';
      cap.textContent = p.caption;
      meta.appendChild(cap);
    }
    const small = document.createElement('div');
    small.className = 'caption';
    small.textContent = p.prompt ? `Prompt: ${p.prompt}` : '';
    meta.appendChild(small);
    card.appendChild(meta);
    els.panels.appendChild(card);
  }
}

async function analyzeStoryToPanels(apiKey, story, options) {
  const { numPages, language, stylePreset, styleNotes, includeBalloons } = options;
  const sys = `You are a senior comic art director. Split the user's story into exactly ${numPages} concise panels.
Return strict JSON with this schema:
{
  "panels": [
    {
      "title": string,
      "visual_summary": string,
      "dialogue": string, // empty if none
      "caption": string,  // concise narration for below-image text
      "characters": [ { "name": string, "age": string, "gender": string, "key_traits": string } ]
    }
  ]
}
Guidelines: keep character names consistent; mention settings, camera angles, and key actions in visual_summary; dialogue only if needed; language: ${language}; visual style: ${stylePreset} ${styleNotes || ''}; speech balloons in image: ${includeBalloons ? 'yes' : 'no'} but keep dialogue text short.`;

  const body = {
    contents: [
      { role: 'user', parts: [ { text: sys }, { text: `STORY:\n${story}` } ] }
    ]
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.textModel)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Text gen failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
  let parsed;
  try { parsed = JSON.parse(extractJson(text)); } catch (e) { throw new Error('Failed to parse JSON from model'); }
  const panels = (parsed.panels || []).map((p, idx) => ({
    index: idx + 1,
    title: p.title || `Panel ${idx + 1}`,
    visual: p.visual_summary || '',
    dialogue: p.dialogue || '',
    caption: p.caption || '',
    characters: Array.isArray(p.characters) ? p.characters : [],
  }));
  return panels;
}

function extractJson(s) {
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

function buildImagePrompt(panel, options) {
  const { stylePreset, styleNotes, includeBalloons } = options;
  const base = [];
  base.push(`A ${stylePreset.replace('_', ' ')} comic panel.`);
  if (styleNotes) base.push(styleNotes);
  base.push(panel.visual);
  if (includeBalloons && panel.dialogue) {
    base.push(`Render speech balloons with this text, clear and legible: ${panel.dialogue}`);
  } else {
    base.push('Do not render any text inside the image.');
  }
  base.push('High resolution, detailed, consistent characters across panels.');
  base.push('Cohesive lighting and color palette.');
  return base.join(' ');
}

async function generateAllPanelImages(apiKey, panels, options) {
  const queue = panels.map((p, idx) => ({ p, idx }));
  let inFlight = 0; let cursor = 0; let done = 0;
  return new Promise((resolve, reject) => {
    const step = () => {
      if (done === queue.length) return resolve();
      while (inFlight < options.maxParallel && cursor < queue.length) {
        const job = queue[cursor++];
        inFlight++;
        generateOne(job.p, options, apiKey).then(() => {
          done++; inFlight--; setStatus(`Generated ${done}/${queue.length}`); step();
        }).catch(err => { console.error(err); done++; inFlight--; step(); });
      }
    };
    step();
  });
}

async function generateOne(panel, options, apiKey) {
  const { aspect, globalSeed } = options;
  const [width, height] = aspect.split('x').map(n => parseInt(n, 10));
  const prompt = buildImagePrompt(panel, options);
  panel.prompt = prompt;

  const parts = [];
  // Attach character references as input images
  const mentioned = new Set((panel.characters || []).map(c => (c.name || '').toLowerCase()));
  const refs = [];
  for (const name of Object.keys(state.characters)) {
    if (mentioned.size === 0 || mentioned.has(name.toLowerCase())) {
      for (const ref of state.characters[name]) {
        parts.push({ inline_data: { data: arrayToBase64(ref.bytes), mime_type: ref.mime } });
        refs.push({ name, mime: ref.mime });
      }
    }
  }
  // Add text prompt at the end
  parts.push({ text: prompt });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.imageModel)}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.6,
      topK: 32,
      topP: 0.9,
      candidateCount: 1,
      seed: typeof globalSeed === 'number' ? globalSeed : undefined,
    },
    safetySettings: [],
    tools: [],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Image gen failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  // Try to find image bytes in response
  let imageInline;
  const cand = data.candidates?.[0]?.content?.parts || [];
  for (const part of cand) {
    if (part.inline_data?.data) { imageInline = part.inline_data; break; }
    if (part.file_data?.file_uri) {
      // If file uri, fetch it
      try {
        const r = await fetch(part.file_data.file_uri);
        const b = await r.arrayBuffer();
        imageInline = { data: base64FromBytes(new Uint8Array(b)), mime_type: r.headers.get('Content-Type') || 'image/png' };
        break;
      } catch {}
    }
  }
  if (!imageInline) throw new Error('No image returned');
  const bytes = base64ToBytes(imageInline.data);
  panel.imageBytes = Array.from(bytes);
  panel.imageDataUrl = `data:${imageInline.mime_type || 'image/png'};base64,${imageInline.data}`;
  panel.references = refs;
}

function arrayToBase64(arr) {
  const bin = String.fromCharCode(...arr);
  return btoa(bin);
}
function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function base64FromBytes(bytes) { return arrayToBase64(Array.from(bytes)); }
async function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}