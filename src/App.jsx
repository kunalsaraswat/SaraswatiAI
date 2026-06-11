import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, orderBy, getDocs, deleteDoc, serverTimestamp, updateDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── CONFIG ──────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAM-o-ZvEV2T1Efso1oiIC7__PFxh4YCxk",
  authDomain: "saraswatiai-51593.firebaseapp.com",
  projectId: "saraswatiai-51593",
  storageBucket: "saraswatiai-51593.firebasestorage.app",
  messagingSenderId: "352789553358",
  appId: "1:352789553358:web:ce3dcc024a98c96c82f09f"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || "";
const TAVILY_KEY = import.meta.env.VITE_TAVILY_API_KEY || "";
const WEATHER_KEY = import.meta.env.VITE_WEATHER_KEY || "";
const ADMIN_EMAIL = "kunalsaraswat691@gmail.com";
const PHONEPAY = "8126630980";
const FREE_LIMIT = 49;
const REACTIONS = ["👍","❤️","😂","😮","🙏","🔥"];

// ── SOUNDS ──────────────────────────────────────────────────────
function playTypingSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 800 + Math.random() * 400;
    o.type = "sine";
    g.gain.setValueAtTime(0.04, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.05);
  } catch {}
}

function playSendSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [600, 800, 1000].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f; o.type = "sine";
      g.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.12);
      o.start(ctx.currentTime + i * 0.05);
      o.stop(ctx.currentTime + i * 0.05 + 0.12);
    });
  } catch {}
}

// ── WEATHER ─────────────────────────────────────────────────────
async function getWeather(city) {
  if (!WEATHER_KEY) return null;
  try {
    const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_KEY}&units=metric&lang=hi`);
    const d = await r.json();
    if (d.cod !== 200) return null;
    return `🌡️ ${city} mausam: ${Math.round(d.main.temp)}°C, ${d.weather[0].description}, Humidity: ${d.main.humidity}%`;
  } catch { return null; }
}

// ── WEB SEARCH ──────────────────────────────────────────────────
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
  const kw = ["image banao","photo banao","tasveer banao","picture banao","draw","generate image","chitra banao","image generate","tasveer banado","sketch banao","wallpaper banao","logo banao","poster banao"];
  return kw.some(k => text.toLowerCase().includes(k.toLowerCase()));
}
function extractImagePrompt(text) {
  let p = text.toLowerCase();
  ["ek image banao","image banao","photo banao","tasveer banao","picture banao","generate image of","generate image","draw a","draw","sketch banao","tasveer banado","chitra banao","wallpaper banao","logo banao","poster banao","ki","ka","of"].forEach(k => { p = p.split(k).join(" "); });
  return p.trim() || text;
}
function getImageUrl(prompt) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&seed=${Math.floor(Math.random()*100000)}&nologo=true`;
}

// ── HELPERS ──────────────────────────────────────────────────────
function needsSearch(text) {
  return ["news","score","weather","mausam","price","rate","mandi","bhav","today","aaj","sona","gold","chandi","kisan","fasal","2025","2026"].some(k => text.toLowerCase().includes(k));
}
function isOwnerQ(text) {
  return ["kisne banaya","who made","who created","owner","creator","malik","kaun hai tera"].some(k => text.toLowerCase().includes(k));
}
function detectGenderFromVoice(t) {
  const fl = ["behen","didi","aunty","madam","sister","ladki","main ladki"];
  const ml = ["bhai","bhaiya","yaar","dost","bro","ladka","main ladka"];
  const tl = t.toLowerCase();
  const f = fl.filter(w => tl.includes(w)).length;
  const m = ml.filter(w => tl.includes(w)).length;
  return f > m ? "female" : m > f ? "male" : null;
}
function fmtTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
}
function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day:"numeric", month:"short" });
}

// ── AI CALL ──────────────────────────────────────────────────────
async function callAI(messages, imageB64, gender) {
  const last = messages[messages.length - 1];
  if (last?.role === "user" && isOwnerQ(last.text)) return "Mujhe **Kunal Saraswat** ne banaya hai! 😊";
  let ctx = "";
  if (last?.role === "user" && needsSearch(last.text)) {
    const txt = last.text.toLowerCase();
    if ((txt.includes("mausam") || txt.includes("weather")) && WEATHER_KEY) {
      const city = txt.split(" ").find(w => w.length > 3 && !["mausam","weather","aaj","kal"].includes(w)) || "Delhi";
      const w = await getWeather(city);
      if (w) ctx = "\n\nWeather Info: " + w;
    } else {
      const r = await webSearch(last.text);
      if (r) ctx = "\n\nWeb Search:\n" + r;
    }
  }
  const gNote = gender === "female"
    ? "User ek LADKI hai — warm, caring, dost jaisi tone mein baat karo."
    : gender === "male"
    ? "User ek LADKA hai — bhai/dost ki tarah baat karo."
    : "Neutral lekin friendly raho.";
  const sys = `You are Saraswati AI — Goddess of Knowledge, intelligent warm assistant for Indian users.
IDENTITY: Owner → "Mujhe Kunal Saraswat ne banaya hai!" | Never say Groq/Meta/OpenAI.
LANGUAGE: Always reply in user's EXACT language.
PERSONALITY: Warm, friendly, emotional. ${gNote}
KISAN MANDI: Real mandi rates batao — district + crop poochho pehle.
FARMING: Expert — crops, irrigation, fertilizers, PM Kisan, KCC, Fasal Bima.
CODING: Always give complete working code.${ctx}`;
  const content = imageB64
    ? [{ type:"image_url", image_url:{ url:"data:image/jpeg;base64,"+imageB64 } }, { type:"text", text:last.text }]
    : last.text;
  const apiMsgs = [
    ...messages.slice(0,-1).map(m => ({ role:m.role==="user"?"user":"assistant", content:m.text })),
    { role:"user", content }
  ];
  const model = imageB64 ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+GROQ_KEY },
    body:JSON.stringify({ model, messages:[{ role:"system", content:sys }, ...apiMsgs], max_tokens:2048 })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "No response.";
}

