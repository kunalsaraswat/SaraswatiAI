import { useState, useEffect, useRef } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, orderBy, getDocs, deleteDoc, serverTimestamp, updateDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── CONFIG ───────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAM-o-ZvEV2T1Efso1oiIC7__PFxh4YCxk",
  authDomain: "saraswatiai-51593.firebaseapp.com",
  projectId: "saraswatiai-51593",
  storageBucket: "saraswatiai-51593.firebasestorage.app",
  messagingSenderId: "352789553358",
  appId: "1:352789553358:web:ce3dcc024a98c96c82f09f"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || "";
const TAVILY_KEY = import.meta.env.VITE_TAVILY_API_KEY || "";
const ADMIN_EMAIL = "kunalsaraswat691@gmail.com";
const PHONEPAY = "8126630980";
const FREE_LIMIT = 49;
const REACTIONS = ["👍","❤️","😂","😮","🙏","🔥"];

// ── COMPRESS IMAGE ───────────────────────────────────────────────
function compressImage(dataUrl, maxW = 180, quality = 0.55) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = img.width * scale;
      c.height = img.height * scale;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

// ── SOUNDS ───────────────────────────────────────────────────────
function playTypingSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 820 + Math.random() * 360; o.type = "sine";
    g.gain.setValueAtTime(0.025, ctx.currentTime);
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
      g.gain.setValueAtTime(0.06, ctx.currentTime + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.1);
      o.start(ctx.currentTime + i * 0.05); o.stop(ctx.currentTime + i * 0.05 + 0.1);
    });
  } catch {}
}

// ── WEB SEARCH ───────────────────────────────────────────────────
async function webSearch(q) {
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_KEY, query: q, search_depth: "basic", max_results: 3 })
    });
    const d = await r.json();
    return d.results?.map(x => x.title + ": " + x.content).join("\n\n") || null;
  } catch { return null; }
}

// ── IMAGE GEN ────────────────────────────────────────────────────
function needsImageGen(text) {
  return ["image banao","photo banao","tasveer banao","picture banao","draw","generate image","chitra banao","sketch","wallpaper banao","logo banao","poster banao","image generate"].some(k => text.toLowerCase().includes(k));
}
function extractImagePrompt(text) {
  let p = text.toLowerCase();
  ["ek image banao","image banao","photo banao","tasveer banao","picture banao","generate image of","generate image","draw a","draw","sketch","wallpaper banao","logo banao","poster banao","ki","ka","of"].forEach(k => { p = p.split(k).join(" "); });
  return p.trim() || text;
}
function getImageUrl(prompt) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&seed=${Math.floor(Math.random() * 99999)}&nologo=true`;
}

// ── HELPERS ──────────────────────────────────────────────────────
function needsSearch(text) {
  return ["news","score","weather","mausam","price","rate","mandi","bhav","today","aaj","gold","sona","chandi","kisan","fasal","2025","2026","upsc"].some(k => text.toLowerCase().includes(k));
}
function isOwnerQ(text) {
  return ["kisne banaya","who made","who created","owner","creator","malik","kaun hai tera","tumhara malik","who built"].some(k => text.toLowerCase().includes(k));
}

// Auto-detect tone from message (no permanent gender setting)
function detectTone(text) {
  const t = text.toLowerCase();
  if (["behen","didi","sister","madam","mam"].some(w => t.includes(w))) return "female";
  if (["bhai","bhaiya","yaar","bro","dost","sir"].some(w => t.includes(w))) return "male";
  return null;
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function fmtDateTime(ts) {
  if (!ts) return "Never";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── SMART TITLE ───────────────────────────────────────────────────
async function generateTitle(msg) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ_KEY },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Create a short 3-5 word chat title. Only the title, no quotes or explanation." },
          { role: "user", content: msg }
        ],
        max_tokens: 15
      })
    });
    const d = await res.json();
    return d.choices?.[0]?.message?.content?.trim() || msg.slice(0, 35);
  } catch { return msg.slice(0, 35); }
}

// ── AI CALL ──────────────────────────────────────────────────────
async function callAI(messages, imageB64, toneHint) {
  const last = messages[messages.length - 1];
  if (last?.role === "user" && isOwnerQ(last.text)) return "I was created by **Kunal Saraswat**! 😊";

  let ctx = "";
  if (last?.role === "user" && needsSearch(last.text)) {
    const r = await webSearch(last.text);
    if (r) ctx = "\n\nLatest Info:\n" + r;
  }

  const toneNote = toneHint === "female"
    ? "The user seems to prefer a sisterly/friendly tone. Respond warmly like a helpful friend."
    : toneHint === "male"
    ? "The user seems to prefer a brotherly/friendly tone. Respond like a helpful friend."
    : "Be warm, friendly and helpful.";

  const sys = `You are Saraswati AI — India's smartest AI assistant, created by Kunal Saraswat.
RULES:
- Never mention Groq, Meta, OpenAI or any underlying model.
- Always reply in the EXACT language the user writes in (Hindi→Hindi, English→English, Hinglish→Hinglish).
- ${toneNote}
- Be warm, emotional, helpful — like a best friend.
- For coding: always give complete, working, copy-paste ready code.
- For education: explain clearly with examples. Help students from class 1 to UPSC.
- For farming: give expert advice on crops, mandi rates, government schemes.
- For general questions: give accurate, helpful answers.${ctx}`;

  const content = imageB64
    ? [{ type: "image_url", image_url: { url: "data:image/jpeg;base64," + imageB64 } }, { type: "text", text: last.text }]
    : last.text;

  const apiMsgs = [
    ...messages.slice(0, -1).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
    { role: "user", content }
  ];

  const model = imageB64 ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ_KEY },
    body: JSON.stringify({ model, messages: [{ role: "system", content: sys }, ...apiMsgs], max_tokens: 2048 })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "No response.";
}

// ── TTS ──────────────────────────────────────────────────────────
function speakText(text, toneGender, speed, onDone) {
  window.speechSynthesis.cancel();
  const clean = text
    .replace(/```[\s\S]*?```/g, "code block")
    .replace(/\*\*/g, "").replace(/`/g, "").replace(/#+\s/g, "")
    .replace(/[^\x00-\x7F\u0900-\u097F .,!?]/g, "")
    .slice(0, 600);

  const go = () => {
    const voices = window.speechSynthesis.getVoices();
    let voice = null;
    if (toneGender === "female") {
      voice = voices.find(v => /female|woman|girl|zira|heera|priya|aditi/i.test(v.name) && v.lang.startsWith("hi"))
        || voices.find(v => v.lang === "hi-IN")
        || voices.find(v => /female|woman|girl/i.test(v.name))
        || voices[0];
    } else {
      voice = voices.find(v => /ravi|hemant|prabhat|male/i.test(v.name) && !/female|woman/i.test(v.name) && v.lang.startsWith("hi"))
        || voices.find(v => v.lang === "hi-IN")
        || voices[0];
    }
    const u = new SpeechSynthesisUtterance(clean);
    if (voice) u.voice = voice;
    u.lang = "hi-IN"; u.rate = speed || 0.9;
    u.pitch = toneGender === "female" ? 1.3 : 0.82; u.volume = 1;
    u.onend = onDone || null; u.onerror = onDone || null;
    window.speechSynthesis.speak(u);
  };

  if (!window.speechSynthesis.getVoices().length) {
    window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; go(); };
  } else go();
}

// ── CODE BLOCK ────────────────────────────────────────────────────
function CodeBlock({ code, lang }) {
  const [cp, setCp] = useState(false);
  const [pv, setPv] = useState(false);
  const canPrev = ["html", "css", "js", "javascript", ""].includes((lang || "").toLowerCase());
  return (
    <div style={{ background: "#0d0d0d", border: "1px solid #333", borderRadius: 10, margin: "6px 0", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", background: "#161616", borderBottom: "1px solid #333" }}>
        <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{lang || "code"}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {canPrev && <button onClick={() => setPv(v => !v)} style={{ background: "none", border: "none", color: pv ? "#f97316" : "#6b7280", cursor: "pointer", fontSize: 11, padding: "2px 6px" }}>{pv ? "✕ Close" : "▶ Preview"}</button>}
          <button onClick={() => { navigator.clipboard?.writeText(code); setCp(true); setTimeout(() => setCp(false), 2000); }} style={{ background: "none", border: "none", color: cp ? "#22c55e" : "#6b7280", cursor: "pointer", fontSize: 11, padding: "2px 6px" }}>{cp ? "✓ Copied" : "Copy"}</button>
        </div>
      </div>
      <pre style={{ padding: "12px", margin: 0, overflowX: "auto", fontSize: 12, lineHeight: 1.6, color: "#e5e7eb", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{code}</pre>
      {pv && canPrev && (
        <div style={{ borderTop: "1px solid #333" }}>
          <div style={{ padding: "4px 12px", background: "#161616", fontSize: 11, color: "#f97316" }}>🌐 Live Preview</div>
          <iframe srcDoc={lang === "css" ? "<style>" + code + "</style><p>Preview</p>" : code} style={{ width: "100%", minHeight: 220, border: "none", background: "#fff" }} sandbox="allow-scripts" title="preview" />
        </div>
      )}
    </div>
  );
}

// ── AI TEXT RENDERER ──────────────────────────────────────────────
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
          if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) return <span key={i + "-" + j} style={{ display: "flex", gap: 8 }}><span style={{ color: "#f97316" }}>•</span><span>{segs}</span></span>;
          if (/^\d+\.\s/.test(line.trim())) return <span key={i + "-" + j} style={{ display: "flex", gap: 8 }}><span style={{ color: "#f97316", minWidth: 16 }}>{line.match(/^\d+/)[0]}.</span><span>{segs}</span></span>;
          if (line.startsWith("### ")) return <strong key={i + "-" + j} style={{ fontSize: 15, color: "#f97316" }}>{line.slice(4)}</strong>;
          if (line.startsWith("## ")) return <strong key={i + "-" + j} style={{ fontSize: 16, color: "#f97316" }}>{line.slice(3)}</strong>;
          if (line.startsWith("# ")) return <strong key={i + "-" + j} style={{ fontSize: 17, color: "#f97316" }}>{line.slice(2)}</strong>;
          return <span key={i + "-" + j}>{segs}</span>;
        });
      })}
    </span>
  );
}

