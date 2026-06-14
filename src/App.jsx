import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider
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
// Vision model (latest non-deprecated)
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const CHAT_MODEL   = "llama-3.3-70b-versatile";
// Skip trivial openers when generating chat title
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
  // Don't waste API call on trivial openers
  if (TRIVIAL.test(msg.trim())) return null;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ }, body: JSON.stringify({ model: CHAT_MODEL, messages: [{ role: "system", content: "Generate a 3-5 word descriptive chat title. Return ONLY the title — no quotes, no punctuation at end." }, { role: "user", content: msg }], max_tokens: 15 }) });
    const d = await r.json();
    const t = d.choices?.[0]?.message?.content?.trim();
    return (t && t.length > 2) ? t : null;
  } catch { return null; }
}

async function callAI(messages, imageB64, tone) {
  const last = messages[messages.length - 1];
  if (last?.role === "user" && isOwnerQ(last.text)) return "I was created by **Kunal Saraswat**! 😊";
  let ctx = "";
  if (last?.role === "user" && needsSearch(last.text)) { const r = await webSearch(last.text); if (r) ctx = "\n\nLatest Info:\n" + r; }
  const tNote = tone === "female" ? "Respond warmly like a helpful sister/friend." : tone === "male" ? "Respond like a helpful brother/friend." : "Be warm and friendly.";
  const sys = `You are Saraswati AI — India's best AI assistant, created by Kunal Saraswat.
Never mention Groq, Meta, Llama, OpenAI or any model name.
Reply in the EXACT language the user writes (Hindi→Hindi, English→English, Hinglish→Hinglish).
${tNote}
Be warm, emotional, helpful — like a best friend.
For coding: complete working copy-paste ready code always.
For education: clear explanations with examples (class 1 to UPSC).
For farming: expert advice on crops, mandi rates, government schemes.
For images: carefully read ALL visible text, describe objects, colors, and context in detail.${ctx}`;

  if (imageB64) {
    // Use latest vision model — separate API call with image content
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

  const apiMsgs = [...messages.slice(0, -1).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })), { role: "user", content: last.text }];
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ }, body: JSON.stringify({ model: CHAT_MODEL, messages: [{ role: "system", content: sys }, ...apiMsgs], max_tokens: 2048 }) });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "No response.";
}

