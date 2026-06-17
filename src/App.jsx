import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, addDoc, query,
  where, orderBy, getDocs, deleteDoc, serverTimestamp, updateDoc, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── CONFIG ───────────────────────────────────────────────────────
const FB = {
  apiKey: "AIzaSyAM-o-ZvEV2T1Efso1oiIC7__PFxh4YCxk",
  authDomain: "saraswatiai-51593.firebaseapp.com",
  projectId: "saraswatiai-51593",
  storageBucket: "saraswatiai-51593.firebasestorage.app",
  messagingSenderId: "352789553358",
  appId: "1:352789553358:web:ce3dcc024a98c96c82f09f"
};
const fapp = initializeApp(FB);
const auth = getAuth(fapp);
const db = getFirestore(fapp);

const GROQ = import.meta.env.VITE_GROQ_API_KEY || "";
const TAVILY = import.meta.env.VITE_TAVILY_API_KEY || "";
const ADMIN = "kunalsaraswat691@gmail.com";
const UPI = "8126630980";
const FREE_LIMIT = 49;
const REACTIONS = ["👍","❤️","😂","😮","🙏","🔥"];
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const localAudioRef = useRef(null);
useEffect(() => {
 if (page === "voice") {
 requestMicrophoneAccess();
 }
}, [page]);

const CHAT_MODEL   = "llama-3.3-70b-versatile";
const TRIVIAL = /^(hi|hello|hey|hii|ok|okay|hmm|ha|bhai|yaar|bro|dost|thanks|thx|yes|no|nahi|haan|k|👍|😊)[\s!?.]*$/i;

// ── ACCENT PALETTES ──────────────────────────────────────────────
const ACCENTS = {
  orange: { primary:"#f97316", grad:"linear-gradient(135deg,#f97316,#ea580c)", glow:"#f9731640" },
  blue:   { primary:"#3b82f6", grad:"linear-gradient(135deg,#3b82f6,#1d4ed8)", glow:"#3b82f640" },
  gold:   { primary:"#f59e0b", grad:"linear-gradient(135deg,#f59e0b,#d97706)", glow:"#f59e0b40" },
};

// ── THEMES ───────────────────────────────────────────────────────
const THEMES = {
  dark:  { bg:"#0a0a0a", sf:"#141414", sf2:"#1c1c1c", bd:"#252525", tx:"#f0f0f0", mt:"#5a5a5a", bub:"#161616", navBg:"#0e0e0e" },
  light: { bg:"#f5f5f5", sf:"#ffffff", sf2:"#eeeeee", bd:"#e0e0e0", tx:"#111111", mt:"#888888", bub:"#ffffff", navBg:"#fafafa" },
  blue:  { bg:"#060b18", sf:"#0d1526", sf2:"#111d30", bd:"#1a2d4a", tx:"#e8f0fe", mt:"#4a6fa5", bub:"#0d1526", navBg:"#08101f" },
  gold:  { bg:"#0a0800", sf:"#12100a", sf2:"#1a1710", bd:"#2e2a1a", tx:"#fef3c7", mt:"#a89060", bub:"#111009", navBg:"#0d0b06" },
};

// ── UTILS ────────────────────────────────────────────────────────
function compressImage(dataUrl, maxW = 180, q = 0.5) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = img.width * sc; c.height = img.height * sc;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", q));
    };
    img.src = dataUrl;
  });
}

const ATTACH_PER_FILE_LIMIT = 8000;
const ATTACH_TOTAL_LIMIT = 20000;

function loadScriptOnce(url, globalCheck) {
  return new Promise((resolve, reject) => {
    if (globalCheck()) return resolve();
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load " + url)));
      if (globalCheck()) resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + url));
    document.head.appendChild(s);
  });
}

async function extractPdfText(arrayBuffer) {
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", () => !!window.pdfjsLib);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  const maxPages = Math.min(pdf.numPages, 30);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(" ") + "\n\n";
    if (text.length > ATTACH_PER_FILE_LIMIT) break;
  }
  return text;
}

async function requestMicrophoneAccess() {
  try {
    const stream = await navigator.mediadevices.getUserMedia({ audio: true });
    localAudioRef.current.srcObject = stream;
  } catch (err) {
    console.error("Error accessing microphone:", err);
  }
}

async function extractDocxText(arrayBuffer) {
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js", () => !!window.mammoth);
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsText(file);
  });
}
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

async function extractFileText(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  try {
    let text = "";
    if (ext === "pdf") {
      const buf = await readFileAsArrayBuffer(file);
      text = await extractPdfText(buf);
    } else if (ext === "docx") {
      const buf = await readFileAsArrayBuffer(file);
      text = await extractDocxText(buf);
    } else if (["txt", "csv", "md", "json", "log"].includes(ext)) {
      text = await readFileAsText(file);
    } else if (ext === "xlsx" || ext === "xls") {
      await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", () => !!window.XLSX);
      const buf = await readFileAsArrayBuffer(file);
      const wb = window.XLSX.read(buf, { type: "array" });
      const rows = [];
      wb.SheetNames.slice(0, 5).forEach(name => {
        const ws = wb.Sheets[name];
        const csv = window.XLSX.utils.sheet_to_csv(ws);
        rows.push(`[Sheet: ${name}]\n${csv}`);
      });
      text = rows.join("\n\n");
    } else if (ext === "pptx") {
      // Extract text from PPTX using JSZip (available via cdnjs)
      await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", () => !!window.JSZip);
      const buf = await readFileAsArrayBuffer(file);
      const zip = await window.JSZip.loadAsync(buf);
      const slideTexts = [];
      const slideFiles = Object.keys(zip.files).filter(f => /ppt\/slides\/slide[0-9]+\.xml$/.test(f)).sort();
      for (const sf of slideFiles.slice(0, 20)) {
        const xml = await zip.files[sf].async("string");
        const text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (text) slideTexts.push(text);
      }
      text = slideTexts.join("\n\n");
    } else {
      return { name: file.name, ext, error: "Unsupported file type. Supported: PDF, DOCX, TXT, CSV, XLSX, PPTX" };
    }
    text = (text || "").trim();
    if (text.length > ATTACH_PER_FILE_LIMIT) text = text.slice(0, ATTACH_PER_FILE_LIMIT) + "\n...[truncated]";
    return { name: file.name, ext, text, size: file.size };
  } catch (e) {
    return { name: file.name, ext, error: e.message || "Could not read file" };
  }
}

function playTypingSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 800 + Math.random() * 400; o.type = "sine";
    g.gain.setValueAtTime(0.02, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.04);
  } catch {}
}
function playSendSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [600, 800, 1000].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f; o.type = "sine";
      g.gain.setValueAtTime(0.05, ctx.currentTime + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.09);
      o.start(ctx.currentTime + i * 0.05); o.stop(ctx.currentTime + i * 0.05 + 0.09);
    });
  } catch {}
}
async function webSearch(q) {
  try {
    const r = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: TAVILY, query: q, search_depth: "basic", max_results: 3 }) });
    const d = await r.json();
    return d.results?.map(x => x.title + ": " + x.content).join("\n\n") || null;
  } catch { return null; }
}
function needsImageGen(t) { return ["image banao","photo banao","tasveer banao","picture banao","draw","generate image","sketch","wallpaper","logo banao","poster"].some(k => t.toLowerCase().includes(k)); }
function extractPrompt(t) { let p = t.toLowerCase(); ["image banao","photo banao","tasveer banao","picture banao","generate image of","generate image","draw a","draw","sketch","wallpaper","logo banao","poster","ki","ka","of"].forEach(k => { p = p.split(k).join(" "); }); return p.trim() || t; }
function getImgUrl(p) { return `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=768&height=768&seed=${Math.floor(Math.random() * 99999)}&nologo=true`; }
function needsSearch(t) { return ["news","score","weather","mausam","price","rate","mandi","today","aaj","gold","sona","kisan","fasal","2025","2026","upsc"].some(k => t.toLowerCase().includes(k)); }
function isOwnerQ(t) { return ["kisne banaya","who made","who created","owner","creator","malik","kaun hai tera","who built"].some(k => t.toLowerCase().includes(k)); }
function detectTone(t) {
  const tl = t.toLowerCase();
  if (["behen","didi","sister","madam","mam"].some(w => tl.includes(w))) return "female";
  if (["bhai","bhaiya","yaar","bro","dost","sir"].some(w => tl.includes(w))) return "male";
  return null;
}
function fmtTime(ts) { if (!ts) return ""; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(ts) { if (!ts) return ""; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }); }

async function genTitle(msg) {
  if (TRIVIAL.test(msg.trim())) return null;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ }, body: JSON.stringify({ model: CHAT_MODEL, messages: [{ role: "system", content: "Generate a 3-5 word descriptive chat title. Return ONLY the title — no quotes, no punctuation at end." }, { role: "user", content: msg }], max_tokens: 15 }) });
    const d = await r.json();
    const t = d.choices?.[0]?.message?.content?.trim();
    return (t && t.length > 2) ? t : null;
  } catch { return null; }
}

async function callAI(messages, imageB64, tone, memories, language) {
  const last = messages[messages.length - 1];
  if (last?.role === "user" && isOwnerQ(last.text)) return "I was created by **Kunal Saraswat**! 😊";
  let ctx = "";
  if (last?.role === "user" && needsSearch(last.text)) { const r = await webSearch(last.text); if (r) ctx = "\n\nLatest Info:\n" + r; }
  const tNote = tone === "female" ? "Respond warmly like a helpful sister/friend." : tone === "male" ? "Respond like a helpful brother/friend." : "Be warm and friendly.";
  let memCtx = "";
  if (memories && memories.length) {
    // Smart: inject only relevant memories for this query
    const relevant = getRelevantMemories(memories, last?.text || "");
    if (relevant.length) {
      memCtx = "\n\nMemories about this user (use naturally when relevant, never list unless asked):\n" +
        relevant.map(m => `- [${m.category || "personal"}] ${m.memory_content || m.text}`).join("\n");
    }
  }
  const langInstruction = {
    hindi: "ALWAYS reply in Hindi (Devanagari script), regardless of what language the user writes in.",
    english: "ALWAYS reply in English, regardless of what language the user writes in.",
    hinglish: "ALWAYS reply in Hinglish (Hindi words written in Roman/English script), regardless of what language the user writes in.",
  }[language] || "Reply in the EXACT language the user writes (Hindi→Hindi, English→English, Hinglish→Hinglish).";
  const sys = `You are Saraswati AI — India's best AI assistant, created by Kunal Saraswat.
Never mention Groq, Meta, Llama, OpenAI or any model name.
${langInstruction}
${tNote}
Be warm, emotional, helpful — like a best friend.
For coding: complete working copy-paste ready code always.
For education: clear explanations with examples (class 1 to UPSC).
For farming: expert advice on crops, mandi rates, government schemes.
For images: carefully read ALL visible text, describe objects, colors, and context in detail.${memCtx}${ctx}`;

  if (imageB64) {
    const visionMsgs = [
      { role: "system", content: sys },
      { role: "user", content: [
        { type: "image_url", image_url: { url: "data:image/jpeg;base64," + imageB64 } },
        { type: "text", text: last.text || "Is image mein kya hai? Saari details batao — text, objects, colors, context." }
      ]}
    ];
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ }, body: JSON.stringify({ model: VISION_MODEL, messages: visionMsgs, max_tokens: 2048 }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices?.[0]?.message?.content || "No response.";
  }

  const lastContent = last.fileContext ? last.text + last.fileContext : last.text;
  const apiMsgs = [...messages.slice(0, -1).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.fileContext ? m.text + m.fileContext : m.text })), { role: "user", content: lastContent }];
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ }, body: JSON.stringify({ model: CHAT_MODEL, messages: [{ role: "system", content: sys }, ...apiMsgs], max_tokens: 2048 }) });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "No response.";
}

// ── LONG-TERM MEMORY SYSTEM (ChatGPT-style) ─────────────────────
const MEM_CATEGORIES = ["preferences", "goals", "projects", "work", "learning", "personal", "custom"];
const MEM_CATEGORY_LABELS = {
  preferences: "⭐ Preferences", goals: "🎯 Goals", projects: "📁 Projects",
  work: "💼 Work", learning: "📚 Learning", personal: "👤 Personal", custom: "✏️ Custom"
};

// Detect explicit "remember that..." commands
function isExplicitMemoryCommand(text) {
  const t = text.toLowerCase().trim();
  return /^(remember (that|this|:)?|save (this|that|to memory)|note (that|this)|yaad rakho|yaad kar|memory mein daal|store (this|that))/.test(t);
}

// Extract the fact from "remember that I am a developer" → "User is a developer"
function extractExplicitFact(text) {
  return text
    .replace(/^(remember (that|this|:)?|save (this|that|to memory)|note (that|this)|yaad rakho|yaad kar|memory mein daal|store (this|that))\s*/i, "")
    .trim();
}

// Simple keyword-based semantic relevance score (0–1) between query and memory
function memoryRelevanceScore(memText, queryText) {
  if (!memText || !queryText) return 0;
  const m = memText.toLowerCase();
  const q = queryText.toLowerCase();
  const qWords = q.split(/\s+/).filter(w => w.length > 3);
  if (!qWords.length) return 0;
  const hits = qWords.filter(w => m.includes(w)).length;
  return hits / qWords.length;
}

// Fetch top-N most relevant memories for a given query
function getRelevantMemories(allMemories, queryText, topN = 8) {
  if (!allMemories || !allMemories.length) return [];
  const scored = allMemories.map(m => ({
    ...m,
    _score: (m.importance_score || 5) * 0.4 + memoryRelevanceScore(m.memory_content || m.text, queryText) * 0.6
  }));
  const sorted = scored.sort((a, b) => b._score - a._score);
  // Always include high-importance memories (>=8) regardless of keyword match
  const highImp = sorted.filter(m => (m.importance_score || 5) >= 8);
  const rest = sorted.filter(m => (m.importance_score || 5) < 8).slice(0, Math.max(0, topN - highImp.length));
  return [...highImp, ...rest].slice(0, topN);
}

// Full AI-powered memory analysis: detect save/update/skip, category, importance
async function analyzeMemory(userText, existingMemories) {
  if (!userText || userText.trim().length < 3) return null;
  try {
    const existingList = (existingMemories || []).slice(0, 40).map((m, i) =>
      `[${i}] (id:${m.id}) [${m.category || "personal"}] ${m.memory_content || m.text}`
    ).join("\n");

    const sys = `You are a memory manager for a personal AI assistant (like ChatGPT memory).

Your job: analyze the user's message and decide if any long-term memory should be saved, updated, or skipped.

Rules:
- SAVE: personal facts, preferences, skills, goals, projects, work info, learning topics, relationships, important dates
- UPDATE: if the new info contradicts or replaces an existing memory (e.g. "I now use Vue" replaces "I use React")
- SKIP: questions, generic requests, greetings, temporary context, one-time tasks
- EXPLICIT: if user says "remember that X", always SAVE or UPDATE

Categories: preferences | goals | projects | work | learning | personal | custom

Importance score 1-10:
- 10: name, profession, major life fact
- 7-9: skills, tools, preferences, goals
- 4-6: interests, habits, minor preferences
- 1-3: trivial facts

Existing memories:
${existingList || "(none yet)"}

Respond with ONLY valid JSON (no markdown):
{
  "action": "save" | "update" | "skip",
  "memory_content": "concise third-person fact (e.g. 'User is a software engineer')",
  "category": "preferences|goals|projects|work|learning|personal|custom",
  "importance_score": 1-10,
  "update_id": "existing memory id to replace, or null"
}`;

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ },
      body: JSON.stringify({ model: CHAT_MODEL, messages: [{ role: "system", content: sys }, { role: "user", content: userText }], max_tokens: 200, temperature: 0.1 })
    });
    const d = await r.json();
    let raw = (d.choices?.[0]?.message?.content || "").trim();
    // Strip markdown code fences if present
    raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    // Extract JSON object if wrapped in extra text
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || parsed.action === "skip" || !parsed.memory_content) return null;
    return {
      action: parsed.action === "update" ? "update" : "save",
      memory_content: String(parsed.memory_content).trim(),
      category: MEM_CATEGORIES.includes(parsed.category) ? parsed.category : "personal",
      importance_score: Math.min(10, Math.max(1, parseInt(parsed.importance_score) || 5)),
      update_id: parsed.update_id && parsed.update_id !== "null" ? String(parsed.update_id) : null
    };
  } catch { return null; }
}

const SARASWATI_VOICE_PRIORITY = [
  /Google हिन्दी/i,
  /Microsoft Swara/i,
  /female.*hi-IN/i,
  /hi-IN/i,
  /female|woman|girl|zira|heera|priya|aditi/i,
];

function pickSaraswatiVoice(vs) {
  for (const pattern of SARASWATI_VOICE_PRIORITY) {
    const found = vs.find(x => pattern.test(x.name) || pattern.test(x.lang));
    if (found) return found;
  }
  return vs[0] || null;
}

