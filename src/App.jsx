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
const ACCENT_COLORS = [
  { name: "Orange", value: "#f97316" },
  { name: "Blue",   value: "#3b82f6" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Green",  value: "#22c55e" },
  { name: "Pink",   value: "#ec4899" },
  { name: "Red",    value: "#ef4444" },
];

// ── COMPRESS IMAGE ───────────────────────────────────────────────
function compressImage(dataUrl, maxW = 180, quality = 0.55) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = img.width * scale; c.height = img.height * scale;
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
  const canPrev = ["html","css","js","javascript",""].includes((lang || "").toLowerCase());
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

// ── ICONS ─────────────────────────────────────────────────────────
const IcoSpeak = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>;
const IcoStop = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>;
const IcoCopy = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
const IcoOk = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const IcoShare = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>;
const IcoMic = ({ on }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="11" rx="3" fill={on ? "#ef4444" : "currentColor"} stroke="none" /><path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" /><line x1="12" y1="18" x2="12" y2="22" strokeLinecap="round" /><line x1="8" y1="22" x2="16" y2="22" strokeLinecap="round" /></svg>;
const IcoImg = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" /><path d="m21 15-5-5L5 21" /></svg>;
const IcoSearch = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const IcoClose = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;

// ── THEME COLORS ──────────────────────────────────────────────────
const THEMES = {
  dark:  { bg: "#0f0f0f", sf: "#1a1a1a", sf2: "#222", bd: "#2a2a2a", tx: "#f5f5f5", mt: "#6b7280", bub: "#1e1e1e" },
  light: { bg: "#f0f0f0", sf: "#ffffff", sf2: "#f5f5f5", bd: "#e0e0e0", tx: "#111111", mt: "#888",   bub: "#ffffff" },
  blue:  { bg: "#0a0f1e", sf: "#111827", sf2: "#1f2937", bd: "#374151", tx: "#f0f4ff", mt: "#6b7280", bub: "#1e2a3a" },
};

// ── BUILD CSS ─────────────────────────────────────────────────────
function buildCSS(theme, fontSize, accent) {
  const v = THEMES[theme] || THEMES.dark;
  const dark = theme !== "light";
  const fs = fontSize || 14;
  const ac = accent || "#f97316";
  return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--accent:${ac};}
body{font-family:'Inter',sans-serif;background:${v.bg};color:${v.tx};height:100dvh;overflow:hidden;font-size:${fs}px;}
.app{display:flex;flex-direction:column;height:100dvh;max-width:480px;margin:0 auto;background:${v.bg};position:relative;}

/* SPLASH */
.splash{position:fixed;inset:0;z-index:999;background:#0a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;transition:opacity .5s ease;}
.splash.out{opacity:0;pointer-events:none;}
.slogo{font-size:84px;animation:sP 1.5s ease-in-out infinite;}
@keyframes sP{0%,100%{transform:scale(1);}50%{transform:scale(1.08);}}
.stitle{font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;}
.ssub{font-size:13px;color:#6b7280;}
.sbar-load{width:140px;height:3px;background:#222;border-radius:3px;overflow:hidden;margin-top:8px;}
.sprog{height:100%;background:linear-gradient(90deg,${ac},${ac}cc);border-radius:3px;animation:sLoad 2.2s ease forwards;}
@keyframes sLoad{from{width:0;}to{width:100%;}}

/* SIDEBAR OVERLAY */
.sb-overlay{position:fixed;inset:0;background:#0009;z-index:90;animation:fadeIn .2s ease;}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
.sidebar{position:fixed;left:0;top:0;bottom:0;width:280px;background:${v.sf};border-right:1px solid ${v.bd};z-index:100;display:flex;flex-direction:column;overflow:hidden;animation:sbIn .22s ease;}
@keyframes sbIn{from{transform:translateX(-100%);}to{transform:translateX(0);}}
.sb-head{padding:20px 18px 14px;display:flex;align-items:center;gap:12px;border-bottom:1px solid ${v.bd};}
.sb-av{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,${ac},${ac}cc);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:18px;flex-shrink:0;}
.sb-info{flex:1;overflow:hidden;}
.sb-name{font-size:15px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sb-email{font-size:11px;color:${v.mt};margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sb-body{flex:1;overflow-y:auto;padding:10px 10px;}
.sb-body::-webkit-scrollbar{width:0;}
.sb-section{font-size:10px;font-weight:700;color:${v.mt};letter-spacing:.1em;text-transform:uppercase;padding:10px 10px 5px;}
.sb-item{display:flex;align-items:center;gap:12px;padding:12px 12px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:500;color:${v.tx};transition:background .15s;width:100%;}
.sb-item:hover{background:${v.sf2};}
.sb-item.active{background:${ac}18;color:${ac};}
.sb-item.red{color:#ef4444;}
.sb-icon{font-size:18px;width:22px;text-align:center;flex-shrink:0;}
.sb-div{height:1px;background:${v.bd};margin:5px 10px;}
.sb-badge{background:linear-gradient(135deg,#f59e0b,${ac});color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:auto;}
.sb-foot{padding:14px 10px;border-top:1px solid ${v.bd};}
.sb-newchat{background:linear-gradient(135deg,${ac},${ac}cc);border:none;border-radius:12px;color:#fff;cursor:pointer;font-family:'Inter',sans-serif;font-size:14px;font-weight:700;padding:13px;width:100%;transition:opacity .2s;}
.sb-newchat:hover{opacity:.9;}

/* RECENT CHATS IN SIDEBAR */
.sb-hcard{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:10px;cursor:pointer;transition:background .15s;}
.sb-hcard:hover{background:${v.sf2};}
.sb-ht{font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
.sb-hd{font-size:10px;color:${v.mt};margin-top:1px;}

/* PWA */
.pwa{position:fixed;bottom:72px;left:10px;right:10px;background:${dark?"#1c1c1c":"#fff"};border:1.5px solid ${ac};border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:10px;z-index:150;box-shadow:0 8px 30px #0009;animation:fadeUp .3s ease;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
.pwa-btn{background:${ac};border:none;border-radius:10px;color:#fff;cursor:pointer;font-size:12px;font-weight:700;padding:7px 13px;font-family:'Inter',sans-serif;}
.pwa-x{background:none;border:none;color:${v.mt};cursor:pointer;font-size:17px;padding:2px 6px;}

/* AUTH */
.auth{flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 24px;gap:18px;}
.auth-logo{font-size:52px;}
.auth-title{font-size:26px;font-weight:800;}
.auth-sub{font-size:13px;color:${v.mt};text-align:center;}
.card{width:100%;background:${v.sf};border:1px solid ${v.bd};border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:13px;}
.card-head{font-size:17px;font-weight:700;text-align:center;}
.iw{display:flex;flex-direction:column;gap:4px;}
.ilbl{font-size:11px;color:${v.mt};font-weight:600;letter-spacing:.05em;text-transform:uppercase;}
.inp{background:${dark?"#111":v.sf2};border:1.5px solid ${v.bd};border-radius:12px;color:${v.tx};font-family:'Inter',sans-serif;font-size:15px;padding:12px 14px;outline:none;width:100%;transition:border-color .2s;}
.inp:focus{border-color:${ac};}
.btn{border:none;border-radius:12px;cursor:pointer;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;padding:13px;transition:all .2s;width:100%;}
.btn-p{background:linear-gradient(135deg,${ac},${ac}cc);color:#fff;}
.btn-p:hover{opacity:.9;}.btn-p:disabled{opacity:.55;cursor:not-allowed;}
.btn-s{background:${v.sf2};color:${v.tx};border:1px solid ${v.bd};}
.link{font-size:13px;color:${v.mt};text-align:center;}.link span{color:${ac};cursor:pointer;font-weight:600;}
.err{color:#ef4444;font-size:13px;text-align:center;background:#ef444414;padding:9px;border-radius:10px;}
.ok{color:#22c55e;font-size:13px;text-align:center;background:#22c55e14;padding:9px;border-radius:10px;}

/* HEADER */
.hdr{display:flex;align-items:center;gap:10px;padding:12px 16px;background:${v.bg};border-bottom:1px solid ${v.bd};flex-shrink:0;position:relative;z-index:20;}
.hdr-name{font-size:17px;font-weight:800;flex:1;letter-spacing:-0.3px;}
.menu-btn{background:none;border:none;color:${v.tx};cursor:pointer;font-size:22px;padding:5px;border-radius:10px;line-height:1;display:flex;align-items:center;justify-content:center;}
.nbtn{background:${v.sf2};border:1px solid ${v.bd};border-radius:10px;color:${v.tx};cursor:pointer;font-size:13px;font-weight:600;padding:7px 13px;}

/* USAGE BAR */
.ubar{display:flex;align-items:center;justify-content:space-between;padding:5px 16px;background:${v.sf};border-bottom:1px solid ${v.bd};font-size:11px;color:${v.mt};flex-shrink:0;}
.upill{background:${v.sf2};border-radius:20px;padding:2px 9px;font-weight:600;}

/* CHAT AREA */
.chat{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;}
.chat::-webkit-scrollbar{width:0;}

/* WELCOME */
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:32px 20px;}
.wlotus{font-size:100px;cursor:pointer;line-height:1;display:block;}
.welcome h2{font-size:28px;font-weight:800;letter-spacing:-0.5px;}
.wsub{font-size:13px;color:${v.mt};max-width:240px;line-height:1.7;}

/* MESSAGES */
.mwrap{display:flex;flex-direction:column;gap:2px;animation:mIn .2s ease;}
@keyframes mIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
.mrow{display:flex;gap:7px;align-items:flex-end;}.mrow.user{flex-direction:row-reverse;}
.bwrap{display:flex;flex-direction:column;max-width:82%;}
.bub{padding:11px 15px;font-size:${fs}px;line-height:1.65;word-break:break-word;}
.bub.user{background:${ac};color:#fff;border-radius:20px 20px 4px 20px;}
.bub.ai{background:${v.bub};color:${v.tx};border:1px solid ${v.bd};border-radius:20px 20px 20px 4px;}
.rbar{display:flex;gap:2px;padding:4px 8px;background:${v.sf};border:1px solid ${v.bd};border-radius:24px;position:absolute;top:-42px;left:0;z-index:10;box-shadow:0 4px 16px #0007;animation:ddIn .15s;}
@keyframes ddIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
.rbtn{background:none;border:none;cursor:pointer;font-size:20px;padding:2px 4px;border-radius:8px;transition:transform .12s;}.rbtn:hover{transform:scale(1.3);}
.react{font-size:16px;padding-left:4px;margin-top:2px;}
.acts{display:flex;gap:4px;padding:3px 2px 0;flex-wrap:wrap;}
.abtn{background:none;border:1px solid ${v.bd};color:${v.mt};cursor:pointer;padding:4px 7px;border-radius:20px;display:flex;align-items:center;justify-content:center;transition:all .15s;line-height:1;}
.abtn:hover{color:${ac};border-color:${ac};}
.abtn.on{color:${ac};border-color:${ac};background:${ac}14;}
.abtn svg{display:block;}
.mtime{font-size:10px;color:${v.mt};padding:0 3px;}.mtime.user{text-align:right;}
.aiav{width:27px;height:27px;border-radius:50%;background:linear-gradient(135deg,${ac},${ac}cc);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
.tbub{background:${v.bub};border:1px solid ${v.bd};border-radius:20px 20px 20px 4px;padding:13px 17px;display:flex;gap:5px;}
.dot{width:6px;height:6px;border-radius:50%;background:${ac};animation:bou 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}.dot:nth-child(3){animation-delay:.4s;}
@keyframes bou{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-5px);}}
.sind{font-size:11px;color:${ac};padding:4px 10px;background:${ac}14;border-radius:20px;display:inline-flex;align-items:center;gap:4px;}
.mimg{max-width:200px;border-radius:12px;margin-bottom:4px;display:block;}
.mimg.gen{width:240px;max-width:100%;border-radius:14px;}

/* INPUT BAR */
.ibar{padding:9px 13px;border-top:1px solid ${v.bd};background:${v.bg};display:flex;gap:7px;align-items:flex-end;flex-shrink:0;}
.tinp{flex:1;background:${v.sf};border:1.5px solid ${v.bd};border-radius:24px;color:${v.tx};font-family:'Inter',sans-serif;font-size:${fs}px;padding:11px 17px;outline:none;resize:none;max-height:110px;min-height:46px;transition:border-color .2s;line-height:1.5;}
.tinp:focus{border-color:${ac};}.tinp::placeholder{color:${v.mt};}
.sbtn{background:linear-gradient(135deg,${ac},${ac}cc);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:18px;width:46px;height:46px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .15s;}
.sbtn:hover{transform:scale(1.05);}.sbtn:disabled{opacity:.4;cursor:not-allowed;}
.ibtn{background:${v.sf2};border:1.5px solid ${v.bd};border-radius:50%;color:${v.tx};cursor:pointer;width:42px;height:42px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;}
.ibtn:hover{border-color:${ac};}
.ibtn.rec{border-color:#ef4444;background:#ef444418;animation:mP 1s infinite;}
@keyframes mP{0%,100%{box-shadow:0 0 0 0 #ef444438;}50%{box-shadow:0 0 0 5px transparent;}}
.imgprev{position:relative;display:inline-block;margin-bottom:7px;}
.imgprev img{width:72px;height:72px;object-fit:cover;border-radius:12px;border:2px solid ${ac};}
.imgprev-x{position:absolute;top:-5px;right:-5px;background:#ef4444;border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:11px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;}

/* PAGES */
.page{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:10px;}
.page::-webkit-scrollbar{width:0;}
.ptitle{font-size:20px;font-weight:800;margin-bottom:2px;}
.sbar-search{display:flex;align-items:center;background:${v.sf};border:1.5px solid ${v.bd};border-radius:12px;padding:8px 13px;gap:7px;margin-bottom:3px;}
.sbar-search input{flex:1;background:none;border:none;outline:none;color:${v.tx};font-size:14px;font-family:'Inter',sans-serif;}
.hcard{background:${v.sf};border:1px solid ${v.bd};border-radius:14px;padding:13px 15px;display:flex;align-items:center;gap:11px;cursor:pointer;transition:border-color .2s;}
.hcard:hover{border-color:${ac};}
.hi{flex:1;overflow:hidden;}
.ht{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hm{font-size:11px;color:${v.mt};margin-top:2px;}
.dbtn{background:none;border:none;color:${v.mt};cursor:pointer;font-size:18px;padding:3px 6px;border-radius:8px;}
.dbtn:hover{color:#ef4444;}

/* SETTINGS */
.scard{background:${v.sf};border:1px solid ${v.bd};border-radius:16px;overflow:hidden;margin-bottom:3px;}
.srow{display:flex;align-items:center;gap:13px;padding:14px 16px;border-bottom:1px solid ${v.bd};cursor:pointer;transition:background .15s;}
.srow:last-child{border-bottom:none;}
.srow:hover{background:${v.sf2};}
.sicon{font-size:20px;width:26px;text-align:center;flex-shrink:0;}
.stxt{flex:1;min-width:0;}
.slbl{font-size:14px;font-weight:600;}
.sdesc{font-size:12px;color:${v.mt};margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sec{font-size:11px;font-weight:700;color:${v.mt};letter-spacing:.08em;text-transform:uppercase;margin:14px 0 6px 2px;}
.badge{background:linear-gradient(135deg,#f59e0b,${ac});color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
.badge-g{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
.badge-y{background:linear-gradient(135deg,#eab308,#ca8a04);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
.pc{background:linear-gradient(135deg,${ac},${ac}cc);border-radius:18px;padding:18px;margin-bottom:4px;cursor:pointer;}
.pc h3{font-size:18px;font-weight:800;color:#fff;}.pc p{font-size:13px;color:#fff9;margin-top:3px;}
.pf{font-size:13px;color:#fff;display:flex;align-items:center;gap:7px;margin-top:5px;}
.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
.sct{background:${v.sf};border:1px solid ${v.bd};border-radius:14px;padding:16px;}
.sv{font-size:26px;font-weight:800;color:${ac};}.sl{font-size:12px;color:${v.mt};margin-top:2px;}
.ucard{background:${v.sf};border:1px solid ${v.bd};border-radius:12px;padding:11px 13px;display:flex;align-items:center;gap:11px;}
.uav{width:35px;height:35px;border-radius:50%;background:linear-gradient(135deg,${ac},${ac}cc);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px;flex-shrink:0;}

/* TOGGLE */
.tgl{position:relative;width:44px;height:24px;background:${v.sf2};border-radius:12px;cursor:pointer;border:2px solid ${v.bd};transition:background .2s;flex-shrink:0;}
.tgl.on{background:${ac};border-color:${ac};}
.tk{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;}
.tgl.on .tk{left:22px;}

/* ACCENT PICKER */
.accent-grid{display:flex;gap:8px;flex-wrap:wrap;padding:4px 0;}
.ac-dot{width:32px;height:32px;border-radius:50%;cursor:pointer;transition:transform .15s;border:3px solid transparent;}
.ac-dot:hover{transform:scale(1.15);}
.ac-dot.sel{border-color:#fff;box-shadow:0 0 0 2px var(--accent);}

/* PROFILE */
.pav{position:relative;display:inline-block;}
.pavimg{width:68px;height:68px;border-radius:50%;object-fit:cover;border:3px solid ${ac};}
.pavph{width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,${ac},${ac}cc);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:#fff;}
.paved{position:absolute;bottom:0;right:0;background:${ac};border-radius:50%;width:21px;height:21px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;}

/* MODAL */
.mbg{position:fixed;inset:0;background:#000c;z-index:200;display:flex;align-items:flex-end;padding:14px;}
.modal{background:${v.sf};border-radius:24px 24px 16px 16px;padding:26px 22px;width:100%;max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:13px;max-height:88vh;overflow-y:auto;}
.modal h3{font-size:20px;font-weight:700;text-align:center;}
.modal p{font-size:13px;color:${v.mt};text-align:center;line-height:1.6;}
.mi{font-size:50px;text-align:center;}
.pbox{background:${v.sf2};border:1px solid ${v.bd};border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:9px;}
.pnum{font-size:22px;font-weight:800;color:${ac};text-align:center;letter-spacing:2px;}
.pstep{font-size:13px;color:${v.tx};display:flex;gap:7px;}
.ld{text-align:center;color:${v.mt};padding:20px;font-size:14px;}

/* VOICE CALL PAGE */
.vpage{display:flex;flex-direction:column;height:100%;background:${dark?"#080808":v.bg};}
.vbody{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:24px 20px;overflow-y:auto;}
.vcaller-card{background:${dark?"#141414":v.sf};border:1px solid ${v.bd};border-radius:28px;padding:32px 28px;display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;max-width:340px;}
.vorb-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:150px;height:150px;}
.vring{position:absolute;border-radius:50%;pointer-events:none;}
.vr1{animation:vra 2s ease-out infinite;background:${ac}20;}
.vr2{animation:vra 2s ease-out .5s infinite;background:${ac}10;}
@keyframes vra{0%{width:94px;height:94px;opacity:.9;}100%{width:165px;height:165px;opacity:0;}}
.vorb{width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,${ac},${ac}cc);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;position:relative;font-size:40px;box-shadow:0 8px 32px ${ac}48;transition:all .25s;}
.vorb:hover{transform:scale(1.04);}
.vorb.listen{background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 0 0 12px #ef444422;animation:orbP 1s infinite;}
.vorb.speak{background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 8px 32px #22c55e55;}
.vorb.think{background:linear-gradient(135deg,#8b5cf6,#6d28d9);box-shadow:0 8px 32px #8b5cf650;}
@keyframes orbP{0%,100%{transform:scale(1);}50%{transform:scale(1.06);}}
.vstatus{font-size:16px;font-weight:700;text-align:center;}
.vsub{font-size:12px;color:${v.mt};text-align:center;}
.vwave{display:flex;align-items:center;gap:3px;height:28px;}
.wb{width:3px;border-radius:3px;background:#22c55e;animation:wv .9s ease-in-out infinite;}
@keyframes wv{0%,100%{height:5px;opacity:.5;}50%{height:24px;opacity:1;}}
.vlast{width:100%;background:${v.sf2};border-radius:14px;padding:12px 14px;}
.vendbtn{background:#ef444418;border:1.5px solid #ef4444;border-radius:14px;color:#ef4444;cursor:pointer;font-size:14px;font-weight:700;padding:13px 36px;font-family:'Inter',sans-serif;transition:background .2s;}
.vendbtn:hover{background:#ef444428;}

/* ADMIN */
.achat{max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:7px;padding:7px;background:${v.sf2};border-radius:12px;}
.achat::-webkit-scrollbar{width:0;}
`;
}

// ── APP ───────────────────────────────────────────────────────────
export default function App() {
  const [splash, setSplash] = useState(true);
  const [splashOut, setSplashOut] = useState(false);
  const [pwaEvt, setPwaEvt] = useState(null);
  const [showPwa, setShowPwa] = useState(false);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [forgot, setForgot] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", pass: "" });
  const [ferr, setFerr] = useState(""); const [fok, setFok] = useState(""); const [fload, setFload] = useState(false);
  // theme & accent
  const [theme, setTheme] = useState("dark");
  const [fontSize, setFontSize] = useState(14);
  const [accentColor, setAccentColor] = useState("#f97316");
  const [chatBg, setChatBg] = useState("default");
  // app
  const [page, setPage] = useState("chat");
  const [userData, setUserData] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sessionTone, setSessionTone] = useState(null);
  // chat
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
  // voice
  const [vs, setVs] = useState("idle");
  const [vSpeed] = useState(0.9);
  const [vLast, setVLast] = useState("");
  // settings sections
  const [showAbout, setShowAbout] = useState(false);

  const bottomRef = useRef(null);
  const galleryRef = useRef(null);
  const pPhotoRef = useRef(null);
  const micRef = useRef(null);
  const voiceRef = useRef(null);
  const micPermRef = useRef(false); // track if mic permission already granted

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

  // Pre-request mic permission once on mount (silent) — avoids repeated popups
  useEffect(() => {
    if (!micPermRef.current && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => { stream.getTracks().forEach(t => t.stop()); micPermRef.current = true; })
        .catch(() => {}); // user may deny; handled gracefully when they actually tap mic
    }
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
          if (data.accentColor) setAccentColor(data.accentColor);
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
      // admin sees ALL messages including user-deleted ones (archived flag)
      let m2 = [];
      try {
        const q = query(collection(db, "messages"), where("userId", "==", u.id), orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(q);
        // admin sees all — even user-soft-deleted
        m2 = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
      } catch {
        const q2 = query(collection(db, "messages"), where("userId", "==", u.id));
        const s2 = await getDocs(q2);
        m2 = s2.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)).slice(-50);
      }
      setAChat({ user: u, msgs: m2 });
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
        await setDoc(doc(db, "users", c.user.uid), { name: form.name, email: form.email, premium: false, createdAt: serverTimestamp(), usageCount: 0 });
        setUserData({ name: form.name, email: form.email, premium: false, usageCount: 0 });
        setPName(form.name);
      } else {
        await signInWithEmailAndPassword(auth, form.email, form.pass);
        const d = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (d.exists()) { const data = d.data(); setUserData(data); if (data.theme) setTheme(data.theme); if (data.accentColor) setAccentColor(data.accentColor); }
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
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    const r = new FileReader();
    r.onload = ev => { const d = ev.target.result; setImgB64(d.split(",")[1]); setImgPrev(d); };
    r.onerror = () => alert("Could not load image.");
    r.readAsDataURL(file);
  }

  function handlePPhoto(e) {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    const r = new FileReader();
    r.onload = ev => setPPhoto(ev.target.result);
    r.readAsDataURL(file);
  }

  // MIC — smooth one-time permission
  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Use Chrome or Edge for voice input."); return; }
    if (micActive) { micRef.current?.stop(); setMicActive(false); return; }
    const r = new SR();
    r.lang = "hi-IN"; r.continuous = false; r.interimResults = false;
    r.onstart = () => setMicActive(true);
    r.onresult = e => { const t = e.results[0][0].transcript; if (t) setInput(p => p ? p + " " + t : t); };
    r.onerror = err => {
      if (err.error === "not-allowed") {
        alert("Please allow microphone access in your browser settings.");
      }
      setMicActive(false);
    };
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
      const det = detectTone(transcript);
      if (det) setSessionTone(det);
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
      await setDoc(doc(db, "users", user.uid), { usageCount: nc }, { merge: true });
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

  // SEND MESSAGE — soft delete: user sees clear, but admin db keeps copy
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
    const uRef = await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "user", text: msgText, image: prev || null, createdAt: serverTimestamp(), deletedByUser: false });
    const newMsgs = [...msgs, { id: uRef.id, role: "user", text: msgText, image: prev, time: new Date() }];
    setMsgs(newMsgs);
    const isFirst = msgs.length === 0;
    const title = isFirst ? await generateTitle(msgText) : undefined;
    await setDoc(doc(db, "chats", sid), { userId: user.uid, ...(title ? { title } : { title: msgText.slice(0, 38) }), updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
    const nc = (ud?.usageCount || 0) + 1;
    await setDoc(doc(db, "users", user.uid), { usageCount: nc }, { merge: true });
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
      await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "ai", text: aiText, image: url, createdAt: serverTimestamp(), deletedByUser: false });
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
      await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "ai", text: aiText, createdAt: serverTimestamp(), deletedByUser: false });
    } catch (e) { setSearching(false); setLoading(false); setMsgs(p => [...p, { id: Date.now(), role: "ai", text: "❌ Error: " + e.message, time: new Date() }]); }
  }

  async function loadSession(s) {
    try {
      setPage("chat"); setSid(s.id); setMsgs([]);
      // user only sees non-deleted messages
      const q = query(collection(db, "messages"), where("sessionId", "==", s.id));
      const snap = await getDocs(q);
      setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data(), time: d.data().createdAt }))
        .filter(m => !m.deletedByUser)
        .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));
    } catch (e) { alert("Error: " + e.message); }
  }

  // User delete: soft delete — only hides from user, admin still sees
  async function delSession(id, e) {
    e.stopPropagation();
    // Mark all messages in session as deletedByUser
    try {
      const q = query(collection(db, "messages"), where("sessionId", "==", id));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => updateDoc(doc(db, "messages", d.id), { deletedByUser: true })));
    } catch {}
    // Remove from chats list for user
    await setDoc(doc(db, "chats", id), { deletedByUser: true }, { merge: true });
    setHists(p => p.filter(h => h.id !== id));
  }

  async function adminToggle(uid, cur) {
    await updateDoc(doc(db, "users", uid), { premium: !cur, premiumPending: false });
    setAdminUsers(p => p.map(u => u.id === uid ? { ...u, premium: !cur } : u));
  }

  async function adminPermDelete(uid) {
    if (!window.confirm("Permanently delete this user and all their data?")) return;
    // Permanently delete messages
    try {
      const q = query(collection(db, "messages"), where("userId", "==", uid));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "messages", d.id))));
    } catch {}
    await deleteDoc(doc(db, "users", uid));
    setAdminUsers(p => p.filter(u => u.id !== uid));
  }

  function newChat() { setSid(Date.now().toString()); setMsgs([]); setPage("chat"); setShowSidebar(false); setImgB64(null); setImgPrev(null); endVoice(); setReactions({}); setSessionTone(null); }

  const isAdmin = user?.email === ADMIN_EMAIL;
  const chatsLeft = userData?.premium ? null : Math.max(0, FREE_LIMIT - (userData?.usageCount || 0));
  const displayName = userData?.name || user?.displayName || "User";
  const filtHists = hists.filter(h => (h.title || "").toLowerCase().includes(hSearch.toLowerCase()));
  const filtAdminU = adminUsers.filter(u => (u.name || "").toLowerCase().includes(aSearch.toLowerCase()) || (u.email || "").toLowerCase().includes(aSearch.toLowerCase()));
  const adminGraph = Array.from({ length: 7 }, (_, i) => {
    const v = adminUsers.filter(u => { if (!u.createdAt?.seconds) return false; return Math.floor((Date.now() - u.createdAt.seconds * 1000) / 86400000) === (6 - i); }).length;
    return { l: ["M","T","W","T","F","S","S"][i], v };
  });
  const maxG = Math.max(...adminGraph.map(d => d.v), 1);
  const vOrbIcon = vs === "listen" ? "🎙️" : vs === "think" ? "🤔" : vs === "speak" ? "🔊" : "🪷";
  const vStatusTxt = { idle: "Tap to speak", listen: "Listening...", think: "Thinking...", speak: "Speaking..." }[vs];

  if (!authReady) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", background: "#0a0a0a" }}>
      <style>{buildCSS("dark", 14, "#f97316")}</style>
      <span style={{ fontSize: 56 }}>🪷</span>
      <div style={{ marginTop: 10, color: "#6b7280", fontSize: 14 }}>Loading...</div>
    </div>
  );

  if (!user) return (
    <div className="app">
      <style>{buildCSS(theme, fontSize, accentColor)}</style>
      {splash && <div className={`splash${splashOut ? " out" : ""}`}><span className="slogo">🪷</span><div className="stitle">Saraswati AI</div><div className="ssub">Your intelligent AI assistant</div><div className="sbar-load"><div className="sprog" /></div></div>}
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
              {authMode === "login" && <div className="link" style={{ color: accentColor, cursor: "pointer", fontWeight: 600 }} onClick={() => { setForgot(true); setFerr(""); setFok(""); }}>Forgot password?</div>}
            </>
          )}
        </div>
        {!forgot && <div className="link">{authMode === "login" ? <>No account? <span onClick={() => { setAuthMode("signup"); setFerr(""); }}>Sign up</span></> : <>Have account? <span onClick={() => { setAuthMode("login"); setFerr(""); }}>Login</span></>}</div>}
      </div>
    </div>
  );

  return (
    <div className="app" onClick={() => { showRx && setShowRx(null); }}>
      <style>{buildCSS(theme, fontSize, accentColor)}</style>
      {splash && <div className={`splash${splashOut ? " out" : ""}`}><span className="slogo">🪷</span><div className="stitle">Saraswati AI</div><div className="ssub">Welcome, {displayName}!</div><div className="sbar-load"><div className="sprog" /></div></div>}

      {/* ── SIDEBAR ── */}
      {showSidebar && (
        <>
          <div className="sb-overlay" onClick={() => setShowSidebar(false)} />
          <div className="sidebar">
            {/* Profile head */}
            <div className="sb-head">
              {pPhotoUrl
                ? <img src={pPhotoUrl} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: `2px solid ${accentColor}`, flexShrink: 0 }} alt="" />
                : <div className="sb-av">{displayName[0]?.toUpperCase()}</div>
              }
              <div className="sb-info">
                <div className="sb-name">{displayName}</div>
                <div className="sb-email">{user.email}</div>
                {userData?.premium && <div style={{ marginTop: 4 }}><span className="badge">⭐ Premium</span></div>}
              </div>
              <button style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 4 }} onClick={() => setShowSidebar(false)}><IcoClose /></button>
            </div>

            <div className="sb-body">
              {/* Main nav */}
              <div className="sb-section">Menu</div>
              <button className={`sb-item${page === "chat" ? " active" : ""}`} onClick={() => { setPage("chat"); setShowSidebar(false); }}>
                <span className="sb-icon">💬</span> Chat
              </button>
              <button className={`sb-item${page === "voice" ? " active" : ""}`} onClick={() => { setPage("voice"); setShowSidebar(false); }}>
                <span className="sb-icon">🎙️</span> Voice Call
              </button>
              <button className={`sb-item${page === "history" ? " active" : ""}`} onClick={() => { setPage("history"); setShowSidebar(false); }}>
                <span className="sb-icon">📂</span> Library
              </button>

              <div className="sb-div" />
              <div className="sb-section">Tools</div>
              <button className="sb-item" onClick={() => { setPage("chat"); setShowSidebar(false); setInput("Ek image banao: "); }}>
                <span className="sb-icon">🎨</span> Image Generator
              </button>
              <button className="sb-item" onClick={() => { setPage("chat"); setShowSidebar(false); setInput("Mandi rates batao aaj ke "); }}>
                <span className="sb-icon">🌾</span> Mandi Rates
              </button>
              <button className="sb-item" onClick={() => { setPage("chat"); setShowSidebar(false); setInput("Gold rate today "); }}>
                <span className="sb-icon">💰</span> Live Rates
              </button>

              <div className="sb-div" />
              <div className="sb-section">Account</div>
              <button className={`sb-item${page === "settings" ? " active" : ""}`} onClick={() => { setPage("settings"); setShowSidebar(false); }}>
                <span className="sb-icon">⚙️</span> Settings
              </button>
              {isAdmin && (
                <button className={`sb-item${page === "admin" ? " active" : ""}`} onClick={() => { setPage("admin"); setShowSidebar(false); }}>
                  <span className="sb-icon">🛡️</span> Admin Panel <span className="sb-badge" style={{ marginLeft: "auto" }}>Admin</span>
                </button>
              )}
              {!userData?.premium && (
                <button className="sb-item" onClick={() => { setShowUpgrade(true); setShowSidebar(false); }}>
                  <span className="sb-icon">⭐</span> Upgrade Premium
                </button>
              )}

              {/* Recent chats */}
              {hists.length > 0 && (
                <>
                  <div className="sb-div" />
                  <div className="sb-section">Recent Chats</div>
                  {hists.slice(0, 6).map(h => (
                    <div key={h.id} className="sb-hcard" onClick={() => { loadSession(h); setShowSidebar(false); }}>
                      <span style={{ fontSize: 14 }}>💬</span>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div className="sb-ht">{h.title || "Chat"}</div>
                        <div className="sb-hd">{fmtDate(h.updatedAt)}</div>
                      </div>
                    </div>
                  ))}
                  <button className="sb-item" onClick={() => { setPage("history"); setShowSidebar(false); }}>
                    <span className="sb-icon">📋</span> View All
                  </button>
                </>
              )}

              <div className="sb-div" />
              <button className="sb-item red" onClick={() => signOut(auth)}>
                <span className="sb-icon">🚪</span> Logout
              </button>
              <div style={{ height: 8 }} />
            </div>

            <div className="sb-foot">
              <button className="sb-newchat" onClick={newChat}>✏️ New Chat</button>
            </div>
          </div>
        </>
      )}

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
        <button className="menu-btn" onClick={e => { e.stopPropagation(); setShowSidebar(v => !v); }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <span style={{ fontSize: 22 }}>🪷</span>
        <div className="hdr-name">Saraswati AI</div>
        {page === "chat" && <button className="nbtn" onClick={newChat}>+ New</button>}
        {page === "voice" && <button className="nbtn" style={{ background: "#ef444418", borderColor: "#ef4444", color: "#ef4444" }} onClick={() => { endVoice(); setPage("chat"); }}>End Call</button>}
      </div>

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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
                  {["Kuch samjhao mujhe 🎓","Image banao 🎨","Mandi rates 🌾","Code likhdo 💻"].map(s => (
                    <button key={s} onClick={() => sendMsg(s.split(" ").slice(0,-1).join(" "))} style={{ background: "transparent", border: `1px solid ${accentColor}44`, borderRadius: 20, color: "#9ca3af", cursor: "pointer", fontSize: 12, fontFamily: "Inter,sans-serif", padding: "7px 13px" }}>{s}</button>
                  ))}
                </div>
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
              {vs === "speak" && <div className="vwave">{[0,1,2,3,4].map(i => <div key={i} className="wb" style={{ animationDelay: `${i * 0.1}s` }} />)}</div>}
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

      {/* ── HISTORY ── */}
      {page === "history" && (
        <div className="page">
          <div className="ptitle">Library</div>
          <div className="sbar-search"><IcoSearch /><input placeholder="Search chats..." value={hSearch} onChange={e => setHSearch(e.target.value)} /></div>
          {histLoad ? <div className="ld">Loading...</div>
            : filtHists.length === 0 ? (
              <div className="welcome"><span style={{ fontSize: 52 }}>📭</span><h2>No history</h2><p className="wsub">Start a chat to see history here</p></div>
            ) : filtHists.map(h => (
              <div key={h.id} className="hcard" onClick={() => loadSession(h)}>
                <div style={{ fontSize: 18 }}>💬</div>
                <div className="hi"><div className="ht">{h.title}</div><div className="hm">{fmtDate(h.updatedAt)}</div></div>
                <button className="dbtn" onClick={e => delSession(h.id, e)} title="Delete from history">🗑️</button>
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
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {userData?.premium && <div className="badge">PREMIUM</div>}
                {isAdmin && <div className="badge">ADMIN</div>}
              </div>
            </div>
            <div className="srow"><div className="sicon">📊</div><div className="stxt"><div className="slbl">Usage</div><div className="sdesc">{userData?.premium ? "Unlimited messages" : chatsLeft + " free messages left"}</div></div></div>
            {!userData?.premium && (
              <div className="srow" onClick={() => setShowUpgrade(true)}>
                <div className="sicon">⭐</div><div className="stxt"><div className="slbl">Upgrade to Premium</div><div className="sdesc">₹99/month — Unlimited access</div></div>
                <span style={{ fontSize: 13, color: accentColor, fontWeight: 600 }}>→</span>
              </div>
            )}
          </div>

          {/* APPEARANCE */}
          <div className="sec">Appearance</div>
          <div className="scard">
            <div className="srow">
              <div className="sicon">🎨</div>
              <div className="stxt"><div className="slbl">Theme</div></div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{k:"dark",bg:"#0f0f0f",label:"🌙"},{k:"light",bg:"#f0f0f0",label:"☀️"},{k:"blue",bg:"#0a0f1e",label:"💙"}].map(t => (
                  <button key={t.k} onClick={async () => { setTheme(t.k); await saveSetting("theme", t.k); }} style={{ background: t.bg, border: "2px solid " + (theme === t.k ? accentColor : "#333"), borderRadius: 10, cursor: "pointer", padding: "6px 10px", fontSize: 14 }}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="srow">
              <div className="sicon">🔤</div>
              <div className="stxt"><div className="slbl">Font Size</div><div className="sdesc">{fontSize}px</div></div>
              <div style={{ display: "flex", gap: 5 }}>
                {[12,14,16].map(s => (
                  <button key={s} onClick={async () => { setFontSize(s); await saveSetting("fontSize", s); }} style={{ background: fontSize === s ? accentColor + "18" : "transparent", border: "1px solid " + (fontSize === s ? accentColor : "#444"), borderRadius: 8, color: fontSize === s ? accentColor : "#888", cursor: "pointer", padding: "4px 9px", fontFamily: "Inter,sans-serif", fontSize: 12 }}>{s}</button>
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
              <div className="sicon">🎨</div>
              <div className="stxt"><div className="slbl">Choose Color</div><div className="sdesc">Personalize your app color</div></div>
            </div>
            <div style={{ padding: "8px 16px 14px" }}>
              <div className="accent-grid">
                {ACCENT_COLORS.map(ac => (
                  <div key={ac.value} className={"ac-dot" + (accentColor === ac.value ? " sel" : "")} style={{ background: ac.value }} onClick={async () => { setAccentColor(ac.value); await saveSetting("accentColor", ac.value); }} title={ac.name} />
                ))}
              </div>
            </div>
          </div>

          {/* VOICE */}
          <div className="sec">Voice</div>
          <div className="scard">
            <div className="srow" style={{ cursor: "default" }}>
              <div className="sicon">🔊</div>
              <div className="stxt"><div className="slbl">Voice Output</div><div className="sdesc">Auto-detected from your messages</div></div>
              <div style={{ fontSize: 12, color: accentColor, fontWeight: 600 }}>{sessionTone === "female" ? "👩 Female" : sessionTone === "male" ? "👨 Male" : "Auto"}</div>
            </div>
            <div className="srow" onClick={() => setPage("voice")}>
              <div className="sicon">🎙️</div>
              <div className="stxt"><div className="slbl">Voice Call</div><div className="sdesc">AI voice conversation</div></div>
              <span style={{ fontSize: 13, color: accentColor, fontWeight: 600 }}>→</span>
            </div>
          </div>

          {/* GENERAL */}
          <div className="sec">General</div>
          <div className="scard">
            <div className="srow" onClick={() => { if (window.confirm("Clear all chat messages?")) { setMsgs([]); setSid(Date.now().toString()); } }}>
              <div className="sicon">🗑️</div>
              <div className="stxt"><div className="slbl">Clear Chat</div><div className="sdesc">Remove current session messages</div></div>
            </div>
            <div className="srow" onClick={exportChat}>
              <div className="sicon">📄</div>
              <div className="stxt"><div className="slbl">Export Chat</div><div className="sdesc">Download as text file</div></div>
            </div>
            <div className="srow" onClick={() => { shareWA(msgs.filter(m => m.role === "ai").pop()?.text || "Check out Saraswati AI!"); }}>
              <div className="sicon">📤</div>
              <div className="stxt"><div className="slbl">Share Chat</div><div className="sdesc">Share last reply on WhatsApp</div></div>
            </div>
          </div>

          {/* DATA CONTROLS */}
          <div className="sec">Data Controls</div>
          <div className="scard">
            <div className="srow" onClick={() => setPage("history")}>
              <div className="sicon">📂</div>
              <div className="stxt"><div className="slbl">Chat History</div><div className="sdesc">View and manage saved chats</div></div>
              <span style={{ fontSize: 13, color: accentColor, fontWeight: 600 }}>→</span>
            </div>
            <div className="srow" style={{ cursor: "default" }}>
              <div className="sicon">🔒</div>
              <div className="stxt"><div className="slbl">Data Storage</div><div className="sdesc">Chats saved securely in Firebase</div></div>
            </div>
          </div>

          {/* SECURITY */}
          <div className="sec">Security</div>
          <div className="scard">
            <div className="srow" style={{ cursor: "default" }}>
              <div className="sicon">🔐</div>
              <div className="stxt"><div className="slbl">Account Email</div><div className="sdesc">{user.email}</div></div>
            </div>
            <div className="srow" onClick={async () => { try { await sendPasswordResetEmail(auth, user.email); alert("Password reset email sent!"); } catch {} }}>
              <div className="sicon">🔑</div>
              <div className="stxt"><div className="slbl">Change Password</div><div className="sdesc">Send reset link to your email</div></div>
            </div>
          </div>

          {/* STORAGE */}
          <div className="sec">Storage</div>
          <div className="scard">
            <div className="srow" style={{ cursor: "default" }}>
              <div className="sicon">💾</div>
              <div className="stxt"><div className="slbl">Messages Used</div><div className="sdesc">{userData?.usageCount || 0} messages sent total</div></div>
            </div>
            <div className="srow" style={{ cursor: "default" }}>
              <div className="sicon">☁️</div>
              <div className="stxt"><div className="slbl">Cloud Backup</div><div className="sdesc">All chats backed up to Firebase</div></div>
              <span style={{ fontSize: 11, background: "#22c55e18", color: "#22c55e", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>Active</span>
            </div>
          </div>

          {/* REPORT BUG */}
          <div className="sec">Support</div>
          <div className="scard">
            <div className="srow" onClick={() => window.open("https://wa.me/918126630980?text=Bug+Report+Saraswati+AI:%20", "_blank")}>
              <div className="sicon">🐛</div>
              <div className="stxt"><div className="slbl">Report Bug</div><div className="sdesc">Send feedback via WhatsApp</div></div>
              <span style={{ fontSize: 13, color: accentColor, fontWeight: 600 }}>→</span>
            </div>
          </div>

          {/* ABOUT */}
          <div className="sec">About</div>
          <div className="scard">
            <div className="srow" onClick={() => setShowAbout(true)}>
              <div className="sicon">🪷</div>
              <div className="stxt"><div className="slbl">Saraswati AI</div><div className="sdesc">Version 2.0 — by Kunal Saraswat</div></div>
              <span style={{ fontSize: 13, color: accentColor, fontWeight: 600 }}>→</span>
            </div>
          </div>

          {/* ACCOUNT ACTIONS */}
          <div className="sec">Account</div>
          <div className="scard">
            <div className="srow" onClick={() => signOut(auth)}>
              <div className="sicon">🚪</div>
              <div className="stxt"><div className="slbl" style={{ color: "#ef4444" }}>Logout</div><div className="sdesc">Sign out of your account</div></div>
            </div>
          </div>
          <div style={{ height: 24 }} />
        </div>
      )}

      {/* ── ADMIN ── (hidden — only admin email) */}
      {page === "admin" && isAdmin && (
        <div className="page">
          <div style={{ background: `${accentColor}14`, border: `1px solid ${accentColor}`, borderRadius: 12, padding: "11px 14px", fontSize: 13, color: accentColor }}>🛡️ Admin Panel — Hidden Access</div>
          <div className="sgrid">
            <div className="sct"><div className="sv">{adminUsers.length}</div><div className="sl">Total Users</div></div>
            <div className="sct"><div className="sv">{adminUsers.filter(u => u.premium).length}</div><div className="sl">Premium</div></div>
            <div className="sct"><div className="sv">₹{adminUsers.filter(u => u.premium).length * 99}</div><div className="sl">Revenue</div></div>
            <div className="sct"><div className="sv">{adminUsers.reduce((s, u) => s + (u.usageCount || 0), 0)}</div><div className="sl">Total Chats</div></div>
          </div>
          {/* Graph */}
          <div className="scard" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>NEW USERS — LAST 7 DAYS</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 64, marginTop: 4 }}>
              {adminGraph.map((d, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: 8, color: accentColor, marginBottom: 2 }}>{d.v > 0 ? d.v : ""}</div>
                  <div style={{ width: "100%", background: accentColor, borderRadius: "3px 3px 0 0", height: Math.max(d.v === 0 ? 2 : (d.v / maxG) * 50, 2), opacity: d.v === 0 ? .25 : .9 }} />
                  <div style={{ fontSize: 9, color: "#6b7280", marginTop: 3 }}>{d.l}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Search */}
          <div className="sbar-search"><IcoSearch /><input placeholder="Search by name or email..." value={aSearch} onChange={e => setASearch(e.target.value)} /></div>
          {/* Pending */}
          {adminUsers.some(u => u.premiumPending && !u.premium) && (
            <>
              <div className="sec">Pending Premium Requests ({adminUsers.filter(u => u.premiumPending && !u.premium).length})</div>
              {adminUsers.filter(u => u.premiumPending && !u.premium).map(u => (
                <div key={u.id} className="ucard" style={{ border: "1px solid #eab308" }}>
                  <div className="uav">{u.name?.[0]?.toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                  </div>
                  <button onClick={() => adminToggle(u.id, false)} style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "6px 12px", flexShrink: 0 }}>Approve ✓</button>
                </div>
              ))}
            </>
          )}
          {/* All users */}
          <div className="sec">All Users ({filtAdminU.length})</div>
          {filtAdminU.map(u => (
            <div key={u.id} className="ucard" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                {u.photoURL ? <img src={u.photoURL} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} alt="" /> : <div className="uav">{u.name?.[0]?.toUpperCase()}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{u.email} · {u.usageCount || 0} msgs</div>
                  {u.createdAt && <div style={{ fontSize: 10, color: "#6b7280" }}>Joined {fmtDate(u.createdAt)}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
                  {u.premium && <div className="badge-g">⭐ Premium</div>}
                  {u.email === ADMIN_EMAIL && <div className="badge">ADMIN</div>}
                  {u.premiumPending && !u.premium && <div className="badge-y">PENDING</div>}
                </div>
              </div>
              {u.email !== ADMIN_EMAIL && (
                <div style={{ display: "flex", gap: 7 }}>
                  <button onClick={() => viewUserChat(u)} style={{ flex: 1, background: "#3b82f618", border: "1px solid #3b82f6", borderRadius: 8, color: "#3b82f6", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 8 }}>💬 View Chats</button>
                  <button onClick={() => adminToggle(u.id, u.premium)} style={{ flex: 1, background: u.premium ? "#ef444418" : "#22c55e18", border: "1px solid " + (u.premium ? "#ef4444" : "#22c55e"), borderRadius: 8, color: u.premium ? "#ef4444" : "#22c55e", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 8 }}>{u.premium ? "❌ Remove" : "⭐ Premium"}</button>
                  <button onClick={() => adminPermDelete(u.id)} style={{ background: "#ef444412", border: "1px solid #ef4444", borderRadius: 8, color: "#ef4444", cursor: "pointer", fontSize: 12, padding: "8px 11px" }}>🗑️</button>
                </div>
              )}
            </div>
          ))}
          <div style={{ height: 24 }} />
        </div>
      )}

      {/* ══ MODALS ══ */}
      {showLimit && (
        <div className="mbg" onClick={() => setShowLimit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mi">⏳</div><h3>Free Limit Reached</h3><p>You've used all {FREE_LIMIT} free messages. Upgrade to continue.</p>
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
              <div style={{ fontSize: 13, fontWeight: 700, color: accentColor, textAlign: "center" }}>📱 PhonePe / GPay / UPI</div>
              <div className="pnum">{PHONEPAY}</div>
              <div className="pstep">1️⃣ <span>Send ₹99 via PhonePe or GPay to above number</span></div>
              <div className="pstep">2️⃣ <span>Note your UTR or take a screenshot</span></div>
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
                  alert("✅ Request submitted! Admin will activate within 24 hours.");
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
            <button className="btn btn-p" onClick={saveProfile} disabled={pSaving}>{pSaving ? "Saving..." : "Save Changes"}</button>
            <button className="btn btn-s" onClick={() => setShowProfile(false)}>Cancel</button>
          </div>
        </div>
      )}
      {aChat && (
        <div className="mbg" onClick={() => setAChat(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>💬 {aChat.user.name}</h3>
            <p style={{ fontSize: 11 }}>{aChat.user.email} · {aChat.user.usageCount || 0} total messages · Joined {fmtDate(aChat.user.createdAt)}</p>
            <p style={{ fontSize: 11, color: "#22c55e" }}>Admin view — includes soft-deleted messages</p>
            {aChatLoad ? <div className="ld">Loading...</div> : (
              <div className="achat">
                {aChat.msgs.length === 0 ? <div style={{ textAlign: "center", color: "#6b7280", fontSize: 13, padding: 16 }}>No messages found</div>
                  : aChat.msgs.map((m, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {m.deletedByUser && <span style={{ fontSize: 9, color: "#ef4444", background: "#ef444418", borderRadius: 4, padding: "1px 4px" }}>deleted</span>}
                      </div>
                      <div style={{ background: m.role === "user" ? accentColor : "#2a2a2a", color: "#fff", borderRadius: m.role === "user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px", padding: "7px 11px", fontSize: 12, maxWidth: "86%" }}>{m.text?.slice(0, 200)}{m.text?.length > 200 ? "..." : ""}</div>
                      <div style={{ fontSize: 9, color: "#6b7280" }}>{m.role === "user" ? "User" : "AI"} · {fmtTime(m.createdAt)}</div>
                    </div>
                  ))}
              </div>
            )}
            <button className="btn btn-s" onClick={() => setAChat(null)}>Close</button>
          </div>
        </div>
      )}
      {showAbout && (
        <div className="mbg" onClick={() => setShowAbout(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mi">🪷</div>
            <h3>Saraswati AI</h3>
            <p>Version 2.0 · Built with  by Kunal Saraswat</p>
            <div style={{ background: THEMES[theme]?.sf2 || "#222", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {[["🤖","AI Model","LLaMA 3.3 70B via Groq"],["🔍","Search","Tavily Web Search"],["🔐","Auth","Firebase Authentication"],["☁️","Database","Cloud Firestore"],["🎙️","Voice","Web Speech API"]].map(([icon,label,val]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{val}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-s" onClick={() => setShowAbout(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
ENDOFFILE
echo "Done! File size: $(wc -c < /mnt/user-data/outputs/SaraswatiAI_Final.jsx) bytes"