function speakText(text, tone, speed, onDone) {
  window.speechSynthesis.cancel();
  const clean = text.replace(/```[\s\S]*?```/g, "code block").replace(/\*\*/g, "").replace(/`/g, "").replace(/#+\s/g, "").replace(/[^\x00-\x7F\u0900-\u097F .,!?]/g, "").slice(0, 600);
  const go = () => {
    const vs = window.speechSynthesis.getVoices();
    let v = null;
    if (tone === "female") { v = vs.find(x => /female|woman|girl|zira|heera|priya|aditi/i.test(x.name) && x.lang.startsWith("hi")) || vs.find(x => x.lang === "hi-IN") || vs.find(x => /female|woman/i.test(x.name)) || vs[0]; }
    else { v = vs.find(x => /ravi|hemant|prabhat|male/i.test(x.name) && !/female|woman/i.test(x.name) && x.lang.startsWith("hi")) || vs.find(x => x.lang === "hi-IN") || vs[0]; }
    const u = new SpeechSynthesisUtterance(clean);
    if (v) u.voice = v;
    u.lang = "hi-IN"; u.rate = speed || 0.9; u.pitch = tone === "female" ? 1.3 : 0.82; u.volume = 1;
    u.onend = onDone || null; u.onerror = onDone || null;
    window.speechSynthesis.speak(u);
  };
  if (!window.speechSynthesis.getVoices().length) { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; go(); }; } else go();
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

/* PWA */
.pwa{position:fixed;bottom:70px;left:10px;right:10px;background:${dark?"#1a1a1a":"#fff"};border:1.5px solid var(--accent);border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:10px;z-index:150;box-shadow:0 8px 28px #0009;animation:fadeUp .3s ease;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
.pwa-btn{background:var(--accent);border:none;border-radius:10px;color:#fff;cursor:pointer;font-size:12px;font-weight:700;padding:7px 13px;font-family:'Inter',sans-serif;}
.pwa-x{background:none;border:none;color:${v.mt};cursor:pointer;font-size:17px;padding:2px 6px;}

/* SIDEBAR */
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

/* AUTH */
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

/* HEADER */
.hdr{display:flex;align-items:center;gap:10px;padding:11px 14px;background:${v.bg};border-bottom:1px solid ${v.bd};flex-shrink:0;position:relative;z-index:10;}
.hdr-name{font-size:17px;font-weight:800;flex:1;letter-spacing:-.3px;}
.dots{background:none;border:none;color:${v.tx};cursor:pointer;padding:5px;border-radius:10px;line-height:1;display:flex;align-items:center;justify-content:center;}
.nbtn{background:${v.sf2};border:1px solid ${v.bd};border-radius:10px;color:${v.tx};cursor:pointer;font-size:13px;font-weight:600;padding:6px 12px;}

/* CHAT */
.chat{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;}
.chat::-webkit-scrollbar{width:0;}
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:40px 20px;}
.wlotus{font-size:96px;cursor:pointer;line-height:1;display:block;animation:wFloat 4s ease-in-out infinite;}
@keyframes wFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
.welcome h2{font-size:26px;font-weight:800;letter-spacing:-.5px;}
.wsub{font-size:13px;color:${v.mt};max-width:220px;line-height:1.7;}

/* MESSAGES */
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

/* IMAGE FULLSCREEN VIEWER */
.imgviewer{position:fixed;inset:0;background:#000e;z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease;}
.imgviewer img{max-width:100%;max-height:90dvh;border-radius:12px;object-fit:contain;}
.imgviewer-x{position:absolute;top:18px;right:18px;background:#fff2;border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:20px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);}

/* PREMIUM SIDEBAR CARD */
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

/* FLOATING FAB */
@keyframes fabPop{0%,100%{box-shadow:0 6px 24px ${a.glow};}50%{box-shadow:0 6px 32px ${a.glow},0 0 0 8px ${a.glow.replace("40","15")};}}
.fab{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--grad);border:none;border-radius:50px;color:#fff;cursor:pointer;display:flex;align-items:center;gap:8px;padding:14px 26px;font-size:14px;font-weight:700;font-family:'Inter',sans-serif;z-index:40;animation:fabPop 3s ease-in-out infinite;transition:transform .2s;}
.fab:hover{transform:translateX(-50%) scale(1.05);}
.fab:active{transform:translateX(-50%) scale(.97);}

/* HISTORY card actions */
.hactions{display:flex;gap:4px;flex-shrink:0;}
.hact{background:none;border:none;color:${v.mt};cursor:pointer;padding:5px 6px;border-radius:8px;font-size:15px;line-height:1;}
.hact:hover{color:var(--accent);background:${v.sf2};}
.hact.del:hover{color:#ef4444;}

/* INPUT BAR */
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

/* PAGES */
.page{flex:1;overflow-y:auto;display:flex;flex-direction:column;}
.page::-webkit-scrollbar{width:0;}
.page-inner{padding:14px 14px 30px;flex:1;}
.ptitle{font-size:20px;font-weight:800;margin-bottom:16px;letter-spacing:-.4px;}

/* SETTINGS */
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

/* PROFILE */
.pav{position:relative;display:inline-block;}
.pavimg{width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid var(--accent);}
.pavph{width:64px;height:64px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;}
.paved{position:absolute;bottom:0;right:0;background:var(--accent);border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;}

/* HISTORY */
.hcard{background:${v.sf};border:1px solid ${v.bd};border-radius:14px;padding:13px 15px;display:flex;align-items:center;gap:11px;cursor:pointer;transition:border-color .2s;margin-bottom:6px;}
.hcard:hover{border-color:var(--accent);}
.hi{flex:1;overflow:hidden;}
.ht{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hm{font-size:11px;color:${v.mt};margin-top:2px;}
.dbtn{background:none;border:none;color:${v.mt};cursor:pointer;font-size:16px;padding:5px 7px;border-radius:8px;}
.dbtn:hover{color:#ef4444;}

/* ADMIN */
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

/* MODAL */
.mbg{position:fixed;inset:0;background:#000c;z-index:200;display:flex;align-items:flex-end;padding:14px;}
.modal{background:${v.sf};border-radius:24px 24px 16px 16px;padding:26px 22px;width:100%;max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:13px;max-height:88vh;overflow-y:auto;}
.modal h3{font-size:20px;font-weight:700;text-align:center;}
.modal p{font-size:13px;color:${v.mt};text-align:center;line-height:1.6;}
.mi{font-size:50px;text-align:center;}
.pbox{background:${v.sf2};border:1px solid ${v.bd};border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:9px;}
.pnum{font-size:22px;font-weight:800;color:var(--accent);text-align:center;letter-spacing:2px;}
.pstep{font-size:13px;color:${v.tx};display:flex;gap:7px;}
.ld{text-align:center;color:${v.mt};padding:20px;font-size:14px;}

/* VOICE PAGE */
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

/* ADMIN CHAT */
.achat{max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:7px;background:${v.sf2};border-radius:12px;}

/* PREMIUM */
.pc{background:var(--grad);border-radius:18px;padding:18px;margin-bottom:6px;cursor:pointer;}
.pc h3{font-size:17px;font-weight:800;color:#fff;}
.pc p{font-size:12px;color:#ffffffaa;margin-top:3px;}
.pf{font-size:13px;color:#fff;display:flex;align-items:center;gap:7px;margin-top:5px;}
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
  const [showLimit, setShowLimit] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [payDone, setPayDone] = useState(false);
  const [copied, setCopied] = useState(null);
  const [speakId, setSpeakId] = useState(null);
  // Mic state: "idle" | "active" — no permission prompts after first grant
  const [micActive, setMicActive] = useState(false);
  const [micPerm, setMicPerm] = useState("unknown"); // unknown | granted | denied
  const [imgB64, setImgB64] = useState(null);
  const [imgPrev, setImgPrev] = useState(null);
  const [hists, setHists] = useState([]);
  const [histLoad, setHistLoad] = useState(false);
  const [hSearch, setHSearch] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  // Image fullscreen viewer
  const [viewerSrc, setViewerSrc] = useState(null);
  // Projects
  const [projects, setProjects] = useState([]);
  const [projLoad, setProjLoad] = useState(false);
  const [showNewProj, setShowNewProj] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [renamingProjId, setRenamingProjId] = useState(null);
  const [renameProjVal, setRenameProjVal] = useState("");
  // Upgrade plan selection
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
  // Voice
  const [vs, setVs] = useState("idle");
  const [vLast, setVLast] = useState("");
  const [vTone, setVTone] = useState("female");
  // Change password
  const [showChangePw, setShowChangePw] = useState(false);
  const [cpForm, setCpForm] = useState({ current: "", newP: "", confirm: "" });
  const [cpErr, setCpErr] = useState(""); const [cpOk, setCpOk] = useState(""); const [cpLoad, setCpLoad] = useState(false);

  const bottomRef = useRef(null);
  const galleryRef = useRef(null);
  const pPhotoRef = useRef(null);
  const micRef = useRef(null);
  const voiceRef = useRef(null);

  // ── Mic permission check (one-time, no repeated prompts) ─────
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
        }
      } else { setUser(null); setUserData(null); }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  useEffect(() => {
    if (user && page === "history") loadHists();
    if (user && page === "admin") loadAdmin();
    if (user && page === "projects") loadProjects();
    if (page !== "voice") endVoice();
    window.speechSynthesis?.cancel();
    setSpeakId(null); setShowRx(null);
  }, [page]);

  async function loadHists() {
    setHistLoad(true);
    try {
      const q = query(collection(db, "chats"), where("userId", "==", user.uid), orderBy("updatedAt", "desc"));
      const snap = await getDocs(q);
      setHists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  // ── AUTH ────────────────────────────────────────────────────
  async function handleAuth() {
    setFerr(""); setFok("");
    // Forgot password = direct password reset via new password fields
    if (forgot) {
      if (!form.newPass || !form.confirmPass) { setFerr("Please fill all fields!"); return; }
      if (form.newPass.length < 8) { setFerr("Password must be 8+ characters!"); return; }
      if (form.newPass !== form.confirmPass) { setFerr("Passwords do not match!"); return; }
      if (!form.email) { setFerr("Please enter your email!"); return; }
      setFload(true);
      try {
        // Send reset link as fallback since we can't update password without being logged in
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
        if (d.exists()) { const data = d.data(); setUserData(data); if (data.theme) setThemeKey(data.theme); if (data.accent) setAccentKey(data.accent); if (data.fontSize) setFontSize(data.fontSize); }
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

  // ── Change Password (in-app, real backend) ──────────────────
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

  function handlePPhoto(e) {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = "";
    const r = new FileReader();
    r.onload = ev => setPPhoto(ev.target.result);
    r.readAsDataURL(file);
  }

  // ── Mic — dev mode: no popup, silent fail ──────────────────
  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Use Chrome or Edge for voice input."); return; }
    if (micActive) { micRef.current?.stop(); setMicActive(false); return; }
    const r = new SR();
    r.lang = "hi-IN"; r.continuous = false; r.interimResults = false;
    r.onstart = () => setMicActive(true);
    r.onresult = e => { const t = e.results[0][0].transcript; if (t) setInput(p => p ? p + " " + t : t); };
    r.onerror = () => setMicActive(false);
    r.onend = () => setMicActive(false);
    micRef.current = r;
    try { r.start(); } catch { setMicActive(false); }
  }

  function toggleSpeak(id, text) {
    if (speakId === id) { window.speechSynthesis?.cancel(); setSpeakId(null); return; }
    setSpeakId(id);
    speakText(text, sessionTone || "female", 0.9, () => setSpeakId(null));
  }

  function copyMsg(text, id) {
    navigator.clipboard?.writeText(text).catch(() => { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); });
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  }

  function shareWA(text) { window.open("https://wa.me/?text=" + encodeURIComponent("Saraswati AI:\n\n" + text.slice(0, 500)), "_blank"); }

  function exportChat() {
    if (!msgs.length) { alert("No messages to export."); return; }
    const txt = msgs.map(m => (m.role === "user" ? "You" : "Saraswati AI") + ":\n" + m.text).join("\n\n---\n\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" })); a.download = "saraswati-chat.txt"; a.click();
  }

  function endVoice() {
    voiceActiveRef.current = false;
    voiceRef.current?.stop?.();
    voiceRef.current?.abort?.();
    window.speechSynthesis?.cancel();
    setVs("idle");
  }

  // ── Voice Call — continuous conversation loop ───────────────
  // voiceActiveRef tracks if call is still ongoing (not ended by user)
  const voiceActiveRef = useRef(false);

  function startListening(currentMsgs, currentTone, currentSid, currentUserData) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !voiceActiveRef.current) return;

    const r = new SR();
    r.lang = "hi-IN"; r.continuous = false; r.interimResults = false;

    r.onresult = async e => {
      const transcript = e.results[0][0].transcript;
      if (!transcript.trim()) {
        // Nothing heard — listen again
        setTimeout(() => startListening(currentMsgs, currentTone, currentSid, currentUserData), 300);
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

      try {
        const aiText = await callAI(newMsgs, null, tone);
        const tid = "v_" + Date.now();
        const updatedMsgs = [...newMsgs, { id: tid, role: "ai", text: aiText, time: new Date() }];
        setMsgs(updatedMsgs);
        setVLast(aiText);
        await addDoc(collection(db, "messages"), {
          sessionId: currentSid, userId: user.uid, role: "ai", text: aiText, createdAt: serverTimestamp()
        });

        setVs("speak");
        // After AI speaks → auto listen again for next user input
        speakText(aiText, tone, 0.9, () => {
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
    };

    r.onerror = () => {
      // On error, retry listening after short delay if call still active
      if (voiceActiveRef.current) {
        setTimeout(() => { setVs("listen"); startListening(currentMsgs, currentTone, currentSid, currentUserData); }, 800);
      } else {
        setVs("idle");
      }
    };

    r.onend = () => {
      // If ended without result and call still active, listen again
      if (voiceActiveRef.current) {
        setVs("listen");
      }
    };

    voiceRef.current = r;
    try { r.start(); } catch { setVs("idle"); }
  }

  async function handleOrb() {
    // Tap while listening → stop listening
    if (vs === "listen") {
      voiceActiveRef.current = false;
      voiceRef.current?.stop?.();
      setVs("idle");
      return;
    }
    // Tap while speaking → stop speaking
    if (vs === "speak") {
      voiceActiveRef.current = false;
      window.speechSynthesis?.cancel();
      setVs("idle");
      return;
    }
    if (vs === "think") return;

    // Start voice call
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Use Chrome or Edge for Voice Call."); return; }

    voiceActiveRef.current = true;
    setVs("listen");
    startListening(msgs, sessionTone || "female", sid, userData);
  }

  // ── Send message ────────────────────────────────────────────
  async function sendMsg(text) {
    const txt = text || input.trim();
    if ((!txt && !imgB64) || loading) return;
    const ud = userData;
    if (!ud?.premium && (ud?.usageCount || 0) >= FREE_LIMIT) { setShowLimit(true); return; }
    const msgText = txt || "What is in this image?";
    setInput("");
    const b64 = imgB64, prev = imgPrev;
    setImgB64(null); setImgPrev(null);
    playSendSound();
    const det = detectTone(msgText);
    if (det) setSessionTone(det);
    const tone = det || sessionTone || "female";
    const uRef = await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "user", text: msgText, image: prev || null, createdAt: serverTimestamp() });
    const newMsgs = [...msgs, { id: uRef.id, role: "user", text: msgText, image: prev, time: new Date() }];
    setMsgs(newMsgs);
    const isFirst = msgs.length === 0;
    let titleUpdate = {};
    if (isFirst) {
      const t = await genTitle(msgText);
      titleUpdate = { title: t || msgText.slice(0, 38), createdAt: serverTimestamp() };
    }
    await setDoc(doc(db, "chats", sid), { userId: user.uid, ...titleUpdate, updatedAt: serverTimestamp() }, { merge: true });
    const nc = (ud?.usageCount || 0) + 1;
    await setDoc(doc(db, "users", user.uid), { usageCount: nc }, { merge: true });
    setUserData(p => ({ ...p, usageCount: nc }));
    if (!b64 && needsImageGen(msgText)) {
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
    if (needsSearch(msgText)) setSearching(true);
    setLoading(true);
    try {
      const aiText = await callAI(newMsgs, b64, tone);
      setSearching(false);
      const tid = "ai_" + Date.now();
      setLoading(false);
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
    } catch (e) { setSearching(false); setLoading(false); setMsgs(p => [...p, { id: Date.now(), role: "ai", text: "❌ Error: " + e.message, time: new Date() }]); }
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
  const filtHists = hists.filter(h => (h.title || "").toLowerCase().includes(hSearch.toLowerCase()));
  const filtAdminU = adminUsers.filter(u => (u.name || "").toLowerCase().includes(aSearch.toLowerCase()) || (u.email || "").toLowerCase().includes(aSearch.toLowerCase()));
  const adminGraph = Array.from({ length: 7 }, (_, i) => {
    const val = adminUsers.filter(u => { if (!u.createdAt?.seconds) return false; return Math.floor((Date.now() - u.createdAt.seconds * 1000) / 86400000) === (6 - i); }).length;
    return { l: ["M", "T", "W", "T", "F", "S", "S"][i], v: val };
  });
  const maxG = Math.max(...adminGraph.map(d => d.v), 1);
  const vOrbIcon = vs === "listen" ? "🎙️" : vs === "think" ? "🤔" : vs === "speak" ? "🔊" : "🪷";
  const vStatusTxt = { idle: "Tap to Talk", listen: "Listening... (tap to stop)", think: "Thinking...", speak: "Speaking..." }[vs];
  const accentColor = ACCENTS[accentKey]?.primary || "#f97316";

  // ── Loading screen (auth check only) ────────────────────────
  if (!authReady) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", background: "#060606" }}>
      <style>{buildStyles("dark", "orange", 14)}</style>
      <span style={{ fontSize: 60 }}>🪷</span>
    </div>
  );

  // ── Auth screen ──────────────────────────────────────────────
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
              <div className="iw">
                <div className="ilbl">Email</div>
                <input className="inp" type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="iw">
                <div className="ilbl">New Password</div>
                <input className="inp" type="password" placeholder="Min 8 characters" value={form.newPass} onChange={e => setForm(f => ({ ...f, newPass: e.target.value }))} />
              </div>
              <div className="iw">
                <div className="ilbl">Confirm Password</div>
                <input className="inp" type="password" placeholder="Re-enter password" value={form.confirmPass} onChange={e => setForm(f => ({ ...f, confirmPass: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAuth()} />
              </div>
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

  // ── MAIN APP ─────────────────────────────────────────────────
  return (
    <div className="app" onClick={() => { showRx && setShowRx(null); }}>
      <style>{buildStyles(themeKey, accentKey, fontSize)}</style>

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
              <span className="sb-logo">🪷</span>
              <span className="sb-title">Saraswati AI</span>
              <button className="sb-close" onClick={() => setShowSb(false)}>✕</button>
            </div>
            {/* User info */}
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
              <div className={"sb-item" + (page === "chat" ? " active" : "")} onClick={() => { setPage("chat"); setShowSb(false); }}>
                <Ico.Chat /><span>Chat</span>
              </div>
              <div className={"sb-item" + (page === "voice" ? " active" : "")} onClick={() => { setPage("voice"); setShowSb(false); }}>
                <Ico.Voice /><span>Voice Call</span>
              </div>
              <div className={"sb-item" + (page === "projects" ? " active" : "")} onClick={() => { setPage("projects"); setShowSb(false); }}>
                <Ico.Project /><span>Projects</span>
              </div>
              <div className={"sb-item" + (page === "settings" ? " active" : "")} onClick={() => { setPage("settings"); setShowSb(false); }}>
                <Ico.Settings /><span>Settings</span>
              </div>
              {isAdmin && (
                <div className={"sb-item" + (page === "admin" ? " active" : "")} onClick={() => { setPage("admin"); setShowSb(false); }}>
                  <span style={{ fontSize: 20, width: 20, textAlign: "center" }}>🛡️</span><span>Admin</span>
                </div>
              )}
              {/* Recent Chats */}
              {hists.length > 0 && (
                <>
                  <div className="sb-section">Recent</div>
                  <div className="sb-recent">
                    {hists.slice(0, 10).map(h => (
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
                <span style={{ fontSize: 20 }}>🚪</span><span>Logout</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* IMAGE FULLSCREEN VIEWER */}
      {viewerSrc && (
        <div className="imgviewer" onClick={() => setViewerSrc(null)}>
          <img src={viewerSrc} alt="full" onClick={e => e.stopPropagation()} />
          <button className="imgviewer-x" onClick={() => setViewerSrc(null)}>✕</button>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="hdr">
        <button className="dots" onClick={() => { setShowSb(true); if (user) loadHists(); }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>
        <span style={{ fontSize: 20 }}>🪷</span>
        <div className="hdr-name">Saraswati AI</div>
        {page === "chat" && <button className="nbtn" onClick={newChat}>+ New</button>}
        {page === "voice" && <button className="nbtn" style={{ background: "#ef444418", borderColor: "#ef4444", color: "#ef4444" }} onClick={() => { endVoice(); setPage("chat"); }}>End Call</button>}
      </div>

      {/* ── CHAT PAGE ── */}
      {page === "chat" && (
        <>
          <div className="chat">
            {msgs.length === 0 && (
              <div className="welcome">
                <span className="wlotus" onClick={() => setPage("voice")}>🪷</span>
                <h2>Saraswati AI</h2>
                <p className="wsub">Your AI assistant — ask anything</p>
              </div>
            )}
            {msgs.map(m => (
              <div key={m.id} className="mwrap">
                <div className={"mrow " + m.role} style={{ position: "relative" }}>
                  {m.role === "ai" && <div className="aiav">🪷</div>}
                  <div className="bwrap" style={m.role === "user" ? { alignItems: "flex-end" } : { alignItems: "flex-start" }}>
                    {showRx === m.id && (
                      <div className="rbar" onClick={e => e.stopPropagation()}>
                        {REACTIONS.map(em => <button key={em} className="rbtn" onClick={() => { setReactions(p => ({ ...p, [m.id]: em })); setShowRx(null); }}>{em}</button>)}
                      </div>
                    )}
                    <div className={"bub " + m.role} onDoubleClick={() => setShowRx(p => p === m.id ? null : m.id)}>
                      {m.image && (
                        m.role === "ai"
                          ? <img src={m.image} className="mimg gen" alt="generated" onClick={() => setViewerSrc(m.image)} />
                          : <img src={m.image} className="mimg" alt="uploaded" onClick={() => setViewerSrc(m.image)} />
                      )}
                      {m.role === "ai" ? <AIText text={m.text} /> : m.text}
                    </div>
                    {reactions[m.id] && <div className="react">{reactions[m.id]}</div>}
                    {m.text && (
                      <div className="acts" style={m.role === "user" ? { justifyContent: "flex-end" } : {}}>
                        {m.role === "ai" && <button className={"abtn" + (speakId === m.id ? " on" : "")} onClick={() => toggleSpeak(m.id, m.text)}>{speakId === m.id ? <Ico.Stop s={13} /> : <Ico.Speak s={13} />}</button>}
                        <button className={"abtn" + (copied === m.id ? " on" : "")} onClick={() => copyMsg(m.text, m.id)}>{copied === m.id ? <Ico.Check s={13} /> : <Ico.Copy s={13} />}</button>
                        {m.role === "ai" && <button className="abtn" onClick={() => shareWA(m.text)}><Ico.Share s={13} /></button>}
                        <button className="abtn" onClick={() => setShowRx(p => p === m.id ? null : m.id)} style={{ fontSize: 11 }}>😊</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className={"mtime " + m.role}>{fmtTime(m.time)}</div>
              </div>
            ))}
            {searching && <div className="mrow"><div className="aiav">🪷</div><div className="sind">🌐 Searching...</div></div>}
            {loading && !searching && <div className="mrow"><div className="aiav">🪷</div><div className="tbub"><div className="dot" /><div className="dot" /><div className="dot" /></div></div>}
            <div ref={bottomRef} />
          </div>
          <div className="ibar">
            <input type="file" ref={galleryRef} accept="image/*" style={{ display: "none" }} onChange={handleGallery} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              {imgPrev && (
                <div className="imgprev">
                  <img src={imgPrev} alt="p" onClick={() => setViewerSrc(imgPrev)} />
                  <button className="imgprev-x" onClick={() => { setImgB64(null); setImgPrev(null); }}>✕</button>
                </div>
              )}
              <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
                <button className="ibtn" onClick={() => galleryRef.current?.click()}><Ico.Img /></button>
                <button className={"ibtn" + (micActive ? " rec" : "")} onClick={toggleMic}><Ico.Mic on={micActive} /></button>
                <textarea
                  className="tinp"
                  placeholder={micActive ? "Listening..." : "Ask anything..."}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMsg())}
                  rows={1}
                  style={micActive ? { borderColor: "#ef4444" } : {}}
                />
                <button className="sbtn" onClick={() => sendMsg()} disabled={(!input.trim() && !imgB64) || loading}>➤</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── VOICE PAGE ── */}
      {page === "voice" && (
        <div className="vpage">
          <div className="vbody">
            <div className="vccard">
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.3px" }}>Saraswati AI</div>
                <div style={{ fontSize: 12, color: "var(--mt)", marginTop: 2 }}>Voice Assistant</div>
              </div>
              <div className="vorb-wrap">
                {(vs === "listen" || vs === "speak") && <><div className="vring vr1" /><div className="vring vr2" /></>}
                <div className={`vorb${vs === "listen" ? " listen" : vs === "speak" ? " speak" : vs === "think" ? " think" : ""}`} onClick={handleOrb}>
                  {vOrbIcon}
                </div>
              </div>
              <div className="vstatus">{vStatusTxt}</div>
              {vs === "speak" && (
                <div className="vwave">
                  {[0, 1, 2, 3, 4].map(i => <div key={i} className="wb" style={{ animationDelay: `${i * 0.1}s` }} />)}
                </div>
              )}
              {vs === "idle" && <div className="vsub">Hindi & English supported</div>}
              {vLast && (
                <div className="vlast">
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>Last reply:</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>{vLast.slice(0, 160)}{vLast.length > 160 ? "..." : ""}</div>
                </div>
              )}
              <button className="vendbtn" onClick={() => { endVoice(); setPage("chat"); }}>End Call</button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {page === "history" && (
        <div className="page">
          <div className="page-inner">
            <div className="ptitle">Chat History</div>
            <div className="sbar"><Ico.Search /><input placeholder="Search chats..." value={hSearch} onChange={e => setHSearch(e.target.value)} /></div>
            {histLoad ? <div className="ld">Loading...</div>
              : filtHists.length === 0
                ? <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--mt)" }}><div style={{ fontSize: 52, marginBottom: 12 }}>📭</div><div style={{ fontWeight: 600 }}>No chats yet</div></div>
                : filtHists.map(h => (
                  <div key={h.id} className="hcard" onClick={() => renamingId !== h.id && loadSession(h)}>
                    <div style={{ fontSize: 18 }}>💬</div>
                    <div className="hi">
                      {renamingId === h.id
                        ? <input
                            autoFocus
                            style={{ background: "transparent", border: "none", borderBottom: "1.5px solid var(--accent)", color: "inherit", fontFamily: "Inter,sans-serif", fontSize: 14, fontWeight: 600, outline: "none", width: "100%", padding: "1px 0" }}
                            value={renameVal}
                            onChange={e => setRenameVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") { renameSession(h.id, renameVal); } if (e.key === "Escape") setRenamingId(null); }}
                            onBlur={() => renameSession(h.id, renameVal)}
                            onClick={e => e.stopPropagation()}
                          />
                        : <div className="ht">{h.title || "Chat"}</div>
                      }
                      <div className="hm">{fmtDate(h.updatedAt)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button className="dbtn" title="Rename" onClick={() => { setRenamingId(h.id); setRenameVal(h.title || ""); }}>✏️</button>
                      <button className="dbtn" title="Delete" onClick={e => delSession(h.id, e)}>🗑️</button>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      )}

      {/* ── SETTINGS ── */}
      {page === "settings" && (
        <div className="page">
          <div className="page-inner">
            <div className="ptitle">Settings</div>

            {/* ACCOUNT */}
            <div className="sec">Account</div>
            <div className="scard">
              <div className="srow" style={{ cursor: "pointer" }} onClick={() => setShowProfile(true)}>
                <div className="pav">
                  {pPhotoUrl ? <img src={pPhotoUrl} className="pavimg" alt="" style={{ width: 44, height: 44 }} /> : <div className="pavph" style={{ width: 44, height: 44, fontSize: 18 }}>{displayName[0]?.toUpperCase()}</div>}
                  <div className="paved" style={{ width: 18, height: 18, fontSize: 9 }}>📷</div>
                </div>
                <div className="stxt"><div className="slbl">{displayName}</div><div className="sdesc">{user.email}</div></div>
                <div style={{ display: "flex", gap: 5 }}>
                  {userData?.premium && <div className="badge">PRO</div>}
                  {isAdmin && <div className="badge">ADMIN</div>}
                </div>
              </div>
            </div>

            {/* SUBSCRIPTION */}
            <div className="sec">Subscription</div>
            <div className="scard">
              <div className="srow">
                <div className="sicon">{userData?.premium ? "⭐" : "🆓"}</div>
                <div className="stxt">
                  <div className="slbl">{userData?.premium ? "Premium Plan" : "Free Plan"}</div>
                  <div className="sdesc">{userData?.premium ? "Unlimited access" : `${chatsLeft} messages remaining`}</div>
                </div>
                {!userData?.premium && <button className="nbtn" onClick={() => setShowUpgrade(true)}>Upgrade</button>}
              </div>
            </div>
            {!userData?.premium && (
              <div className="pc" onClick={() => setShowUpgrade(true)}>
                <h3>⭐ Upgrade to Premium</h3>
                <p>₹99/month — Unlimited access</p>
                <div className="pf">✅ Unlimited Chat & Voice</div>
                <div className="pf">✅ Web Search + Image AI</div>
              </div>
            )}

            {/* APPEARANCE */}
            <div className="sec">Appearance</div>
            <div className="scard">
              <ExpandRow icon="🎨" label="Theme" desc={{ dark: "Black", light: "White", blue: "Blue", gold: "Gold" }[themeKey]}>
                <div className="opt-row">
                  {[{ k: "dark", l: "🌙 Black" }, { k: "light", l: "☀️ White" }, { k: "blue", l: "🔷 Blue" }, { k: "gold", l: "✨ Gold" }].map(t => (
                    <button key={t.k} className={"opt-pill" + (themeKey === t.k ? " sel" : "")} onClick={() => savePref("theme", t.k)}>{t.l}</button>
                  ))}
                </div>
              </ExpandRow>
              <ExpandRow icon="🎨" label="Accent Color" desc={{ orange: "Orange", blue: "Blue", gold: "Gold" }[accentKey]}>
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 8 }}>
                  {[{ k: "orange", c: "#f97316" }, { k: "blue", c: "#3b82f6" }, { k: "gold", c: "#f59e0b" }].map(ac => (
                    <div key={ac.k} className={"cdot" + (accentKey === ac.k ? " sel" : "")} style={{ background: ac.c }} onClick={() => savePref("accent", ac.k)} />
                  ))}
                </div>
                <div className="opt-row">
                  {[{ k: "orange", l: "Orange" }, { k: "blue", l: "Blue" }, { k: "gold", l: "Gold" }].map(ac => (
                    <button key={ac.k} className={"opt-pill" + (accentKey === ac.k ? " sel" : "")} onClick={() => savePref("accent", ac.k)} style={{ fontSize: 11, padding: "5px 10px" }}>{ac.l}</button>
                  ))}
                </div>
              </ExpandRow>
              <ExpandRow icon="🔤" label="Font Size" desc={fontSize + "px"}>
                <div className="opt-row">
                  {[{ v: 12, l: "Small" }, { v: 14, l: "Medium" }, { v: 16, l: "Large" }].map(f => (
                    <button key={f.v} className={"opt-pill" + (fontSize === f.v ? " sel" : "")} onClick={() => savePref("fontSize", f.v)}>{f.l}</button>
                  ))}
                </div>
              </ExpandRow>
            </div>

            {/* GENERAL */}
            <div className="sec">General</div>
            <div className="scard">
              <div className="srow" style={{ cursor: "pointer" }} onClick={() => { if (window.confirm("Clear current chat?")) { setMsgs([]); setSid(Date.now().toString()); } }}>
                <div className="sicon">🗑️</div>
                <div className="stxt"><div className="slbl">Clear Chat</div><div className="sdesc">Remove current chat messages</div></div>
              </div>
              <div className="srow" style={{ cursor: "pointer" }} onClick={exportChat}>
                <div className="sicon">📄</div>
                <div className="stxt"><div className="slbl">Export Chat</div><div className="sdesc">Save as text file</div></div>
              </div>
            </div>

            {/* VOICE */}
            <div className="sec">Voice</div>
            <div className="scard">
              <div className="srow">
                <div className="sicon">🎙️</div>
                <div className="stxt">
                  <div className="slbl">Microphone</div>
                  <div className="sdesc">{micPerm === "granted" ? "Permission granted" : micPerm === "denied" ? "Blocked — enable in browser settings" : "Not yet requested"}</div>
                </div>
                <div style={{ fontSize: 11, color: micPerm === "granted" ? "#22c55e" : micPerm === "denied" ? "#ef4444" : "var(--mt)", fontWeight: 600 }}>
                  {micPerm === "granted" ? "✓ On" : micPerm === "denied" ? "✗ Off" : "—"}
                </div>
              </div>
            </div>

            {/* DATA */}
            <div className="sec">Data Controls</div>
            <div className="scard">
              <div className="srow" style={{ cursor: "pointer" }} onClick={() => setPage("history")}>
                <div className="sicon">📂</div>
                <div className="stxt"><div className="slbl">Chat History</div><div className="sdesc">View and manage your chats</div></div>
                <Ico.ChevRight />
              </div>
            </div>

            {/* SECURITY */}
            <div className="sec">Security</div>
            <div className="scard">
              <div className="srow" style={{ cursor: "pointer" }} onClick={() => { setShowChangePw(true); setCpErr(""); setCpOk(""); setCpForm({ current: "", newP: "", confirm: "" }); }}>
                <div className="sicon">🔐</div>
                <div className="stxt"><div className="slbl">Change Password</div><div className="sdesc">Update your account password</div></div>
                <Ico.ChevRight />
              </div>
            </div>

            {/* STORAGE */}
            <div className="sec">Storage</div>
            <div className="scard">
              <div className="srow">
                <div className="sicon">💾</div>
                <div className="stxt">
                  <div className="slbl">Chat Messages</div>
                  <div className="sdesc">{msgs.length} messages in current session</div>
                </div>
              </div>
            </div>

            {/* ABOUT */}
            <div className="sec">About</div>
            <div className="scard">
              <div className="srow">
                <div className="sicon">🪷</div>
                <div className="stxt"><div className="slbl">Saraswati AI</div><div className="sdesc">Version 4.0 · Made by Kunal Saraswat</div></div>
              </div>
            </div>

            {/* LOGOUT */}
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <div className="scard">
                <div className="srow" style={{ cursor: "pointer" }} onClick={() => signOut(auth)}>
                  <div className="sicon">🚪</div>
                  <div className="stxt"><div className="slbl" style={{ color: "#ef4444" }}>Logout</div><div className="sdesc">Sign out of your account</div></div>
                </div>
              </div>
            </div>
            <div style={{ height: 20 }} />
          </div>
        </div>
      )}

      {/* ── PROJECTS PAGE ── */}
      {page === "projects" && (
        <div className="page">
          <div className="page-inner">
            <div className="ptitle">Projects</div>
            {projLoad ? <div className="ld">Loading...</div>
              : projects.length === 0
                ? <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--mt)" }}>
                    <div style={{ fontSize: 52, marginBottom: 12 }}>📁</div>
                    <div style={{ fontWeight: 600 }}>No projects yet</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>Tap + to create your first project</div>
                  </div>
                : projects.map(pr => (
                  <div key={pr.id} className="hcard">
                    <div style={{ fontSize: 18 }}>📁</div>
                    <div className="hi">
                      {renamingProjId === pr.id
                        ? <input
                            autoFocus
                            style={{ background: "transparent", border: "none", borderBottom: "1.5px solid var(--accent)", color: "inherit", fontFamily: "Inter,sans-serif", fontSize: 14, fontWeight: 600, outline: "none", width: "100%", padding: "1px 0" }}
                            value={renameProjVal}
                            onChange={e => setRenameProjVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") renameProject(pr.id, renameProjVal); if (e.key === "Escape") setRenamingProjId(null); }}
                            onBlur={() => renameProject(pr.id, renameProjVal)}
                            onClick={e => e.stopPropagation()}
                          />
                        : <div className="ht">{pr.title}</div>
                      }
                      <div className="hm">{fmtDate(pr.createdAt)}</div>
                    </div>
                    <div className="hactions">
                      <button className="hact" onClick={() => { setRenamingProjId(pr.id); setRenameProjVal(pr.title); }}>✏️</button>
                      <button className="hact del" onClick={() => deleteProject(pr.id)}>🗑️</button>
                    </div>
                  </div>
                ))
            }
          </div>
          {/* Floating + button */}
          <button className="fab" onClick={() => setShowNewProj(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Project
          </button>
        </div>
      )}

      {/* ── ADMIN ── */}
      {page === "admin" && isAdmin && (
        <div className="page">
          <div className="page-inner">
            <div className="ptitle">🛡️ Admin Panel</div>
            <div className="sgrid" style={{ marginTop: 4 }}>
              <div className="sct"><div className="sv">{adminUsers.length}</div><div className="sl">Total Users</div></div>
              <div className="sct"><div className="sv">{adminUsers.filter(u => u.premium).length}</div><div className="sl">Premium</div></div>
              <div className="sct"><div className="sv">₹{adminUsers.filter(u => u.premium).length * 99}</div><div className="sl">Revenue</div></div>
              <div className="sct"><div className="sv">{adminUsers.reduce((s, u) => s + (u.usageCount || 0), 0)}</div><div className="sl">Total Chats</div></div>
            </div>
            <div className="scard" style={{ padding: 14, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>NEW SIGNUPS — LAST 7 DAYS</div>
              <div className="gbar">
                {adminGraph.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ fontSize: 8, color: "var(--accent)", marginBottom: 2 }}>{d.v > 0 ? d.v : ""}</div>
                    <div style={{ width: "100%", background: "var(--accent)", borderRadius: "3px 3px 0 0", height: Math.max(d.v === 0 ? 2 : (d.v / maxG) * 52, 2), opacity: d.v === 0 ? .2 : .85 }} />
                    <div style={{ fontSize: 9, color: "#6b7280", marginTop: 3 }}>{d.l}</div>
                  </div>
                ))