function speakText(text, tone, speed, onDone) {
  window.speechSynthesis.cancel();
  const clean = text.replace(/```[\s\S]*?```/g, "code block").replace(/\*\*/g, "").replace(/`/g, "").replace(/#+\s/g, "").replace(/[^\x00-\x7F\u0900-\u097F .,!?]/g, "").slice(0, 600);
  const go = () => {
    const vs = window.speechSynthesis.getVoices();
    const v = pickSaraswatiVoice(vs);
    const u = new SpeechSynthesisUtterance(clean);
    if (v) u.voice = v;
    u.lang = "hi-IN";
    u.rate = speed || 0.95;
    u.pitch = 1.05;
    u.volume = 1;
    u.onend = onDone || null; u.onerror = onDone || null;
    window.speechSynthesis.speak(u);
  };
  if (!window.speechSynthesis.getVoices().length) { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; go(); }; } else go();
}

// ── SARASWATI LOGO — Premium 3D Digital Lotus ─────────────────
function SaraswatiLogo({ size = 32, animate = false, state = "idle" }) {
  // state: "idle" | "thinking" | "speaking"
  const animStyle = {
    idle:     { animation: "logoGlow 3s ease-in-out infinite" },
    thinking: { animation: "logoRotate 1.6s linear infinite" },
    speaking: { animation: "logoPulse 0.7s ease-in-out infinite" },
  }[state] || {};
  const finalStyle = animate ? animStyle : {};

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={finalStyle}>
      <defs>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5c842"/>
          <stop offset="100%" stopColor="#e8a020"/>
        </linearGradient>
        <linearGradient id="blueGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#1e3a8a"/>
          <stop offset="100%" stopColor="#3b82f6"/>
        </linearGradient>
        <linearGradient id="petalGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa"/>
          <stop offset="100%" stopColor="#1d4ed8"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Outer ring */}
      <circle cx="24" cy="24" r="22" stroke="url(#blueGrad)" strokeWidth="0.8" opacity="0.4"/>
      <circle cx="24" cy="24" r="18" stroke="url(#goldGrad)" strokeWidth="0.5" opacity="0.3"/>

      {/* 8 digital lotus petals */}
      {[0,45,90,135,180,225,270,315].map((deg, i) => (
        <g key={i} transform={`rotate(${deg} 24 24)`} filter="url(#glow)">
          <ellipse cx="24" cy="10" rx="2.8" ry="7" fill="url(#petalGrad)" opacity={i % 2 === 0 ? 0.95 : 0.6}/>
          {/* digital line detail on each petal */}
          <line x1="24" y1="5" x2="24" y2="15" stroke="#93c5fd" strokeWidth="0.4" opacity="0.7"/>
        </g>
      ))}

      {/* Inner gold ring */}
      <circle cx="24" cy="24" r="7" fill="url(#goldGrad)" filter="url(#glow)"/>
      {/* Center white core */}
      <circle cx="24" cy="24" r="4" fill="white" opacity="0.95"/>
      {/* Center dot */}
      <circle cx="24" cy="24" r="1.5" fill="url(#goldGrad)"/>
    </svg>
  );
}

// ── CODE BLOCK ─────────────────────────────────────────────────
function CodeBlock({ code, lang }) {
  const [cp, setCp] = useState(false);
  const [pv, setPv] = useState(false);
  const ok = ["html","css","js","javascript",""].includes((lang || "").toLowerCase());
  return (
    <div style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 10, margin: "6px 0", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 12px", background: "#141414", borderBottom: "1px solid #222" }}>
        <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{lang || "code"}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {ok && <button onClick={() => setPv(v => !v)} style={{ background: "none", border: "none", color: pv ? "#f97316" : "#6b7280", cursor: "pointer", fontSize: 11, padding: "2px 6px" }}>{pv ? "✕ Close" : "▶ Preview"}</button>}
          <button onClick={() => { navigator.clipboard?.writeText(code); setCp(true); setTimeout(() => setCp(false), 2000); }} style={{ background: "none", border: "none", color: cp ? "#22c55e" : "#6b7280", cursor: "pointer", fontSize: 11, padding: "2px 6px" }}>{cp ? "✓ Copied" : "Copy"}</button>
        </div>
      </div>
      <pre style={{ padding: "12px", margin: 0, overflowX: "auto", fontSize: 12, lineHeight: 1.6, color: "#e5e7eb", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{code}</pre>
      {pv && ok && <div style={{ borderTop: "1px solid #222" }}><div style={{ padding: "4px 12px", background: "#141414", fontSize: 11, color: "#f97316" }}>🌐 Live Preview</div><iframe srcDoc={lang === "css" ? "<style>" + code + "</style><p>Preview</p>" : code} style={{ width: "100%", minHeight: 200, border: "none", background: "#fff" }} sandbox="allow-scripts" title="preview" /></div>}
    </div>
  );
}
function AIText({ text }) {
  if (!text) return null;
  const parts = []; const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
    parts.push({ type: "code", lang: m[1], content: m[2].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {parts.map((p, i) => {
        if (p.type === "code") return <CodeBlock key={i} code={p.content} lang={p.lang} />;
        return p.content.split("\n").map((line, j) => {
          if (!line.trim()) return <span key={i + "-" + j} style={{ height: 5 }} />;
          const segs = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((s, k) => {
            if (s.startsWith("**") && s.endsWith("**")) return <strong key={k}>{s.slice(2, -2)}</strong>;
            if (s.startsWith("`") && s.endsWith("`")) return <code key={k} style={{ background: "#ffffff18", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: 12 }}>{s.slice(1, -1)}</code>;
            return s;
          });
          if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) return <span key={i + "-" + j} style={{ display: "flex", gap: 8 }}><span style={{ color: "var(--accent)" }}>•</span><span>{segs}</span></span>;
          if (/^\d+\.\s/.test(line.trim())) return <span key={i + "-" + j} style={{ display: "flex", gap: 8 }}><span style={{ color: "var(--accent)", minWidth: 16 }}>{line.match(/^\d+/)[0]}.</span><span>{segs}</span></span>;
          if (line.startsWith("### ")) return <strong key={i + "-" + j} style={{ fontSize: 15, color: "var(--accent)" }}>{line.slice(4)}</strong>;
          if (line.startsWith("## ")) return <strong key={i + "-" + j} style={{ fontSize: 16, color: "var(--accent)" }}>{line.slice(3)}</strong>;
          if (line.startsWith("# ")) return <strong key={i + "-" + j} style={{ fontSize: 17, color: "var(--accent)" }}>{line.slice(2)}</strong>;
          return <span key={i + "-" + j}>{segs}</span>;
        });
      })}
    </span>
  );
}

// ── ICONS ──────────────────────────────────────────────────────
const Ico = {
  Speak: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>,
  Stop: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>,
  Copy: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  Check: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  Share: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>,
  Mic: ({ on }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="11" rx="3" fill={on ? "#ef4444" : "currentColor"} stroke="none" /><path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" /><line x1="12" y1="18" x2="12" y2="22" strokeLinecap="round" /><line x1="8" y1="22" x2="16" y2="22" strokeLinecap="round" /></svg>,
  Img: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" /><path d="m21 15-5-5L5 21" /></svg>,
  Search: ({ s = 15 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  ChevRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>,
  Back: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>,
  Chat: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  Voice: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>,
  Apps: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  Project: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  More: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></svg>,
};

// ── STYLES ──────────────────────────────────────────────────────
function buildStyles(themeKey, accentKey, fontSize) {
  const v = THEMES[themeKey] || THEMES.dark;
  const a = ACCENTS[accentKey] || ACCENTS.orange;
  const dark = themeKey !== "light";
  const fs = fontSize || 14;
  return `
:root{--accent:${a.primary};--grad:${a.grad};--glow:${a.glow};--bd:${v.bd};--mt:${v.mt};--sf2:${v.sf2};--tx:${v.tx};}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;overflow:hidden;}
body{font-family:'Inter',sans-serif;background:${v.bg};color:${v.tx};font-size:${fs}px;}
.app{display:flex;flex-direction:column;height:100dvh;max-width:480px;margin:0 auto;background:${v.bg};position:relative;overflow:hidden;}

.pwa{position:fixed;bottom:70px;left:10px;right:10px;background:${dark?"#1a1a1a":"#fff"};border:1.5px solid var(--accent);border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:10px;z-index:150;box-shadow:0 8px 28px #0009;animation:fadeUp .3s ease;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
.pwa-btn{background:var(--accent);border:none;border-radius:10px;color:#fff;cursor:pointer;font-size:12px;font-weight:700;padding:7px 13px;font-family:'Inter',sans-serif;}
.pwa-x{background:none;border:none;color:${v.mt};cursor:pointer;font-size:17px;padding:2px 6px;}

.sb-overlay{position:fixed;inset:0;background:#0009;z-index:50;animation:fadeIn .2s ease;}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
.sidebar{position:fixed;top:0;left:0;bottom:0;width:86%;max-width:320px;background:${v.navBg};z-index:51;display:flex;flex-direction:column;animation:sbIn .25s cubic-bezier(.4,0,.2,1);overflow:hidden;border-right:1px solid ${v.bd};}
@keyframes sbIn{from{transform:translateX(-100%);}to{transform:translateX(0);}}
.sb-head{display:flex;align-items:center;gap:10px;padding:18px 16px 14px;border-bottom:1px solid ${v.bd};}
.sb-logo{font-size:26px;}
.sb-title{font-size:17px;font-weight:800;flex:1;letter-spacing:-.4px;}
.sb-close{background:none;border:none;color:${v.mt};cursor:pointer;font-size:20px;padding:4px 8px;line-height:1;border-radius:8px;}
.sb-user{display:flex;align-items:center;gap:11px;padding:14px 16px;border-bottom:1px solid ${v.bd};}
.sb-uinfo{flex:1;min-width:0;}
.sb-uname{font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sb-email{font-size:11px;color:${v.mt};margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sb-nav{flex:1;overflow-y:auto;padding:8px 8px 0;}
.sb-nav::-webkit-scrollbar{width:0;}
.sb-section{font-size:10px;font-weight:700;color:${v.mt};letter-spacing:.12em;text-transform:uppercase;padding:12px 10px 5px;}
.sb-item{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:500;color:${v.tx};transition:background .15s;margin-bottom:1px;width:100%;}
.sb-item:hover{background:${v.sf2};}
.sb-item.active{background:${v.sf2};color:var(--accent);font-weight:600;}
.sb-item.active svg{stroke:var(--accent);}
.sb-recent{max-height:200px;overflow-y:auto;padding:0 2px;}
.sb-recent::-webkit-scrollbar{width:0;}
.sb-ritem{display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:10px;cursor:pointer;font-size:13px;color:${v.mt};transition:background .15s;}
.sb-ritem:hover{background:${v.sf2};color:${v.tx};}
.sb-rtxt{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;}
.sb-rdate{font-size:10px;opacity:.6;flex-shrink:0;}
.sb-bottom{padding:10px 8px;border-top:1px solid ${v.bd};}
.sb-logout{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:500;color:#ef4444;}
.sb-logout:hover{background:#ef444414;}
.sb-upgrade{margin:0 0 6px;background:var(--grad);border-radius:14px;padding:14px;cursor:pointer;}
.sb-upgrade h4{font-size:14px;font-weight:700;color:#fff;}
.sb-upgrade p{font-size:11px;color:#ffffffaa;margin-top:3px;}

.auth{flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 22px;gap:14px;}
.auth-logo{font-size:50px;}
.auth-title{font-size:24px;font-weight:800;letter-spacing:-.5px;}
.auth-sub{font-size:13px;color:${v.mt};text-align:center;}
.card{width:100%;background:${v.sf};border:1px solid ${v.bd};border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:12px;}
.card-head{font-size:17px;font-weight:700;text-align:center;}
.iw{display:flex;flex-direction:column;gap:4px;}
.ilbl{font-size:10px;color:${v.mt};font-weight:700;letter-spacing:.07em;text-transform:uppercase;}
.inp{background:${dark?"#111":v.sf2};border:1.5px solid ${v.bd};border-radius:12px;color:${v.tx};font-family:'Inter',sans-serif;font-size:15px;padding:12px 14px;outline:none;width:100%;transition:border-color .2s;}
.inp:focus{border-color:var(--accent);}
.btn{border:none;border-radius:12px;cursor:pointer;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;padding:13px;transition:all .2s;width:100%;}
.btn-p{background:var(--grad);color:#fff;}.btn-p:hover{opacity:.9;}.btn-p:disabled{opacity:.55;cursor:not-allowed;}
.btn-s{background:${v.sf2};color:${v.tx};border:1px solid ${v.bd};}
.lnk{font-size:13px;color:${v.mt};text-align:center;}.lnk span{color:var(--accent);cursor:pointer;font-weight:600;}
.err{color:#ef4444;font-size:13px;text-align:center;background:#ef444412;padding:9px;border-radius:10px;}
.ok{color:#22c55e;font-size:13px;text-align:center;background:#22c55e12;padding:9px;border-radius:10px;}

.hdr{display:flex;align-items:center;gap:10px;padding:11px 14px;background:${v.bg};border-bottom:1px solid ${v.bd};flex-shrink:0;position:relative;z-index:10;}
.hdr-name{font-size:17px;font-weight:800;flex:1;letter-spacing:-.3px;}
.dots{background:none;border:none;color:${v.tx};cursor:pointer;padding:5px;border-radius:10px;line-height:1;display:flex;align-items:center;justify-content:center;}
.nbtn{background:${v.sf2};border:1px solid ${v.bd};border-radius:10px;color:${v.tx};cursor:pointer;font-size:13px;font-weight:600;padding:6px 12px;}

.chat{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;}
.chat::-webkit-scrollbar{width:0;}
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:40px 20px;}
.wlotus{font-size:96px;cursor:pointer;line-height:1;display:block;animation:wFloat 4s ease-in-out infinite;}
@keyframes wFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
.welcome h2{font-size:26px;font-weight:800;letter-spacing:-.5px;}
.wsub{font-size:13px;color:${v.mt};max-width:220px;line-height:1.7;}

.mwrap{display:flex;flex-direction:column;gap:2px;animation:mIn .2s ease;}
@keyframes mIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
.mrow{display:flex;gap:7px;align-items:flex-end;}.mrow.user{flex-direction:row-reverse;}
.bwrap{display:flex;flex-direction:column;max-width:82%;}
.bub{padding:11px 15px;font-size:${fs}px;line-height:1.65;word-break:break-word;}
.bub.user{background:var(--grad);color:#fff;border-radius:20px 20px 4px 20px;}
.bub.ai{background:${v.bub};color:${v.tx};border:1px solid ${v.bd};border-radius:20px 20px 20px 4px;}
.rbar{display:flex;gap:2px;padding:4px 8px;background:${v.sf};border:1px solid ${v.bd};border-radius:24px;position:absolute;top:-42px;left:0;z-index:10;box-shadow:0 4px 16px #0007;animation:fadeIn .15s;}
.rbtn{background:none;border:none;cursor:pointer;font-size:20px;padding:2px 4px;border-radius:8px;transition:transform .12s;}.rbtn:hover{transform:scale(1.3);}
.react{font-size:15px;padding-left:4px;margin-top:2px;}
.acts{display:flex;gap:4px;padding:3px 2px 0;flex-wrap:wrap;}
.abtn{background:none;border:1px solid ${v.bd};color:${v.mt};cursor:pointer;padding:4px 7px;border-radius:20px;display:flex;align-items:center;justify-content:center;transition:all .15s;line-height:1;}
.abtn:hover{color:var(--accent);border-color:var(--accent);}.abtn.on{color:var(--accent);border-color:var(--accent);background:var(--glow);}
.mtime{font-size:10px;color:${v.mt};padding:0 3px;}.mtime.user{text-align:right;}
.aiav{width:27px;height:27px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
.tbub{background:${v.bub};border:1px solid ${v.bd};border-radius:20px 20px 20px 4px;padding:13px 17px;display:flex;gap:5px;}
.dot{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:bou 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}.dot:nth-child(3){animation-delay:.4s;}
@keyframes bou{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-5px);}}
.sind{font-size:11px;color:var(--accent);padding:4px 10px;background:var(--glow);border-radius:20px;display:inline-flex;align-items:center;gap:4px;}
.mimg{max-width:200px;border-radius:12px;margin-bottom:4px;display:block;cursor:pointer;}
.mimg.gen{width:240px;max-width:100%;border-radius:14px;cursor:pointer;}

.imgviewer{position:fixed;inset:0;background:#000e;z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease;}
.imgviewer img{max-width:100%;max-height:90dvh;border-radius:12px;object-fit:contain;}
.imgviewer-x{position:absolute;top:18px;right:18px;background:#fff2;border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:20px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);}

.sb-premium{margin:0 0 8px;border-radius:16px;padding:2px;background:var(--grad);position:relative;overflow:hidden;}
.sb-premium::after{content:'';position:absolute;inset:0;background:var(--grad);animation:premGlow 3s ease-in-out infinite;opacity:.5;pointer-events:none;}
@keyframes premGlow{0%,100%{opacity:.3;}50%{opacity:.8;}}
.sb-premium-inner{background:${dark?"#0d0d0d":v.sf};border-radius:14px;padding:14px;position:relative;z-index:1;}
.sb-prem-plans{display:flex;gap:8px;margin-top:10px;}
.pplan{flex:1;border-radius:12px;padding:10px 8px;cursor:pointer;text-align:center;border:1.5px solid transparent;transition:all .2s;}
.pplan.month{background:var(--grad);}.pplan.week{background:transparent;border-color:var(--accent);}
.pplan-price{font-size:16px;font-weight:800;color:#fff;}.pplan.week .pplan-price{color:var(--accent);}
.pplan-label{font-size:10px;color:rgba(255,255,255,.75);margin-top:2px;}.pplan.week .pplan-label{color:var(--accent);}
.pplan-feats{font-size:10px;margin-top:6px;color:rgba(255,255,255,.85);line-height:1.6;text-align:left;white-space:pre-line;}.pplan.week .pplan-feats{color:${v.mt};}

@keyframes fabPop{0%,100%{box-shadow:0 6px 24px ${a.glow};}50%{box-shadow:0 6px 32px ${a.glow},0 0 0 8px ${a.glow.replace("40","15")};}}
.fab{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--grad);border:none;border-radius:50px;color:#fff;cursor:pointer;display:flex;align-items:center;gap:8px;padding:14px 26px;font-size:14px;font-weight:700;font-family:'Inter',sans-serif;z-index:40;animation:fabPop 3s ease-in-out infinite;transition:transform .2s;}
.fab:hover{transform:translateX(-50%) scale(1.05);}
.fab:active{transform:translateX(-50%) scale(.97);}

.hactions{display:flex;gap:4px;flex-shrink:0;}
.hact{background:none;border:none;color:${v.mt};cursor:pointer;padding:5px 6px;border-radius:8px;font-size:15px;line-height:1;}
.hact:hover{color:var(--accent);background:${v.sf2};}
.hact.del:hover{color:#ef4444;}

.ibar{padding:9px 12px;border-top:1px solid ${v.bd};background:${v.bg};display:flex;gap:7px;align-items:flex-end;flex-shrink:0;}
.tinp{flex:1;background:${v.sf};border:1.5px solid ${v.bd};border-radius:24px;color:${v.tx};font-family:'Inter',sans-serif;font-size:${fs}px;padding:11px 17px;outline:none;resize:none;max-height:110px;min-height:46px;transition:border-color .2s;line-height:1.5;}
.tinp:focus{border-color:var(--accent);}.tinp::placeholder{color:${v.mt};}
.sbtn{background:var(--grad);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:18px;width:46px;height:46px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .15s;}
.sbtn:hover{transform:scale(1.05);}.sbtn:disabled{opacity:.4;cursor:not-allowed;}
.ibtn{background:${v.sf2};border:1.5px solid ${v.bd};border-radius:50%;color:${v.tx};cursor:pointer;width:42px;height:42px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;}
.ibtn:hover{border-color:var(--accent);}.ibtn.rec{border-color:#ef4444;background:#ef444418;animation:mPulse 1s infinite;}
@keyframes mPulse{0%,100%{box-shadow:0 0 0 0 #ef444438;}50%{box-shadow:0 0 0 5px transparent;}}
.imgprev{position:relative;display:inline-block;margin-bottom:7px;}
.imgprev img{width:72px;height:72px;object-fit:cover;border-radius:12px;border:2px solid var(--accent);}
.imgprev-x{position:absolute;top:-5px;right:-5px;background:#ef4444;border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:11px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;}

.page{flex:1;overflow-y:auto;display:flex;flex-direction:column;}
.page::-webkit-scrollbar{width:0;}
.page-inner{padding:14px 14px 30px;flex:1;}
.ptitle{font-size:20px;font-weight:800;margin-bottom:16px;letter-spacing:-.4px;}

.sbar{display:flex;align-items:center;background:${v.sf};border:1.5px solid ${v.bd};border-radius:12px;padding:8px 13px;gap:7px;margin-bottom:10px;}
.sbar input{flex:1;background:none;border:none;outline:none;color:${v.tx};font-size:14px;font-family:'Inter',sans-serif;}
.sec{font-size:10px;font-weight:700;color:${v.mt};letter-spacing:.12em;text-transform:uppercase;padding:16px 0 6px;}
.scard{background:${v.sf};border:1px solid ${v.bd};border-radius:16px;overflow:hidden;margin-bottom:8px;}
.srow{display:flex;align-items:center;gap:13px;padding:14px 16px;border-bottom:1px solid ${v.bd};min-height:54px;}
.srow:last-child{border-bottom:none;}
.sicon{font-size:18px;width:26px;text-align:center;flex-shrink:0;}
.stxt{flex:1;min-width:0;}
.slbl{font-size:14px;font-weight:600;}
.sdesc{font-size:12px;color:${v.mt};margin-top:2px;}
.sright{flex-shrink:0;display:flex;align-items:center;gap:6px;}
.sexpand{overflow:hidden;transition:max-height .28s cubic-bezier(.4,0,.2,1);}
.sexpand-inner{padding:12px 16px 16px;display:flex;flex-direction:column;gap:8px;border-top:1px solid ${v.bd};}
.opt-row{display:flex;gap:6px;flex-wrap:wrap;}
.opt-pill{padding:7px 14px;border-radius:20px;border:1.5px solid ${v.bd};background:transparent;color:${v.mt};cursor:pointer;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;transition:all .2s;}
.opt-pill.sel{border-color:var(--accent);color:var(--accent);background:var(--glow);}
.cdot{width:24px;height:24px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:all .2s;}
.cdot.sel{border-color:var(--accent);box-shadow:0 0 0 2px var(--glow);}
.tgl{position:relative;width:44px;height:24px;background:${v.sf2};border-radius:12px;cursor:pointer;border:2px solid ${v.bd};transition:background .2s;flex-shrink:0;}
.tgl.on{background:var(--accent);border-color:var(--accent);}
.tk{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;}
.tgl.on .tk{left:22px;}

.pav{position:relative;display:inline-block;}
.pavimg{width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid var(--accent);}
.pavph{width:64px;height:64px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;}
.paved{position:absolute;bottom:0;right:0;background:var(--accent);border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;}

.hcard{background:${v.sf};border:1px solid ${v.bd};border-radius:14px;padding:13px 15px;display:flex;align-items:center;gap:11px;cursor:pointer;transition:border-color .2s;margin-bottom:6px;}
.hcard:hover{border-color:var(--accent);}
.hi{flex:1;overflow:hidden;}
.ht{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hm{font-size:11px;color:${v.mt};margin-top:2px;}
.dbtn{background:none;border:none;color:${v.mt};cursor:pointer;font-size:16px;padding:5px 7px;border-radius:8px;}
.dbtn:hover{color:#ef4444;}

.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:10px;}
.sct{background:${v.sf};border:1px solid ${v.bd};border-radius:14px;padding:15px;}
.sv{font-size:26px;font-weight:800;color:var(--accent);}
.sl{font-size:12px;color:${v.mt};margin-top:2px;}
.ucard{background:${v.sf};border:1px solid ${v.bd};border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:11px;margin-bottom:6px;}
.uav{width:36px;height:36px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:15px;flex-shrink:0;}
.badge{background:var(--grad);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
.badge-g{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
.badge-y{background:linear-gradient(135deg,#eab308,#ca8a04);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
.gbar{display:flex;align-items:flex-end;gap:4px;height:64px;margin-top:4px;}

.mbg{position:fixed;inset:0;background:#000c;z-index:200;display:flex;align-items:flex-end;padding:14px;}
.modal{background:${v.sf};border-radius:24px 24px 16px 16px;padding:26px 22px;width:100%;max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:13px;max-height:88vh;overflow-y:auto;}
.modal h3{font-size:20px;font-weight:700;text-align:center;}
.modal p{font-size:13px;color:${v.mt};text-align:center;line-height:1.6;}
.mi{font-size:50px;text-align:center;}
.pbox{background:${v.sf2};border:1px solid ${v.bd};border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:9px;}
.pnum{font-size:22px;font-weight:800;color:var(--accent);text-align:center;letter-spacing:2px;}
.pstep{font-size:13px;color:${v.tx};display:flex;gap:7px;}
.ld{text-align:center;color:${v.mt};padding:20px;font-size:14px;}

.vpage{display:flex;flex-direction:column;flex:1;background:${dark?"#060606":v.bg};}
.vbody{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:24px 20px;}
.vccard{background:${v.sf};border:1px solid ${v.bd};border-radius:28px;padding:32px 24px;display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;max-width:320px;}
.vorb-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:160px;height:160px;}
.vring{position:absolute;border-radius:50%;pointer-events:none;}
.vr1{animation:vra 2s ease-out infinite;background:${a.glow};}
.vr2{animation:vra 2s ease-out .5s infinite;background:${a.glow.replace("40","20")};}
@keyframes vra{0%{width:110px;height:110px;opacity:.9;}100%{width:180px;height:180px;opacity:0;}}
.vorb{width:116px;height:116px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;position:relative;font-size:46px;box-shadow:0 8px 32px ${a.glow};transition:all .25s;}
.vorb:hover{transform:scale(1.04);}
.vorb.listen{background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 0 0 12px #ef444422;animation:orbP 1s infinite;}
.vorb.speak{background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 8px 32px #22c55e55;}
.vorb.think{background:linear-gradient(135deg,#8b5cf6,#6d28d9);}
@keyframes orbP{0%,100%{transform:scale(1);}50%{transform:scale(1.06);}}
.vstatus{font-size:18px;font-weight:700;text-align:center;}
.vsub{font-size:12px;color:${v.mt};text-align:center;line-height:1.6;}
.vwave{display:flex;align-items:center;gap:3px;height:28px;}
.wb{width:3px;border-radius:3px;background:#22c55e;animation:wv .9s ease-in-out infinite;}
@keyframes wv{0%,100%{height:5px;opacity:.5;}50%{height:24px;opacity:1;}}
.vlast{width:100%;background:${v.sf2};border-radius:14px;padding:12px 14px;}
.vendbtn{background:#ef444418;border:1.5px solid #ef4444;border-radius:14px;color:#ef4444;cursor:pointer;font-size:14px;font-weight:700;padding:13px 36px;font-family:'Inter',sans-serif;transition:background .2s;}
.vendbtn:hover{background:#ef444428;}

.achat{max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:7px;background:${v.sf2};border-radius:12px;}

.pc{background:var(--grad);border-radius:18px;padding:18px;margin-bottom:6px;cursor:pointer;}
.pc h3{font-size:17px;font-weight:800;color:#fff;}
.pc p{font-size:12px;color:#ffffffaa;margin-top:3px;}
.pf{font-size:13px;color:#fff;display:flex;align-items:center;gap:7px;margin-top:5px;}

.toast{position:fixed;top:70px;left:50%;transform:translateX(-50%);background:${v.sf};border:1px solid var(--accent);border-radius:20px;padding:8px 16px;font-size:12px;font-weight:600;color:var(--accent);z-index:500;animation:fadeUp .3s ease;white-space:nowrap;box-shadow:0 4px 20px #0006;}
@keyframes logoGlow{0%,100%{filter:drop-shadow(0 0 3px #3b82f680);}50%{filter:drop-shadow(0 0 10px #3b82f6cc);}}
@keyframes logoRotate{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
@keyframes logoPulse{0%,100%{transform:scale(1);filter:drop-shadow(0 0 4px #f5c84280);}50%{transform:scale(1.18);filter:drop-shadow(0 0 12px #f5c842cc);}}
.plusmenu{position:absolute;bottom:60px;left:12px;background:${v.sf};border:1px solid ${v.bd};border-radius:16px;padding:8px;display:flex;flex-direction:column;gap:4px;z-index:50;box-shadow:0 8px 28px #0008;animation:fadeUp .18s ease;min-width:140px;}
.plusmenu-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;color:${v.tx};border:none;background:none;width:100%;text-align:left;font-family:'Inter',sans-serif;}
.plusmenu-item:hover{background:${v.sf2};}
.chat-ctx{position:fixed;background:${v.sf};border:1px solid ${v.bd};border-radius:14px;padding:6px;z-index:200;box-shadow:0 8px 28px #0009;animation:fadeIn .15s ease;min-width:160px;}
.chat-ctx-item{display:flex;align-items:center;gap:9px;padding:9px 13px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:500;color:${v.tx};border:none;background:none;width:100%;text-align:left;font-family:'Inter',sans-serif;}
.chat-ctx-item:hover{background:${v.sf2};}
.chat-ctx-item.red{color:#ef4444;}.chat-ctx-item.red:hover{background:#ef444414;}
.topbar{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid ${v.bd};background:${v.bg};flex-shrink:0;}
.topbar input{flex:1;background:${v.sf};border:1.5px solid ${v.bd};border-radius:20px;color:${v.tx};font-size:13px;padding:8px 14px;outline:none;font-family:'Inter',sans-serif;}
.topbar input:focus{border-color:var(--accent);}
.think-step{font-size:11px;color:var(--accent);margin-left:6px;font-style:italic;}
`;
}

// ── EXPAND ROW ─────────────────────────────────────────────────
function ExpandRow({ icon, label, desc, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--bd,#2a2a2a)" }}>
      <div className="srow" style={{ borderBottom: "none", cursor: "pointer" }} onClick={() => setOpen(v => !v)}>
        <div className="sicon">{icon}</div>
        <div className="stxt"><div className="slbl">{label}</div>{desc && <div className="sdesc">{desc}</div>}</div>
        <div style={{ color: "var(--mt,#6b7280)", transition: "transform .2s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}><Ico.ChevRight /></div>
      </div>
      <div className="sexpand" style={{ maxHeight: open ? "400px" : "0px" }}>
        <div className="sexpand-inner">{children}</div>
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────
export default function App() {
  const [pwaEvt, setPwaEvt] = useState(null);
  const [showPwa, setShowPwa] = useState(false);
  const [showSb, setShowSb] = useState(false);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [forgot, setForgot] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", pass: "", newPass: "", confirmPass: "" });
  const [ferr, setFerr] = useState(""); const [fok, setFok] = useState(""); const [fload, setFload] = useState(false);
  const [themeKey, setThemeKey] = useState("dark");
  const [accentKey, setAccentKey] = useState("orange");
  const [fontSize, setFontSize] = useState(14);
  const [language, setLanguage] = useState("auto");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [showDeleteAcc, setShowDeleteAcc] = useState(false);
  const [delConfirmText, setDelConfirmText] = useState("");
  const [delLoading, setDelLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState("chat");
  const [userData, setUserData] = useState(null);
  const [sessionTone, setSessionTone] = useState(null);
  const [sid, setSid] = useState(() => Date.now().toString());
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [reactions, setReactions] = useState({});
  const [showRx, setShowRx] = useState(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [chatContextMenu, setChatContextMenu] = useState(null); // { histId, x, y }
  const [loadingStep, setLoadingStep] = useState(""); // "Searching...", "Thinking...", etc.
  const [chatSearch, setChatSearch] = useState(null); // null=hidden, ""=open empty
  const [showLimit, setShowLimit] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [payDone, setPayDone] = useState(false);
  const [copied, setCopied] = useState(null);
  const [speakId, setSpeakId] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [micPerm, setMicPerm] = useState("unknown");
  const [imgB64, setImgB64] = useState(null);
  const [imgPrev, setImgPrev] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const [hists, setHists] = useState([]);
  const [histLoad, setHistLoad] = useState(false);
  const [hSearch, setHSearch] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [hFilter, setHFilter] = useState("all");
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [viewerSrc, setViewerSrc] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projLoad, setProjLoad] = useState(false);
  const [showNewProj, setShowNewProj] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [renamingProjId, setRenamingProjId] = useState(null);
  const [renameProjVal, setRenameProjVal] = useState("");
  const [upgradePlan, setUpgradePlan] = useState("monthly");
  const [showProfile, setShowProfile] = useState(false);
  const [pName, setPName] = useState("");
  const [pPhoto, setPPhoto] = useState(null);
  const [pPhotoUrl, setPPhotoUrl] = useState(null);
  const [pSaving, setPSaving] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [aSearch, setASearch] = useState("");
  const [aChat, setAChat] = useState(null);
  const [aChatLoad, setAChatLoad] = useState(false);
  const [vs, setVs] = useState("idle");
  const [vLast, setVLast] = useState("");
  const [vTone, setVTone] = useState("female");
  const [showChangePw, setShowChangePw] = useState(false);
  const [cpForm, setCpForm] = useState({ current: "", newP: "", confirm: "" });
  const [cpErr, setCpErr] = useState(""); const [cpOk, setCpOk] = useState(""); const [cpLoad, setCpLoad] = useState(false);
  const [memories, setMemories] = useState([]);
  const [memLoad, setMemLoad] = useState(false);
  const [memSaved, setMemSaved] = useState(false);
  const [showAddMem, setShowAddMem] = useState(false);
  const [newMemText, setNewMemText] = useState("");
  const [newMemCat, setNewMemCat] = useState("personal");
  const [newMemImportance, setNewMemImportance] = useState(5);
  const [editingMemId, setEditingMemId] = useState(null);
  const [editMemVal, setEditMemVal] = useState("");

  const bottomRef = useRef(null);
  const galleryRef = useRef(null);
  const fileRef = useRef(null);
  const pPhotoRef = useRef(null);
  const micRef = useRef(null);
  const voiceRef = useRef(null);
  const voiceActiveRef = useRef(false);
  const vsRef = useRef("idle");

  useEffect(() => { vsRef.current = vs; }, [vs]);

  useEffect(() => {
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "microphone" }).then(p => {
        setMicPerm(p.state === "granted" ? "granted" : p.state === "denied" ? "denied" : "unknown");
        p.onchange = () => setMicPerm(p.state === "granted" ? "granted" : p.state === "denied" ? "denied" : "unknown");
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const h = e => { e.preventDefault(); setPwaEvt(e); setShowPwa(true); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        setUser(u);
        const d = await getDoc(doc(db, "users", u.uid));
        if (d.exists()) {
          const data = d.data();
          setUserData(data);
          setPName(data.name || u.displayName || "");
          setPPhotoUrl(data.photoURL || null);
          if (data.theme) setThemeKey(data.theme);
          if (data.accent) setAccentKey(data.accent);
          if (data.fontSize) setFontSize(data.fontSize);
          if (data.language) setLanguage(data.language);
          if (data.memoryEnabled === false) setMemoryEnabled(false);
        }
        loadMemories(u.uid);
      } else { setUser(null); setUserData(null); setMemories([]); }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  useEffect(() => {
    if (user && page === "history") loadHists();
    if (user && page === "admin") loadAdmin();
    if (user && page === "projects") loadProjects();
    if (user && page === "memory") loadMemories(user.uid);
    if (page !== "voice") endVoice();
    window.speechSynthesis?.cancel();
    setSpeakId(null); setShowRx(null);
  }, [page]);

  async function loadMemories(uid) {
    setMemLoad(true);
    try {
      const q = query(collection(db, "memories"), where("userId", "==", uid || user.uid), orderBy("createdAt", "desc"), limit(50));
      const snap = await getDocs(q);
      setMemories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      try {
        const q2 = query(collection(db, "memories"), where("userId", "==", uid || user.uid));
        const s2 = await getDocs(q2);
        setMemories(s2.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      } catch (e) { console.error(e); }
    }
    setMemLoad(false);
  }

  async function addMemory(text, category, importance) {
    if (!text.trim()) return;
    const now = { seconds: Date.now() / 1000 };
    const data = {
      userId: user.uid,
      memory_content: text.trim(),
      text: text.trim(),
      category: category || "personal",
      importance_score: importance || 5,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      const ref = await addDoc(collection(db, "memories"), data);
      setMemories(p => [{ id: ref.id, ...data, createdAt: now, updatedAt: now }, ...p]);
    } catch (e) { alert("Memory save failed: " + e.message); }
  }

  async function editMemory(id, text) {
    if (!text.trim()) return;
    try {
      await updateDoc(doc(db, "memories", id), {
        memory_content: text.trim(),
        text: text.trim(),
        updatedAt: serverTimestamp()
      });
      setMemories(p => p.map(m => m.id === id
        ? { ...m, memory_content: text.trim(), text: text.trim(), updatedAt: { seconds: Date.now() / 1000 } }
        : m
      ));
    } catch (e) { alert("Memory update failed: " + e.message); }
    setEditingMemId(null);
  }

  async function deleteMemory(id) {
    if (!window.confirm("Delete this memory?")) return;
    await deleteDoc(doc(db, "memories", id));
    setMemories(p => p.filter(m => m.id !== id));
  }

  async function maybeSaveMemory(userText) {
    // Handle explicit "remember that..." commands immediately
    let textToAnalyze = userText;
    const isExplicit = isExplicitMemoryCommand(userText);
    if (isExplicit) textToAnalyze = extractExplicitFact(userText) || userText;

    // Capture memories snapshot at call time to avoid stale closure
    const memoriesSnapshot = memories;
    const result = await analyzeMemory(textToAnalyze, memoriesSnapshot);
    if (!result) return;

    const now = { seconds: Date.now() / 1000 };
    const memData = {
      userId: user.uid,
      memory_content: result.memory_content,
      // Keep .text alias for backward compat with old records
      text: result.memory_content,
      category: result.category,
      importance_score: result.importance_score,
      updatedAt: serverTimestamp(),
    };

    if (result.action === "update" && result.update_id) {
      // Update existing memory instead of creating duplicate
      const existingIdx = memoriesSnapshot.findIndex(m => m.id === result.update_id);
      if (existingIdx !== -1) {
        try {
          await updateDoc(doc(db, "memories", result.update_id), { ...memData, updatedAt: serverTimestamp() });
          setMemories(p => p.map(m => m.id === result.update_id
            ? { ...m, ...memData, updatedAt: now }
            : m
          ));
          setMemSaved("updated");
          setTimeout(() => setMemSaved(false), 2500);
          return;
        } catch { /* fall through to save new */ }
      }
    }

    // Save new memory
    const ref = await addDoc(collection(db, "memories"), {
      ...memData,
      createdAt: serverTimestamp(),
    });
    setMemories(p => [{
      id: ref.id,
      ...memData,
      createdAt: now,
      updatedAt: now,
    }, ...p]);
    setMemSaved("saved");
    setTimeout(() => setMemSaved(false), 2500);
  }

  async function loadHists() {
    setHistLoad(true);
    try {
      const q = query(collection(db, "chats"), where("userId", "==", user.uid), orderBy("updatedAt", "desc"));
      const snap = await getDocs(q);
      const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // For each chat without searchIndex, load last 5 messages and build index
      const enriched = await Promise.all(chats.map(async h => {
        if (h.searchIndex) return h; // already indexed
        try {
          const mq = query(
            collection(db, "messages"),
            where("sessionId", "==", h.id),
            orderBy("createdAt", "desc"),
            limit(5)
          );
          const mSnap = await getDocs(mq);
          const texts = mSnap.docs.map(d => d.data().text || "").join(" ");
          const searchIndex = texts.slice(0, 500).toLowerCase();
          // Save index back to Firestore for future searches
          if (searchIndex) {
            setDoc(doc(db, "chats", h.id), { searchIndex }, { merge: true }).catch(() => {});
          }
          return { ...h, searchIndex };
        } catch {
          return h;
        }
      }));

      setHists(enriched);
    } catch {
      try {
        const q2 = query(collection(db, "chats"), where("userId", "==", user.uid));
        const s2 = await getDocs(q2);
        setHists(s2.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)));
      } catch (e) { console.error(e); }
    }
    setHistLoad(false);
  }

  async function loadAdmin() {
    const snap = await getDocs(collection(db, "users"));
    setAdminUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function viewUserChat(u) {
    setAChat({ user: u, msgs: [] }); setAChatLoad(true);
    try {
      let m2 = [];
      try {
        const q = query(collection(db, "messages"), where("userId", "==", u.id), orderBy("createdAt", "desc"), limit(40));
        const snap = await getDocs(q);
        m2 = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
      } catch {
        const q2 = query(collection(db, "messages"), where("userId", "==", u.id));
        const s2 = await getDocs(q2);
        m2 = s2.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)).slice(-40);
      }
      setAChat({ user: u, msgs: m2 });
    } catch (e) { console.error(e); }
    setAChatLoad(false);
  }

  async function handleAuth() {
    setFerr(""); setFok("");
    if (forgot) {
      if (!form.newPass || !form.confirmPass) { setFerr("Please fill all fields!"); return; }
      if (form.newPass.length < 8) { setFerr("Password must be 8+ characters!"); return; }
      if (form.newPass !== form.confirmPass) { setFerr("Passwords do not match!"); return; }
      if (!form.email) { setFerr("Please enter your email!"); return; }
      setFload(true);
      try {
        await sendPasswordResetEmail(auth, form.email);
        setFok("✅ Password reset link sent to your email. Please check your inbox.");
        setForm(f => ({ ...f, email: "", newPass: "", confirmPass: "" }));
      } catch { setFerr("Email not registered!"); }
      setFload(false);
      return;
    }
    if (!form.email || !form.pass) { setFerr("Please fill all fields!"); return; }
    if (form.pass.length < 8) { setFerr("Password must be 8+ characters!"); return; }
    if (authMode === "signup" && !form.name) { setFerr("Enter your name!"); return; }
    setFload(true);
    try {
      if (authMode === "signup") {
        const c = await createUserWithEmailAndPassword(auth, form.email, form.pass);
        await updateProfile(c.user, { displayName: form.name });
        await setDoc(doc(db, "users", c.user.uid), { name: form.name, email: form.email, premium: false, createdAt: serverTimestamp(), usageCount: 0, theme: "dark", accent: "orange", fontSize: 14 });
        setUserData({ name: form.name, email: form.email, premium: false, usageCount: 0 });
        setPName(form.name);
      } else {
        await signInWithEmailAndPassword(auth, form.email, form.pass);
        const d = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (d.exists()) {
          const data = d.data(); setUserData(data);
          if (data.theme) setThemeKey(data.theme);
          if (data.accent) setAccentKey(data.accent);
          if (data.fontSize) setFontSize(data.fontSize);
          if (data.language) setLanguage(data.language);
          if (data.memoryEnabled === false) setMemoryEnabled(false);
        }
      }
      setForm({ name: "", email: "", pass: "", newPass: "", confirmPass: "" });
    } catch (e) {
      const errs = { "auth/email-already-in-use": "Email already registered!", "auth/invalid-email": "Invalid email!", "auth/wrong-password": "Wrong password!", "auth/user-not-found": "Account not found!", "auth/invalid-credential": "Wrong email or password!" };
      setFerr(errs[e.code] || e.message);
    }
    setFload(false);
  }

  async function savePref(key, val) {
    if (key === "theme") setThemeKey(val);
    if (key === "accent") setAccentKey(val);
    if (key === "fontSize") setFontSize(val);
    if (key === "language") setLanguage(val);
    if (key === "memoryEnabled") setMemoryEnabled(val);
    try { await setDoc(doc(db, "users", user.uid), { [key]: val }, { merge: true }); setUserData(p => ({ ...p, [key]: val })); } catch {}
  }

  async function saveProfile() {
    if (!pName.trim()) { alert("Enter your name!"); return; }
    setPSaving(true);
    try {
      const updates = { name: pName.trim() };
      if (pPhoto) { const compressed = await compressImage(pPhoto, 120, 0.55); updates.photoURL = compressed; setPPhotoUrl(compressed); }
      await updateProfile(auth.currentUser, { displayName: pName.trim() });
      await setDoc(doc(db, "users", user.uid), updates, { merge: true });
      setUserData(p => ({ ...p, ...updates }));
      setPPhoto(null); setShowProfile(false);
    } catch (e) { alert("Error: " + e.message); }
    setPSaving(false);
  }

  async function handleChangePw() {
    setCpErr(""); setCpOk("");
    if (!cpForm.current || !cpForm.newP || !cpForm.confirm) { setCpErr("Fill all fields!"); return; }
    if (cpForm.newP.length < 8) { setCpErr("New password must be 8+ characters!"); return; }
    if (cpForm.newP !== cpForm.confirm) { setCpErr("Passwords do not match!"); return; }
    setCpLoad(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, cpForm.current);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, cpForm.newP);
      setCpOk("✅ Password changed successfully!");
      setCpForm({ current: "", newP: "", confirm: "" });
      setTimeout(() => setShowChangePw(false), 1500);
    } catch (e) {
      const errs = { "auth/wrong-password": "Current password is incorrect!", "auth/invalid-credential": "Current password is incorrect!", "auth/too-many-requests": "Too many attempts. Try again later." };
      setCpErr(errs[e.code] || "Error: " + e.message);
    }
    setCpLoad(false);
  }

  function handleGallery(e) {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = "";
    const r = new FileReader();
    r.onload = ev => { const d = ev.target.result; setImgB64(d.split(",")[1]); setImgPrev(d); };
    r.onerror = () => alert("Could not load image.");
    r.readAsDataURL(file);
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setAttachLoading(true);
    for (const file of files) {
      const result = await extractFileText(file);
      setAttachments(p => [...p, result]);
    }
    setAttachLoading(false);
  }
  function removeAttachment(idx) {
    setAttachments(p => p.filter((_, i) => i !== idx));
  }

  function handlePPhoto(e) {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = "";
    const r = new FileReader();
    r.onload = ev => setPPhoto(ev.target.result);
    r.onerror = () => alert("Could not load image.");
    r.readAsDataURL(file);
  }

  // ── SPEECH TO TEXT (input bar mic) ─────────────────────────────
  const [micTranscript, setMicTranscript] = useState(""); // live interim transcript

  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input Chrome/Edge mein kaam karta hai. Please Chrome use karein."); return; }

    if (micActive) {
      micRef.current?.stop();
      micRef.current?.abort();
      setMicActive(false);
      setMicTranscript("");
      return;
    }

    const r = new SR();
    r.lang = language === "english" ? "en-IN" : "hi-IN";
    r.continuous = true;       // keep listening until user stops
    r.interimResults = true;   // show live transcript
    r.maxAlternatives = 1;

    r.onstart = () => { setMicActive(true); setMicTranscript(""); };

    r.onresult = e => {
      let final = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      // Final words go into input permanently, interim shown as live preview
      if (final.trim()) setInput(p => (p + " " + final).trim());
      setMicTranscript(interim);
    };

    r.onerror = ev => {
      if (ev.error === "no-speech") return; // ignore silence
      setMicActive(false);
      setMicTranscript("");
    };

    r.onend = () => {
      setMicActive(false);
      setMicTranscript("");
    };

    micRef.current = r;
    try { r.start(); } catch { setMicActive(false); }
  }

  function toggleSpeak(id, text) {
    if (speakId === id) { window.speechSynthesis?.cancel(); setSpeakId(null); return; }
    setSpeakId(id);
    speakText(text, sessionTone || "female", 0.95, () => setSpeakId(null));
  }

  function copyMsg(text, id) {
    navigator.clipboard?.writeText(text).catch(() => { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); });
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  }

  function shareWA(text) { window.open("https://wa.me/?text=" + encodeURIComponent("Saraswati AI:\n\n" + text.slice(0, 500)), "_blank"); }

  async function shareChat(histId) {
    // Find chat in hists or use current msgs
    const chatMsgs = histId === sid ? msgs : null;
    let exportText = `Saraswati AI — Chat Export\n${"=".repeat(30)}\n\n`;
    if (chatMsgs) {
      exportText += chatMsgs.map(m => `${m.role === "user" ? "You" : "Saraswati AI"}:\n${m.text}`).join("\n\n---\n\n");
    } else {
      // Load from Firestore
      try {
        const q = query(collection(db, "messages"), where("sessionId", "==", histId));
        const snap = await getDocs(q);
        const loaded = snap.docs.map(d => d.data()).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        exportText += loaded.map(m => `${m.role === "user" ? "You" : "Saraswati AI"}:\n${m.text || ""}`).join("\n\n---\n\n");
      } catch { exportText += "(Could not load messages)"; }
    }
    // Try native share → fallback to clipboard → fallback to WA
    if (navigator.share) {
      try { await navigator.share({ title: "Saraswati AI Chat", text: exportText.slice(0, 2000) }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(exportText);
      alert("✅ Chat copied to clipboard! Paste anywhere to share.");
    } catch {
      window.open("https://wa.me/?text=" + encodeURIComponent(exportText.slice(0, 1000)), "_blank");
    }
  }

  function exportChat() {
    if (!msgs.length) { alert("No messages to export."); return; }
    const txt = msgs.map(m => (m.role === "user" ? "You" : "Saraswati AI") + ":\n" + m.text).join("\n\n---\n\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" })); a.download = "saraswati-chat.txt"; a.click();
  }

  async function exportAllData() {
    setExporting(true);
    try {
      const exportObj = { exportedAt: new Date().toISOString(), profile: null, chats: [], memories: [], projects: [] };
      try { const d = await getDoc(doc(db, "users", user.uid)); if (d.exists()) exportObj.profile = { email: user.email, ...d.data() }; } catch {}
      try {
        const chatsSnap = await getDocs(query(collection(db, "chats"), where("userId", "==", user.uid)));
        for (const cd of chatsSnap.docs) {
          const chat = { id: cd.id, ...cd.data() };
          try {
            const msgSnap = await getDocs(query(collection(db, "messages"), where("sessionId", "==", cd.id)));
            chat.messages = msgSnap.docs.map(md => ({ id: md.id, ...md.data() }));
          } catch { chat.messages = []; }
          exportObj.chats.push(chat);
        }
      } catch {}
      try {
        const memSnap = await getDocs(query(collection(db, "memories"), where("userId", "==", user.uid)));
        exportObj.memories = memSnap.docs.map(md => ({ id: md.id, ...md.data() }));
      } catch {}
      try {
        const projSnap = await getDocs(query(collection(db, "projects"), where("userId", "==", user.uid)));
        exportObj.projects = projSnap.docs.map(pd => ({ id: pd.id, ...pd.data() }));
      } catch {}
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "saraswati-ai-data-export.json";
      a.click();
    } catch (e) { alert("Export error: " + e.message); }
    setExporting(false);
  }

  async function clearAllMemories() {
    if (!window.confirm("Saari saved memories delete kar dein? Ye undo nahi ho sakta.")) return;
    try {
      const snap = await getDocs(query(collection(db, "memories"), where("userId", "==", user.uid)));
      for (const d of snap.docs) { await deleteDoc(doc(db, "memories", d.id)); }
      setMemories([]);
      alert("✅ Saari memories delete ho gayi.");
    } catch (e) { alert("Error: " + e.message); }
  }

  async function clearAllChatHistory() {
    if (!window.confirm("Saari chat history delete kar dein? Ye undo nahi ho sakta.")) return;
    try {
      const chatsSnap = await getDocs(query(collection(db, "chats"), where("userId", "==", user.uid)));
      for (const cd of chatsSnap.docs) {
        try {
          const msgSnap = await getDocs(query(collection(db, "messages"), where("sessionId", "==", cd.id)));
          for (const md of msgSnap.docs) { await deleteDoc(doc(db, "messages", md.id)); }
        } catch {}
        await deleteDoc(doc(db, "chats", cd.id));
      }
      setHists([]);
      setMsgs([]);
      setSid(Date.now().toString());
      alert("✅ Saari chat history delete ho gayi.");
    } catch (e) { alert("Error: " + e.message); }
  }

  async function deleteAccount() {
    if (delConfirmText.trim().toUpperCase() !== "DELETE") return;
    setDelLoading(true);
    try {
      const uid = user.uid;
      try {
        const chatsSnap = await getDocs(query(collection(db, "chats"), where("userId", "==", uid)));
        for (const cd of chatsSnap.docs) {
          try {
            const msgSnap = await getDocs(query(collection(db, "messages"), where("sessionId", "==", cd.id)));
            for (const md of msgSnap.docs) { await deleteDoc(doc(db, "messages", md.id)); }
          } catch {}
          await deleteDoc(doc(db, "chats", cd.id));
        }
      } catch {}
      try {
        const memSnap = await getDocs(query(collection(db, "memories"), where("userId", "==", uid)));
        for (const md of memSnap.docs) { await deleteDoc(doc(db, "memories", md.id)); }
      } catch {}
      try {
        const projSnap = await getDocs(query(collection(db, "projects"), where("userId", "==", uid)));
        for (const pd of projSnap.docs) { await deleteDoc(doc(db, "projects", pd.id)); }
      } catch {}
      try { await deleteDoc(doc(db, "users", uid)); } catch {}
      await deleteUser(auth.currentUser);
    } catch (e) {
      alert("Account delete karne mein error aaya: " + e.message);
    }
    setDelLoading(false);
  }

  function endVoice() {
    voiceActiveRef.current = false;
    voiceRef.current?.stop?.();
    voiceRef.current?.abort?.();
    window.speechSynthesis?.cancel();
    setVs("idle");
  }

  function startListening(currentMsgs, currentTone, currentSid, currentUserData) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !voiceActiveRef.current) return;

    const r = new SR();
    // Support both Hindi and English speech recognition
    r.lang = language === "english" ? "en-IN" : "hi-IN";
    r.continuous = false; // false is more reliable on mobile Chrome
    r.interimResults = false; // false = only final results, avoids double-processing
    r.maxAlternatives = 1;

    let finished = false;

    r.onresult = e => {
      if (finished) return;
      let finalTranscript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
      }
      if (finalTranscript.trim()) {
        finished = true;
        processUtterance(finalTranscript);
      }
    };

    async function processUtterance(rawTranscript) {
      let transcript = rawTranscript.trim();
      const lower = transcript.toLowerCase();
      const isQuestion = /^(kya|kaun|kab|kahan|kyu|kyun|kaise|why|what|when|where|who|how|which|kitna|kitne)\b/.test(lower) || lower.includes("?");
      transcript = transcript.charAt(0).toUpperCase() + transcript.slice(1);
      if (!/[.?!]$/.test(transcript)) transcript += isQuestion ? "?" : ".";

      if (!transcript.trim() || transcript.trim() === ".") {
        if (voiceActiveRef.current) { setVs("listen"); setTimeout(() => startListening(currentMsgs, currentTone, currentSid, currentUserData), 300); }
        return;
      }

      const det = detectTone(transcript);
      if (det) { setSessionTone(det); currentTone = det; }
      const tone = currentTone || "female";

      setVs("think");

      const ud = currentUserData;
      if (!ud?.premium && (ud?.usageCount || 0) >= FREE_LIMIT) {
        setShowLimit(true); voiceActiveRef.current = false; setVs("idle"); return;
      }

      const uRef = await addDoc(collection(db, "messages"), {
        sessionId: currentSid, userId: user.uid, role: "user", text: transcript, createdAt: serverTimestamp()
      });
      const newMsgs = [...currentMsgs, { id: uRef.id, role: "user", text: transcript, time: new Date() }];
      setMsgs(newMsgs);

      const isFirst = currentMsgs.length === 0;
      let titleUpdate = {};
      if (isFirst) {
        const t = await genTitle(transcript);
        titleUpdate = { title: t || transcript.slice(0, 38), createdAt: serverTimestamp() };
      }
      await setDoc(doc(db, "chats", currentSid), { userId: user.uid, ...titleUpdate, updatedAt: serverTimestamp() }, { merge: true });

      const nc = (ud?.usageCount || 0) + 1;
      await setDoc(doc(db, "users", user.uid), { usageCount: nc }, { merge: true });
      setUserData(p => ({ ...p, usageCount: nc }));
      if (memoryEnabled) maybeSaveMemory(transcript).catch(() => {});

      try {
        const aiText = await callAI(newMsgs, null, tone, memoryEnabled ? memories : null, language);
        const tid = "v_" + Date.now();
        const updatedMsgs = [...newMsgs, { id: tid, role: "ai", text: aiText, time: new Date() }];
        setMsgs(updatedMsgs);
        setVLast(aiText);
        await addDoc(collection(db, "messages"), {
          sessionId: currentSid, userId: user.uid, role: "ai", text: aiText, createdAt: serverTimestamp()
        });

        setVs("speak");
        speakText(aiText, tone, 0.95, () => {
          if (voiceActiveRef.current) {
            setVs("listen");
            setTimeout(() => startListening(updatedMsgs, tone, currentSid, { ...currentUserData, usageCount: nc }), 400);
          } else {
            setVs("idle");
          }
        });
      } catch (err) {
        setMsgs(p => [...p, { id: Date.now(), role: "ai", text: "❌ " + err.message, time: new Date() }]);
        if (voiceActiveRef.current) {
          setVs("listen");
          setTimeout(() => startListening(newMsgs, tone, currentSid, { ...currentUserData, usageCount: nc }), 500);
        } else {
          setVs("idle");
        }
      }
    }

    r.onerror = () => {
      if (finished) return;
      if (voiceActiveRef.current) {
        setTimeout(() => { setVs("listen"); startListening(currentMsgs, currentTone, currentSid, currentUserData); }, 800);
      } else {
        setVs("idle");
      }
    };

    r.onend = () => {
      // Auto-restart if call still active and not mid-processing
      if (voiceActiveRef.current && !finished && vsRef.current !== "think" && vsRef.current !== "speak") {
        setVs("listen");
        setTimeout(() => startListening(currentMsgs, currentTone, currentSid, currentUserData), 400);
      }
    };

    voiceRef.current = r;
    try { r.start(); } catch { setVs("idle"); }
  }

  async function handleOrb() {
    if (vs === "listen") {
      voiceActiveRef.current = false;
      voiceRef.current?.stop?.();
      setVs("idle");
      return;
    }
    if (vs === "speak") {
      voiceActiveRef.current = false;
      window.speechSynthesis?.cancel();
      setVs("idle");
      return;
    }
    if (vs === "think") return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Use Chrome or Edge for Voice Call."); return; }

    voiceActiveRef.current = true;
    setVs("listen");
    startListening(msgs, sessionTone || "female", sid, userData);
  }

  async function runAIAndAppend(newMsgs, b64, tone) {
    if (!b64 && needsImageGen(newMsgs[newMsgs.length - 1]?.text || "")) {
      const msgText = newMsgs[newMsgs.length - 1].text;
      setLoading(true);
      const prompt = extractPrompt(msgText);
      const url = getImgUrl(prompt);
      await new Promise(r => setTimeout(r, 500));
      const tid = "img_" + Date.now();
      const aiText = '🎨 Here is your image — "' + prompt + '"';
      setLoading(false);
      setMsgs(p => [...p, { id: tid, role: "ai", text: aiText, image: url, time: new Date() }]);
      await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "ai", text: aiText, image: url, createdAt: serverTimestamp() });
      return;
    }
    const lastUserMsg = [...newMsgs].reverse().find(m => m.role === "user");
    if (lastUserMsg && needsSearch(lastUserMsg.text)) { setSearching(true); setLoadingStep("Searching web..."); }
    else setLoadingStep("Thinking...");
    setLoading(true);
    try {
      const aiText = await callAI(newMsgs, b64, tone, memoryEnabled ? memories : null, language);
      setSearching(false); setLoadingStep("Writing response...");
      const tid = "ai_" + Date.now();
      setLoading(false); setLoadingStep("");
      setMsgs(p => [...p, { id: tid, role: "ai", text: "", time: new Date() }]);
      let shown = "", sc = 0;
      for (let i = 0; i < aiText.length; i++) {
        shown += aiText[i];
        const s = shown;
        setMsgs(p => p.map(m => m.id === tid ? { ...m, text: s } : m));
        sc++; if (sc % 10 === 0) playTypingSound();
        await new Promise(r => setTimeout(r, 7));
      }
      await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "ai", text: aiText, createdAt: serverTimestamp() });
    } catch (e) { setSearching(false); setLoading(false); setLoadingStep(""); setMsgs(p => [...p, { id: Date.now(), role: "ai", text: "❌ Error: " + e.message, time: new Date() }]); }
  }

  async function sendMsg(text) {
    const txt = (text !== undefined && text !== null) ? String(text).trim() : input.trim();
    if ((!txt && !imgB64 && !imgPrev && !attachments.length) || loading) return;
    const ud = userData || {};
    if (!ud?.premium && (ud?.usageCount || 0) >= FREE_LIMIT) { setShowLimit(true); return; }
    const msgText = txt || (attachments.length ? "Is file ko padho aur samjhao." : "What is in this image?");
    setInput("");
    const b64 = imgB64, prev = imgPrev;
    const files = attachments.map(a => ({ name: a.name, ext: a.ext, error: a.error || null }));
    let fileContext = "";
    if (attachments.length) {
      let combined = "";
      for (const a of attachments) {
        if (a.error) { combined += `\n\n[Attached file: ${a.name} — could not be read: ${a.error}]`; continue; }
        combined += `\n\n[Attached file: ${a.name}]\n${a.text}`;
      }
      if (combined.length > ATTACH_TOTAL_LIMIT) combined = combined.slice(0, ATTACH_TOTAL_LIMIT) + "\n...[truncated]";
      fileContext = combined;
    }
    setImgB64(null); setImgPrev(null); setAttachments([]);
    playSendSound();
    const det = detectTone(msgText);
    if (det) setSessionTone(det);
    const tone = det || sessionTone || "female";
    const uRef = await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "user", text: msgText, image: prev || null, files: files.length ? files : null, fileContext: fileContext || null, createdAt: serverTimestamp() });
    const newMsgs = [...msgs, { id: uRef.id, role: "user", text: msgText, image: prev, files: files.length ? files : null, fileContext: fileContext || null, time: new Date() }];
    setMsgs(newMsgs);
    const isFirst = msgs.length === 0;
    let titleUpdate = {};
    if (isFirst) {
      const t = await genTitle(msgText);
      titleUpdate = { title: t || msgText.slice(0, 38), createdAt: serverTimestamp() };
    }
    // Build searchIndex from last messages for content search
    const existingIndex = (msgs.slice(-4).map(m => m.text || "").join(" ") + " " + msgText).slice(0, 500).toLowerCase();
    await setDoc(doc(db, "chats", sid), { userId: user.uid, ...titleUpdate, updatedAt: serverTimestamp(), searchIndex: existingIndex }, { merge: true });
    const nc = (ud?.usageCount || 0) + 1;
    await setDoc(doc(db, "users", user.uid), { usageCount: nc }, { merge: true });
    setUserData(p => ({ ...p, usageCount: nc }));
    // Fire memory save in background — intentionally not awaited so AI response isn't blocked
    // Explicit "remember" commands still work because maybeSaveMemory handles them first
    if (memoryEnabled) maybeSaveMemory(msgText).catch(() => {});
    await runAIAndAppend(newMsgs, b64, tone);
  }

  async function editMessage(id, newText) {
    if (!newText.trim() || loading) return;
    const idx = msgs.findIndex(m => m.id === id);
    if (idx === -1) return;
    const target = msgs[idx];
    try { await updateDoc(doc(db, "messages", id), { text: newText.trim(), edited: true }); } catch {}
    const toRemove = msgs.slice(idx + 1).filter(m => typeof m.id === "string" && !m.id.startsWith("ai_") && !m.id.startsWith("img_") && !m.id.startsWith("v_"));
    for (const m of toRemove) { try { await deleteDoc(doc(db, "messages", m.id)); } catch {} }
    const trimmed = msgs.slice(0, idx);
    const updatedMsg = { ...target, text: newText.trim(), edited: true };
    const newMsgs = [...trimmed, updatedMsg];
    setMsgs(newMsgs);
    const tone = sessionTone || "female";
    await runAIAndAppend(newMsgs, null, tone);
  }

  async function deleteMessage(id) {
    if (!window.confirm("Delete this message?")) return;
    try { await deleteDoc(doc(db, "messages", id)); } catch {}
    setMsgs(p => p.filter(m => m.id !== id));
  }

  async function regenerateMessage(id) {
    if (loading) return;
    const idx = msgs.findIndex(m => m.id === id);
    if (idx === -1) return;
    const toRemove = msgs.slice(idx).filter(m => typeof m.id === "string" && !m.id.startsWith("ai_") && !m.id.startsWith("img_") && !m.id.startsWith("v_"));
    for (const m of toRemove) { try { await deleteDoc(doc(db, "messages", m.id)); } catch {} }
    const newMsgs = msgs.slice(0, idx);
    setMsgs(newMsgs);
    const tone = sessionTone || "female";
    await runAIAndAppend(newMsgs, null, tone);
  }

  async function loadSession(s) {
    try {
      setPage("chat"); setSid(s.id); setMsgs([]); setShowSb(false);
      const q = query(collection(db, "messages"), where("sessionId", "==", s.id));
      const snap = await getDocs(q);
      setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data(), time: d.data().createdAt })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));
    } catch (e) { alert("Error: " + e.message); }
  }

  async function delSession(id, e) {
    e.stopPropagation();
    if (!window.confirm("Delete this chat?")) return;
    await deleteDoc(doc(db, "chats", id));
    setHists(p => p.filter(h => h.id !== id));
  }

  async function renameSession(id, newTitle) {
    if (!newTitle.trim()) { setRenamingId(null); return; }
    await updateDoc(doc(db, "chats", id), { title: newTitle.trim() });
    setHists(p => p.map(h => h.id === id ? { ...h, title: newTitle.trim() } : h));
    setRenamingId(null);
  }

  async function togglePin(id, e) {
    e?.stopPropagation();
    const cur = hists.find(h => h.id === id);
    const next = !cur?.pinned;
    await setDoc(doc(db, "chats", id), { pinned: next }, { merge: true });
    setHists(p => p.map(h => h.id === id ? { ...h, pinned: next } : h));
  }
  async function toggleStar(id, e) {
    e?.stopPropagation();
    const cur = hists.find(h => h.id === id);
    const next = !cur?.starred;
    await setDoc(doc(db, "chats", id), { starred: next }, { merge: true });
    setHists(p => p.map(h => h.id === id ? { ...h, starred: next } : h));
  }
  async function toggleArchive(id, e) {
    e?.stopPropagation();
    const cur = hists.find(h => h.id === id);
    const next = !cur?.archived;
    await setDoc(doc(db, "chats", id), { archived: next }, { merge: true });
    setHists(p => p.map(h => h.id === id ? { ...h, archived: next } : h));
  }

  async function loadProjects() {
    setProjLoad(true);
    try {
      const q = query(collection(db, "projects"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      try {
        const q2 = query(collection(db, "projects"), where("userId", "==", user.uid));
        const s2 = await getDocs(q2);
        setProjects(s2.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      } catch (e) { console.error(e); }
    }
    setProjLoad(false);
  }

  async function createProject() {
    const name = newProjName.trim();
    if (!name) return;
    const ref = await addDoc(collection(db, "projects"), { userId: user.uid, title: name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    setProjects(p => [{ id: ref.id, userId: user.uid, title: name, createdAt: { seconds: Date.now() / 1000 } }, ...p]);
    setNewProjName(""); setShowNewProj(false);
  }

  async function renameProject(id, name) {
    if (!name.trim()) { setRenamingProjId(null); return; }
    await updateDoc(doc(db, "projects", id), { title: name.trim() });
    setProjects(p => p.map(pr => pr.id === id ? { ...pr, title: name.trim() } : pr));
    setRenamingProjId(null);
  }

  async function deleteProject(id) {
    if (!window.confirm("Delete this project?")) return;
    await deleteDoc(doc(db, "projects", id));
    setProjects(p => p.filter(pr => pr.id !== id));
  }

  async function adminToggle(uid, cur) {
    await updateDoc(doc(db, "users", uid), { premium: !cur, premiumPending: false });
    setAdminUsers(p => p.map(u => u.id === uid ? { ...u, premium: !cur } : u));
  }
  async function adminDelUser(uid) {
    if (!window.confirm("Permanently delete this user?")) return;
    await deleteDoc(doc(db, "users", uid));
    setAdminUsers(p => p.filter(u => u.id !== uid));
  }
  async function adminDelChat(msgId) {
    await deleteDoc(doc(db, "messages", msgId));
    setAChat(p => ({ ...p, msgs: p.msgs.filter(m => m.id !== msgId) }));
  }

  function newChat() { setSid(Date.now().toString()); setMsgs([]); setPage("chat"); setShowSb(false); setImgB64(null); setImgPrev(null); endVoice(); setReactions({}); setSessionTone(null); }

  const isAdmin = user?.email === ADMIN;
  const chatsLeft = userData?.premium ? null : Math.max(0, FREE_LIMIT - (userData?.usageCount || 0));
  const displayName = userData?.name || user?.displayName || "User";
  const filtHists = hists.filter(h => {
    const q = hSearch.toLowerCase().trim();
    if (!q) {
      if (hFilter === "pinned") return !!h.pinned;
      if (hFilter === "starred") return !!h.starred;
      if (hFilter === "archived") return !!h.archived;
      return !h.archived;
    }
    // Search in title AND message content (searchIndex)
    const inTitle = (h.title || "").toLowerCase().includes(q);
    const inContent = (h.searchIndex || "").toLowerCase().includes(q);
    if (!inTitle && !inContent) return false;
    if (hFilter === "pinned") return !!h.pinned;
    if (hFilter === "starred") return !!h.starred;
    if (hFilter === "archived") return !!h.archived;
    return !h.archived;
  });
  const pinnedHists = hists.filter(h => h.pinned && !h.archived);
  const filtAdminU = adminUsers.filter(u => (u.name || "").toLowerCase().includes(aSearch.toLowerCase()) || (u.email || "").toLowerCase().includes(aSearch.toLowerCase()));
  const adminGraph = Array.from({ length: 7 }, (_, i) => {
    const val = adminUsers.filter(u => { if (!u.createdAt?.seconds) return false; return Math.floor((Date.now() - u.createdAt.seconds * 1000) / 86400000) === (6 - i); }).length;
    return { l: ["M", "T", "W", "T", "F", "S", "S"][i], v: val };
  });
  const maxG = Math.max(...adminGraph.map(d => d.v), 1);
  const vOrbIcon = vs === "listen" ? "🎙️" : vs === "think" ? "🤔" : vs === "speak" ? "🔊" : "🪷";
  const vStatusTxt = { idle: "Tap to Talk", listen: "Listening... (tap to stop)", think: "Thinking...", speak: "Speaking..." }[vs];
  const accentColor = ACCENTS[accentKey]?.primary || "#f97316";

  if (!authReady) return null;

  if (!user) return (
    <div className="app">
      <style>{buildStyles(themeKey, accentKey, fontSize)}</style>
      <div className="auth">
        <div className="auth-logo">🪷</div>
        <div className="auth-title">Saraswati AI</div>
        <div className="auth-sub">India's AI assistant</div>
        <div className="card">
          {forgot ? (
            <>
              <div className="card-head">🔑 Reset Password</div>
              <div className="iw"><div className="ilbl">Email</div><input className="inp" type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="iw"><div className="ilbl">New Password</div><input className="inp" type="password" placeholder="Min 8 characters" value={form.newPass} onChange={e => setForm(f => ({ ...f, newPass: e.target.value }))} /></div>
              <div className="iw"><div className="ilbl">Confirm Password</div><input className="inp" type="password" placeholder="Re-enter password" value={form.confirmPass} onChange={e => setForm(f => ({ ...f, confirmPass: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAuth()} /></div>
              {ferr && <div className="err">{ferr}</div>}
              {fok && <div className="ok">{fok}</div>}
              <button className="btn btn-p" onClick={handleAuth} disabled={fload}>{fload ? "Sending..." : "Reset Password"}</button>
              <div className="lnk"><span onClick={() => { setForgot(false); setFerr(""); setFok(""); }}>← Back to Login</span></div>
            </>
          ) : (
            <>
              <div className="card-head">{authMode === "login" ? "Welcome Back 👋" : "Create Account ✨"}</div>
              {authMode === "signup" && <div className="iw"><div className="ilbl">Name</div><input className="inp" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>}
              <div className="iw"><div className="ilbl">Email</div><input className="inp" type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="iw"><div className="ilbl">Password</div><input className="inp" type="password" placeholder="Min 8 characters" value={form.pass} onChange={e => setForm(f => ({ ...f, pass: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAuth()} /></div>
              {ferr && <div className="err">{ferr}</div>}
              <button className="btn btn-p" onClick={handleAuth} disabled={fload}>{fload ? "Please wait..." : authMode === "login" ? "Login →" : "Create Account →"}</button>
              {authMode === "login" && <div className="lnk" style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }} onClick={() => { setForgot(true); setFerr(""); setFok(""); }}>Forgot password?</div>}
            </>
          )}
        </div>
        {!forgot && <div className="lnk">{authMode === "login" ? <><span style={{ color: "var(--mt)" }}>No account? </span><span onClick={() => { setAuthMode("signup"); setFerr(""); }}>Sign up</span></> : <><span style={{ color: "var(--mt)" }}>Have account? </span><span onClick={() => { setAuthMode("login"); setFerr(""); }}>Login</span></>}</div>}
      </div>
    </div>
  );

  return (
    <div className="app" onClick={() => { setShowRx(null); setShowPlusMenu(false); setChatContextMenu(null); }}>
      <style>{buildStyles(themeKey, accentKey, fontSize)}</style>

      {/* Chat context menu */}
      {chatContextMenu && (() => {
        const h = hists.find(x => x.id === chatContextMenu.histId);
        if (!h) return null;
        return (
          <div className="chat-ctx" style={{ top: Math.min(chatContextMenu.y, window.innerHeight - 260), left: Math.min(chatContextMenu.x, window.innerWidth - 180) }}
            onClick={e => e.stopPropagation()}>
            <button className="chat-ctx-item" onClick={() => { loadSession(h); setChatContextMenu(null); }}>💬 Open Chat</button>
            <button className="chat-ctx-item" onClick={() => { setRenamingId(h.id); setRenameVal(h.title || ""); setChatContextMenu(null); setPage("history"); }}>✏️ Rename</button>
            <button className="chat-ctx-item" onClick={() => { togglePin(h.id, { stopPropagation: () => {} }); setChatContextMenu(null); }}>{h.pinned ? "📍 Unpin" : "📌 Pin"}</button>
            <button className="chat-ctx-item" onClick={() => { shareWA((h.title || "Chat") + " - Saraswati AI"); setChatContextMenu(null); }}>📤 Share</button>
            <button className="chat-ctx-item red" onClick={() => { delSession(h.id, { stopPropagation: () => {} }); setChatContextMenu(null); }}>🗑 Delete</button>
          </div>
        );
      })()}
      <style>{buildStyles(themeKey, accentKey, fontSize)}</style>

      {/* Memory saved toast */}
      {memSaved && (
        <div className="toast">
          {memSaved === "updated" ? "🔄 Memory updated" : "🧠 Memory saved"}
        </div>
      )}

      {/* Image fullscreen viewer */}
      {viewerSrc && (
        <div className="imgviewer" onClick={() => setViewerSrc(null)}>
          <img src={viewerSrc} alt="full" onClick={e => e.stopPropagation()} />
          <button className="imgviewer-x" onClick={() => setViewerSrc(null)}>✕</button>
        </div>
      )}

      {/* PWA Install Banner */}
      {showPwa && pwaEvt && (
        <div className="pwa">
          <span style={{ fontSize: 26 }}>🪷</span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>Install App</div><div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Add to home screen</div></div>
          <button className="pwa-btn" onClick={async () => { pwaEvt.prompt(); await pwaEvt.userChoice; setShowPwa(false); }}>Install</button>
          <button className="pwa-x" onClick={() => setShowPwa(false)}>✕</button>
        </div>
      )}

      {/* ── SIDEBAR ── */}
      {showSb && (
        <>
          <div className="sb-overlay" onClick={() => setShowSb(false)} />
          <div className="sidebar">
            <div className="sb-head">
              <SaraswatiLogo size={30} animate={true} state="idle" />
              <span className="sb-title">Saraswati AI</span>
              <button className="sb-close" onClick={() => setShowSb(false)}>✕</button>
            </div>
            <div className="sb-user">
              {pPhotoUrl
                ? <img src={pPhotoUrl} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: `2px solid ${accentColor}`, flexShrink: 0 }} />
                : <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg,${accentColor},#ea580c)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 16, flexShrink: 0 }}>{displayName[0]?.toUpperCase()}</div>
              }
              <div className="sb-uinfo">
                <div className="sb-uname">{displayName}</div>
                <div className="sb-email">{user.email}</div>
              </div>
              {userData?.premium && <div className="badge" style={{ fontSize: 9 }}>PRO</div>}
            </div>
            <div className="sb-nav">
              <div className="sb-section">Menu</div>
              {[
                { id: "chat", icon: <Ico.Chat />, label: "Chat" },
                { id: "history", icon: <span style={{fontSize:18}}>📋</span>, label: "History" },
                { id: "projects", icon: <Ico.Project />, label: "Projects" },
                { id: "settings", icon: <Ico.Settings />, label: "Settings" },
              ].map(item => (
                <div key={item.id} className={"sb-item" + (page === item.id ? " active" : "")} onClick={() => { setPage(item.id); setShowSb(false); }}>
                  {item.icon}<span>{item.label}</span>
                </div>
              ))}
              {isAdmin && (
                <div className={"sb-item" + (page === "admin" ? " active" : "")} onClick={() => { setPage("admin"); setShowSb(false); }}>
                  <span style={{ fontSize: 18 }}>🛡️</span><span>Admin</span>
                </div>
              )}
              {pinnedHists.length > 0 && (
                <>
                  <div className="sb-section">📌 Pinned</div>
                  <div className="sb-recent">
                    {pinnedHists.map(h => (
                      <div key={h.id} className="sb-ritem" onClick={() => loadSession(h)}>
                        <span style={{ fontSize: 13, flexShrink: 0 }}>📌</span>
                        <span className="sb-rtxt">{h.title || "Chat"}</span>
                        <span className="sb-rdate">{fmtDate(h.updatedAt)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {hists.filter(h => !h.archived).length > 0 && (
                <>
                  <div className="sb-section">Recent</div>
                  <div className="sb-recent">
                    {hists.filter(h => !h.archived).slice(0, 10).map(h => (
                      <div key={h.id} className="sb-ritem" onClick={() => loadSession(h)}>
                        <span style={{ fontSize: 13, flexShrink: 0 }}>💬</span>
                        <span className="sb-rtxt">{h.title || "Chat"}</span>
                        <span className="sb-rdate">{fmtDate(h.updatedAt)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="sb-bottom">
              {!userData?.premium && (
                <div className="sb-premium">
                  <div className="sb-premium-inner">
                    <div style={{ fontWeight: 800, fontSize: 14 }}>⭐ Upgrade Premium</div>
                    <div style={{ fontSize: 11, color: "var(--mt)", marginTop: 2 }}>Unlimited access</div>
                    <div className="sb-prem-plans">
                      <div className="pplan month" onClick={() => { setUpgradePlan("monthly"); setShowUpgrade(true); setShowSb(false); }}>
                        <div className="pplan-price">₹99</div>
                        <div className="pplan-label">/month</div>
                        <div className="pplan-feats">{"✓ Unlimited Chats\n✓ No Ads\n✓ Faster AI\n✓ Voice Access"}</div>
                      </div>
                      <div className="pplan week" onClick={() => { setUpgradePlan("weekly"); setShowUpgrade(true); setShowSb(false); }}>
                        <div className="pplan-price">₹29</div>
                        <div className="pplan-label">/week</div>
                        <div className="pplan-feats">{"✓ Unlimited Msgs\n✓ Ad-Free\n✓ Premium AI"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="sb-logout" onClick={() => signOut(auth)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                <span>Logout</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── FREE LIMIT MODAL ── */}
      {showLimit && (
        <div className="mbg" onClick={() => setShowLimit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mi">🔒</div>
            <h3>Free Limit Reached</h3>
            <p>You've used all {FREE_LIMIT} free messages. Upgrade to Premium for unlimited access!</p>
            <button className="btn btn-p" onClick={() => { setShowLimit(false); setShowUpgrade(true); }}>⭐ Upgrade Now</button>
            <button className="btn btn-s" onClick={() => setShowLimit(false)}>Maybe Later</button>
          </div>
        </div>
      )}

      {/* ── UPGRADE MODAL ── */}
      {showUpgrade && (
        <div className="mbg" onClick={() => { setShowUpgrade(false); setPayDone(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {payDone ? (
              <>
                <div className="mi">✅</div>
                <h3>Payment Sent!</h3>
                <p>Screenshot bhejo WhatsApp pe — 30 min mein activate ho jayega!</p>
                <button className="btn btn-p" onClick={() => window.open("https://wa.me/91" + UPI + "?text=Maine%20Saraswati%20AI%20Premium%20ke%20liye%20payment%20kiya%20hai", "_blank")}>📲 WhatsApp karo</button>
                <button className="btn btn-s" onClick={() => { setShowUpgrade(false); setPayDone(false); }}>Close</button>
              </>
            ) : (
              <>
                <div className="mi">⭐</div>
                <h3>Saraswati AI {upgradePlan === "monthly" ? "Monthly" : "Weekly"} Premium</h3>
                <p>Unlimited chats · Voice Call · Faster AI · Ad-free</p>
                <div className="pbox">
                  <div className="pnum">{upgradePlan === "monthly" ? "₹99 / month" : "₹29 / week"}</div>
                  <div className="pstep"><span>1️⃣</span><span>UPI pe pay karo: <strong>{UPI}@upi</strong></span></div>
                  <div className="pstep"><span>2️⃣</span><span>Screenshot lo</span></div>
                  <div className="pstep"><span>3️⃣</span><span>WhatsApp karo confirmation ke liye</span></div>
                </div>
                <button className="btn btn-p" onClick={() => { window.open("upi://pay?pa=" + UPI + "@upi&pn=SaraswatiAI&am=" + (upgradePlan === "monthly" ? "99" : "29") + "&cu=INR", "_blank"); setPayDone(true); }}>💳 Pay Now</button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className={"btn btn-s" + (upgradePlan === "monthly" ? " " : "")} style={{ flex: 1, opacity: upgradePlan === "monthly" ? 1 : 0.6 }} onClick={() => setUpgradePlan("monthly")}>Monthly ₹99</button>
                  <button className="btn btn-s" style={{ flex: 1, opacity: upgradePlan === "weekly" ? 1 : 0.6 }} onClick={() => setUpgradePlan("weekly")}>Weekly ₹29</button>
                </div>
                <button className="btn btn-s" onClick={() => setShowUpgrade(false)}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PROFILE MODAL ── */}
      {showProfile && (
        <div className="mbg" onClick={() => setShowProfile(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Profile</h3>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div className="pav">
                {(pPhoto || pPhotoUrl)
                  ? <img className="pavimg" src={pPhoto || pPhotoUrl} alt="" />
                  : <div className="pavph">{(pName || displayName)[0]?.toUpperCase()}</div>
                }
                <div className="paved" onClick={() => pPhotoRef.current?.click()}>📷</div>
                <input ref={pPhotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePPhoto} />
              </div>
            </div>
            <div className="iw"><div className="ilbl">Name</div><input className="inp" value={pName} onChange={e => setPName(e.target.value)} placeholder="Your name" /></div>
            <div style={{ fontSize: 13, color: "var(--mt)", textAlign: "center" }}>{user.email}</div>
            <button className="btn btn-p" onClick={saveProfile} disabled={pSaving}>{pSaving ? "Saving..." : "Save Changes"}</button>
            <button className="btn btn-s" onClick={() => setShowProfile(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── CHANGE PASSWORD MODAL ── */}
      {showChangePw && (
        <div className="mbg" onClick={() => setShowChangePw(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🔐 Change Password</h3>
            <div className="iw"><div className="ilbl">Current Password</div><input className="inp" type="password" placeholder="Current password" value={cpForm.current} onChange={e => setCpForm(f => ({ ...f, current: e.target.value }))} /></div>
            <div className="iw"><div className="ilbl">New Password</div><input className="inp" type="password" placeholder="Min 8 characters" value={cpForm.newP} onChange={e => setCpForm(f => ({ ...f, newP: e.target.value }))} /></div>
            <div className="iw"><div className="ilbl">Confirm New Password</div><input className="inp" type="password" placeholder="Repeat new password" value={cpForm.confirm} onChange={e => setCpForm(f => ({ ...f, confirm: e.target.value }))} /></div>
            {cpErr && <div className="err">{cpErr}</div>}
            {cpOk && <div className="ok">{cpOk}</div>}
            <button className="btn btn-p" onClick={handleChangePw} disabled={cpLoad}>{cpLoad ? "Changing..." : "Change Password"}</button>
            <button className="btn btn-s" onClick={() => setShowChangePw(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── DELETE ACCOUNT MODAL ── */}
      {showDeleteAcc && (
        <div className="mbg" onClick={() => setShowDeleteAcc(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mi">⚠️</div>
            <h3>Delete Account</h3>
            <p>Ye action permanent hai. Saara data delete ho jayega. Type <strong>DELETE</strong> to confirm.</p>
            <input className="inp" placeholder='Type "DELETE" to confirm' value={delConfirmText} onChange={e => setDelConfirmText(e.target.value)} />
            <button className="btn" style={{ background: "#ef4444", color: "#fff" }} onClick={deleteAccount} disabled={delLoading || delConfirmText.trim().toUpperCase() !== "DELETE"}>{delLoading ? "Deleting..." : "Delete My Account"}</button>
            <button className="btn btn-s" onClick={() => setShowDeleteAcc(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── ADD MEMORY MODAL ── */}
      {showAddMem && (
        <div className="mbg" onClick={() => setShowAddMem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🧠 Add Memory</h3>
            <div className="iw">
              <div className="ilbl">What to remember?</div>
              <textarea className="inp" rows={3}
                placeholder="e.g. User is a software engineer who loves Python"
                value={newMemText} onChange={e => setNewMemText(e.target.value)} style={{ resize: "none" }} />
            </div>
            <div className="iw">
              <div className="ilbl">Category</div>
              <div className="opt-row">
                {MEM_CATEGORIES.map(c => (
                  <button key={c} className={"opt-pill" + (newMemCat === c ? " sel" : "")} onClick={() => setNewMemCat(c)}>
                    {MEM_CATEGORY_LABELS[c]?.split(" ")[0]} {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="iw">
              <div className="ilbl">Importance: {newMemImportance || 5}/10</div>
              <input type="range" min={1} max={10} value={newMemImportance || 5}
                onChange={e => setNewMemImportance(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "var(--accent)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--mt)", marginTop: 2 }}>
                <span>Low</span><span>Medium</span><span>Critical</span>
              </div>
            </div>
            <button className="btn btn-p" onClick={async () => {
              if (!newMemText.trim()) return;
              await addMemory(newMemText, newMemCat, newMemImportance || 5);
              setNewMemText(""); setNewMemCat("personal"); setNewMemImportance(5); setShowAddMem(false);
            }}>Save Memory</button>
            <button className="btn btn-s" onClick={() => setShowAddMem(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── ADMIN USER CHAT MODAL ── */}
      {aChat && (
        <div className="mbg" onClick={() => setAChat(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>💬 {aChat.user.name || aChat.user.email}</h3>
            {aChatLoad ? <div className="ld">Loading...</div> : (
              <div className="achat">
                {aChat.msgs.length === 0 && <div className="ld">No messages</div>}
                {aChat.msgs.map(m => (
                  <div key={m.id} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, fontSize: 12, padding: "7px 10px", background: m.role === "user" ? "var(--glow)" : "var(--sf2)", borderRadius: 10, color: "var(--tx)" }}><strong style={{ fontSize: 10, color: "var(--mt)" }}>{m.role === "user" ? "User" : "AI"}</strong><br />{m.text?.slice(0, 200)}{m.text?.length > 200 ? "..." : ""}</div>
                    <button onClick={() => adminDelChat(m.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: "4px", flexShrink: 0 }}>🗑</button>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-s" onClick={() => setAChat(null)}>Close</button>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="hdr">
        <button className="dots" onClick={() => { setShowSb(true); if (user) loadHists(); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div className="hdr-name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SaraswatiLogo size={26} animate={false} state="idle" />
          {page === "chat" ? "Saraswati AI" : page === "history" ? "History" : page === "settings" ? "Settings" : page === "admin" ? "Admin" : page === "projects" ? "Projects" : page === "memory" ? "Memory" : "Saraswati AI"}
        </div>
        {page === "chat" && (
          <>
            {chatsLeft !== null && chatsLeft <= 10 && (
              <div style={{ fontSize: 11, color: chatsLeft <= 3 ? "#ef4444" : "var(--mt)", fontWeight: 600 }}>{chatsLeft} left</div>
            )}
            <button className="dots" onClick={() => setChatSearch(v => v === null ? "" : null)} title="Search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button className="nbtn" onClick={newChat}>+ New</button>
          </>
        )}
        <button className="dots" onClick={() => setShowProfile(true)}>
          {pPhotoUrl
            ? <img src={pPhotoUrl} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: `2px solid ${accentColor}` }} />
            : <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${accentColor},#ea580c)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 12 }}>{displayName[0]?.toUpperCase()}</div>
          }
        </button>
      </div>

      {/* ── VOICE PAGE ── */}
      {page === "voice" && (
        <div className="vpage">
          <div className="vbody">
            <div className="vccard">
              <div className="vorb-wrap">
                <div className="vring vr1" />
                <div className="vring vr2" />
                <div className={"vorb" + (vs !== "idle" ? " " + vs : "")} onClick={handleOrb}>{vOrbIcon}</div>
              </div>
              <div className="vstatus">{vStatusTxt}</div>
              <div className="vsub">
                {vs === "idle" ? "Tap the lotus to start a voice conversation" : vs === "listen" ? "Bol rahe hain... main sun rahi hoon 👂" : vs === "think" ? "Soch rahi hoon... ek second 🤔" : "Bol rahi hoon..."}
              </div>
              {vs === "speak" && (
                <div className="vwave">
                  {Array.from({ length: 6 }, (_, i) => <div key={i} className="wb" style={{ animationDelay: i * 0.12 + "s" }} />)}
                </div>
              )}
              {vLast && (
                <div className="vlast">
                  <div style={{ fontSize: 11, color: "var(--accent)", marginBottom: 5, fontWeight: 600 }}>🪷 Last reply</div>
                  <div style={{ fontSize: 13, color: "var(--tx)", lineHeight: 1.6 }}>{vLast.slice(0, 180)}{vLast.length > 180 ? "..." : ""}</div>
                </div>
              )}
              {vs !== "idle" && <button className="vendbtn" onClick={endVoice}>End Call</button>}
            </div>
            <div style={{ fontSize: 12, color: "var(--mt)", textAlign: "center", maxWidth: 260, lineHeight: 1.6 }}>
              Works best on Chrome/Edge. Hindi aur English dono mein baat kar sakte hain.
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY PAGE ── */}
      {page === "history" && (
        <div className="page">
          <div className="page-inner">
            <div className="sbar">
              <Ico.Search />
              <input
                placeholder="Search chats & messages..."
                value={hSearch}
                onChange={e => setHSearch(e.target.value)}
              />
              {hSearch && <button onClick={() => setHSearch("")} style={{ background: "none", border: "none", color: "var(--mt)", cursor: "pointer", fontSize: 16 }}>✕</button>}
            </div>
            {hSearch && (
              <div style={{ fontSize: 11, color: "var(--mt)", marginBottom: 8, paddingLeft: 4 }}>
                {filtHists.length} result{filtHists.length !== 1 ? "s" : ""} — title aur messages dono mein search ho raha hai
              </div>
            )}
            <div className="opt-row" style={{ marginBottom: 12 }}>
              {["all","pinned","starred","archived"].map(f => (
                <button key={f} className={"opt-pill" + (hFilter === f ? " sel" : "")} onClick={() => setHFilter(f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
              ))}
            </div>
            {histLoad ? <div className="ld">Loading...</div> : filtHists.length === 0 ? <div className="ld">No chats found</div> : filtHists.map(h => (
              <div key={h.id} className="hcard" onClick={() => loadSession(h)}>
                <div style={{ fontSize: 20 }}>💬</div>
                <div className="hi">
                  {renamingId === h.id ? (
                    <input className="inp" style={{ fontSize: 13, padding: "5px 9px" }} value={renameVal} onChange={e => setRenameVal(e.target.value)}
                      onBlur={() => renameSession(h.id, renameVal)}
                      onKeyDown={e => { if (e.key === "Enter") renameSession(h.id, renameVal); if (e.key === "Escape") setRenamingId(null); }}
                      autoFocus onClick={e => e.stopPropagation()} />
                  ) : (
                    <div className="ht">{h.pinned ? "📌 " : ""}{h.title || "Chat"}</div>
                  )}
                  {hSearch && h.searchIndex?.toLowerCase().includes(hSearch.toLowerCase()) && !(h.title || "").toLowerCase().includes(hSearch.toLowerCase()) && (
                    <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
                      💬 Message mein milا: "...{(() => {
                        const idx = h.searchIndex.toLowerCase().indexOf(hSearch.toLowerCase());
                        return h.searchIndex.slice(Math.max(0, idx - 20), idx + 40);
                      })()}..."
                    </div>
                  )}
                  <div className="hm">{fmtDate(h.updatedAt)}</div>
                </div>
                <button className="hact" title="More" onClick={e => { e.stopPropagation(); setChatContextMenu(chatContextMenu?.histId === h.id ? null : { histId: h.id, x: e.clientX, y: e.clientY }); }}>
                  <Ico.More />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PROJECTS PAGE ── */}
      {page === "projects" && (
        <div className="page">
          <div className="page-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="ptitle" style={{ marginBottom: 0 }}>Projects</div>
              <button className="nbtn" onClick={() => setShowNewProj(true)}>+ New</button>
            </div>
            {showNewProj && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input className="inp" placeholder="Project name..." value={newProjName} onChange={e => setNewProjName(e.target.value)} onKeyDown={e => e.key === "Enter" && createProject()} autoFocus />
                <button className="btn btn-p" style={{ width: "auto", padding: "0 16px" }} onClick={createProject}>Create</button>
                <button className="btn btn-s" style={{ width: "auto", padding: "0 12px" }} onClick={() => setShowNewProj(false)}>✕</button>
              </div>
            )}
            {projLoad ? <div className="ld">Loading...</div> : projects.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--mt)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
                <div>No projects yet. Create one!</div>
              </div>
            ) : projects.map(pr => (
              <div key={pr.id} className="hcard">
                <div style={{ fontSize: 22 }}>📁</div>
                <div className="hi">
                  {renamingProjId === pr.id ? (
                    <input className="inp" style={{ fontSize: 13, padding: "5px 9px" }} value={renameProjVal} onChange={e => setRenameProjVal(e.target.value)}
                      onBlur={() => renameProject(pr.id, renameProjVal)}
                      onKeyDown={e => { if (e.key === "Enter") renameProject(pr.id, renameProjVal); if (e.key === "Escape") setRenamingProjId(null); }}
                      autoFocus />
                  ) : (
                    <div className="ht">{pr.title}</div>
                  )}
                  <div className="hm">{fmtDate(pr.createdAt)}</div>
                </div>
                <div className="hactions">
                  <button className="hact" onClick={() => { setRenamingProjId(pr.id); setRenameProjVal(pr.title); }}>✏️</button>
                  <button className="hact del" onClick={() => deleteProject(pr.id)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MEMORY PAGE ── */}
      {page === "memory" && (
        <div className="page">
          <div className="page-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div className="ptitle" style={{ marginBottom: 0 }}>🧠 Memory</div>
              <button className="nbtn" onClick={() => setShowAddMem(true)}>+ Add</button>
            </div>
            <div style={{ fontSize: 12, color: "var(--mt)", marginBottom: 12, lineHeight: 1.6 }}>
              Conversations se automatically seekhti hoon. "Remember that I am a developer" bol kar bhi save kar sakte ho.
            </div>

            {/* Auto Memory toggle */}
            <div className="scard" style={{ marginBottom: 12 }}>
              <div className="srow">
                <div className="sicon">🧠</div>
                <div className="stxt"><div className="slbl">Auto Memory</div><div className="sdesc">Conversations se automatically seekho</div></div>
                <div className="sright">
                  <div className={"tgl" + (memoryEnabled ? " on" : "")} onClick={() => savePref("memoryEnabled", !memoryEnabled)}><div className="tk" /></div>
                </div>
              </div>
            </div>

            {/* Stats bar */}
            {memories.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <div style={{ background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 10, padding: "7px 12px", fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: "var(--accent)" }}>{memories.length}</span> <span style={{ color: "var(--mt)" }}>total</span>
                </div>
                {MEM_CATEGORIES.map(cat => {
                  const n = memories.filter(m => m.category === cat).length;
                  if (!n) return null;
                  return (
                    <div key={cat} style={{ background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 10, padding: "7px 12px", fontSize: 11 }}>
                      <span style={{ fontWeight: 700, color: "var(--accent)" }}>{n}</span> <span style={{ color: "var(--mt)" }}>{cat}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {memLoad ? (
              <div className="ld">Loading memories...</div>
            ) : memories.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--mt)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🧠</div>
                <div style={{ fontSize: 14, marginBottom: 8 }}>Koi memory nahi hai abhi</div>
                <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                  Chat karo main seekhungi, ya<br />
                  <span style={{ color: "var(--accent)" }}>"Remember that I am a developer"</span><br />
                  type karo
                </div>
              </div>
            ) : (
              <>
                {MEM_CATEGORIES.map(cat => {
                  const catMems = memories
                    .filter(m => (m.category || "personal") === cat)
                    .sort((a, b) => (b.importance_score || 5) - (a.importance_score || 5));
                  if (!catMems.length) return null;
                  return (
                    <div key={cat}>
                      <div className="sec">{MEM_CATEGORY_LABELS[cat] || cat}</div>
                      {catMems.map(m => {
                        const content = m.memory_content || m.text || "";
                        const score = m.importance_score || 5;
                        const isEditing = editingMemId === m.id;
                        return (
                          <div key={m.id} style={{
                            background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 14,
                            padding: "12px 14px", marginBottom: 7, display: "flex", gap: 11, alignItems: "flex-start"
                          }}>
                            {/* Importance indicator */}
                            <div style={{
                              width: 6, borderRadius: 3, flexShrink: 0, alignSelf: "stretch", minHeight: 36,
                              background: score >= 8 ? "#22c55e" : score >= 5 ? "var(--accent)" : "var(--bd)"
                            }} title={`Importance: ${score}/10`} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {isEditing ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <textarea
                                    className="inp"
                                    rows={2}
                                    style={{ fontSize: 13, padding: "7px 10px", resize: "none", borderRadius: 10 }}
                                    value={editMemVal}
                                    onChange={e => setEditMemVal(e.target.value)}
                                    autoFocus
                                  />
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button className="btn btn-p" style={{ padding: "6px 14px", fontSize: 12, width: "auto" }}
                                      onClick={() => editMemory(m.id, editMemVal)}>Save</button>
                                    <button className="btn btn-s" style={{ padding: "6px 14px", fontSize: 12, width: "auto" }}
                                      onClick={() => setEditingMemId(null)}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--tx)", lineHeight: 1.5 }}>{content}</div>
                                  <div style={{ display: "flex", gap: 8, marginTop: 5, alignItems: "center" }}>
                                    <span style={{ fontSize: 10, color: "var(--mt)" }}>
                                      {m.updatedAt ? fmtDate(m.updatedAt) : fmtDate(m.createdAt)}
                                    </span>
                                    <span style={{ fontSize: 10, color: "var(--mt)" }}>·</span>
                                    <span style={{ fontSize: 10, color: score >= 8 ? "#22c55e" : score >= 5 ? "var(--accent)" : "var(--mt)", fontWeight: 600 }}>
                                      ★ {score}/10
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                            {!isEditing && (
                              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                <button className="hact" onClick={() => { setEditingMemId(m.id); setEditMemVal(content); }} title="Edit">✏️</button>
                                <button className="hact del" onClick={() => deleteMemory(m.id)} title="Delete">🗑</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                <button className="btn btn-s" style={{ marginTop: 8, color: "#ef4444", borderColor: "#ef444430" }} onClick={clearAllMemories}>
                  🗑 Clear All Memories
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SETTINGS PAGE ── */}
      {page === "settings" && (
        <div className="page">
          <div className="page-inner">
            <div className="ptitle">Settings</div>

            <div className="sec">Appearance</div>
            <div className="scard">
              <ExpandRow icon="🎨" label="Theme" desc={themeKey.charAt(0).toUpperCase() + themeKey.slice(1)}>
                <div className="opt-row">
                  {Object.keys(THEMES).map(t => <button key={t} className={"opt-pill" + (themeKey === t ? " sel" : "")} onClick={() => savePref("theme", t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
                </div>
              </ExpandRow>
              <ExpandRow icon="🎨" label="Accent Color">
                <div className="opt-row">
                  {Object.entries(ACCENTS).map(([k, v]) => (
                    <div key={k} className={"cdot" + (accentKey === k ? " sel" : "")} style={{ background: v.primary }} onClick={() => savePref("accent", k)} title={k} />
                  ))}
                </div>
              </ExpandRow>
              <ExpandRow icon="📝" label="Font Size" desc={fontSize + "px"}>
                <div className="opt-row">
                  {[12, 13, 14, 15, 16].map(s => <button key={s} className={"opt-pill" + (fontSize === s ? " sel" : "")} onClick={() => savePref("fontSize", s)}>{s}px</button>)}
                </div>
              </ExpandRow>
            </div>

            <div className="sec">AI Behavior</div>
            <div className="scard">
              <ExpandRow icon="🌐" label="Language" desc={language === "auto" ? "Auto Detect" : language === "hindi" ? "Hindi" : "English"}>
                <div className="opt-row">
                  {[["auto","Auto Detect"],["hindi","Hindi"],["english","English"]].map(([val, lbl]) => (
                    <button key={val} className={"opt-pill" + (language === val ? " sel" : "")} onClick={() => savePref("language", val)}>{lbl}</button>
                  ))}
                </div>
              </ExpandRow>
              <div className="srow">
                <div className="sicon">🧠</div>
                <div className="stxt"><div className="slbl">Memory</div><div className="sdesc">Remember info across chats</div></div>
                <div className="sright"><div className={"tgl" + (memoryEnabled ? " on" : "")} onClick={() => savePref("memoryEnabled", !memoryEnabled)}><div className="tk" /></div></div>
              </div>
            </div>

            {/* ── MEMORY MANAGEMENT inside Settings ── */}
            <div className="sec">🧠 Memory</div>
            <div className="scard" style={{ marginBottom: 8 }}>
              <div className="srow" style={{ cursor: "pointer" }} onClick={() => setShowAddMem(true)}>
                <div className="sicon">➕</div>
                <div className="stxt"><div className="slbl">Add Memory</div><div className="sdesc">Manually save a fact</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
              <div className="srow" style={{ cursor: "pointer" }} onClick={clearAllMemories}>
                <div className="sicon">🗑</div>
                <div className="stxt"><div className="slbl">Clear All Memories</div><div className="sdesc">{memories.length} saved</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
            </div>
            {memories.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {memories.slice(0, 20).map(m => {
                  const content = m.memory_content || m.text || "";
                  return (
                    <div key={m.id} style={{ background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 12, padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        {editingMemId === m.id ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <input className="inp" style={{ fontSize: 12, padding: "5px 9px", flex: 1 }} value={editMemVal}
                              onChange={e => setEditMemVal(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") editMemory(m.id, editMemVal); if (e.key === "Escape") setEditingMemId(null); }}
                              autoFocus />
                            <button className="btn btn-p" style={{ width: "auto", padding: "5px 10px", fontSize: 11 }} onClick={() => editMemory(m.id, editMemVal)}>Save</button>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: 13, color: "var(--tx)" }}>{content}</div>
                            <div style={{ fontSize: 10, color: "var(--mt)", marginTop: 2 }}>{m.category} · ★{m.importance_score || 5}</div>
                          </>
                        )}
                      </div>
                      {editingMemId !== m.id && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="hact" onClick={() => { setEditingMemId(m.id); setEditMemVal(content); }}>✏️</button>
                          <button className="hact del" onClick={() => deleteMemory(m.id)}>🗑</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="sec">Account</div>
            <div className="scard">
              <div className="srow" style={{ cursor: "pointer" }} onClick={() => setShowProfile(true)}>
                <div className="sicon">👤</div>
                <div className="stxt"><div className="slbl">Edit Profile</div><div className="sdesc">{displayName}</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
              <div className="srow" style={{ cursor: "pointer" }} onClick={() => setShowChangePw(true)}>
                <div className="sicon">🔐</div>
                <div className="stxt"><div className="slbl">Change Password</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
              {!userData?.premium && (
                <div className="srow" style={{ cursor: "pointer" }} onClick={() => setShowUpgrade(true)}>
                  <div className="sicon">⭐</div>
                  <div className="stxt"><div className="slbl">Upgrade to Premium</div><div className="sdesc">Unlimited chats + Voice</div></div>
                  <div className="sright"><Ico.ChevRight /></div>
                </div>
              )}
            </div>

            <div className="sec">Data</div>
            <div className="scard">
              <div className="srow" style={{ cursor: "pointer" }} onClick={exportChat}>
                <div className="sicon">💾</div>
                <div className="stxt"><div className="slbl">Export Current Chat</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
              <div className="srow" style={{ cursor: "pointer" }} onClick={exportAllData}>
                <div className="sicon">📦</div>
                <div className="stxt"><div className="slbl">{exporting ? "Exporting..." : "Export All Data"}</div><div className="sdesc">JSON format</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
              <div className="srow" style={{ cursor: "pointer" }} onClick={clearAllChatHistory}>
                <div className="sicon">🗑</div>
                <div className="stxt"><div className="slbl">Clear Chat History</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
              <div className="srow" style={{ cursor: "pointer" }} onClick={clearAllMemories}>
                <div className="sicon">🧠</div>
                <div className="stxt"><div className="slbl">Clear All Memories</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
              <div className="srow" style={{ cursor: "pointer" }} onClick={() => setShowDeleteAcc(true)}>
                <div className="sicon" style={{ color: "#ef4444" }}>⚠️</div>
                <div className="stxt"><div className="slbl" style={{ color: "#ef4444" }}>Delete Account</div><div className="sdesc">Permanent, cannot be undone</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
            </div>

            <div className="sec">About</div>
            <div className="scard">
              <div className="srow">
                <div className="sicon">🪷</div>
                <div className="stxt"><div className="slbl">Saraswati AI</div><div className="sdesc">Made with ❤️ by Kunal Saraswat</div></div>
              </div>
              <div className="srow">
                <div className="sicon">📊</div>
                <div className="stxt"><div className="slbl">Usage</div><div className="sdesc">{userData?.usageCount || 0} messages sent · {userData?.premium ? "Premium" : `${chatsLeft} free left`}</div></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN PAGE ── */}
      {page === "admin" && isAdmin && (
        <div className="page">
          <div className="page-inner">
            <div className="ptitle">Admin Panel</div>
            <div className="sgrid">
              <div className="sct"><div className="sv">{adminUsers.length}</div><div className="sl">Total Users</div></div>
              <div className="sct"><div className="sv">{adminUsers.filter(u => u.premium).length}</div><div className="sl">Premium</div></div>
              <div className="sct"><div className="sv">{adminUsers.filter(u => u.premiumPending).length}</div><div className="sl">Pending</div></div>
              <div className="sct"><div className="sv">{adminUsers.reduce((a, u) => a + (u.usageCount || 0), 0)}</div><div className="sl">Total Msgs</div></div>
            </div>
            <div className="sec">New Users (7d)</div>
            <div className="scard" style={{ padding: "14px 16px" }}>
              <div className="gbar">
                {adminGraph.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                      <div style={{ width: "100%", height: Math.max(4, (d.v / maxG) * 56) + "px", background: "var(--grad)", borderRadius: "4px 4px 0 0", transition: "height .3s" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--mt)" }}>{d.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="sec">Users</div>
            <div className="sbar"><Ico.Search /><input placeholder="Search users..." value={aSearch} onChange={e => setASearch(e.target.value)} /></div>
            {filtAdminU.map(u => (
              <div key={u.id} className="ucard">
                <div className="uav">{(u.name || u.email || "?")[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name || "No name"}</div>
                  <div style={{ fontSize: 11, color: "var(--mt)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                  <div style={{ fontSize: 11, color: "var(--mt)", marginTop: 2 }}>{u.usageCount || 0} msgs · {fmtDate(u.createdAt)}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  {u.premium && <span className="badge">PRO</span>}
                  {u.premiumPending && <span className="badge-y">Pending</span>}
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => viewUserChat(u)} style={{ background: "none", border: "1px solid var(--bd)", borderRadius: 8, color: "var(--mt)", cursor: "pointer", fontSize: 11, padding: "3px 7px" }}>Chat</button>
                    <button onClick={() => adminToggle(u.id, u.premium)} style={{ background: "var(--grad)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 11, padding: "3px 7px" }}>{u.premium ? "Revoke" : "Grant"}</button>
                    <button onClick={() => adminDelUser(u.id)} style={{ background: "none", border: "1px solid #ef4444", borderRadius: 8, color: "#ef4444", cursor: "pointer", fontSize: 11, padding: "3px 7px" }}>Del</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CHAT PAGE ── */}
      {page === "chat" && (
        <>
          {/* Top search bar */}
          {chatSearch !== null && (
            <div className="topbar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mt)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                placeholder="Search messages..."
                value={chatSearch}
                onChange={e => setChatSearch(e.target.value)}
                autoFocus
              />
              {chatSearch && <button onClick={() => setChatSearch("")} style={{ background: "none", border: "none", color: "var(--mt)", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>✕</button>}
            </div>
          )}
          <div className="chat" onClick={() => setShowPlusMenu(false)}>
            {msgs.length === 0 && (() => {
              const hr = new Date().getHours();
              const greeting = hr < 12 ? "Good Morning" : hr < 17 ? "Good Afternoon" : hr < 21 ? "Good Evening" : "Good Night";
              const firstName = (userData?.name || user?.displayName || "").split(" ")[0] || "";
              return (
                <div className="welcome">
                  <SaraswatiLogo size={80} animate={true} state="idle" />
                  <h2 style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>
                    {greeting}{firstName ? `, ${firstName}` : ""}
                  </h2>
                  <div className="wsub">Kuch bhi puchho — main hoon na!</div>
                </div>
              );
            })()}

            {msgs.map((m, idx) => (
              <div key={m.id} className="mwrap">
                <div className={"mrow" + (m.role === "user" ? " user" : "")}>
                  {m.role === "ai" && <div className="aiav"><SaraswatiLogo size={18} animate={speakId === m.id} state={speakId === m.id ? "speaking" : "idle"} /></div>}
                  <div className="bwrap" style={{ position: "relative" }}>
                    {m.image && m.role === "user" && (
                      <img src={m.image} alt="sent" className="mimg" onClick={() => setViewerSrc(m.image)} />
                    )}
                    {m.files && m.files.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 5 }}>
                        {m.files.map((f, fi) => (
                          <div key={fi} style={{ background: "var(--sf2)", border: "1px solid var(--bd)", borderRadius: 8, padding: "4px 9px", fontSize: 11, color: "var(--mt)", display: "flex", alignItems: "center", gap: 4 }}>
                            <span>{f.error ? "⚠️" : "📎"}</span><span>{f.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={"bub " + m.role}>
                      {m.role === "ai" ? <AIText text={m.text} /> : <span>{m.text}</span>}
                      {m.image && m.role === "ai" && (
                        <img src={m.image} alt="gen" className="mimg gen" onClick={() => setViewerSrc(m.image)} onError={e => { e.target.src = ""; e.target.style.display = "none"; }} />
                      )}
                    </div>
                    <div className="acts">
                      {m.role === "ai" && (
                        <>
                          <button className={"abtn" + (speakId === m.id ? " on" : "")} onClick={() => toggleSpeak(m.id, m.text)} title="Speak">
                            {speakId === m.id ? <Ico.Stop s={13} /> : <Ico.Speak s={13} />}
                          </button>
                          <button className={"abtn" + (copied === m.id ? " on" : "")} onClick={() => copyMsg(m.text, m.id)} title="Copy">
                            {copied === m.id ? <Ico.Check s={13} /> : <Ico.Copy s={13} />}
                          </button>
                          <button className="abtn" onClick={() => regenerateMessage(m.id)} title="Regenerate">🔄</button>
                          <button className="abtn" onClick={() => deleteMessage(m.id)} title="Delete">🗑</button>
                        </>
                      )}
                      {m.role === "user" && (
                        <button className="abtn" onClick={() => deleteMessage(m.id)} title="Delete">🗑</button>
                      )}
                    </div>
                    <div className={"mtime" + (m.role === "user" ? " user" : "")}>{fmtTime(m.time || m.createdAt)}</div>
                  </div>
                </div>
              </div>
            ))}

            {(loading || searching) && (
              <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
                <div className="aiav"><SaraswatiLogo size={18} animate={true} state="thinking" /></div>
                <div className="tbub" style={{ alignItems: "center" }}>
                  <SaraswatiLogo size={16} animate={true} state="thinking" />
                  <span className="think-step">{loadingStep || "Thinking..."}</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="ibar" style={{ position: "relative" }}>
            <input ref={galleryRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleGallery} />
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.csv,.md,.json,.log,.xlsx,.xls,.pptx" multiple style={{ display: "none" }} onChange={handleFiles} />

            {/* + attach menu popup */}
            {showPlusMenu && (
              <div className="plusmenu">
                <button className="plusmenu-item" onClick={() => { setShowPlusMenu(false); galleryRef.current?.click(); }}>
                  🖼️ <span>Image / Photo</span>
                </button>
                <button className="plusmenu-item" onClick={() => { setShowPlusMenu(false); fileRef.current?.click(); }}>
                  📎 <span>File (PDF, DOCX…)</span>
                </button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 5 }}>
              {(imgPrev || attachments.length > 0) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 4 }}>
                  {imgPrev && (
                    <div className="imgprev">
                      <img src={imgPrev} alt="preview" />
                      <button className="imgprev-x" onClick={() => { setImgB64(null); setImgPrev(null); }}>✕</button>
                    </div>
                  )}
                  {attachments.map((a, i) => (
                    <div key={i} style={{ background: "var(--sf2)", border: "1px solid var(--bd)", borderRadius: 10, padding: "5px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 5, position: "relative" }}>
                      <span>{a.error ? "⚠️" : "📎"}</span>
                      <span style={{ color: "var(--tx)" }}>{a.name.slice(0, 18)}</span>
                      <button onClick={() => removeAttachment(i)} style={{ background: "#ef4444", border: "none", borderRadius: "50%", color: "#fff", cursor: "pointer", fontSize: 10, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>
                  ))}
                  {attachLoading && <div style={{ fontSize: 12, color: "var(--accent)", alignSelf: "center" }}>Reading file...</div>}
                </div>
              )}
              <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
                {/* Gemini-style + button */}
                <button
                  className="ibtn"
                  onClick={() => setShowPlusMenu(v => !v)}
                  title="Attach"
                  style={showPlusMenu ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <textarea
                  className="tinp"
                  placeholder={micActive ? "🎙️ Bol rahe ho..." : "Message..."}
                  value={micActive && micTranscript ? input + (input ? " " : "") + micTranscript : input}
                  onChange={e => { if (!micActive) { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px"; } }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (micActive) { micRef.current?.stop(); setMicActive(false); setMicTranscript(""); } sendMsg(); } }}
                  rows={1}
                  readOnly={micActive}
                  style={micActive ? { borderColor: "#ef4444" } : {}}
                />
                <button
                  className={"ibtn" + (micActive ? " rec" : "")}
                  onClick={toggleMic}
                  title={micActive ? "Stop" : "Voice"}
                  style={micActive ? { borderColor: "#ef4444", color: "#ef4444", background: "#ef444418" } : {}}
                >
                  <Ico.Mic on={micActive} />
                </button>
                <button className="sbtn" onClick={() => { if (micActive) { micRef.current?.stop(); setMicActive(false); setMicTranscript(""); } sendMsg(); }} disabled={loading || (!input.trim() && !imgB64 && !imgPrev && !attachments.length && !micTranscript)}>
                  {loading ? <SaraswatiLogo size={18} animate={true} state="thinking" /> : "➤"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