// ── TTS ──────────────────────────────────────────────────────────
function speakText(text, gender, speed, onDone) {
  window.speechSynthesis.cancel();
  const clean = text.replace(/```[\s\S]*?```/g,"code block").replace(/\*\*/g,"").replace(/`/g,"").replace(/#+\s/g,"").replace(/[\u{1F300}-\u{1FFFF}]/gu,"").slice(0,800);
  const trySpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    let voice = null;
    if (gender === "female") {
      voice = voices.find(v => /female|woman|girl|zira|heera|priya|aditi/i.test(v.name) && v.lang.startsWith("hi"))
        || voices.find(v => v.lang === "hi-IN")
        || voices.find(v => /female|woman|girl/i.test(v.name))
        || voices[0];
    } else {
      voice = voices.find(v => /male|man|ravi|hemant|prabhat/i.test(v.name) && !/female|woman/i.test(v.name) && v.lang.startsWith("hi"))
        || voices.find(v => v.lang.startsWith("hi"))
        || voices[0];
    }
    const utt = new SpeechSynthesisUtterance(clean);
    if (voice) utt.voice = voice;
    utt.lang = "hi-IN"; utt.rate = speed||0.92;
    utt.pitch = gender==="female"?1.4:0.75; utt.volume = 1;
    utt.onend = onDone||null; utt.onerror = onDone||null;
    window.speechSynthesis.speak(utt);
  };
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged=null; trySpeak(); }; }
  else trySpeak();
}

// ── CODE BLOCK ───────────────────────────────────────────────────
function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const canPrev = ["html","css","js","javascript",""].includes((lang||"").toLowerCase());
  return (
    <div style={{background:"#0d0d0d",border:"1px solid #333",borderRadius:10,margin:"6px 0",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 12px",background:"#1a1a1a",borderBottom:"1px solid #333"}}>
        <span style={{fontSize:11,color:"#6b7280",fontFamily:"monospace"}}>{lang||"code"}</span>
        <div style={{display:"flex",gap:8}}>
          {canPrev&&<button onClick={()=>setPreview(v=>!v)} style={{background:"none",border:"none",color:preview?"#f97316":"#6b7280",cursor:"pointer",fontSize:11,padding:"2px 6px"}}>{preview?"✕":"▶ Preview"}</button>}
          <button onClick={()=>{navigator.clipboard?.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{background:"none",border:"none",color:copied?"#22c55e":"#6b7280",cursor:"pointer",fontSize:11,padding:"2px 6px"}}>{copied?"✓ Copied":"Copy"}</button>
        </div>
      </div>
      <pre style={{padding:"12px",margin:0,overflowX:"auto",fontSize:12,lineHeight:1.6,color:"#e5e7eb",fontFamily:"monospace",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{code}</pre>
      {preview&&canPrev&&(
        <div style={{borderTop:"1px solid #333"}}>
          <div style={{padding:"6px 12px",background:"#1a1a1a",fontSize:11,color:"#f97316"}}>🌐 Live Preview</div>
          <iframe srcDoc={lang==="css"?"<style>"+code+"</style><p>Preview</p>":code} style={{width:"100%",minHeight:300,border:"none",background:"#fff"}} sandbox="allow-scripts" title="p"/>
        </div>
      )}
    </div>
  );
}

// ── AI TEXT RENDERER ─────────────────────────────────────────────
function AIText({ text }) {
  if (!text) return null;
  const parts=[]; const re=/```(\w*)\n?([\s\S]*?)```/g;
  let last=0,m;
  while((m=re.exec(text))!==null){
    if(m.index>last) parts.push({type:"text",content:text.slice(last,m.index)});
    parts.push({type:"code",lang:m[1],content:m[2].trim()});
    last=m.index+m[0].length;
  }
  if(last<text.length) parts.push({type:"text",content:text.slice(last)});
  return (
    <span style={{display:"flex",flexDirection:"column",gap:4}}>
      {parts.map((part,idx)=>{
        if(part.type==="code") return <CodeBlock key={idx} code={part.content} lang={part.lang}/>;
        return part.content.split("\n").map((line,i)=>{
          if(!line.trim()) return <span key={idx+"-"+i} style={{height:6}}/>;
          const segs=line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((s,j)=>{
            if(s.startsWith("**")&&s.endsWith("**")) return <strong key={j}>{s.slice(2,-2)}</strong>;
            if(s.startsWith("`")&&s.endsWith("`")) return <code key={j} style={{background:"#ffffff18",borderRadius:4,padding:"1px 6px",fontFamily:"monospace",fontSize:12}}>{s.slice(1,-1)}</code>;
            return s;
          });
          if(line.trim().startsWith("- ")||line.trim().startsWith("• ")) return <span key={idx+"-"+i} style={{display:"flex",gap:8}}><span style={{color:"#f97316"}}>•</span><span>{segs}</span></span>;
          if(/^\d+\.\s/.test(line.trim())) return <span key={idx+"-"+i} style={{display:"flex",gap:8}}><span style={{color:"#f97316",minWidth:16}}>{line.match(/^\d+/)[0]}.</span><span>{segs}</span></span>;
          if(line.startsWith("### ")) return <strong key={idx+"-"+i} style={{fontSize:15,color:"#f97316"}}>{line.slice(4)}</strong>;
          if(line.startsWith("## ")) return <strong key={idx+"-"+i} style={{fontSize:16,color:"#f97316"}}>{line.slice(3)}</strong>;
          if(line.startsWith("# ")) return <strong key={idx+"-"+i} style={{fontSize:17,color:"#f97316"}}>{line.slice(2)}</strong>;
          return <span key={idx+"-"+i}>{segs}</span>;
        });
      })}
    </span>
  );
}

// ── SVG ICONS ────────────────────────────────────────────────────
const IcoSpeaker = ({size=14,color="currentColor"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);
const IcoStop = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>;
const IcoCopy = ({size=14}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const IcoCheck = ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoShare = ({size=14}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
);
const IcoMic = ({active}) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="2" width="6" height="11" rx="3" fill={active?"#ef4444":"currentColor"} stroke="none"/>
    <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round"/>
    <line x1="12" y1="18" x2="12" y2="22" strokeLinecap="round"/>
    <line x1="8" y1="22" x2="16" y2="22" strokeLinecap="round"/>
  </svg>
);
const IcoImage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
    <path d="m21 15-5-5L5 21"/>
  </svg>
);

// ── CSS ──────────────────────────────────────────────────────────
function buildCSS(dark) {
  const v = dark
    ? {bg:"#0f0f0f",surface:"#1a1a1a",surface2:"#222",border:"#2a2a2a",text:"#f5f5f5",muted:"#6b7280",bubble:"#1e1e1e"}
    : {bg:"#f8f8f8",surface:"#ffffff",surface2:"#f0f0f0",border:"#e0e0e0",text:"#1a1a1a",muted:"#888",bubble:"#ffffff"};
  return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',sans-serif;background:${v.bg};color:${v.text};height:100dvh;overflow:hidden;}
.app{display:flex;flex-direction:column;height:100dvh;max-width:480px;margin:0 auto;background:${v.bg};position:relative;}

/* SPLASH */
.splash{position:fixed;inset:0;background:#0f0f0f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;z-index:999;transition:opacity .6s ease;}
.splash.hide{opacity:0;pointer-events:none;}
.splash-logo{font-size:80px;animation:splashPulse 1.2s ease-in-out infinite;}
@keyframes splashPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.12);}}
.splash-title{font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;}
.splash-sub{font-size:14px;color:#6b7280;}
.splash-bar{width:180px;height:3px;background:#222;border-radius:3px;overflow:hidden;margin-top:8px;}
.splash-progress{height:100%;background:linear-gradient(90deg,#f97316,#ea580c);border-radius:3px;animation:splashLoad 1.8s ease forwards;}
@keyframes splashLoad{from{width:0;}to{width:100%;}}

/* PWA BANNER */
.pwa-banner{position:fixed;bottom:80px;left:12px;right:12px;background:linear-gradient(135deg,#1a1a1a,#222);border:1px solid #f97316;border-radius:16px;padding:14px 16px;display:flex;align-items:center;gap:12px;z-index:150;box-shadow:0 8px 32px #0008;animation:slideUp .3s ease;}
.pwa-text{flex:1;font-size:13px;font-weight:600;color:#f5f5f5;}
.pwa-sub{font-size:11px;color:#6b7280;margin-top:2px;}
.pwa-btn{background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:10px;color:#fff;cursor:pointer;font-size:13px;font-weight:700;padding:8px 14px;font-family:'Inter',sans-serif;}
.pwa-x{background:none;border:none;color:#6b7280;cursor:pointer;font-size:18px;padding:4px;}

/* AUTH */
.auth{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;gap:20px;background:radial-gradient(ellipse at 50% -10%,#f9731620 0%,transparent 60%);overflow-y:auto;}
.auth-logo{font-size:52px;}.auth-title{font-size:26px;font-weight:700;}.auth-sub{font-size:13px;color:${v.muted};text-align:center;}
.auth-card{width:100%;background:${v.surface};border:1px solid ${v.border};border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:14px;}
.auth-head{font-size:18px;font-weight:700;text-align:center;}
.inp-wrap{display:flex;flex-direction:column;gap:5px;}
.inp-label{font-size:11px;color:${v.muted};font-weight:600;letter-spacing:.05em;}
.inp{background:${dark?"#111":v.surface2};border:1.5px solid ${v.border};border-radius:12px;color:${v.text};font-family:'Inter',sans-serif;font-size:15px;padding:13px 14px;outline:none;width:100%;transition:border-color .2s;}
.inp:focus{border-color:#f97316;}.inp-hint{font-size:11px;color:${v.muted};}
.btn{border:none;border-radius:12px;cursor:pointer;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;padding:14px;transition:all .2s;width:100%;}
.btn-primary{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;}.btn-primary:hover{opacity:.9;}.btn-primary:disabled{opacity:.6;cursor:not-allowed;}
.btn-secondary{background:${v.surface2};color:${v.text};border:1px solid ${v.border};}
.auth-switch{font-size:13px;color:${v.muted};text-align:center;}.auth-switch span{color:#fb923c;cursor:pointer;font-weight:600;}
.forgot-link{font-size:13px;color:#fb923c;text-align:center;cursor:pointer;font-weight:600;}
.err{color:#ef4444;font-size:13px;text-align:center;background:#ef444415;padding:10px;border-radius:10px;}
.ok{color:#22c55e;font-size:13px;text-align:center;background:#22c55e15;padding:10px;border-radius:10px;}

/* HEADER */
.header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:${v.bg};border-bottom:1px solid ${v.border};position:relative;z-index:20;flex-shrink:0;}
.header-logo{font-size:24px;}.header-name{font-size:16px;font-weight:700;flex:1;color:${v.text};}
.dots-btn{background:none;border:none;color:${v.text};cursor:pointer;font-size:22px;padding:6px;border-radius:10px;line-height:1;}
.new-btn{background:${v.surface2};border:1px solid ${v.border};border-radius:10px;color:${v.text};cursor:pointer;font-size:13px;font-weight:600;padding:8px 14px;}

/* DROPDOWN */
.dropdown{position:absolute;top:56px;left:12px;background:${v.surface};border:1px solid ${v.border};border-radius:16px;padding:8px;min-width:220px;z-index:100;box-shadow:0 8px 32px #0008;animation:fadeIn .15s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
.drop-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;color:${v.text};transition:background .15s;}
.drop-item:hover{background:${v.surface2};}.drop-item.danger{color:#ef4444;}
.drop-divider{height:1px;background:${v.border};margin:4px 0;}
.drop-user{padding:12px 14px;}.drop-name{font-size:15px;font-weight:700;}.drop-email{font-size:11px;color:${v.muted};margin-top:2px;}
.prem-tag{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-top:4px;display:inline-block;}

/* USAGE BAR */
.usage-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 16px;background:${v.surface};border-bottom:1px solid ${v.border};font-size:11px;color:${v.muted};flex-shrink:0;}
.usage-pill{background:${v.surface2};border-radius:20px;padding:3px 10px;font-weight:600;}

/* CHAT */
.chat-area{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth;}
.chat-area::-webkit-scrollbar{width:0;}

/* WELCOME */
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:32px 20px;}
.lotus{font-size:96px;animation:breath 3s ease-in-out infinite;cursor:pointer;display:block;line-height:1;}
@keyframes breath{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
.welcome h2{font-size:26px;font-weight:700;}
.welcome-sub{font-size:13px;color:${v.muted};max-width:240px;line-height:1.7;}

/* MESSAGES */
.msg-wrap{display:flex;flex-direction:column;gap:2px;animation:slideUp .2s ease;}
@keyframes slideUp{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
.msg-row{display:flex;gap:8px;align-items:flex-end;}.msg-row.user{flex-direction:row-reverse;}
.bubble-wrap{display:flex;flex-direction:column;max-width:82%;}
.bubble{padding:12px 16px;font-size:14px;line-height:1.65;word-break:break-word;position:relative;}
.bubble.user{background:#f97316;color:#fff;border-radius:20px 20px 4px 20px;}
.bubble.ai{background:${v.bubble};color:${v.text};border:1px solid ${v.border};border-radius:20px 20px 20px 4px;}

/* REACTION PICKER */
.reaction-bar{display:flex;gap:2px;padding:4px 8px;background:${v.surface};border:1px solid ${v.border};border-radius:20px;position:absolute;top:-40px;left:0;z-index:10;box-shadow:0 4px 16px #0006;animation:fadeIn .15s ease;}
.reaction-btn{background:none;border:none;cursor:pointer;font-size:20px;padding:2px 4px;border-radius:8px;transition:transform .15s;}
.reaction-btn:hover{transform:scale(1.3);}
.msg-reaction{font-size:16px;margin-top:3px;padding-left:4px;}

/* ACTION BUTTONS BELOW BUBBLE */
.bubble-acts{display:flex;gap:5px;padding:4px 4px 0;flex-wrap:wrap;}
.act-ico-btn{background:none;border:1px solid ${v.border};color:${v.muted};cursor:pointer;padding:5px 8px;border-radius:20px;display:flex;align-items:center;justify-content:center;transition:all .15s;line-height:1;}
.act-ico-btn:hover{color:#f97316;border-color:#f97316;}
.act-ico-btn.on{color:#f97316;border-color:#f97316;background:#f9731615;}
.act-ico-btn svg{display:block;}

.msg-time{font-size:10px;color:${v.muted};padding:0 4px;}.msg-time.user{text-align:right;}
.ai-av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.typing-bub{background:${v.bubble};border:1px solid ${v.border};border-radius:20px 20px 20px 4px;padding:14px 18px;display:flex;gap:5px;}
.dot{width:7px;height:7px;border-radius:50%;background:#f97316;animation:bounce 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}.dot:nth-child(3){animation-delay:.4s;}
@keyframes bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-6px);}}
.search-ind{font-size:11px;color:#f97316;padding:4px 10px;background:#f9731615;border-radius:20px;display:inline-flex;align-items:center;gap:4px;}

/* INPUT BAR */
.input-bar{padding:10px 14px;border-top:1px solid ${v.border};background:${v.bg};display:flex;gap:8px;align-items:flex-end;flex-shrink:0;}
.msg-inp{flex:1;background:${v.surface};border:1.5px solid ${v.border};border-radius:24px;color:${v.text};font-family:'Inter',sans-serif;font-size:14px;padding:12px 18px;outline:none;resize:none;max-height:120px;min-height:48px;transition:border-color .2s;line-height:1.5;}
.msg-inp:focus{border-color:#f97316;}.msg-inp::placeholder{color:${v.muted};}
.send-btn{background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:18px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.send-btn:disabled{opacity:.4;cursor:not-allowed;}
.icon-btn{background:${v.surface2};border:1.5px solid ${v.border};border-radius:50%;color:${v.text};cursor:pointer;width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;}
.icon-btn:hover{border-color:#f97316;}.icon-btn.rec{border-color:#ef4444;background:#ef444420;animation:micPulse 1s infinite;}
@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 #ef444440;}50%{box-shadow:0 0 0 6px #ef444400;}}
.img-prev{position:relative;display:inline-block;margin-bottom:8px;}
.img-prev img{width:80px;height:80px;object-fit:cover;border-radius:12px;border:2px solid #f97316;}
.img-prev-x{position:absolute;top:-6px;right:-6px;background:#ef4444;border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:12px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;}
.msg-img{max-width:200px;border-radius:12px;margin-bottom:4px;display:block;}
.msg-img.gen{max-width:100%;width:240px;border-radius:14px;}

/* PAGES */
.page{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
.page-title{font-size:18px;font-weight:700;margin-bottom:4px;}
.search-bar{display:flex;align-items:center;background:${v.surface};border:1.5px solid ${v.border};border-radius:12px;padding:8px 14px;gap:8px;margin-bottom:4px;}
.search-bar input{flex:1;background:none;border:none;outline:none;color:${v.text};font-size:14px;font-family:'Inter',sans-serif;}
.hist-card{background:${v.surface};border:1px solid ${v.border};border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:border-color .2s;}
.hist-card:hover{border-color:#f97316;}
.hist-info{flex:1;overflow:hidden;}.hist-title{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hist-meta{font-size:11px;color:${v.muted};margin-top:2px;}
.del-btn{background:none;border:none;color:${v.muted};cursor:pointer;font-size:18px;padding:4px 6px;border-radius:8px;}.del-btn:hover{color:#ef4444;}
.set-card{background:${v.surface};border:1px solid ${v.border};border-radius:14px;overflow:hidden;margin-bottom:4px;}
.set-row{display:flex;align-items:center;gap:14px;padding:15px 16px;border-bottom:1px solid ${v.border};cursor:pointer;}.set-row:last-child{border-bottom:none;}
.set-icon{font-size:20px;width:28px;text-align:center;}.set-text{flex:1;}
.set-label{font-size:14px;font-weight:600;}.set-desc{font-size:12px;color:${v.muted};margin-top:2px;}
.sec-lbl{font-size:11px;font-weight:700;color:${v.muted};letter-spacing:.1em;text-transform:uppercase;margin:12px 0 6px;}
.badge{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
.badge-g{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
.badge-y{background:linear-gradient(135deg,#eab308,#ca8a04);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
.prem-card{background:linear-gradient(135deg,#f97316,#ea580c);border-radius:16px;padding:18px;margin-bottom:4px;cursor:pointer;}
.prem-card h3{font-size:18px;font-weight:700;color:#fff;}.prem-card p{font-size:13px;color:#fff9;margin-top:4px;}
.pf{font-size:13px;color:#fff;display:flex;align-items:center;gap:8px;margin-top:6px;}
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.stat-card{background:${v.surface};border:1px solid ${v.border};border-radius:14px;padding:16px;}
.stat-val{font-size:28px;font-weight:800;color:#f97316;}.stat-lbl{font-size:12px;color:${v.muted};margin-top:2px;}
.u-card{background:${v.surface};border:1px solid ${v.border};border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;}
.u-av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:15px;flex-shrink:0;}
.toggle{position:relative;width:44px;height:24px;background:${v.surface2};border-radius:12px;cursor:pointer;border:2px solid ${v.border};transition:background .2s;flex-shrink:0;}
.toggle.on{background:#f97316;border-color:#f97316;}
.toggle-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;}
.toggle.on .toggle-knob{left:22px;}
.graph-bars{display:flex;align-items:flex-end;gap:4px;height:80px;margin-top:8px;}
.graph-lbl{font-size:9px;color:${v.muted};text-align:center;margin-top:3px;}
.graph-val{font-size:8px;color:#f97316;text-align:center;margin-bottom:2px;}

/* PROFILE PHOTO */
.profile-av{position:relative;display:inline-block;}
.profile-img{width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid #f97316;}
.profile-av-placeholder{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;border:3px solid #f97316;}
.profile-edit-badge{position:absolute;bottom:0;right:0;background:#f97316;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;}

/* MODAL */
.modal-bg{position:fixed;inset:0;background:#000a;z-index:200;display:flex;align-items:flex-end;padding:16px;}
.modal{background:${v.surface};border-radius:24px 24px 16px 16px;padding:28px 24px;width:100%;max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:14px;max-height:90vh;overflow-y:auto;}
.modal h3{font-size:20px;font-weight:700;text-align:center;}.modal p{font-size:14px;color:${v.muted};text-align:center;line-height:1.6;}
.modal-icon{font-size:52px;text-align:center;}
.pay-box{background:${v.surface2};border:1px solid ${v.border};border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;}
.pay-num{font-size:22px;font-weight:800;color:#f97316;text-align:center;letter-spacing:2px;}
.pay-step{font-size:13px;color:${v.text};display:flex;gap:8px;}
.loading{text-align:center;color:${v.muted};padding:20px;font-size:14px;}

/* VOICE PAGE */
.voice-page{display:flex;flex-direction:column;height:100%;background:${dark?"#0a0a0a":v.bg};overflow:hidden;}
.voice-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:20px;overflow-y:auto;}
.voice-orb-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:160px;height:160px;}
.v-ring{position:absolute;border-radius:50%;pointer-events:none;}
.v-ring-1{animation:vr 1.8s ease-out infinite;background:#f9731622;}
.v-ring-2{animation:vr 1.8s ease-out .4s infinite;background:#f9731614;}
.v-ring-3{animation:vr 1.8s ease-out .8s infinite;background:#f9731608;}
@keyframes vr{0%{width:100px;height:100px;opacity:.9;}100%{width:180px;height:180px;opacity:0;}}
.voice-orb{width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;position:relative;font-size:44px;box-shadow:0 8px 40px #f9731660;transition:all .3s;}
.voice-orb.listening{background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 0 0 10px #ef444430;animation:orbP 1s infinite;}
.voice-orb.speaking{background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 8px 40px #22c55e70;}
.voice-orb.thinking{background:linear-gradient(135deg,#8b5cf6,#6d28d9);}
@keyframes orbP{0%,100%{transform:scale(1);}50%{transform:scale(1.08);}}
.voice-status{font-size:18px;font-weight:700;text-align:center;}
.voice-hint{font-size:12px;color:${v.muted};text-align:center;max-width:280px;line-height:1.6;}
.voice-gender-info{display:flex;align-items:center;gap:8px;padding:10px 16px;background:${v.surface};border:1px solid ${v.border};border-radius:14px;font-size:13px;font-weight:600;}
.spd-row{display:flex;gap:6px;}
.spd-btn{flex:1;padding:8px 6px;border-radius:10px;border:1.5px solid ${v.border};background:transparent;color:${v.muted};cursor:pointer;font-size:11px;font-weight:600;font-family:'Inter',sans-serif;transition:all .2s;}
.spd-btn.on{border-color:#f97316;color:#f97316;background:#f9731615;}
.v-last-reply{background:${v.surface};border:1px solid ${v.border};border-radius:14px;padding:14px 16px;width:100%;}
.v-end-btn{background:#ef444420;border:1.5px solid #ef4444;border-radius:14px;color:#ef4444;cursor:pointer;font-size:15px;font-weight:700;padding:14px 32px;font-family:'Inter',sans-serif;}
.voice-wave{display:flex;align-items:center;gap:3px;height:32px;}
.wave-bar{width:3px;border-radius:3px;background:#f97316;animation:wave 1s ease-in-out infinite;}
@keyframes wave{0%,100%{height:6px;opacity:.5;}50%{height:28px;opacity:1;}}

/* ADMIN USER CHAT MODAL */
.admin-chat-area{max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:8px;background:${v.surface2};border-radius:12px;}
`;
}

// ── MAIN APP ─────────────────────────────────────────────────────
export default function App() {
  const [splash, setSplash] = useState(true);
  const [splashHide, setSplashHide] = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState(null);
  const [showPwaBanner, setShowPwaBanner] = useState(false);

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [page, setPage] = useState("chat");
  const [authMode, setAuthMode] = useState("login");
  const [forgotMode, setForgotMode] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", pass:"" });
  const [formErr, setFormErr] = useState("");
  const [formOk, setFormOk] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [dark, setDark] = useState(true);

  const [sid, setSid] = useState(() => Date.now().toString());
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [reactions, setReactions] = useState({}); // msgId → emoji
  const [showReactionFor, setShowReactionFor] = useState(null);

  const [hists, setHists] = useState([]);
  const [histLoad, setHistLoad] = useState(false);
  const [histSearch, setHistSearch] = useState("");

  const [showMenu, setShowMenu] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [payDone, setPayDone] = useState(false);
  const [userData, setUserData] = useState(null);

  // Profile edit
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(null); // base64
  const [profilePhotoURL, setProfilePhotoURL] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Admin
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminViewChat, setAdminViewChat] = useState(null); // {user, msgs}
  const [adminChatLoading, setAdminChatLoading] = useState(false);

  const [imgB64, setImgB64] = useState(null);
  const [imgPrev, setImgPrev] = useState(null);
  const [speakId, setSpeakId] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [copied, setCopied] = useState(null);

  // Voice call
  const [vStatus, setVStatus] = useState("idle");
  const [vGender, setVGender] = useState("female");
  const [vDetected, setVDetected] = useState(false);
  const [vSpeed, setVSpeed] = useState(0.92);
  const [vLastReply, setVLastReply] = useState("");

  const bottomRef = useRef(null);
  const galleryRef = useRef(null);
  const profilePhotoRef = useRef(null);
  const micRef = useRef(null);
  const voiceRef = useRef(null);
  const typingSoundTimer = useRef(null);

  // ── SPLASH ──
  useEffect(() => {
    const t = setTimeout(() => { setSplashHide(true); setTimeout(() => setSplash(false), 700); }, 2200);
    return () => clearTimeout(t);
  }, []);

  // ── PWA INSTALL ──
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPwaPrompt(e); setShowPwaBanner(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // ── AUTH ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        setUser(u);
        const d = await getDoc(doc(db,"users",u.uid));
        if (d.exists()) {
          const data = d.data();
          setUserData(data);
          setProfilePhotoURL(data.photoURL || null);
          setProfileName(data.name || u.displayName || "");
        }
      } else { setUser(null); setUserData(null); }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, loading]);

  useEffect(() => {
    if (user && page==="history") loadHists();
    if (user && page==="admin") loadAdmin();
    if (page!=="voice") endVoice();
    window.speechSynthesis?.cancel();
    setSpeakId(null);
    setShowReactionFor(null);
  }, [page]);

  // ── LOAD HISTORY ──
  async function loadHists() {
    setHistLoad(true);
    try {
      const q = query(collection(db,"chats"), where("userId","==",user.uid), orderBy("updatedAt","desc"));
      const snap = await getDocs(q);
      setHists(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    } catch {
      try {
        const q2 = query(collection(db,"chats"), where("userId","==",user.uid));
        const s2 = await getDocs(q2);
        setHists(s2.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.updatedAt?.seconds||0)-(a.updatedAt?.seconds||0)));
      } catch(e) { console.error(e); }
    }
    setHistLoad(false);
  }

  // ── LOAD ADMIN ──
  async function loadAdmin() {
    const snap = await getDocs(collection(db,"users"));
    setAdminUsers(snap.docs.map(d => ({ id:d.id, ...d.data() })));
  }

  // ── ADMIN: view user chats ──
  async function adminViewUserChat(u) {
    setAdminViewChat({ user:u, msgs:[] });
    setAdminChatLoading(true);
    try {
      const q = query(collection(db,"messages"), where("userId","==",u.id), orderBy("createdAt","desc"), limit(30));
      const snap = await getDocs(q);
      const chatMsgs = snap.docs.map(d=>({id:d.id,...d.data()})).reverse();
      setAdminViewChat({ user:u, msgs:chatMsgs });
    } catch(e) {
      try {
        const q2 = query(collection(db,"messages"), where("userId","==",u.id));
        const snap2 = await getDocs(q2);
        setAdminViewChat({ user:u, msgs:snap2.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)).slice(-30) });
      } catch {}
    }
    setAdminChatLoading(false);
  }

  // ── AUTH HANDLER ──
  async function handleAuth() {
    setFormErr(""); setFormOk("");
    if (forgotMode) {
      if (!form.email) { setFormErr("Email daalo!"); return; }
      setFormLoading(true);
      try { await sendPasswordResetEmail(auth, form.email); setFormOk("✅ Reset link bhej diya!"); setForm(f=>({...f,email:""})); }
      catch { setFormErr("Email registered nahi hai!"); }
      setFormLoading(false); return;
    }
    if (!form.email||!form.pass) { setFormErr("Sab fields bharo!"); return; }
    if (form.pass.length<8) { setFormErr("Password 8+ characters!"); return; }
    if (authMode==="signup"&&!form.name) { setFormErr("Naam daalo!"); return; }
    setFormLoading(true);
    try {
      if (authMode==="signup") {
        const c = await createUserWithEmailAndPassword(auth,form.email,form.pass);
        await updateProfile(c.user,{displayName:form.name});
        await setDoc(doc(db,"users",c.user.uid),{name:form.name,email:form.email,premium:false,createdAt:serverTimestamp(),usageCount:0});
        setUserData({name:form.name,email:form.email,premium:false,usageCount:0});
      } else {
        await signInWithEmailAndPassword(auth,form.email,form.pass);
        const d = await getDoc(doc(db,"users",auth.currentUser.uid));
        if (d.exists()) setUserData(d.data());
      }
      setForm({name:"",email:"",pass:""});
    } catch(e) {
      const errs={"auth/email-already-in-use":"Email already registered!","auth/invalid-email":"Invalid email!","auth/wrong-password":"Wrong password!","auth/user-not-found":"Account nahi mila!","auth/invalid-credential":"Wrong email ya password!"};
      setFormErr(errs[e.code]||e.message);
    }
    setFormLoading(false);
  }

  // ── PROFILE SAVE ──
  async function saveProfile() {
    if (!profileName.trim()) { alert("Naam daalo!"); return; }
    setProfileSaving(true);
    try {
      const updates = { name:profileName.trim() };
      if (profilePhoto) updates.photoURL = profilePhoto;
      await updateProfile(auth.currentUser, { displayName:profileName.trim() });
      await setDoc(doc(db,"users",user.uid), updates, { merge:true });
      setUserData(p => ({ ...p, ...updates }));
      if (profilePhoto) setProfilePhotoURL(profilePhoto);
      setShowProfileEdit(false);
    } catch(e) { alert("Error: "+e.message); }
    setProfileSaving(false);
  }

  function handleProfilePhoto(e) {
    const file = e.target.files[0]; if (!file) return;
    e.target.value="";
    const reader = new FileReader();
    reader.onload = ev => setProfilePhoto(ev.target.result);
    reader.readAsDataURL(file);
  }

  // ── GALLERY ──
  function handleGallery(e) {
    const file = e.target.files[0]; if (!file) return;
    e.target.value="";
    const reader = new FileReader();
    reader.onload = ev => { const r=ev.target.result; setImgB64(r.split(",")[1]); setImgPrev(r); };
    reader.onerror = () => alert("Image load nahi hui!");
    reader.readAsDataURL(file);
  }

  // ── MIC ──
  function toggleMic() {
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!SR) { alert("Chrome ya Edge mein voice use karo!"); return; }
    if (micActive) { micRef.current?.stop(); setMicActive(false); return; }
    const r = new SR();
    r.lang="hi-IN"; r.continuous=false; r.interimResults=false; r.maxAlternatives=1;
    r.onstart = () => setMicActive(true);
    r.onresult = e => { const t=e.results[0][0].transcript; if(t) setInput(p=>p?p+" "+t:t); };
    r.onerror = err => { if(err.error==="not-allowed") alert("Mic permission do!"); setMicActive(false); };
    r.onend = () => setMicActive(false);
    micRef.current=r;
    try { r.start(); } catch { setMicActive(false); }
  }

  // ── SPEAK MSG ──
  function toggleSpeak(msgId, text) {
    if (speakId===msgId) { window.speechSynthesis?.cancel(); setSpeakId(null); return; }
    setSpeakId(msgId);
    speakText(text, vGender, vSpeed, () => setSpeakId(null));
  }

  function copyMsg(text, id) {
    navigator.clipboard?.writeText(text).catch(() => { const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); });
    setCopied(id); setTimeout(()=>setCopied(null),2000);
  }

  function shareWA(text) { window.open("https://wa.me/?text="+encodeURIComponent("Saraswati AI:\n\n"+text.slice(0,500)),"_blank"); }

  function exportChat() {
    if (!msgs.length) { alert("Koi chat nahi!"); return; }
    const txt=msgs.map(m=>(m.role==="user"?"Aap":"Saraswati AI")+":\n"+m.text).join("\n\n---\n\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([txt],{type:"text/plain"})); a.download="saraswati-chat.txt"; a.click();
  }

  // ── REACTION ──
  function addReaction(msgId, emoji) {
    setReactions(p => ({ ...p, [msgId]:emoji }));
    setShowReactionFor(null);
  }

  // ── VOICE CALL ──
  function endVoice() {
    voiceRef.current?.stop?.(); voiceRef.current?.abort?.();
    window.speechSynthesis?.cancel(); setVStatus("idle");
  }

  async function handleOrb() {
    if (vStatus==="listening") { voiceRef.current?.stop?.(); setVStatus("idle"); return; }
    if (vStatus==="speaking") { window.speechSynthesis?.cancel(); setVStatus("idle"); return; }
    if (vStatus==="thinking") return;
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!SR) { alert("Chrome ya Edge use karo!"); return; }
    const r = new SR();
    r.lang="hi-IN"; r.continuous=false; r.interimResults=false; r.maxAlternatives=3;
    r.onresult = async e => {
      const transcript = e.results[0][0].transcript;
      if (!transcript.trim()) { setVStatus("idle"); return; }
      const det = detectGenderFromVoice(transcript);
      if (det) { setVGender(det); setVDetected(true); }
      const curGender = det||vGender;
      setVStatus("thinking");
      const ud = userData;
      if (!ud?.premium&&(ud?.usageCount||0)>=FREE_LIMIT) { setShowLimit(true); setVStatus("idle"); return; }
      const uRef = await addDoc(collection(db,"messages"),{sessionId:sid,userId:user.uid,role:"user",text:transcript,createdAt:serverTimestamp()});
      const newMsgs = [...msgs,{id:uRef.id,role:"user",text:transcript,time:new Date()}];
      setMsgs(newMsgs);
      await setDoc(doc(db,"chats",sid),{userId:user.uid,title:transcript.slice(0,45),updatedAt:serverTimestamp(),createdAt:serverTimestamp()},{merge:true});
      const nc=(ud?.usageCount||0)+1;
      await setDoc(doc(db,"users",user.uid),{usageCount:nc},{merge:true});
      setUserData(p=>({...p,usageCount:nc}));
      try {
        const aiText = await callAI(newMsgs,null,curGender);
        const tid="tmp_"+Date.now();
        setMsgs(p=>[...p,{id:tid,role:"ai",text:aiText,time:new Date()}]);
        setVLastReply(aiText);
        await addDoc(collection(db,"messages"),{sessionId:sid,userId:user.uid,role:"ai",text:aiText,createdAt:serverTimestamp()});
        setVStatus("speaking");
        speakText(aiText,curGender,vSpeed,()=>setVStatus("idle"));
      } catch(err) { setMsgs(p=>[...p,{id:Date.now(),role:"ai",text:"❌ "+err.message,time:new Date()}]); setVStatus("idle"); }
    };
    r.onerror = e => { if(e.error==="not-allowed") alert("Mic permission do!"); setVStatus("idle"); };
    r.onend = () => { if(vStatus==="listening") setVStatus("idle"); };
    voiceRef.current=r;
    try { r.start(); setVStatus("listening"); } catch { setVStatus("idle"); }
  }

  // ── SEND MSG ──
  async function sendMsg(text) {
    const txt = text||input.trim();
    if ((!txt&&!imgB64)||loading) return;
    const ud = userData;
    if (!ud?.premium&&(ud?.usageCount||0)>=FREE_LIMIT) { setShowLimit(true); return; }
    const msgText = txt||"Is image mein kya hai?";
    setInput("");
    const b64=imgB64, prev=imgPrev;
    setImgB64(null); setImgPrev(null);
    playSendSound();
    const uRef = await addDoc(collection(db,"messages"),{sessionId:sid,userId:user.uid,role:"user",text:msgText,image:prev||null,createdAt:serverTimestamp()});
    const newMsgs = [...msgs,{id:uRef.id,role:"user",text:msgText,image:prev,time:new Date()}];
    setMsgs(newMsgs);
    await setDoc(doc(db,"chats",sid),{userId:user.uid,title:msgText.slice(0,45),updatedAt:serverTimestamp(),createdAt:serverTimestamp()},{merge:true});
    const nc=(ud?.usageCount||0)+1;
    await setDoc(doc(db,"users",user.uid),{usageCount:nc},{merge:true});
    setUserData(p=>({...p,usageCount:nc}));

    if (!b64&&needsImageGen(msgText)) {
      setLoading(true);
      const prompt=extractImagePrompt(msgText);
      const url=getImageUrl(prompt);
      await new Promise(r=>setTimeout(r,600));
      const tid="tmp_"+Date.now();
      const aiText="🎨 Yeh raha aapka image — \""+prompt+"\"";
      setLoading(false);
      setMsgs(p=>[...p,{id:tid,role:"ai",text:aiText,image:url,time:new Date()}]);
      await addDoc(collection(db,"messages"),{sessionId:sid,userId:user.uid,role:"ai",text:aiText,image:url,createdAt:serverTimestamp()});
      return;
    }

    if (needsSearch(msgText)) setSearching(true);
    setLoading(true);
    try {
      const aiText = await callAI(newMsgs,b64,vGender);
      setSearching(false);
      const tid="tmp_"+Date.now();
      setLoading(false);
      setMsgs(p=>[...p,{id:tid,role:"ai",text:"",time:new Date()}]);
      let shown="";
      let soundCount=0;
      for (let i=0;i<aiText.length;i++) {
        shown+=aiText[i];
        const s=shown;
        setMsgs(p=>p.map(m=>m.id===tid?{...m,text:s}:m));
        soundCount++;
        if (soundCount%8===0) playTypingSound();
        await new Promise(r=>setTimeout(r,8));
      }
      await addDoc(collection(db,"messages"),{sessionId:sid,userId:user.uid,role:"ai",text:aiText,createdAt:serverTimestamp()});
    } catch(e) { setSearching(false); setLoading(false); setMsgs(p=>[...p,{id:Date.now(),role:"ai",text:"❌ Error: "+e.message,time:new Date()}]); }
  }

  async function loadSession(s) {
    try {
      setPage("chat"); setSid(s.id); setMsgs([]);
      const q=query(collection(db,"messages"),where("sessionId","==",s.id));
      const snap=await getDocs(q);
      setMsgs(snap.docs.map(d=>({id:d.id,...d.data(),time:d.data().createdAt})).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)));
    } catch(e) { alert("❌ "+e.message); }
  }

  async function delSession(id, e) {
    e.stopPropagation();
    await deleteDoc(doc(db,"chats",id));
    setHists(p=>p.filter(h=>h.id!==id));
  }

  async function adminToggle(uid, current) {
    await updateDoc(doc(db,"users",uid),{premium:!current,premiumPending:false});
    setAdminUsers(p=>p.map(u=>u.id===uid?{...u,premium:!current}:u));
  }

  async function adminDel(uid) {
    if (!window.confirm("Delete karo?")) return;
    await deleteDoc(doc(db,"users",uid));
    setAdminUsers(p=>p.filter(u=>u.id!==uid));
  }

  function newChat() { setSid(Date.now().toString()); setMsgs([]); setPage("chat"); setShowMenu(false); setImgB64(null); setImgPrev(null); endVoice(); setReactions({}); }

  const isAdmin = user?.email===ADMIN_EMAIL;
  const chatsLeft = userData?.premium?null:Math.max(0,FREE_LIMIT-(userData?.usageCount||0));
  const displayName = userData?.name||user?.displayName||"User";

  // Admin graph — real user signup by day (simplified: show total users spread over 7 days)
  const totalU = adminUsers.length;
  const adminGraph = Array.from({length:7},(_,i)=>{
    const dayUsers = adminUsers.filter(u => {
      if (!u.createdAt?.seconds) return false;
      const d = new Date(u.createdAt.seconds*1000);
      const daysAgo = Math.floor((Date.now()-d.getTime())/(86400000));
      return daysAgo === (6-i);
    }).length;
    return { l:["M","T","W","T","F","S","S"][i], v:dayUsers };
  });
  const maxG = Math.max(...adminGraph.map(d=>d.v),1);

  const filteredHists = hists.filter(h=>h.title?.toLowerCase().includes(histSearch.toLowerCase()));
  const filteredAdminUsers = adminUsers.filter(u=>
    (u.name||"").toLowerCase().includes(adminSearch.toLowerCase()) ||
    (u.email||"").toLowerCase().includes(adminSearch.toLowerCase())
  );

  const vOrbIcon = vStatus==="listening"?"🎙️":vStatus==="thinking"?"🤔":vStatus==="speaking"?"🔊":"🪷";
  const vOrbText = {idle:"Tap karke baat karo",listening:"Sun raha hoon... 👂",thinking:"Soch rahi hoon... 💭",speaking:"Bol rahi hoon... 🔊"}[vStatus];

  // ── RENDER ───────────────────────────────────────────────────
  if (!authReady) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100dvh",background:"#0f0f0f"}}>
      <style>{buildCSS(true)}</style>
      <span style={{fontSize:60}}>🪷</span>
      <div style={{marginTop:12,color:"#6b7280",fontSize:14}}>Loading...</div>
    </div>
  );

  if (!user) return (
    <div className="app">
      <style>{buildCSS(dark)}</style>
      {splash && <div className={`splash${splashHide?" hide":""}`}><span className="splash-logo">🪷</span><div className="splash-title">Saraswati AI</div><div className="splash-sub">Aapki apni AI assistant</div><div className="splash-bar"><div className="splash-progress"/></div></div>}
      <div className="auth">
        <div className="auth-logo">🪷</div>
        <div className="auth-title">Saraswati AI</div>
        <div className="auth-sub">Aapki intelligent AI assistant</div>
        <div className="auth-card">
          {forgotMode?(
            <>
              <div className="auth-head">🔑 Password Bhool Gaye?</div>
              <div className="inp-wrap"><div className="inp-label">EMAIL</div><input className="inp" type="email" placeholder="email@example.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/></div>
              {formErr&&<div className="err">{formErr}</div>}
              {formOk&&<div className="ok">{formOk}</div>}
              <button className="btn btn-primary" onClick={handleAuth} disabled={formLoading}>{formLoading?"Bhej raha hoon...":"📧 Reset Link Bhejo"}</button>
              <div className="auth-switch"><span onClick={()=>{setForgotMode(false);setFormErr("");setFormOk("");}}>← Wapas</span></div>
            </>
          ):(
            <>
              <div className="auth-head">{authMode==="login"?"Swagat Hai! 👋":"Account Banao ✨"}</div>
              {authMode==="signup"&&<div className="inp-wrap"><div className="inp-label">NAAM</div><input className="inp" placeholder="Apna naam" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>}
              <div className="inp-wrap"><div className="inp-label">EMAIL</div><input className="inp" type="email" placeholder="email@example.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
              <div className="inp-wrap">
                <div className="inp-label">PASSWORD</div>
                <input className="inp" type="password" placeholder="Min 8 characters" value={form.pass} onChange={e=>setForm(f=>({...f,pass:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
                <div className="inp-hint">⚠️ Minimum 8 characters</div>
              </div>
              {formErr&&<div className="err">{formErr}</div>}
              <button className="btn btn-primary" onClick={handleAuth} disabled={formLoading}>{formLoading?"Ruko...":authMode==="login"?"Login →":"Account Banao →"}</button>
              {authMode==="login"&&<div className="forgot-link" onClick={()=>{setForgotMode(true);setFormErr("");setFormOk("");}}>Password bhool gaye?</div>}
            </>
          )}
        </div>
        {!forgotMode&&<div className="auth-switch">{authMode==="login"?<>Account nahi hai? <span onClick={()=>{setAuthMode("signup");setFormErr("");}}>Sign Up karo</span></>:<>Account hai? <span onClick={()=>{setAuthMode("login");setFormErr("");}}>Login karo</span></>}</div>}
      </div>
    </div>
  );

  return (
    <div className="app" onClick={()=>{showMenu&&setShowMenu(false);showReactionFor&&setShowReactionFor(null);}}>
      <style>{buildCSS(dark)}</style>

      {/* SPLASH (after login too, for first load) */}
      {splash&&<div className={`splash${splashHide?" hide":""}`}><span className="splash-logo">🪷</span><div className="splash-title">Saraswati AI</div><div className="splash-sub">Namaste, {displayName}! 🙏</div><div className="splash-bar"><div className="splash-progress"/></div></div>}

      {/* PWA BANNER */}
      {showPwaBanner&&pwaPrompt&&(
        <div className="pwa-banner">
          <span style={{fontSize:28}}>🪷</span>
          <div style={{flex:1}}>
            <div className="pwa-text">App Install Karo!</div>
            <div className="pwa-sub">Home screen pe add karo — app jaisa feel</div>
          </div>
          <button className="pwa-btn" onClick={async()=>{ pwaPrompt.prompt(); const r=await pwaPrompt.userChoice; setShowPwaBanner(false); }}>Install</button>
          <button className="pwa-x" onClick={()=>setShowPwaBanner(false)}>✕</button>
        </div>
      )}

      {/* HEADER */}
      <div className="header">
        <button className="dots-btn" onClick={e=>{e.stopPropagation();setShowMenu(v=>!v);}}>⋯</button>
        <div className="header-logo">🪷</div>
        <div className="header-name">Saraswati AI</div>
        {page==="chat"&&<button className="new-btn" onClick={newChat}>✏️ New</button>}
        {page==="voice"&&<button className="new-btn" style={{background:"#ef444420",borderColor:"#ef4444",color:"#ef4444"}} onClick={()=>{endVoice();setPage("chat");}}>📵 End</button>}
      </div>

      {/* DROPDOWN */}
      {showMenu&&(
        <div className="dropdown" onClick={e=>e.stopPropagation()}>
          <div className="drop-user">
            {profilePhotoURL
              ? <img src={profilePhotoURL} alt="" style={{width:40,height:40,borderRadius:"50%",objectFit:"cover",border:"2px solid #f97316",marginBottom:6}}/>
              : <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#fff",fontSize:18,marginBottom:6}}>{displayName[0]?.toUpperCase()}</div>
            }
            <div className="drop-name">{displayName}</div>
            <div className="drop-email">{user.email}</div>
            {userData?.premium&&<div className="prem-tag">⭐ PREMIUM</div>}
          </div>
          <div className="drop-divider"/>
          <div className="drop-item" onClick={newChat}>✏️ New Chat</div>
          <div className="drop-item" onClick={()=>{setPage("chat");setShowMenu(false);}}>💬 Chat</div>
          <div className="drop-item" onClick={()=>{setPage("voice");setShowMenu(false);}}>🎙️ Voice Call</div>
          <div className="drop-item" onClick={()=>{setPage("history");setShowMenu(false);}}>📂 History</div>
          <div className="drop-item" onClick={()=>{setPage("settings");setShowMenu(false);}}>⚙️ Settings</div>
          {isAdmin&&<div className="drop-item" onClick={()=>{setPage("admin");setShowMenu(false);}}>🛡️ Admin</div>}
          <div className="drop-divider"/>
          <div className="drop-item" onClick={()=>{setDark(v=>!v);setShowMenu(false);}}>{dark?"☀️ Light Mode":"🌙 Dark Mode"}</div>
          <div className="drop-item" onClick={()=>{shareWA(msgs.filter(m=>m.role==="ai").pop()?.text||"");setShowMenu(false);}}>📤 Share Chat</div>
          <div className="drop-item" onClick={()=>{exportChat();setShowMenu(false);}}>📄 Export</div>
          <div className="drop-divider"/>
          {!userData?.premium&&<div className="drop-item" onClick={()=>{setShowUpgrade(true);setShowMenu(false);}}>⭐ Premium</div>}
          <div className="drop-item danger" onClick={()=>signOut(auth)}>🚪 Logout</div>
        </div>
      )}

      {page==="chat"&&<div className="usage-bar"><span>{userData?.premium?"⭐ Premium":"Free Plan"}</span><span className="usage-pill">{userData?.premium?"Unlimited":chatsLeft+" left"}</span></div>}

      {/* ── CHAT PAGE ── */}
      {page==="chat"&&(
        <>
          <div className="chat-area">
            {msgs.length===0&&(
              <div className="welcome">
                <span className="lotus" onClick={()=>setPage("voice")}>🪷</span>
                <h2>Saraswati AI</h2>
                <p className="welcome-sub">Kuch bhi poochho — ya lotus dabao voice call ke liye</p>
              </div>
            )}
            {msgs.map(m=>(
              <div key={m.id} className="msg-wrap">
                <div className={"msg-row "+m.role} style={{position:"relative"}}>
                  {m.role==="ai"&&<div className="ai-av">🪷</div>}
                  <div className="bubble-wrap" style={m.role==="user"?{alignItems:"flex-end"}:{alignItems:"flex-start"}}>
                    {/* REACTION PICKER */}
                    {showReactionFor===m.id&&(
                      <div className="reaction-bar" onClick={e=>e.stopPropagation()}>
                        {REACTIONS.map(emoji=>(
                          <button key={emoji} className="reaction-btn" onClick={()=>addReaction(m.id,emoji)}>{emoji}</button>
                        ))}
                      </div>
                    )}
                    <div
                      className={"bubble "+m.role}
                      onDoubleClick={()=>setShowReactionFor(p=>p===m.id?null:m.id)}
                    >
                      {m.image&&(m.role==="ai"
                        ?<a href={m.image} target="_blank" rel="noreferrer"><img src={m.image} className="msg-img gen" alt="generated"/></a>
                        :<img src={m.image} className="msg-img" alt="img"/>
                      )}
                      {m.role==="ai"?<AIText text={m.text}/>:m.text}
                    </div>
                    {/* Reaction display */}
                    {reactions[m.id]&&<div className="msg-reaction">{reactions[m.id]}</div>}
                    {/* Action buttons */}
                    {m.text&&(
                      <div className="bubble-acts" style={m.role==="user"?{justifyContent:"flex-end"}:{}}>
                        {m.role==="ai"&&(
                          <button className={"act-ico-btn"+(speakId===m.id?" on":"")} onClick={()=>toggleSpeak(m.id,m.text)} title="Listen">
                            {speakId===m.id?<IcoStop size={13}/>:<IcoSpeaker size={13}/>}
                          </button>
                        )}
                        <button className={"act-ico-btn"+(copied===m.id?" on":"")} onClick={()=>copyMsg(m.text,m.id)} title="Copy">
                          {copied===m.id?<IcoCheck size={13}/>:<IcoCopy size={13}/>}
                        </button>
                        {m.role==="ai"&&<button className="act-ico-btn" onClick={()=>shareWA(m.text)} title="Share"><IcoShare size={13}/></button>}
                        <button className="act-ico-btn" onClick={()=>setShowReactionFor(p=>p===m.id?null:m.id)} title="React" style={{fontSize:11}}>😊</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className={"msg-time "+m.role}>{fmtTime(m.time)}</div>
              </div>
            ))}
            {searching&&<div className="msg-row"><div className="ai-av">🪷</div><div className="search-ind">🌐 Search ho raha hai...</div></div>}
            {loading&&!searching&&<div className="msg-row"><div className="ai-av">🪷</div><div className="typing-bub"><div className="dot"/><div className="dot"/><div className="dot"/></div></div>}
            <div ref={bottomRef}/>
          </div>
          {/* INPUT BAR */}
          <div className="input-bar">
            <input type="file" ref={galleryRef} accept="image/*" style={{display:"none"}} onChange={handleGallery}/>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
              {imgPrev&&(
                <div className="img-prev">
                  <img src={imgPrev} alt="preview"/>
                  <button className="img-prev-x" onClick={()=>{setImgB64(null);setImgPrev(null);}}>✕</button>
                </div>
              )}
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                <button className="icon-btn" onClick={()=>galleryRef.current?.click()} title="Image lagao"><IcoImage/></button>
                <button className={"icon-btn"+(micActive?" rec":"")} onClick={toggleMic} title="Bolkar type karo"><IcoMic active={micActive}/></button>
                <textarea
                  className="msg-inp"
                  placeholder={micActive?"Sun raha hoon...":"Kuch bhi poochho..."}
                  value={input}
                  onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),sendMsg())}
                  rows={1}
                  style={micActive?{borderColor:"#ef4444"}:{}}
                />
                <button className="send-btn" onClick={()=>sendMsg()} disabled={(!input.trim()&&!imgB64)||loading}>➤</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── VOICE PAGE ── */}
      {page==="voice"&&(
        <div className="voice-page">
          <div className="voice-body">
            <div className="voice-gender-info">
              <div style={{width:8,height:8,borderRadius:"50%",background:vGender==="female"?"#ec4899":"#3b82f6"}}/>
              {vDetected?(vGender==="female"?"Ladki detect 👩 — Female voice":"Ladka detect 👨 — Male voice"):"Pehli baar bolo — auto detect hoga"}
            </div>
            <div className="voice-orb-wrap">
              {(vStatus==="listening"||vStatus==="speaking")&&<><div className="v-ring v-ring-1"/><div className="v-ring v-ring-2"/><div className="v-ring v-ring-3"/></>}
              <div className={`voice-orb${vStatus==="listening"?" listening":vStatus==="speaking"?" speaking":vStatus==="thinking"?" thinking":""}`} onClick={handleOrb}>{vOrbIcon}</div>
            </div>
            <div className="voice-status">{vOrbText}</div>
            {vStatus==="speaking"&&<div className="voice-wave">{[1,2,3,4,5].map(i=><div key={i} className="wave-bar" style={{animationDelay:`${(i-1)*0.1}s`}}/>)}</div>}
            <div className="voice-hint">Hindi • English • Urdu • Punjabi • 100+ languages</div>
            <div className="spd-row">
              {[{l:"🐢 Dheere",v:0.65},{l:"Normal",v:0.92},{l:"⚡ Tez",v:1.3}].map(s=>(
                <button key={s.v} className={"spd-btn"+(vSpeed===s.v?" on":"")} onClick={()=>setVSpeed(s.v)}>{s.l}</button>
              ))}
            </div>
            {vLastReply&&<div className="v-last-reply"><div style={{fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:4}}>Pichla Jawab:</div><div style={{fontSize:13,lineHeight:1.6}}>{vLastReply.slice(0,160)}{vLastReply.length>160?"...":""}</div></div>}
            <button className="v-end-btn" onClick={()=>{endVoice();setPage("chat");}}>📵 Call Khatam Karo</button>
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {page==="history"&&(
        <div className="page">
          <div className="page-title">📂 History</div>
          <div className="search-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Chat dhundho..." value={histSearch} onChange={e=>setHistSearch(e.target.value)}/>
          </div>
          {histLoad?<div className="loading">⏳ Load ho raha hai...</div>
          :filteredHists.length===0?<div className="welcome"><span style={{fontSize:60}}>📭</span><h2>Koi history nahi</h2></div>
          :filteredHists.map(h=>(
            <div key={h.id} className="hist-card" onClick={()=>loadSession(h)}>
              <div style={{fontSize:20}}>💬</div>
              <div className="hist-info"><div className="hist-title">{h.title}</div><div className="hist-meta">{fmtDate(h.updatedAt)}</div></div>
              <button className="del-btn" onClick={e=>delSession(h.id,e)}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* ── SETTINGS ── */}
      {page==="settings"&&(
        <div className="page">
          {!userData?.premium&&(
            <div className="prem-card" onClick={()=>setShowUpgrade(true)}>
              <h3>⭐ Premium Lelo</h3><p>₹99/month — Sab kuch unlimited!</p>
              <div className="pf">✅ Unlimited Chat & Voice</div>
              <div className="pf">✅ Web Search + Image AI</div>
              <div className="pf">✅ Priority Support</div>
            </div>
          )}
          <div className="sec-lbl">Profile</div>
          <div className="set-card">
            <div className="set-row" onClick={()=>setShowProfileEdit(true)}>
              <div className="profile-av">
                {profilePhotoURL
                  ?<img src={profilePhotoURL} className="profile-img" alt="" style={{width:44,height:44,borderRadius:"50%",objectFit:"cover"}}/>
                  :<div className="profile-av-placeholder" style={{width:44,height:44,fontSize:18}}>{displayName[0]?.toUpperCase()}</div>
                }
              </div>
              <div className="set-text"><div className="set-label">{displayName}</div><div className="set-desc">{user.email}</div></div>
              <div style={{display:"flex",gap:6}}>
                {userData?.premium&&<div className="badge">PREMIUM</div>}
                {isAdmin&&<div className="badge">ADMIN</div>}
              </div>
            </div>
            <div className="set-row"><div className="set-icon">📊</div><div className="set-text"><div className="set-label">Usage</div><div className="set-desc">{userData?.premium?"Unlimited":chatsLeft+" free bache hain"}</div></div></div>
          </div>
          <div className="sec-lbl">Voice</div>
          <div className="set-card">
            <div className="set-row">
              <div className="set-icon">🎙️</div>
              <div className="set-text"><div className="set-label">Default Voice</div><div className="set-desc">Voice call mein auto-detect hoga</div></div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setVGender("female")} style={{background:vGender==="female"?"#f9731615":"transparent",border:"1px solid "+(vGender==="female"?"#f97316":"#444"),borderRadius:8,color:vGender==="female"?"#f97316":"#888",cursor:"pointer",padding:"4px 10px",fontFamily:"Inter,sans-serif",fontSize:11}}>👩 F</button>
                <button onClick={()=>setVGender("male")} style={{background:vGender==="male"?"#f9731615":"transparent",border:"1px solid "+(vGender==="male"?"#f97316":"#444"),borderRadius:8,color:vGender==="male"?"#f97316":"#888",cursor:"pointer",padding:"4px 10px",fontFamily:"Inter,sans-serif",fontSize:11}}>👨 M</button>
              </div>
            </div>
            <div className="set-row">
              <div className="set-icon">⚡</div>
              <div className="set-text"><div className="set-label">Speed</div><div className="set-desc">{vSpeed===0.65?"Dheere":vSpeed===1.3?"Tez":"Normal"}</div></div>
              <div className="spd-row" style={{gap:4}}>
                {[{l:"🐢",v:0.65},{l:"●",v:0.92},{l:"⚡",v:1.3}].map(s=>(
                  <button key={s.v} className={"spd-btn"+(vSpeed===s.v?" on":"")} onClick={()=>setVSpeed(s.v)} style={{padding:"4px 8px",minWidth:32}}>{s.l}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="sec-lbl">Appearance</div>
          <div className="set-card">
            <div className="set-row" onClick={()=>setDark(v=>!v)}>
              <div className="set-icon">{dark?"☀️":"🌙"}</div>
              <div className="set-text"><div className="set-label">{dark?"Light Mode":"Dark Mode"}</div><div className="set-desc">Theme badlo</div></div>
              <div className={"toggle"+(dark?" on":"")}><div className="toggle-knob"/></div>
            </div>
          </div>
          <div className="sec-lbl">Account</div>
          <div className="set-card">
            <div className="set-row" onClick={()=>signOut(auth)}><div className="set-icon">🚪</div><div className="set-text"><div className="set-label" style={{color:"#ef4444"}}>Logout</div><div className="set-desc">Sign out karo</div></div></div>
          </div>
        </div>
      )}

      {/* ── ADMIN ── */}
      {page==="admin"&&isAdmin&&(
        <div className="page">
          <div style={{background:"#f9731615",border:"1px solid #f97316",borderRadius:12,padding:"12px 14px",fontSize:13,color:"#fb923c"}}>🛡️ Admin Panel</div>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-val">{adminUsers.length}</div><div className="stat-lbl">👥 Users</div></div>
            <div className="stat-card"><div className="stat-val">{adminUsers.filter(u=>u.premium).length}</div><div className="stat-lbl">⭐ Premium</div></div>
            <div className="stat-card"><div className="stat-val">₹{adminUsers.filter(u=>u.premium).length*99}</div><div className="stat-lbl">💰 Revenue</div></div>
            <div className="stat-card"><div className="stat-val">{adminUsers.reduce((s,u)=>s+(u.usageCount||0),0)}</div><div className="stat-lbl">💬 Chats</div></div>
          </div>
          {/* REAL USER GRAPH */}
          <div className="set-card" style={{padding:16}}>
            <div style={{fontSize:11,fontWeight:700,color:"#6b7280",letterSpacing:".05em",marginBottom:4}}>SIGNUPS — LAST 7 DAYS</div>
            <div className="graph-bars">
              {adminGraph.map((d,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div className="graph-val">{d.v>0?d.v:""}</div>
                  <div style={{width:"100%",background:"#f97316",borderRadius:"3px 3px 0 0",height:Math.max(d.v===0?2:(d.v/maxG)*60,2),opacity:d.v===0?.3:.85}}/>
                  <div className="graph-lbl">{d.l}</div>
                </div>
              ))}
            </div>
          </div>
          {/* SEARCH */}
          <div className="search-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="User dhundho..." value={adminSearch} onChange={e=>setAdminSearch(e.target.value)}/>
          </div>
          {adminUsers.some(u=>u.premiumPending&&!u.premium)&&(
            <>
              <div className="sec-lbl">⏳ Pending ({adminUsers.filter(u=>u.premiumPending&&!u.premium).length})</div>
              {adminUsers.filter(u=>u.premiumPending&&!u.premium).map(u=>(
                <div key={u.id} className="u-card" style={{border:"1px solid #eab308"}}>
                  <div className="u-av">{u.name?.[0]?.toUpperCase()}</div>
                  <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{u.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{u.email}</div></div>
                  <button onClick={()=>adminToggle(u.id,false)} style={{background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,padding:"6px 12px"}}>✅ Approve</button>
                </div>
              ))}
            </>
          )}
          <div className="sec-lbl">All Users ({filteredAdminUsers.length})</div>
          {filteredAdminUsers.map(u=>(
            <div key={u.id} className="u-card" style={{flexDirection:"column",alignItems:"stretch",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {u.photoURL?<img src={u.photoURL} style={{width:36,height:36,borderRadius:"50%",objectFit:"cover"}} alt=""/>:<div className="u-av">{u.name?.[0]?.toUpperCase()}</div>}
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600}}>{u.name}</div>
                  <div style={{fontSize:11,color:"#6b7280"}}>{u.email} • {u.usageCount||0} chats</div>
                </div>
                {u.premium&&<div className="badge-g">⭐</div>}
                {u.email===ADMIN_EMAIL&&<div className="badge">ADMIN</div>}
                {u.premiumPending&&!u.premium&&<div className="badge-y">PENDING</div>}
              </div>
              {u.email!==ADMIN_EMAIL&&(
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>adminViewUserChat(u)} style={{flex:1,background:"#3b82f620",border:"1px solid #3b82f6",borderRadius:8,color:"#3b82f6",cursor:"pointer",fontSize:12,fontWeight:700,padding:8}}>💬 Chats Dekho</button>
                  <button onClick={()=>adminToggle(u.id,u.premium)} style={{flex:1,background:u.premium?"#ef444420":"#22c55e20",border:"1px solid "+(u.premium?"#ef4444":"#22c55e"),borderRadius:8,color:u.premium?"#ef4444":"#22c55e",cursor:"pointer",fontSize:12,fontWeight:700,padding:8}}>{u.premium?"❌ Remove":"✅ Premium"}</button>
                  <button onClick={()=>adminDel(u.id)} style={{background:"#ef444415",border:"1px solid #ef4444",borderRadius:8,color:"#ef4444",cursor:"pointer",fontSize:12,padding:"8px 12px"}}>🗑️</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── MODALS ── */}
      {showLimit&&(
        <div className="modal-bg" onClick={()=>setShowLimit(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-icon">⏳</div>
            <h3>Free Limit Ho Gai!</h3>
            <p>Unlimited access ke liye Premium lo</p>
            <button className="btn btn-primary" onClick={()=>{setShowLimit(false);setShowUpgrade(true);}}>⭐ Premium Lo — ₹99/month</button>
            <button className="btn btn-secondary" onClick={()=>setShowLimit(false)}>Baad mein</button>
          </div>
        </div>
      )}

      {showUpgrade&&(
        <div className="modal-bg" onClick={()=>setShowUpgrade(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-icon">⭐</div>
            <h3>Saraswati AI Premium</h3>
            <p>₹99/month — Sab kuch unlimited!</p>
            <div className="pay-box">
              <div style={{fontSize:13,fontWeight:700,color:"#f97316",textAlign:"center"}}>📱 PhonePe / GPay / UPI</div>
              <div className="pay-num">{PHONEPAY}</div>
              <div className="pay-step">1️⃣ <span>₹99 bhejo PhonePe ya GPay se</span></div>
              <div className="pay-step">2️⃣ <span>UTR ya screenshot note karo</span></div>
              <div className="pay-step">3️⃣ <span>"Payment Ho Gayi" dabao</span></div>
            </div>
            {!payDone?(
              <button className="btn btn-primary" onClick={()=>setPayDone(true)}>✅ Payment Ho Gayi</button>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{fontSize:13,color:"#6b7280",textAlign:"center"}}>Admin 24 ghante mein activate karega</div>
                <button className="btn btn-primary" onClick={async()=>{
                  await setDoc(doc(db,"users",user.uid),{premiumPending:true,premiumRequestedAt:serverTimestamp()},{merge:true});
                  setUserData(p=>({...p,premiumPending:true}));
                  setShowUpgrade(false); setPayDone(false);
                  alert("✅ Request bhej di gai!");
                }}>📨 Request Submit Karo</button>
              </div>
            )}
            <button className="btn btn-secondary" onClick={()=>{setShowUpgrade(false);setPayDone(false);}}>Cancel</button>
          </div>
        </div>
      )}

      {/* PROFILE EDIT MODAL */}
      {showProfileEdit&&(
        <div className="modal-bg" onClick={()=>setShowProfileEdit(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3>✏️ Profile Edit Karo</h3>
            <input type="file" ref={profilePhotoRef} accept="image/*" style={{display:"none"}} onChange={handleProfilePhoto}/>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
              <div className="profile-av" style={{cursor:"pointer"}} onClick={()=>profilePhotoRef.current?.click()}>
                {(profilePhoto||profilePhotoURL)
                  ?<img src={profilePhoto||profilePhotoURL} className="profile-img" alt=""/>
                  :<div className="profile-av-placeholder">{profileName[0]?.toUpperCase()||"?"}</div>
                }
                <div className="profile-edit-badge">📷</div>
              </div>
              <div style={{fontSize:12,color:"#6b7280"}}>Photo pe tap karo change ke liye</div>
            </div>
            <div className="inp-wrap">
              <div className="inp-label">NAAM</div>
              <input className="inp" placeholder="Apna naam" value={profileName} onChange={e=>setProfileName(e.target.value)}/>
            </div>
            <button className="btn btn-primary" onClick={saveProfile} disabled={profileSaving}>{profileSaving?"Save ho raha hai...":"💾 Save Karo"}</button>
            <button className="btn btn-secondary" onClick={()=>setShowProfileEdit(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ADMIN: USER CHAT MODAL */}
      {adminViewChat&&(
        <div className="modal-bg" onClick={()=>setAdminViewChat(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3>💬 {adminViewChat.user.name} ki Chat</h3>
            <p style={{fontSize:12}}>{adminViewChat.user.email}</p>
            {adminChatLoading?<div className="loading">⏳ Load ho raha hai...</div>:(
              <div className="admin-chat-area">
                {adminViewChat.msgs.length===0?<div style={{textAlign:"center",color:"#6b7280",fontSize:13}}>Koi chat nahi</div>:adminViewChat.msgs.map((m,i)=>(
                  <div key={i} style={{display:"flex",flexDirection:"column",gap:2,alignItems:m.role==="user"?"flex-end":"flex-start"}}>
                    <div style={{background:m.role==="user"?"#f97316":"#2a2a2a",color:"#fff",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",padding:"8px 12px",fontSize:12,maxWidth:"85%"}}>
                      {m.text?.slice(0,200)}{m.text?.length>200?"...":""}
                    </div>
                    <div style={{fontSize:10,color:"#6b7280"}}>{m.role==="user"?"User":"AI"} • {fmtTime(m.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-secondary" onClick={()=>setAdminViewChat(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