// ── ICONS ─────────────────────────────────────────────────────────
const IcoSpeak = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>;
const IcoStop = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>;
const IcoCopy = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
const IcoOk = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const IcoShare = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>;
const IcoMic = ({ on }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="11" rx="3" fill={on ? "#ef4444" : "currentColor"} stroke="none" /><path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" /><line x1="12" y1="18" x2="12" y2="22" strokeLinecap="round" /><line x1="8" y1="22" x2="16" y2="22" strokeLinecap="round" /></svg>;
const IcoImg = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" /><path d="m21 15-5-5L5 21" /></svg>;
const IcoSearch = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;

// ── THEME COLORS ──────────────────────────────────────────────────
const THEMES = {
  dark:   { bg: "#0f0f0f", sf: "#1a1a1a", sf2: "#222", bd: "#2a2a2a", tx: "#f5f5f5", mt: "#6b7280", bub: "#1e1e1e", accent: "#f97316" },
  light:  { bg: "#f5f5f5", sf: "#ffffff", sf2: "#f0f0f0", bd: "#e5e5e5", tx: "#111111", mt: "#888", bub: "#ffffff", accent: "#f97316" },
  blue:   { bg: "#0a0f1e", sf: "#111827", sf2: "#1f2937", bd: "#374151", tx: "#f0f4ff", mt: "#6b7280", bub: "#1e2a3a", accent: "#3b82f6" },
};

// ── BUILD CSS ─────────────────────────────────────────────────────
function buildCSS(theme, fontSize) {
  const v = THEMES[theme] || THEMES.dark;
  const dark = theme !== "light";
  const fs = fontSize || 14;
  return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', sans-serif; background: ${v.bg}; color: ${v.tx}; height: 100dvh; overflow: hidden; font-size: ${fs}px; }
.app { display: flex; flex-direction: column; height: 100dvh; max-width: 480px; margin: 0 auto; background: ${v.bg}; position: relative; }

/* SPLASH */
.splash { position: fixed; inset: 0; z-index: 999; background: #0a0a0a; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; transition: opacity .5s ease; }
.splash.out { opacity: 0; pointer-events: none; }
.slogo { font-size: 84px; animation: sP 1.5s ease-in-out infinite; }
@keyframes sP { 0%,100%{transform:scale(1);}50%{transform:scale(1.08);} }
.stitle { font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
.ssub { font-size: 13px; color: #6b7280; }
.sbar { width: 140px; height: 3px; background: #222; border-radius: 3px; overflow: hidden; margin-top: 8px; }
.sprog { height: 100%; background: linear-gradient(90deg, #f97316, #ea580c); border-radius: 3px; animation: sLoad 2.2s ease forwards; }
@keyframes sLoad { from{width:0;} to{width:100%;} }

/* PWA */
.pwa { position: fixed; bottom: 72px; left: 10px; right: 10px; background: ${dark ? "#1c1c1c" : "#fff"}; border: 1.5px solid ${v.accent}; border-radius: 16px; padding: 12px 14px; display: flex; align-items: center; gap: 10px; z-index: 150; box-shadow: 0 8px 30px #0009; animation: fadeUp .3s ease; }
@keyframes fadeUp { from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);} }
.pwa-btn { background: ${v.accent}; border: none; border-radius: 10px; color: #fff; cursor: pointer; font-size: 12px; font-weight: 700; padding: 7px 13px; font-family: 'Inter', sans-serif; }
.pwa-x { background: none; border: none; color: ${v.mt}; cursor: pointer; font-size: 17px; padding: 2px 6px; }

/* AUTH */
.auth { flex: 1; overflow-y: auto; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 24px; gap: 18px; }
.auth-logo { font-size: 52px; }
.auth-title { font-size: 26px; font-weight: 800; }
.auth-sub { font-size: 13px; color: ${v.mt}; text-align: center; }
.card { width: 100%; background: ${v.sf}; border: 1px solid ${v.bd}; border-radius: 20px; padding: 22px; display: flex; flex-direction: column; gap: 13px; }
.card-head { font-size: 17px; font-weight: 700; text-align: center; }
.iw { display: flex; flex-direction: column; gap: 4px; }
.ilbl { font-size: 11px; color: ${v.mt}; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
.inp { background: ${dark ? "#111" : v.sf2}; border: 1.5px solid ${v.bd}; border-radius: 12px; color: ${v.tx}; font-family: 'Inter', sans-serif; font-size: 15px; padding: 12px 14px; outline: none; width: 100%; transition: border-color .2s; }
.inp:focus { border-color: ${v.accent}; }
.btn { border: none; border-radius: 12px; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600; padding: 13px; transition: all .2s; width: 100%; }
.btn-p { background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; }
.btn-p:hover { opacity: .9; } .btn-p:disabled { opacity: .55; cursor: not-allowed; }
.btn-s { background: ${v.sf2}; color: ${v.tx}; border: 1px solid ${v.bd}; }
.link { font-size: 13px; color: ${v.mt}; text-align: center; } .link span { color: #fb923c; cursor: pointer; font-weight: 600; }
.err { color: #ef4444; font-size: 13px; text-align: center; background: #ef444414; padding: 9px; border-radius: 10px; }
.ok { color: #22c55e; font-size: 13px; text-align: center; background: #22c55e14; padding: 9px; border-radius: 10px; }

/* HEADER */
.hdr { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: ${v.bg}; border-bottom: 1px solid ${v.bd}; flex-shrink: 0; position: relative; z-index: 20; }
.hdr-name { font-size: 17px; font-weight: 800; flex: 1; letter-spacing: -0.3px; }
.dots { background: none; border: none; color: ${v.tx}; cursor: pointer; font-size: 22px; padding: 5px; border-radius: 10px; line-height: 1; }
.nbtn { background: ${v.sf2}; border: 1px solid ${v.bd}; border-radius: 10px; color: ${v.tx}; cursor: pointer; font-size: 13px; font-weight: 600; padding: 7px 13px; }

/* SIDEBAR */
.sb-overlay { position: fixed; inset: 0; background: #000a; z-index: 90; }
.sidebar { position: fixed; top: 0; left: 0; bottom: 0; width: 78%; max-width: 320px; background: ${v.sf}; border-right: 1px solid ${v.bd}; z-index: 100; display: flex; flex-direction: column; padding: 16px 12px; gap: 4px; animation: sbIn .2s ease; overflow-y: auto; }
@keyframes sbIn { from{transform:translateX(-100%);} to{transform:translateX(0);} }
.sb-head { display: flex; align-items: center; gap: 9px; padding: 6px 8px 14px; font-size: 18px; font-weight: 800; }
.sb-item { display: flex; align-items: center; gap: 13px; padding: 12px 12px; border-radius: 12px; cursor: pointer; font-size: 15px; font-weight: 600; color: ${v.tx}; transition: background .15s; }
.sb-item:hover { background: ${v.sf2}; }
.sb-item .ic { font-size: 18px; width: 22px; text-align: center; flex-shrink: 0; }
.sb-div { height: 1px; background: ${v.bd}; margin: 8px 4px; }
.sb-sec { font-size: 11px; font-weight: 700; color: ${v.mt}; letter-spacing: .08em; text-transform: uppercase; padding: 10px 12px 4px; }
.sb-chat { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; cursor: pointer; font-size: 13px; color: ${v.tx}; }
.sb-chat:hover { background: ${v.sf2}; }
.sb-chat span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }

/* DROPDOWN */
.dd { position: absolute; top: 54px; left: 10px; background: ${v.sf}; border: 1px solid ${v.bd}; border-radius: 18px; padding: 7px; min-width: 215px; z-index: 100; box-shadow: 0 10px 40px #0009; animation: ddIn .15s ease; }
@keyframes ddIn { from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);} }
.ddi { display: flex; align-items: center; gap: 11px; padding: 11px 13px; border-radius: 11px; cursor: pointer; font-size: 14px; font-weight: 500; color: ${v.tx}; transition: background .15s; }
.ddi:hover { background: ${v.sf2}; } .ddi.red { color: #ef4444; }
.ddiv { height: 1px; background: ${v.bd}; margin: 3px 0; }
.ddu { padding: 13px 13px 9px; }
.ddn { font-size: 15px; font-weight: 700; } .dde { font-size: 11px; color: ${v.mt}; margin-top: 2px; }
.ptag { background: linear-gradient(135deg, #f59e0b, #f97316); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; margin-top: 4px; display: inline-block; }

/* USAGE BAR */
.ubar { display: flex; align-items: center; justify-content: space-between; padding: 5px 16px; background: ${v.sf}; border-bottom: 1px solid ${v.bd}; font-size: 11px; color: ${v.mt}; flex-shrink: 0; }
.upill { background: ${v.sf2}; border-radius: 20px; padding: 2px 9px; font-weight: 600; }

/* CHAT AREA */
.chat { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth; }
.chat::-webkit-scrollbar { width: 0; }

/* WELCOME */
.welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 32px 20px; }
.wlotus { font-size: 100px; cursor: pointer; line-height: 1; display: block; }
.welcome h2 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
.wsub { font-size: 13px; color: ${v.mt}; max-width: 240px; line-height: 1.7; }

/* MESSAGES */
.mwrap { display: flex; flex-direction: column; gap: 2px; animation: mIn .2s ease; }
@keyframes mIn { from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);} }
.mrow { display: flex; gap: 7px; align-items: flex-end; } .mrow.user { flex-direction: row-reverse; }
.bwrap { display: flex; flex-direction: column; max-width: 82%; }
.bub { padding: 11px 15px; font-size: ${fs}px; line-height: 1.65; word-break: break-word; }
.bub.user { background: ${v.accent}; color: #fff; border-radius: 20px 20px 4px 20px; }
.bub.ai { background: ${v.bub}; color: ${v.tx}; border: 1px solid ${v.bd}; border-radius: 20px 20px 20px 4px; }
.rbar { display: flex; gap: 2px; padding: 4px 8px; background: ${v.sf}; border: 1px solid ${v.bd}; border-radius: 24px; position: absolute; top: -42px; left: 0; z-index: 10; box-shadow: 0 4px 16px #0007; animation: ddIn .15s; }
.rbtn { background: none; border: none; cursor: pointer; font-size: 20px; padding: 2px 4px; border-radius: 8px; transition: transform .12s; } .rbtn:hover { transform: scale(1.3); }
.react { font-size: 16px; padding-left: 4px; margin-top: 2px; }
.acts { display: flex; gap: 4px; padding: 3px 2px 0; flex-wrap: wrap; }
.abtn { background: none; border: 1px solid ${v.bd}; color: ${v.mt}; cursor: pointer; padding: 4px 7px; border-radius: 20px; display: flex; align-items: center; justify-content: center; transition: all .15s; line-height: 1; }
.abtn:hover { color: ${v.accent}; border-color: ${v.accent}; }
.abtn.on { color: ${v.accent}; border-color: ${v.accent}; background: ${v.accent}14; }
.abtn svg { display: block; }
.mtime { font-size: 10px; color: ${v.mt}; padding: 0 3px; } .mtime.user { text-align: right; }
.aiav { width: 27px; height: 27px; border-radius: 50%; background: linear-gradient(135deg, #f97316, #ea580c); display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.tbub { background: ${v.bub}; border: 1px solid ${v.bd}; border-radius: 20px 20px 20px 4px; padding: 13px 17px; display: flex; gap: 5px; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: ${v.accent}; animation: bou 1.2s infinite; }
.dot:nth-child(2){animation-delay:.2s;} .dot:nth-child(3){animation-delay:.4s;}
@keyframes bou { 0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-5px);} }
.sind { font-size: 11px; color: ${v.accent}; padding: 4px 10px; background: ${v.accent}14; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px; }
.mimg { max-width: 200px; border-radius: 12px; margin-bottom: 4px; display: block; }
.mimg.gen { width: 240px; max-width: 100%; border-radius: 14px; }

/* INPUT BAR */
.ibar { padding: 9px 13px; border-top: 1px solid ${v.bd}; background: ${v.bg}; display: flex; gap: 7px; align-items: flex-end; flex-shrink: 0; }
.tinp { flex: 1; background: ${v.sf}; border: 1.5px solid ${v.bd}; border-radius: 24px; color: ${v.tx}; font-family: 'Inter', sans-serif; font-size: ${fs}px; padding: 11px 17px; outline: none; resize: none; max-height: 110px; min-height: 46px; transition: border-color .2s; line-height: 1.5; }
.tinp:focus { border-color: ${v.accent}; } .tinp::placeholder { color: ${v.mt}; }
.sbtn { background: linear-gradient(135deg, #f97316, #ea580c); border: none; border-radius: 50%; color: #fff; cursor: pointer; font-size: 18px; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform .15s; }
.sbtn:hover { transform: scale(1.05); } .sbtn:disabled { opacity: .4; cursor: not-allowed; }
.ibtn { background: ${v.sf2}; border: 1.5px solid ${v.bd}; border-radius: 50%; color: ${v.tx}; cursor: pointer; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .2s; }
.ibtn:hover { border-color: ${v.accent}; }
.ibtn.rec { border-color: #ef4444; background: #ef444418; animation: mP 1s infinite; }
@keyframes mP { 0%,100%{box-shadow:0 0 0 0 #ef444438;}50%{box-shadow:0 0 0 5px transparent;} }
.imgprev { position: relative; display: inline-block; margin-bottom: 7px; }
.imgprev img { width: 72px; height: 72px; object-fit: cover; border-radius: 12px; border: 2px solid ${v.accent}; }
.imgprev-x { position: absolute; top: -5px; right: -5px; background: #ef4444; border: none; border-radius: 50%; color: #fff; cursor: pointer; font-size: 11px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; }

/* PAGES */
.page { flex: 1; overflow-y: auto; padding: 14px; padding-bottom: 28px; display: flex; flex-direction: column; gap: 9px; }
.ptitle { font-size: 18px; font-weight: 700; margin-bottom: 3px; }
.sbar { display: flex; align-items: center; background: ${v.sf}; border: 1.5px solid ${v.bd}; border-radius: 12px; padding: 8px 13px; gap: 7px; margin-bottom: 3px; }
.sbar input { flex: 1; background: none; border: none; outline: none; color: ${v.tx}; font-size: 14px; font-family: 'Inter', sans-serif; min-width: 0; }
.hcard { background: ${v.sf}; border: 1px solid ${v.bd}; border-radius: 14px; padding: 13px 15px; display: flex; align-items: center; gap: 11px; cursor: pointer; transition: border-color .2s; }
.hcard:hover { border-color: ${v.accent}; }
.hi { flex: 1; overflow: hidden; }
.ht { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hm { font-size: 11px; color: ${v.mt}; margin-top: 2px; }
.dbtn { background: none; border: none; color: ${v.mt}; cursor: pointer; font-size: 18px; padding: 3px 6px; border-radius: 8px; flex-shrink: 0; }
.dbtn:hover { color: #ef4444; }
.scard { background: ${v.sf}; border: 1px solid ${v.bd}; border-radius: 16px; overflow: hidden; margin-bottom: 3px; }
.srow { display: flex; align-items: center; gap: 13px; padding: 14px 16px; border-bottom: 1px solid ${v.bd}; cursor: pointer; flex-wrap: wrap; } .srow:last-child { border-bottom: none; }
.sicon { font-size: 20px; width: 26px; text-align: center; flex-shrink: 0; } .stxt { flex: 1; min-width: 120px; }
.slbl { font-size: 14px; font-weight: 600; } .sdesc { font-size: 12px; color: ${v.mt}; margin-top: 2px; word-break: break-word; }
.sec { font-size: 11px; font-weight: 700; color: ${v.mt}; letter-spacing: .08em; text-transform: uppercase; margin: 12px 0 5px; }
.badge { background: linear-gradient(135deg,#f59e0b,#f97316); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
.badge-g { background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
.badge-y { background: linear-gradient(135deg,#eab308,#ca8a04); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
.badge-r { background: linear-gradient(135deg,#ef4444,#b91c1c); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
.pc { background: linear-gradient(135deg,#f97316,#ea580c); border-radius: 18px; padding: 18px; margin-bottom: 4px; cursor: pointer; }
.pc h3 { font-size: 18px; font-weight: 800; color: #fff; } .pc p { font-size: 13px; color: #fff9; margin-top: 3px; }
.pf { font-size: 13px; color: #fff; display: flex; align-items: center; gap: 7px; margin-top: 5px; }
.sgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.sct { background: ${v.sf}; border: 1px solid ${v.bd}; border-radius: 14px; padding: 16px; }
.sv { font-size: 26px; font-weight: 800; color: ${v.accent}; } .sl { font-size: 12px; color: ${v.mt}; margin-top: 2px; }
.ucard { background: ${v.sf}; border: 1px solid ${v.bd}; border-radius: 12px; padding: 11px 13px; display: flex; align-items: center; gap: 11px; }
.uav { width: 35px; height: 35px; border-radius: 50%; background: linear-gradient(135deg,#f97316,#ea580c); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; font-size: 14px; flex-shrink: 0; }
.tgl { position: relative; width: 44px; height: 24px; background: ${v.sf2}; border-radius: 12px; cursor: pointer; border: 2px solid ${v.bd}; transition: background .2s; flex-shrink: 0; }
.tgl.on { background: ${v.accent}; border-color: ${v.accent}; }
.tk { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left .2s; }
.tgl.on .tk { left: 22px; }

/* PROFILE */
.pav { position: relative; display: inline-block; }
.pavimg { width: 68px; height: 68px; border-radius: 50%; object-fit: cover; border: 3px solid ${v.accent}; }
.pavph { width: 68px; height: 68px; border-radius: 50%; background: linear-gradient(135deg,#f97316,#ea580c); display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 700; color: #fff; }
.paved { position: absolute; bottom: 0; right: 0; background: ${v.accent}; border-radius: 50%; width: 21px; height: 21px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 11px; }

/* MODAL */
.mbg { position: fixed; inset: 0; background: #000c; z-index: 200; display: flex; align-items: flex-end; padding: 14px; }
.modal { background: ${v.sf}; border-radius: 24px 24px 16px 16px; padding: 26px 22px; width: 100%; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 13px; max-height: 88vh; overflow-y: auto; }
.modal h3 { font-size: 20px; font-weight: 700; text-align: center; }
.modal p { font-size: 13px; color: ${v.mt}; text-align: center; line-height: 1.6; }
.mi { font-size: 50px; text-align: center; }
.pbox { background: ${v.sf2}; border: 1px solid ${v.bd}; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 9px; }
.pnum { font-size: 22px; font-weight: 800; color: ${v.accent}; text-align: center; letter-spacing: 2px; }
.pstep { font-size: 13px; color: ${v.tx}; display: flex; gap: 7px; }
.ld { text-align: center; color: ${v.mt}; padding: 20px; font-size: 14px; }

/* VOICE CALL PAGE — Clean & Professional */
.vpage { display: flex; flex-direction: column; height: 100%; background: ${dark ? "#080808" : "#f8f8f8"}; }
.vbody { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 24px 20px; overflow-y: auto; }
.vcaller-card { background: ${dark ? "#141414" : "#ffffff"}; border: 1px solid ${v.bd}; border-radius: 28px; padding: 32px 28px; display: flex; flex-direction: column; align-items: center; gap: 20px; width: 100%; max-width: 340px; }
.vorb-wrap { position: relative; display: flex; align-items: center; justify-content: center; width: 150px; height: 150px; }
.vring { position: absolute; border-radius: 50%; pointer-events: none; }
.vr1 { animation: vra 2s ease-out infinite; background: #f9731620; }
.vr2 { animation: vra 2s ease-out .5s infinite; background: #f9731610; }
@keyframes vra { 0%{width:94px;height:94px;opacity:.9;}100%{width:165px;height:165px;opacity:0;} }
.vorb { width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg,#f97316,#ea580c); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2; position: relative; font-size: 40px; box-shadow: 0 8px 32px #f9731648; transition: all .25s; }
.vorb:hover { transform: scale(1.04); }
.vorb.listen { background: linear-gradient(135deg,#ef4444,#dc2626); box-shadow: 0 0 0 12px #ef444422; animation: orbP 1s infinite; }
.vorb.speak { background: linear-gradient(135deg,#22c55e,#16a34a); box-shadow: 0 8px 32px #22c55e55; }
.vorb.think { background: linear-gradient(135deg,#8b5cf6,#6d28d9); box-shadow: 0 8px 32px #8b5cf650; }
@keyframes orbP { 0%,100%{transform:scale(1);}50%{transform:scale(1.06);} }
.vstatus { font-size: 16px; font-weight: 700; text-align: center; }
.vsub { font-size: 12px; color: ${v.mt}; text-align: center; }
.vwave { display: flex; align-items: center; gap: 3px; height: 28px; }
.wb { width: 3px; border-radius: 3px; background: #22c55e; animation: wv .9s ease-in-out infinite; }
@keyframes wv { 0%,100%{height:5px;opacity:.5;}50%{height:24px;opacity:1;} }
.vlast { width: 100%; background: ${v.sf2}; border-radius: 14px; padding: 12px 14px; }
.vendbtn { background: #ef444418; border: 1.5px solid #ef4444; border-radius: 14px; color: #ef4444; cursor: pointer; font-size: 14px; font-weight: 700; padding: 13px 36px; font-family: 'Inter', sans-serif; transition: background .2s; }
.vendbtn:hover { background: #ef444428; }

/* ADMIN CHAT */
.achat { max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 7px; padding: 7px; background: ${v.sf2}; border-radius: 12px; }

/* THEME PICKER */
.theme-grid { display: flex; gap: 8px; }
.thm-opt { flex: 1; padding: 10px 8px; border-radius: 12px; border: 2px solid ${v.bd}; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; transition: all .2s; }
.thm-opt.sel { border-color: ${v.accent}; background: ${v.accent}12; }
.thm-dot { width: 28px; height: 28px; border-radius: 50%; }

/* ACCENT */
.accent-grid { display: flex; gap: 8px; flex-wrap: wrap; }
.accent-dot { width: 30px; height: 30px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; transition: all .15s; flex-shrink: 0; }
.accent-dot.sel { border-color: ${v.tx}; transform: scale(1.12); }
`;
}

const ACCENTS = ["#f97316","#3b82f6","#22c55e","#a855f7","#ec4899","#ef4444","#eab308","#14b8a6"];

// ── APP ───────────────────────────────────────────────────────────
export default function App() {
  // splash
  const [splash, setSplash] = useState(true);
  const [splashOut, setSplashOut] = useState(false);
  // pwa
  const [pwaEvt, setPwaEvt] = useState(null);
  const [showPwa, setShowPwa] = useState(false);
  // auth
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [forgot, setForgot] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", pass: "" });
  const [ferr, setFerr] = useState(""); const [fok, setFok] = useState(""); const [fload, setFload] = useState(false);
  // theme & settings
  const [theme, setTheme] = useState("dark"); // dark | light | blue
  const [fontSize, setFontSize] = useState(14);
  const [chatBg, setChatBg] = useState("default");
  const [accent, setAccent] = useState("#f97316");
  const [notifOn, setNotifOn] = useState(false);
  // app
  const [page, setPage] = useState("chat");
  const [userData, setUserData] = useState(null);
  // sidebar
  const [showSidebar, setShowSidebar] = useState(false);
  // auto-detected tone per session
  const [sessionTone, setSessionTone] = useState(null); // null | "male" | "female"
  // chat
  const [sid, setSid] = useState(() => Date.now().toString());
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [reactions, setReactions] = useState({});
  const [showRx, setShowRx] = useState(null);
  // ui
  const [showMenu, setShowMenu] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [payDone, setPayDone] = useState(false);
  const [copied, setCopied] = useState(null);
  const [speakId, setSpeakId] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [imgB64, setImgB64] = useState(null);
  const [imgPrev, setImgPrev] = useState(null);
  // history
  const [hists, setHists] = useState([]);
  const [histLoad, setHistLoad] = useState(false);
  const [hSearch, setHSearch] = useState("");
  // profile
  const [showProfile, setShowProfile] = useState(false);
  const [pName, setPName] = useState("");
  const [pPhoto, setPPhoto] = useState(null);
  const [pPhotoUrl, setPPhotoUrl] = useState(null);
  const [pSaving, setPSaving] = useState(false);
  // admin
  const [adminUsers, setAdminUsers] = useState([]);
  const [aSearch, setASearch] = useState("");
  const [aChat, setAChat] = useState(null);
  const [aChatLoad, setAChatLoad] = useState(false);
  const [aChatShowDeleted, setAChatShowDeleted] = useState(false);
  // voice
  const [vs, setVs] = useState("idle");
  const [vSpeed] = useState(0.9);
  const [vLast, setVLast] = useState("");
  const [vTone, setVTone] = useState("female");

  const bottomRef = useRef(null);
  const galleryRef = useRef(null);
  const pPhotoRef = useRef(null);
  const micRef = useRef(null);
  const voiceRef = useRef(null);

  // SPLASH
  useEffect(() => {
    const t1 = setTimeout(() => setSplashOut(true), 2300);
    const t2 = setTimeout(() => setSplash(false), 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // PWA
  useEffect(() => {
    const h = e => { e.preventDefault(); setPwaEvt(e); setShowPwa(true); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  // AUTH
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
          if (data.theme) setTheme(data.theme);
          if (data.fontSize) setFontSize(data.fontSize);
          if (data.accent) setAccent(data.accent);
        }
        // mark last active
        setDoc(doc(db, "users", u.uid), { lastActive: serverTimestamp() }, { merge: true }).catch(() => {});
      } else { setUser(null); setUserData(null); }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  useEffect(() => {
    if (user && page === "history") loadHists();
    if (user && page === "admin") loadAdmin();
    if (page !== "voice") endVoice();
    window.speechSynthesis?.cancel();
    setSpeakId(null); setShowRx(null);
  }, [page]);

  async function loadHists() {
    setHistLoad(true);
    try {
      const q = query(collection(db, "chats"), where("userId", "==", user.uid), orderBy("updatedAt", "desc"));
      const snap = await getDocs(q);
      setHists(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(h => !h.deletedByUser));
    } catch {
      try {
        const q2 = query(collection(db, "chats"), where("userId", "==", user.uid));
        const s2 = await getDocs(q2);
        setHists(s2.docs.map(d => ({ id: d.id, ...d.data() })).filter(h => !h.deletedByUser).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)));
      } catch (e) { console.error(e); }
    }
    setHistLoad(false);
  }

  async function loadAdmin() {
    const snap = await getDocs(collection(db, "users"));
    setAdminUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function viewUserChat(u) {
    setAChat({ user: u, msgs: [] }); setAChatLoad(true); setAChatShowDeleted(false);
    try {
      let m2 = [];
      try {
        const q = query(collection(db, "messages"), where("userId", "==", u.id), orderBy("createdAt", "desc"), limit(60));
        const snap = await getDocs(q);
        m2 = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
      } catch {
        const q2 = query(collection(db, "messages"), where("userId", "==", u.id));
        const s2 = await getDocs(q2);
        m2 = s2.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)).slice(-60);
      }
      // also load chat sessions (incl. user-deleted) for this user
      let sessions = [];
      try {
        const qs = query(collection(db, "chats"), where("userId", "==", u.id));
        const ss = await getDocs(qs);
        sessions = ss.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {}
      setAChat({ user: u, msgs: m2, sessions });
    } catch (e) { console.error(e); }
    setAChatLoad(false);
  }

  async function handleAuth() {
    setFerr(""); setFok("");
    if (forgot) {
      if (!form.email) { setFerr("Enter your email!"); return; }
      setFload(true);
      try { await sendPasswordResetEmail(auth, form.email); setFok("✅ Reset link sent! Check your email."); setForm(f => ({ ...f, email: "" })); }
      catch { setFerr("Email not registered!"); }
      setFload(false); return;
    }
    if (!form.email || !form.pass) { setFerr("Please fill all fields!"); return; }
    if (form.pass.length < 8) { setFerr("Password must be 8+ characters!"); return; }
    if (authMode === "signup" && !form.name) { setFerr("Enter your name!"); return; }
    setFload(true);
    try {
      if (authMode === "signup") {
        const c = await createUserWithEmailAndPassword(auth, form.email, form.pass);
        await updateProfile(c.user, { displayName: form.name });
        await setDoc(doc(db, "users", c.user.uid), { name: form.name, email: form.email, premium: false, createdAt: serverTimestamp(), usageCount: 0, lastActive: serverTimestamp() });
        setUserData({ name: form.name, email: form.email, premium: false, usageCount: 0 });
        setPName(form.name);
      } else {
        await signInWithEmailAndPassword(auth, form.email, form.pass);
        const d = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (d.exists()) { const data = d.data(); setUserData(data); if (data.theme) setTheme(data.theme); }
      }
      setForm({ name: "", email: "", pass: "" });
    } catch (e) {
      const errs = { "auth/email-already-in-use": "Email already registered!", "auth/invalid-email": "Invalid email!", "auth/wrong-password": "Wrong password!", "auth/user-not-found": "Account not found!", "auth/invalid-credential": "Wrong email or password!" };
      setFerr(errs[e.code] || e.message);
    }
    setFload(false);
  }

  async function saveProfile() {
    if (!pName.trim()) { alert("Enter your name!"); return; }
    setPSaving(true);
    try {
      const updates = { name: pName.trim() };
      if (pPhoto) {
        const compressed = await compressImage(pPhoto, 120, 0.55);
        updates.photoURL = compressed;
        setPPhotoUrl(compressed);
      }
      await updateProfile(auth.currentUser, { displayName: pName.trim() });
      await setDoc(doc(db, "users", user.uid), updates, { merge: true });
      setUserData(p => ({ ...p, ...updates }));
      setPPhoto(null); setShowProfile(false);
    } catch (e) { alert("Error: " + e.message); }
    setPSaving(false);
  }

  async function saveSetting(key, val) {
    await setDoc(doc(db, "users", user.uid), { [key]: val }, { merge: true });
    setUserData(p => ({ ...p, [key]: val }));
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

  // MIC — only when user taps, no auto-permission
  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Use Chrome or Edge for voice input."); return; }
    if (micActive) { micRef.current?.stop(); setMicActive(false); return; }
    const r = new SR();
    r.lang = "hi-IN"; r.continuous = false; r.interimResults = false;
    r.onstart = () => setMicActive(true);
    r.onresult = e => { const t = e.results[0][0].transcript; if (t) setInput(p => p ? p + " " + t : t); };
    r.onerror = err => { if (err.error === "not-allowed") alert("Please allow microphone access."); setMicActive(false); };
    r.onend = () => setMicActive(false);
    micRef.current = r;
    try { r.start(); } catch { setMicActive(false); }
  }

  function toggleSpeak(id, text) {
    if (speakId === id) { window.speechSynthesis?.cancel(); setSpeakId(null); return; }
    setSpeakId(id);
    speakText(text, sessionTone || "female", vSpeed, () => setSpeakId(null));
  }

  function copyMsg(text, id) {
    navigator.clipboard?.writeText(text).catch(() => { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); });
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  }

  function shareWA(text) { window.open("https://wa.me/?text=" + encodeURIComponent("Saraswati AI:\n\n" + text.slice(0, 500)), "_blank"); }

  function exportChat() {
    if (!msgs.length) { alert("No messages to export."); return; }
    const txt = msgs.map(m => (m.role === "user" ? "You" : "Saraswati AI") + ":\n" + m.text).join("\n\n---\n\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
    a.download = "saraswati-chat.txt"; a.click();
  }

  // VOICE CALL
  function endVoice() {
    voiceRef.current?.stop?.(); voiceRef.current?.abort?.();
    window.speechSynthesis?.cancel(); setVs("idle");
  }

  async function handleOrb() {
    if (vs === "listen") { voiceRef.current?.stop?.(); setVs("idle"); return; }
    if (vs === "speak") { window.speechSynthesis?.cancel(); setVs("idle"); return; }
    if (vs === "think") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Use Chrome or Edge for voice call."); return; }
    const r = new SR();
    r.lang = "hi-IN"; r.continuous = false; r.interimResults = false;
    r.onresult = async e => {
      const transcript = e.results[0][0].transcript;
      if (!transcript.trim()) { setVs("idle"); return; }
      // auto-detect tone
      const det = detectTone(transcript);
      if (det) { setSessionTone(det); setVTone(det); }
      const tone = det || sessionTone || "female";
      setVs("think");
      const ud = userData;
      if (!ud?.premium && (ud?.usageCount || 0) >= FREE_LIMIT) { setShowLimit(true); setVs("idle"); return; }
      const uRef = await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "user", text: transcript, createdAt: serverTimestamp() });
      const newMsgs = [...msgs, { id: uRef.id, role: "user", text: transcript, time: new Date() }];
      setMsgs(newMsgs);
      const isFirst = msgs.length === 0;
      const title = isFirst ? await generateTitle(transcript) : undefined;
      await setDoc(doc(db, "chats", sid), { userId: user.uid, ...(title && { title }), updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
      const nc = (ud?.usageCount || 0) + 1;
      await setDoc(doc(db, "users", user.uid), { usageCount: nc, lastActive: serverTimestamp() }, { merge: true });
      setUserData(p => ({ ...p, usageCount: nc }));
      try {
        const aiText = await callAI(newMsgs, null, tone);
        const tid = "v_" + Date.now();
        setMsgs(p => [...p, { id: tid, role: "ai", text: aiText, time: new Date() }]);
        setVLast(aiText);
        await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "ai", text: aiText, createdAt: serverTimestamp() });
        setVs("speak");
        speakText(aiText, tone, vSpeed, () => setVs("idle"));
      } catch (err) { setMsgs(p => [...p, { id: Date.now(), role: "ai", text: "❌ " + err.message, time: new Date() }]); setVs("idle"); }
    };
    r.onerror = e => {
      if (e.error === "not-allowed" || e.error === "permission-denied") alert("Allow microphone access to use Voice Call.");
      else if (e.error === "network") alert("Network error. Check your connection.");
      setVs("idle");
    };
    r.onend = () => { if (vs === "listen") setVs("idle"); };
    voiceRef.current = r;
    try { r.start(); setVs("listen"); } catch { setVs("idle"); }
  }

  // SEND MESSAGE
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
    // detect tone from message
    const det = detectTone(msgText);
    if (det) setSessionTone(det);
    const tone = det || sessionTone || "female";
    const uRef = await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "user", text: msgText, image: prev || null, createdAt: serverTimestamp() });
    const newMsgs = [...msgs, { id: uRef.id, role: "user", text: msgText, image: prev, time: new Date() }];
    setMsgs(newMsgs);
    const isFirst = msgs.length === 0;
    const title = isFirst ? await generateTitle(msgText) : undefined;
    await setDoc(doc(db, "chats", sid), { userId: user.uid, ...(title ? { title } : { title: msgText.slice(0, 38) }), updatedAt: serverTimestamp(), createdAt: serverTimestamp(), deletedByUser: false }, { merge: true });
    const nc = (ud?.usageCount || 0) + 1;
    await setDoc(doc(db, "users", user.uid), { usageCount: nc, lastActive: serverTimestamp() }, { merge: true });
    setUserData(p => ({ ...p, usageCount: nc }));
    if (!b64 && needsImageGen(msgText)) {
      setLoading(true);
      const prompt = extractImagePrompt(msgText);
      const url = getImageUrl(prompt);
      await new Promise(r => setTimeout(r, 500));
      const tid = "img_" + Date.now();
      const aiText = "🎨 Here is your image — \"" + prompt + "\"";
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
      setPage("chat"); setSid(s.id); setMsgs([]);
      const q = query(collection(db, "messages"), where("sessionId", "==", s.id));
      const snap = await getDocs(q);
      setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data(), time: d.data().createdAt })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));
    } catch (e) { alert("Error: " + e.message); }
  }

  // SOFT DELETE — user delete only hides the chat for the user.
  // The chat document + all its messages remain in the database for admin visibility.
  // Only an admin can permanently remove a chat (adminHardDeleteChat).
  async function delSession(id, e) {
    e.stopPropagation();
    if (!window.confirm("Delete this chat from your history?")) return;
    await setDoc(doc(db, "chats", id), { deletedByUser: true, deletedAt: serverTimestamp() }, { merge: true });
    setHists(p => p.filter(h => h.id !== id));
  }

  // ADMIN — permanently delete a chat session and all its messages
  async function adminHardDeleteChat(chatId, userId) {
    if (!window.confirm("Permanently delete this chat and all its messages? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "chats", chatId));
      const q = query(collection(db, "messages"), where("sessionId", "==", chatId));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "messages", d.id))));
      if (aChat) {
        setAChat(p => ({
          ...p,
          msgs: p.msgs.filter(m => m.sessionId !== chatId),
          sessions: (p.sessions || []).filter(s => s.id !== chatId)
        }));
      }
    } catch (e) { alert("Error: " + e.message); }
  }

  async function adminToggle(uid, cur) {
    await updateDoc(doc(db, "users", uid), { premium: !cur, premiumPending: false });
    setAdminUsers(p => p.map(u => u.id === uid ? { ...u, premium: !cur } : u));
    if (aChat?.user?.id === uid) setAChat(p => ({ ...p, user: { ...p.user, premium: !cur } }));
  }
  async function adminDel(uid) {
    if (!window.confirm("Delete this user?")) return;
    await deleteDoc(doc(db, "users", uid));
    setAdminUsers(p => p.filter(u => u.id !== uid));
  }

  function newChat() { setSid(Date.now().toString()); setMsgs([]); setPage("chat"); setShowMenu(false); setShowSidebar(false); setImgB64(null); setImgPrev(null); endVoice(); setReactions({}); setSessionTone(null); }

  function goPage(p) { setPage(p); setShowMenu(false); setShowSidebar(false); }

  const isAdmin = user?.email === ADMIN_EMAIL;
  const chatsLeft = userData?.premium ? null : Math.max(0, FREE_LIMIT - (userData?.usageCount || 0));
  const displayName = userData?.name || user?.displayName || "User";
  const filtHists = hists.filter(h => (h.title || "").toLowerCase().includes(hSearch.toLowerCase()));
  const filtAdminU = adminUsers.filter(u => (u.name || "").toLowerCase().includes(aSearch.toLowerCase()) || (u.email || "").toLowerCase().includes(aSearch.toLowerCase()));
  const adminGraph = Array.from({ length: 7 }, (_, i) => {
    const v = adminUsers.filter(u => { if (!u.createdAt?.seconds) return false; return Math.floor((Date.now() - u.createdAt.seconds * 1000) / 86400000) === (6 - i); }).length;
    return { l: ["M", "T", "W", "T", "F", "S", "S"][i], v };
  });
  const maxG = Math.max(...adminGraph.map(d => d.v), 1);
  const vOrbIcon = vs === "listen" ? "🎙️" : vs === "think" ? "🤔" : vs === "speak" ? "🔊" : "🪷";
  const vStatusTxt = { idle: "Tap to speak", listen: "Listening...", think: "Thinking...", speak: "Speaking..." }[vs];

  if (!authReady) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", background: "#0a0a0a" }}>
      <style>{buildCSS("dark", 14)}</style>
      <span style={{ fontSize: 56 }}>🪷</span>
      <div style={{ marginTop: 10, color: "#6b7280", fontSize: 14 }}>Loading...</div>
    </div>
  );

  if (!user) return (
    <div className="app">
      <style>{buildCSS(theme, fontSize).replace(/#f97316/g, accent)}</style>
      {splash && <div className={`splash${splashOut ? " out" : ""}`}><span className="slogo">🪷</span><div className="stitle">Saraswati AI</div><div className="ssub">Your intelligent AI assistant</div><div className="sbar"><div className="sprog" /></div></div>}
      <div className="auth">
        <div className="auth-logo">🪷</div>
        <div className="auth-title">Saraswati AI</div>
        <div className="auth-sub">AI assistant for everyone</div>
        <div className="card">
          {forgot ? (
            <>
              <div className="card-head">🔑 Reset Password</div>
              <div className="iw"><div className="ilbl">Email</div><input className="inp" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAuth()} /></div>
              {ferr && <div className="err">{ferr}</div>}
              {fok && <div className="ok">{fok}</div>}
              <button className="btn btn-p" onClick={handleAuth} disabled={fload}>{fload ? "Sending..." : "Send Reset Link"}</button>
              <div className="link"><span onClick={() => { setForgot(false); setFerr(""); setFok(""); }}>← Back</span></div>
            </>
          ) : (
            <>
              <div className="card-head">{authMode === "login" ? "Welcome Back 👋" : "Create Account ✨"}</div>
              {authMode === "signup" && <div className="iw"><div className="ilbl">Name</div><input className="inp" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>}
              <div className="iw"><div className="ilbl">Email</div><input className="inp" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="iw"><div className="ilbl">Password</div><input className="inp" type="password" placeholder="Min 8 characters" value={form.pass} onChange={e => setForm(f => ({ ...f, pass: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAuth()} /></div>
              {ferr && <div className="err">{ferr}</div>}
              <button className="btn btn-p" onClick={handleAuth} disabled={fload}>{fload ? "Please wait..." : authMode === "login" ? "Login →" : "Create Account →"}</button>
              {authMode === "login" && <div className="link" style={{ color: "#fb923c", cursor: "pointer", fontWeight: 600 }} onClick={() => { setForgot(true); setFerr(""); setFok(""); }}>Forgot password?</div>}
            </>
          )}
        </div>
        {!forgot && <div className="link">{authMode === "login" ? <>No account? <span onClick={() => { setAuthMode("signup"); setFerr(""); }}>Sign up</span></> : <>Have account? <span onClick={() => { setAuthMode("login"); setFerr(""); }}>Login</span></>}</div>}
      </div>
    </div>
  );

  return (
    <div className="app" onClick={() => { showMenu && setShowMenu(false); showRx && setShowRx(null); }}>
      <style>{buildCSS(theme, fontSize).replace(/#f97316/g, accent).replace(/#ea580c/g, accent)}</style>
      {splash && <div className={`splash${splashOut ? " out" : ""}`}><span className="slogo">🪷</span><div className="stitle">Saraswati AI</div><div className="ssub">Welcome, {displayName}!</div><div className="sbar"><div className="sprog" /></div></div>}

      {/* PWA */}
      {showPwa && pwaEvt && (
        <div className="pwa">
          <span style={{ fontSize: 26 }}>🪷</span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>Install App</div><div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Add to home screen</div></div>
          <button className="pwa-btn" onClick={async () => { pwaEvt.prompt(); await pwaEvt.userChoice; setShowPwa(false); }}>Install</button>
          <button className="pwa-x" onClick={() => setShowPwa(false)}>✕</button>
        </div>
      )}

      {/* HEADER */}
      <div className="hdr">
        <button className="dots" onClick={e => { e.stopPropagation(); setShowSidebar(v => !v); }}>☰</button>
        <span style={{ fontSize: 22 }}>🪷</span>
        <div className="hdr-name">Saraswati AI</div>
        {page === "chat" && <button className="nbtn" onClick={newChat}>+ New</button>}
        {page === "voice" && <button className="nbtn" style={{ background: "#ef444418", borderColor: "#ef4444", color: "#ef4444" }} onClick={() => { endVoice(); setPage("chat"); }}>End Call</button>}
      </div>

      {/* SIDEBAR */}
      {showSidebar && (
        <>
          <div className="sb-overlay" onClick={() => setShowSidebar(false)} />
          <div className="sidebar" onClick={e => e.stopPropagation()}>
            <div className="sb-head"><span style={{ fontSize: 24 }}>🪷</span> Saraswati AI</div>
            <div className="sb-item" onClick={newChat}><span className="ic">✏️</span> New Chat</div>
            <div className="sb-item" onClick={() => goPage("chat")}><span className="ic">💬</span> Chat</div>
            <div className="sb-item" onClick={() => goPage("voice")}><span className="ic">🎙️</span> Voice Call</div>
            <div className="sb-div" />
            <div className="sb-item" onClick={() => goPage("history")}><span className="ic">📂</span> Library</div>
            <div className="sb-item" onClick={() => alert("Projects feature coming soon!")}><span className="ic">📁</span> Projects</div>
            <div className="sb-item" onClick={() => alert("Apps feature coming soon!")}><span className="ic">🧩</span> Apps</div>
            <div className="sb-item" onClick={() => goPage("settings")}><span className="ic">⚙️</span> Settings & More</div>
            {isAdmin && <div className="sb-item" onClick={() => goPage("admin")}><span className="ic">🛡️</span> Admin Panel</div>}
            <div className="sb-div" />
            <div className="sb-sec">Recent Chats</div>
            {hists.length === 0 && <div style={{ fontSize: 12, color: "#6b7280", padding: "4px 12px" }}>No recent chats yet</div>}
            {hists.slice(0, 8).map(h => (
              <div key={h.id} className="sb-chat" onClick={() => { loadSession(h); setShowSidebar(false); }}>
                <span style={{ fontSize: 14 }}>💬</span><span>{h.title}</span>
              </div>
            ))}
            <div className="sb-div" />
            <div className="sb-item red" style={{ color: "#ef4444" }} onClick={() => signOut(auth)}><span className="ic">🚪</span> Logout</div>
          </div>
        </>
      )}

      {/* DROPDOWN (user/profile quick menu, kept for profile + share) */}
      {showMenu && (
        <div className="dd" onClick={e => e.stopPropagation()}>
          <div className="ddu">
            {pPhotoUrl
              ? <img src={pPhotoUrl} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "2px solid " + accent, marginBottom: 5 }} />
              : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#f97316,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 17, marginBottom: 5 }}>{displayName[0]?.toUpperCase()}</div>
            }
            <div className="ddn">{displayName}</div>
            <div className="dde">{user.email}</div>
            {userData?.premium && <div className="ptag">⭐ Premium</div>}
          </div>
          <div className="ddiv" />
          <div className="ddi" onClick={() => { shareWA(msgs.filter(m => m.role === "ai").pop()?.text || ""); setShowMenu(false); }}>📤 Share Chat</div>
          <div className="ddi" onClick={() => { exportChat(); setShowMenu(false); }}>📄 Export</div>
          {!userData?.premium && <div className="ddi" onClick={() => { setShowUpgrade(true); setShowMenu(false); }}>⭐ Upgrade to Premium</div>}
        </div>
      )}

      {page === "chat" && (
        <div className="ubar">
          <span>{userData?.premium ? "⭐ Premium Plan" : "Free Plan"}</span>
          <span className="upill">{userData?.premium ? "Unlimited" : chatsLeft + " left"}</span>
        </div>
      )}

      {/* ── CHAT ── */}
      {page === "chat" && (
        <>
          <div className="chat" style={chatBg === "gradient" ? { background: "linear-gradient(180deg,#0f0a00,#0f0f0f)" } : {}}>
            {msgs.length === 0 && (
              <div className="welcome">
                <span className="wlotus" onClick={() => setPage("voice")}>🪷</span>
                <h2>Saraswati AI</h2>
                <p className="wsub">Ask me anything — or tap the lotus for a voice call</p>
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
                      {m.image && (m.role === "ai"
                        ? <a href={m.image} target="_blank" rel="noreferrer"><img src={m.image} className="mimg gen" alt="generated" /></a>
                        : <img src={m.image} className="mimg" alt="uploaded" />
                      )}
                      {m.role === "ai" ? <AIText text={m.text} /> : m.text}
                    </div>
                    {reactions[m.id] && <div className="react">{reactions[m.id]}</div>}
                    {m.text && (
                      <div className="acts" style={m.role === "user" ? { justifyContent: "flex-end" } : {}}>
                        {m.role === "ai" && <button className={"abtn" + (speakId === m.id ? " on" : "")} onClick={() => toggleSpeak(m.id, m.text)}>{speakId === m.id ? <IcoStop s={13} /> : <IcoSpeak s={13} />}</button>}
                        <button className={"abtn" + (copied === m.id ? " on" : "")} onClick={() => copyMsg(m.text, m.id)}>{copied === m.id ? <IcoOk s={13} /> : <IcoCopy s={13} />}</button>
                        {m.role === "ai" && <button className="abtn" onClick={() => shareWA(m.text)}><IcoShare s={13} /></button>}
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
              {imgPrev && <div className="imgprev"><img src={imgPrev} alt="preview" /><button className="imgprev-x" onClick={() => { setImgB64(null); setImgPrev(null); }}>✕</button></div>}
              <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
                <button className="ibtn" onClick={() => galleryRef.current?.click()}><IcoImg /></button>
                <button className={"ibtn" + (micActive ? " rec" : "")} onClick={toggleMic}><IcoMic on={micActive} /></button>
                <textarea className="tinp" placeholder={micActive ? "Listening..." : "Ask anything..."} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMsg())} rows={1} style={micActive ? { borderColor: "#ef4444" } : {}} />
                <button className="sbtn" onClick={() => sendMsg()} disabled={(!input.trim() && !imgB64) || loading}>➤</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── VOICE CALL ── */}
      {page === "voice" && (
        <div className="vpage">
          <div className="vbody">
            <div className="vcaller-card">
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", letterSpacing: ".08em", textTransform: "uppercase" }}>Voice Call</div>
              <div className="vorb-wrap">
                {(vs === "listen" || vs === "speak") && <><div className="vring vr1" /><div className="vring vr2" /></>}
                <div className={`vorb${vs === "listen" ? " listen" : vs === "speak" ? " speak" : vs === "think" ? " think" : ""}`} onClick={handleOrb}>{vOrbIcon}</div>
              </div>
              <div className="vstatus">{vStatusTxt}</div>
              {vs === "speak" && <div className="vwave">{[0, 1, 2, 3, 4].map(i => <div key={i} className="wb" style={{ animationDelay: `${i * 0.1}s` }} />)}</div>}
              <div className="vsub">Hindi • English • Urdu • 100+ languages</div>
              <div className="vsub" style={{ fontSize: 11 }}>Tap to speak · Tap again to stop</div>
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

      {/* ── HISTORY / LIBRARY ── */}
      {page === "history" && (
        <div className="page">
          <div className="ptitle">Library</div>
          <div className="sbar"><IcoSearch /><input placeholder="Search chats..." value={hSearch} onChange={e => setHSearch(e.target.value)} /></div>
          {histLoad ? <div className="ld">Loading...</div>
            : filtHists.length === 0 ? <div className="welcome"><span style={{ fontSize: 52 }}>📭</span><h2>No history</h2></div>
              : filtHists.map(h => (
                <div key={h.id} className="hcard" onClick={() => loadSession(h)}>
                  <div style={{ fontSize: 18 }}>💬</div>
                  <div className="hi"><div className="ht">{h.title}</div><div className="hm">{fmtDate(h.updatedAt)}</div></div>
                  <button className="dbtn" onClick={e => delSession(h.id, e)}>🗑️</button>
                </div>
              ))}
        </div>
      )}

      {/* ── SETTINGS ── */}
      {page === "settings" && (
        <div className="page">
          {!userData?.premium && (
            <div className="pc" onClick={() => setShowUpgrade(true)}>
              <h3>⭐ Upgrade to Premium</h3><p>₹99/month — Everything unlimited</p>
              <div className="pf">✅ Unlimited Chat & Voice</div>
              <div className="pf">✅ Web Search + Image AI</div>
              <div className="pf">✅ Priority Support</div>
            </div>
          )}

          {/* ACCOUNT */}
          <div className="sec">Account</div>
          <div className="scard">
            <div className="srow" onClick={() => setShowProfile(true)}>
              <div className="pav">
                {pPhotoUrl ? <img src={pPhotoUrl} className="pavimg" alt="" /> : <div className="pavph">{displayName[0]?.toUpperCase()}</div>}
                <div className="paved">📷</div>
              </div>
              <div className="stxt"><div className="slbl">{displayName}</div><div className="sdesc">{user.email}</div></div>
              <div style={{ display: "flex", gap: 5 }}>
                {userData?.premium && <div className="badge">PREMIUM</div>}
                {isAdmin && <div className="badge">ADMIN</div>}
              </div>
            </div>
            <div className="srow"><div className="sicon">📊</div><div className="stxt"><div className="slbl">Usage</div><div className="sdesc">{userData?.premium ? "Unlimited" : chatsLeft + " free messages left"}</div></div></div>
          </div>

          {/* APPEARANCE */}
          <div className="sec">Appearance</div>
          <div className="scard">
            <div className="srow">
              <div className="sicon">🎨</div>
              <div className="stxt"><div className="slbl">Theme</div><div className="sdesc">{theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Blue"}</div></div>
              <div className="theme-grid" style={{ gap: 6, flex: "0 0 auto" }}>
                {[{ k: "dark", bg: "#0f0f0f", label: "🌙" }, { k: "light", bg: "#f5f5f5", label: "☀️" }, { k: "blue", bg: "#0a0f1e", label: "💙" }].map(t => (
                  <button key={t.k} onClick={async () => { setTheme(t.k); await saveSetting("theme", t.k); }} style={{ background: t.bg, border: "2px solid " + (theme === t.k ? accent : "#333"), borderRadius: 10, cursor: "pointer", padding: "6px 10px", fontSize: 14 }}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="srow">
              <div className="sicon">🔤</div>
              <div className="stxt"><div className="slbl">Font Size</div><div className="sdesc">{fontSize}px</div></div>
              <div style={{ display: "flex", gap: 5, flex: "0 0 auto" }}>
                {[12, 14, 16].map(s => (
                  <button key={s} onClick={async () => { setFontSize(s); await saveSetting("fontSize", s); }} style={{ background: fontSize === s ? accent + "18" : "transparent", border: "1px solid " + (fontSize === s ? accent : "#444"), borderRadius: 8, color: fontSize === s ? accent : "#888", cursor: "pointer", padding: "4px 9px", fontFamily: "Inter,sans-serif", fontSize: 12 }}>{s}</button>
                ))}
              </div>
            </div>
            <div className="srow">
              <div className="sicon">🖼️</div>
              <div className="stxt"><div className="slbl">Chat Background</div><div className="sdesc">{chatBg === "gradient" ? "Gradient" : "Default"}</div></div>
              <div className={"tgl" + (chatBg === "gradient" ? " on" : "")} onClick={() => setChatBg(p => p === "gradient" ? "default" : "gradient")}><div className="tk" /></div>
            </div>
          </div>

          {/* ACCENT COLOR */}
          <div className="sec">Accent Color</div>
          <div className="scard">
            <div className="srow" style={{ cursor: "default" }}>
              <div className="accent-grid">
                {ACCENTS.map(c => (
                  <div key={c} className={"accent-dot" + (accent === c ? " sel" : "")} style={{ background: c }} onClick={async () => { setAccent(c); await saveSetting("accent", c); }} />
                ))}
              </div>
            </div>
          </div>

          {/* GENERAL */}
          <div className="sec">General</div>
          <div className="scard">
            <div className="srow">
              <div className="sicon">🌐</div>
              <div className="stxt"><div className="slbl">Language</div><div className="sdesc">Auto-detected (Hindi / English / Hinglish)</div></div>
            </div>
            <div className="srow">
              <div className="sicon">🔔</div>
              <div className="stxt"><div className="slbl">Notifications</div><div className="sdesc">Get updates and reminders</div></div>
              <div className={"tgl" + (notifOn ? " on" : "")} onClick={() => setNotifOn(p => !p)}><div className="tk" /></div>
            </div>
          </div>

          {/* VOICE */}
          <div className="sec">Voice</div>
          <div className="scard">
            <div className="srow">
              <div className="sicon">🔊</div>
              <div className="stxt"><div className="slbl">Voice Output</div><div className="sdesc">Auto-detected from your messages</div></div>
              <div style={{ fontSize: 12, color: accent, fontWeight: 600 }}>{sessionTone === "female" ? "👩 Female" : sessionTone === "male" ? "👨 Male" : "Auto"}</div>
            </div>
            <div className="srow" onClick={() => goPage("voice")}>
              <div className="sicon">🎙️</div>
              <div className="stxt"><div className="slbl">Start Voice Call</div><div className="sdesc">Talk to Saraswati AI</div></div>
            </div>
          </div>

          {/* DATA CONTROLS */}
          <div className="sec">Data Controls</div>
          <div className="scard">
            <div className="srow" onClick={() => { if (window.confirm("Clear all chat messages?")) { setMsgs([]); setSid(Date.now().toString()); } }}>
              <div className="sicon">🗑️</div>
              <div className="stxt"><div className="slbl">Clear Chat</div><div className="sdesc">Remove current chat messages</div></div>
            </div>
            <div className="srow" onClick={exportChat}>
              <div className="sicon">📄</div>
              <div className="stxt"><div className="slbl">Export Chat</div><div className="sdesc">Download as text file</div></div>
            </div>
            <div className="srow" onClick={() => goPage("history")}>
              <div className="sicon">📂</div>
              <div className="stxt"><div className="slbl">Manage Chat History</div><div className="sdesc">View or delete past chats</div></div>
            </div>
          </div>

          {/* SECURITY */}
          <div className="sec">Security</div>
          <div className="scard">
            <div className="srow" onClick={() => { setForgot(false); sendPasswordResetEmail(auth, user.email).then(() => alert("Password reset link sent to " + user.email)).catch(e => alert(e.message)); }}>
              <div className="sicon">🔑</div>
              <div className="stxt"><div className="slbl">Change Password</div><div className="sdesc">Send reset link to your email</div></div>
            </div>
            <div className="srow">
              <div className="sicon">🔐</div>
              <div className="stxt"><div className="slbl">Two-Factor Auth</div><div className="sdesc">Coming soon</div></div>
            </div>
          </div>

          {/* STORAGE */}
          <div className="sec">Storage</div>
          <div className="scard">
            <div className="srow">
              <div className="sicon">💾</div>
              <div className="stxt"><div className="slbl">Chats Stored</div><div className="sdesc">{userData?.usageCount || 0} messages sent in total</div></div>
            </div>
          </div>

          {/* REPORT BUG */}
          <div className="sec">Report Bug</div>
          <div className="scard">
            <div className="srow" onClick={() => window.open("mailto:" + ADMIN_EMAIL + "?subject=Saraswati AI Bug Report")}>
              <div className="sicon">🐞</div>
              <div className="stxt"><div className="slbl">Report a Bug</div><div className="sdesc">Email the developer</div></div>
            </div>
          </div>

          {/* ABOUT */}
          <div className="sec">About</div>
          <div className="scard">
            <div className="srow">
              <div className="sicon">🪷</div>
              <div className="stxt"><div className="slbl">Saraswati AI</div><div className="sdesc">Version 1.0 · Made with ❤️ by Kunal Saraswat</div></div>
            </div>
          </div>

          {/* LOGOUT */}
          <div className="sec">&nbsp;</div>
          <div className="scard">
            <div className="srow" onClick={() => signOut(auth)}>
              <div className="sicon">🚪</div>
              <div className="stxt"><div className="slbl" style={{ color: "#ef4444" }}>Logout</div><div className="sdesc">Sign out of your account</div></div>
            </div>
          </div>
          <div style={{ height: 20 }} />
        </div>
      )}

      {/* ── ADMIN ── */}
      {page === "admin" && isAdmin && (
        <div className="page">
          <div style={{ background: accent + "14", border: "1px solid " + accent, borderRadius: 12, padding: "11px 14px", fontSize: 13, color: accent }}>🛡️ Admin Panel — Hidden from normal users</div>
          <div className="sgrid">
            <div className="sct"><div className="sv">{adminUsers.length}</div><div className="sl">Total Users</div></div>
            <div className="sct"><div className="sv">{adminUsers.filter(u => u.premium).length}</div><div className="sl">Premium</div></div>
            <div className="sct"><div className="sv">₹{adminUsers.filter(u => u.premium).length * 99}</div><div className="sl">Revenue</div></div>
            <div className="sct"><div className="sv">{adminUsers.reduce((s, u) => s + (u.usageCount || 0), 0)}</div><div className="sl">Total Chats</div></div>
          </div>
          <div className="scard" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>NEW USERS — LAST 7 DAYS</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 64, marginTop: 4 }}>
              {adminGraph.map((d, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: 8, color: accent, marginBottom: 2 }}>{d.v > 0 ? d.v : ""}</div>
                  <div style={{ width: "100%", background: accent, borderRadius: "3px 3px 0 0", height: Math.max(d.v === 0 ? 2 : (d.v / maxG) * 50, 2), opacity: d.v === 0 ? .25 : .9 }} />
                  <div style={{ fontSize: 9, color: "#6b7280", marginTop: 3 }}>{d.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="sbar"><IcoSearch /><input placeholder="Search by name or email..." value={aSearch} onChange={e => setASearch(e.target.value)} /></div>
          {aSearch && (
            <div style={{ fontSize: 12, color: "#6b7280" }}>{filtAdminU.length} result{filtAdminU.length !== 1 ? "s" : ""} for "{aSearch}"</div>
          )}
          {adminUsers.some(u => u.premiumPending && !u.premium) && (
            <>
              <div className="sec">Pending Requests ({adminUsers.filter(u => u.premiumPending && !u.premium).length})</div>
              {adminUsers.filter(u => u.premiumPending && !u.premium).map(u => (
                <div key={u.id} className="ucard" style={{ border: "1px solid #eab308" }}>
                  <div className="uav">{u.name?.[0]?.toUpperCase()}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 11, color: "#6b7280" }}>{u.email}</div></div>
                  <button onClick={() => adminToggle(u.id, false)} style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "6px 12px" }}>Approve</button>
                </div>
              ))}
            </>
          )}
          <div className="sec">All Users ({filtAdminU.length})</div>
          {filtAdminU.map(u => (
            <div key={u.id} className="ucard" style={{ flexDirection: "column", alignItems: "stretch", gap: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                {u.photoURL ? <img src={u.photoURL} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} alt="" /> : <div className="uav">{u.name?.[0]?.toUpperCase()}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email} · {u.usageCount || 0} chats</div>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 1 }}>Last active: {fmtDateTime(u.lastActive)}</div>
                </div>
                {u.premium && <div className="badge-g">⭐</div>}
                {u.email === ADMIN_EMAIL && <div className="badge">ADMIN</div>}
                {u.premiumPending && !u.premium && <div className="badge-y">PENDING</div>}
              </div>
              {u.email !== ADMIN_EMAIL && (
                <div style={{ display: "flex", gap: 7 }}>
                  <button onClick={() => viewUserChat(u)} style={{ flex: 1, background: "#3b82f618", border: "1px solid #3b82f6", borderRadius: 8, color: "#3b82f6", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 7 }}>View Chats</button>
                  <button onClick={() => adminToggle(u.id, u.premium)} style={{ flex: 1, background: u.premium ? "#ef444418" : "#22c55e18", border: "1px solid " + (u.premium ? "#ef4444" : "#22c55e"), borderRadius: 8, color: u.premium ? "#ef4444" : "#22c55e", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 7 }}>{u.premium ? "Remove Premium" : "Give Premium"}</button>
                  <button onClick={() => adminDel(u.id)} style={{ background: "#ef444412", border: "1px solid #ef4444", borderRadius: 8, color: "#ef4444", cursor: "pointer", fontSize: 12, padding: "7px 11px" }}>🗑️</button>
                </div>
              )}
            </div>
          ))}
          <div style={{ height: 20 }} />
        </div>
      )}

      {/* MODALS */}
      {showLimit && (
        <div className="mbg" onClick={() => setShowLimit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mi">⏳</div><h3>Free Limit Reached</h3><p>Upgrade to Premium for unlimited access</p>
            <button className="btn btn-p" onClick={() => { setShowLimit(false); setShowUpgrade(true); }}>⭐ Upgrade — ₹99/month</button>
            <button className="btn btn-s" onClick={() => setShowLimit(false)}>Later</button>
          </div>
        </div>
      )}
      {showUpgrade && (
        <div className="mbg" onClick={() => setShowUpgrade(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mi">⭐</div><h3>Saraswati AI Premium</h3><p>₹99/month — Unlimited everything</p>
            <div className="pbox">
              <div style={{ fontSize: 13, fontWeight: 700, color: accent, textAlign: "center" }}>📱 PhonePe / GPay / UPI</div>
              <div className="pnum">{PHONEPAY}</div>
              <div className="pstep">1️⃣ <span>Send ₹99 via PhonePe or GPay</span></div>
              <div className="pstep">2️⃣ <span>Note your UTR or screenshot</span></div>
              <div className="pstep">3️⃣ <span>Tap "Payment Done" below</span></div>
            </div>
            {!payDone ? (
              <button className="btn btn-p" onClick={() => setPayDone(true)}>✅ Payment Done</button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center" }}>Admin will activate within 24 hours</div>
                <button className="btn btn-p" onClick={async () => {
                  await setDoc(doc(db, "users", user.uid), { premiumPending: true, premiumRequestedAt: serverTimestamp() }, { merge: true });
                  setUserData(p => ({ ...p, premiumPending: true }));
                  setShowUpgrade(false); setPayDone(false);
                  alert("✅ Request submitted!");
                }}>Submit Request</button>
              </div>
            )}
            <button className="btn btn-s" onClick={() => { setShowUpgrade(false); setPayDone(false); }}>Cancel</button>
          </div>
        </div>
      )}
      {showProfile && (
        <div className="mbg" onClick={() => setShowProfile(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Profile</h3>
            <input type="file" ref={pPhotoRef} accept="image/*" style={{ display: "none" }} onChange={handlePPhoto} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
              <div className="pav" style={{ cursor: "pointer" }} onClick={() => pPhotoRef.current?.click()}>
                {(pPhoto || pPhotoUrl) ? <img src={pPhoto || pPhotoUrl} className="pavimg" alt="" /> : <div className="pavph">{pName[0]?.toUpperCase() || "?"}</div>}
                <div className="paved">📷</div>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Tap photo to change</div>
            </div>
            <div className="iw"><div className="ilbl">Name</div><input className="inp" placeholder="Your name" value={pName} onChange={e => setPName(e.target.value)} /></div>
            <button className="btn btn-p" onClick={saveProfile} disabled={pSaving}>{pSaving ? "Saving..." : "Save"}</button>
            <button className="btn btn-s" onClick={() => setShowProfile(false)}>Cancel</button>
          </div>
        </div>
      )}
      {aChat && (
        <div className="mbg" onClick={() => setAChat(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>💬 {aChat.user.name}</h3>
            <p style={{ fontSize: 11 }}>{aChat.user.email} · {aChat.user.usageCount || 0} total chats · Last active: {fmtDateTime(aChat.user.lastActive)}</p>
            {aChat.user.email !== ADMIN_EMAIL && (
              <button className="btn" style={{ background: aChat.user.premium ? "#ef444418" : "#22c55e18", border: "1px solid " + (aChat.user.premium ? "#ef4444" : "#22c55e"), color: aChat.user.premium ? "#ef4444" : "#22c55e", fontWeight: 700 }} onClick={() => adminToggle(aChat.user.id, aChat.user.premium)}>
                {aChat.user.premium ? "Remove Premium" : "Give Premium"}
              </button>
            )}

            {/* Sessions including user-deleted */}
            {aChat.sessions && aChat.sessions.length > 0 && (
              <>
                <div className="sec">Chat Sessions ({aChat.sessions.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 130, overflowY: "auto" }}>
                  {aChat.sessions.map(s => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a1a1a08", border: "1px solid #333", borderRadius: 10, padding: "7px 10px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title || "Untitled chat"}</div>
                        <div style={{ fontSize: 10, color: "#6b7280" }}>{fmtDate(s.updatedAt)}{s.deletedByUser ? " · 🗑️ deleted by user (admin can still view)" : ""}</div>
                      </div>
                      <button onClick={() => adminHardDeleteChat(s.id, aChat.user.id)} style={{ background: "#ef444412", border: "1px solid #ef4444", borderRadius: 8, color: "#ef4444", cursor: "pointer", fontSize: 11, padding: "5px 9px", flexShrink: 0 }}>Delete</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="sec">Recent Messages</div>
            {aChatLoad ? <div className="ld">Loading...</div> : (
              <div className="achat">
                {aChat.msgs.length === 0 ? <div style={{ textAlign: "center", color: "#6b7280", fontSize: 13 }}>No messages</div>
                  : aChat.msgs.map((m, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 1 }}>
                      <div style={{ background: m.role === "user" ? accent : "#2a2a2a", color: "#fff", borderRadius: m.role === "user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px", padding: "7px 11px", fontSize: 12, maxWidth: "86%" }}>{m.text?.slice(0, 200)}{m.text?.length > 200 ? "..." : ""}</div>
                      <div style={{ fontSize: 9, color: "#6b7280" }}>{m.role === "user" ? "User" : "AI"} · {fmtTime(m.createdAt)}</div>
                    </div>
                  ))}
              </div>
            )}
            <button className="btn btn-s" onClick={() => setAChat(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
