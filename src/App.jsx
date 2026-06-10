cat > /mnt/user-data/outputs/App.jsx << 'ENDOFFILE'
import { useState, useEffect, useRef } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, orderBy, getDocs, deleteDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const ADMIN_EMAIL = "kunalsaraswat691@gmail.com";
const PHONEPAY = "8126630980";
const FREE_LIMIT = 49;

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

function needsSearch(text) {
  return ["news","score","weather","mausam","price","rate","mandi","bhav","today","aaj","sona","gold","chandi","silver","loha","tambe","pital","kisan","fasal","2025","2026"].some(k => text.toLowerCase().includes(k));
}

function isOwnerQ(text) {
  return ["kisne banaya","who made","who created","owner","creator","malik","kaun hai tera"].some(k => text.toLowerCase().includes(k));
}

async function callAI(messages, imageB64) {
  const last = messages[messages.length - 1];
  if (last?.role === "user" && isOwnerQ(last.text)) return "Mujhe **Kunal Saraswat** ne banaya hai! 😊";
  let ctx = "";
  if (last?.role === "user" && needsSearch(last.text)) {
    const r = await webSearch(last.text);
    if (r) ctx = "\n\nWeb Search:\n" + r;
  }
  const sys = `You are Saraswati AI — Goddess of Knowledge, intelligent warm assistant for Indian users.
IDENTITY: Owner → "Mujhe Kunal Saraswat ne banaya hai!" | How built → "Private hai!" | Never say Groq/Meta.
LANGUAGE: Always reply in user's EXACT language.
PERSONALITY: Warm, friendly like best friend. Understand emotions.
KISAN MANDI: Ask location first → ask mandi name → give real rates.
FARMING: Expert — crops, irrigation, fertilizers, PM Kisan, KCC, Fasal Bima.
CODING: Complete working code always.${ctx}`;
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

// ── VOICE SPEAK — gender aware ─────────────────────────────────
function speakText(text, gender, speed, onDone) {
  window.speechSynthesis.cancel();
  const clean = text.replace(/```[\s\S]*?```/g, "code").replace(/\*\*/g, "").replace(/`/g, "").replace(/#+\s/g, "").slice(0, 600);
  const trySpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    let voice = null;
    if (gender === "female") {
      voice = voices.find(v => /female|woman|girl/i.test(v.name) && v.lang.startsWith("hi"))
        || voices.find(v => v.lang.startsWith("hi"))
        || voices.find(v => /female|woman/i.test(v.name))
        || voices.find(v => v.lang.startsWith("en-IN"))
        || voices[0];
    } else {
      voice = voices.find(v => /male|man|boy|ravi|hemant|prabhat/i.test(v.name) && !(/female|woman/i.test(v.name)) && v.lang.startsWith("hi"))
        || voices.find(v => v.lang.startsWith("hi"))
        || voices[0];
    }
    const utt = new SpeechSynthesisUtterance(clean);
    if (voice) utt.voice = voice;
    utt.lang = "hi-IN";
    utt.rate = speed || 0.92;
    utt.pitch = gender === "female" ? 1.35 : 0.8;
    utt.volume = 1;
    utt.onend = onDone || null;
    utt.onerror = onDone || null;
    window.speechSynthesis.speak(utt);
  };
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; trySpeak(); };
  } else trySpeak();
}

function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const canPrev = ["html","css","js","javascript",""].includes((lang||"").toLowerCase());
  return (
    <div style={{background:"#0d0d0d",border:"1px solid #333",borderRadius:10,margin:"6px 0",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 12px",background:"#1a1a1a",borderBottom:"1px solid #333"}}>
        <span style={{fontSize:11,color:"#6b7280",fontFamily:"monospace"}}>{lang||"code"}</span>
        <div style={{display:"flex",gap:8}}>
          {canPrev && <button onClick={()=>setPreview(v=>!v)} style={{background:"none",border:"none",color:preview?"#f97316":"#6b7280",cursor:"pointer",fontSize:11,padding:"2px 6px"}}>{preview?"✕":"▶ Preview"}</button>}
          <button onClick={()=>{navigator.clipboard?.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{background:"none",border:"none",color:copied?"#22c55e":"#6b7280",cursor:"pointer",fontSize:11,padding:"2px 6px"}}>{copied?"✓":"Copy"}</button>
        </div>
      </div>
      <pre style={{padding:"12px",margin:0,overflowX:"auto",fontSize:12,lineHeight:1.6,color:"#e5e7eb",fontFamily:"monospace",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{code}</pre>
      {preview && canPrev && (
        <div style={{borderTop:"1px solid #333"}}>
          <div style={{padding:"6px 12px",background:"#1a1a1a",fontSize:11,color:"#f97316"}}>🌐 Live Preview</div>
          <iframe srcDoc={lang==="css"?"<style>"+code+"</style><p>Preview</p>":code} style={{width:"100%",minHeight:300,border:"none",background:"#fff"}} sandbox="allow-scripts" title="p"/>
        </div>
      )}
    </div>
  );
}

function AIText({ text }) {
  if (!text) return null;
  const parts = []; const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type:"text", content:text.slice(last,m.index) });
    parts.push({ type:"code", lang:m[1], content:m[2].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type:"text", content:text.slice(last) });
  return (
    <span style={{display:"flex",flexDirection:"column",gap:4}}>
      {parts.map((part,idx) => {
        if (part.type === "code") return <CodeBlock key={idx} code={part.content} lang={part.lang}/>;
        return part.content.split("\n").map((line,i) => {
          if (!line.trim()) return <span key={idx+"-"+i} style={{height:6}}/>;
          const segs = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((s,j) => {
            if (s.startsWith("**")&&s.endsWith("**")) return <strong key={j}>{s.slice(2,-2)}</strong>;
            if (s.startsWith("`")&&s.endsWith("`")) return <code key={j} style={{background:"#ffffff18",borderRadius:4,padding:"1px 6px",fontFamily:"monospace",fontSize:12}}>{s.slice(1,-1)}</code>;
            return s;
          });
          if (line.trim().startsWith("- ")||line.trim().startsWith("• ")) return <span key={idx+"-"+i} style={{display:"flex",gap:8}}><span style={{color:"#f97316"}}>•</span><span>{segs}</span></span>;
          if (/^\d+\.\s/.test(line.trim())) return <span key={idx+"-"+i} style={{display:"flex",gap:8}}><span style={{color:"#f97316",minWidth:16}}>{line.match(/^\d+/)[0]}.</span><span>{segs}</span></span>;
          if (line.startsWith("### ")) return <strong key={idx+"-"+i} style={{fontSize:15,color:"#f97316"}}>{line.slice(4)}</strong>;
          if (line.startsWith("## ")) return <strong key={idx+"-"+i} style={{fontSize:16,color:"#f97316"}}>{line.slice(3)}</strong>;
          if (line.startsWith("# ")) return <strong key={idx+"-"+i} style={{fontSize:17,color:"#f97316"}}>{line.slice(2)}</strong>;
          return <span key={idx+"-"+i}>{segs}</span>;
        });
      })}
    </span>
  );
}

function buildCSS(dark) {
  const v = dark
    ? {bg:"#0f0f0f",surface:"#1a1a1a",surface2:"#222",border:"#2a2a2a",text:"#f5f5f5",muted:"#6b7280",bubble:"#1e1e1e"}
    : {bg:"#f8f8f8",surface:"#ffffff",surface2:"#f0f0f0",border:"#e0e0e0",text:"#1a1a1a",muted:"#888",bubble:"#ffffff"};
  return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',sans-serif;background:${v.bg};color:${v.text};height:100dvh;overflow:hidden;}
.app{display:flex;flex-direction:column;height:100dvh;max-width:480px;margin:0 auto;background:${v.bg};}
.auth{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;gap:20px;background:radial-gradient(ellipse at 50% -10%,#f9731620 0%,transparent 60%);}
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
.header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:${v.bg};border-bottom:1px solid ${v.border};position:relative;z-index:20;}
.header-logo{font-size:24px;}.header-name{font-size:16px;font-weight:700;flex:1;color:${v.text};}
.dots-btn{background:none;border:none;color:${v.text};cursor:pointer;font-size:22px;padding:6px;border-radius:10px;line-height:1;}
.new-btn{background:${v.surface2};border:1px solid ${v.border};border-radius:10px;color:${v.text};cursor:pointer;font-size:13px;font-weight:600;padding:8px 14px;}
.dropdown{position:absolute;top:56px;left:12px;background:${v.surface};border:1px solid ${v.border};border-radius:16px;padding:8px;min-width:220px;z-index:100;box-shadow:0 8px 32px #0008;animation:fadeIn .15s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
.drop-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;color:${v.text};transition:background .15s;}
.drop-item:hover{background:${v.surface2};}.drop-item.danger{color:#ef4444;}
.drop-divider{height:1px;background:${v.border};margin:4px 0;}
.drop-user{padding:12px 14px;}.drop-name{font-size:15px;font-weight:700;}.drop-email{font-size:11px;color:${v.muted};margin-top:2px;}
.prem-tag{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-top:4px;display:inline-block;}
.usage-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 16px;background:${v.surface};border-bottom:1px solid ${v.border};font-size:11px;color:${v.muted};}
.usage-pill{background:${v.surface2};border-radius:20px;padding:3px 10px;font-weight:600;}
.chat-area{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:16px;scroll-behavior:smooth;}
.chat-area::-webkit-scrollbar{width:0;}
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:32px 20px;}
.lotus{font-size:88px;animation:breath 3s ease-in-out infinite;cursor:pointer;display:block;line-height:1;}
@keyframes breath{0%,100%{transform:scale(1);}50%{transform:scale(1.18);}}
.welcome h2{font-size:24px;font-weight:700;}.welcome-sub{font-size:13px;color:${v.muted};max-width:280px;line-height:1.6;}
.msg-wrap{display:flex;flex-direction:column;gap:4px;animation:slideUp .25s ease;}
@keyframes slideUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.msg-row{display:flex;gap:8px;align-items:flex-end;}.msg-row.user{flex-direction:row-reverse;}
.bubble{max-width:82%;padding:12px 16px;font-size:14px;line-height:1.65;word-break:break-word;}
.bubble.user{background:#f97316;color:#fff;border-radius:20px 20px 4px 20px;}
.bubble.ai{background:${v.bubble};color:${v.text};border:1px solid ${v.border};border-radius:20px 20px 20px 4px;}
.msg-time{font-size:10px;color:${v.muted};padding:0 4px;}.msg-time.user{text-align:right;}
.ai-av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.typing-bub{background:${v.bubble};border:1px solid ${v.border};border-radius:20px 20px 20px 4px;padding:14px 18px;display:flex;gap:5px;}
.dot{width:7px;height:7px;border-radius:50%;background:#f97316;animation:bounce 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}.dot:nth-child(3){animation-delay:.4s;}
@keyframes bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-6px);}}
.msg-acts{display:flex;gap:5px;padding:2px 36px;flex-wrap:wrap;}
.act-btn{background:none;border:1px solid ${v.border};color:${v.muted};cursor:pointer;font-size:11px;padding:3px 9px;border-radius:20px;font-family:'Inter',sans-serif;display:flex;align-items:center;gap:3px;transition:all .15s;}
.act-btn:hover{color:#f97316;border-color:#f97316;}
.act-btn.on{color:#f97316;border-color:#f97316;background:#f9731615;}
.search-ind{font-size:11px;color:#f97316;padding:4px 10px;background:#f9731615;border-radius:20px;display:inline-flex;align-items:center;gap:4px;}
.input-bar{padding:10px 14px;border-top:1px solid ${v.border};background:${v.bg};display:flex;gap:8px;align-items:flex-end;}
.msg-inp{flex:1;background:${v.surface};border:1.5px solid ${v.border};border-radius:24px;color:${v.text};font-family:'Inter',sans-serif;font-size:14px;padding:12px 18px;outline:none;resize:none;max-height:120px;min-height:48px;transition:border-color .2s;line-height:1.5;}
.msg-inp:focus{border-color:#f97316;}.msg-inp::placeholder{color:${v.muted};}
.send-btn{background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:18px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.send-btn:disabled{opacity:.4;cursor:not-allowed;}
.icon-btn{background:${v.surface2};border:1.5px solid ${v.border};border-radius:50%;color:${v.text};cursor:pointer;width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.icon-btn.rec{border-color:#ef4444;background:#ef444420;animation:micPulse 1s infinite;}
@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 #ef444440;}50%{box-shadow:0 0 0 6px #ef444400;}}
.img-prev{position:relative;display:inline-block;margin-bottom:8px;}
.img-prev img{width:80px;height:80px;object-fit:cover;border-radius:12px;border:2px solid #f97316;}
.img-prev-x{position:absolute;top:-6px;right:-6px;background:#ef4444;border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:12px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;}
.msg-img{max-width:200px;border-radius:12px;margin-bottom:4px;display:block;}
.page{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
.page-title{font-size:18px;font-weight:700;margin-bottom:4px;}
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
.modal-bg{position:fixed;inset:0;background:#000a;z-index:200;display:flex;align-items:flex-end;padding:16px;}
.modal{background:${v.surface};border-radius:24px 24px 16px 16px;padding:28px 24px;width:100%;max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:14px;}
.modal h3{font-size:20px;font-weight:700;text-align:center;}.modal p{font-size:14px;color:${v.muted};text-align:center;line-height:1.6;}
.modal-icon{font-size:52px;text-align:center;}
.pay-box{background:${v.surface2};border:1px solid ${v.border};border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;}
.pay-num{font-size:22px;font-weight:800;color:#f97316;text-align:center;letter-spacing:2px;}
.pay-step{font-size:13px;color:${v.text};display:flex;gap:8px;}
.loading{text-align:center;color:${v.muted};padding:20px;font-size:14px;}
.toggle{position:relative;width:44px;height:24px;background:${v.surface2};border-radius:12px;cursor:pointer;border:2px solid ${v.border};transition:background .2s;flex-shrink:0;}
.toggle.on{background:#f97316;border-color:#f97316;}
.toggle-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;}
.toggle.on .toggle-knob{left:22px;}
.graph-bars{display:flex;align-items:flex-end;gap:4px;height:70px;margin-top:8px;}
.graph-lbl{font-size:9px;color:${v.muted};text-align:center;margin-top:3px;}
/* VOICE PAGE */
.voice-page{flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:24px;}
.voice-card{background:${v.surface};border:1px solid ${v.border};border-radius:28px;padding:28px 24px;display:flex;flex-direction:column;align-items:center;gap:18px;width:100%;max-width:340px;}
.voice-orb-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:140px;height:140px;}
.v-ring{position:absolute;border-radius:50%;pointer-events:none;}
.v-ring-1{animation:vr 1.8s ease-out infinite;background:#f9731622;}
.v-ring-2{animation:vr 1.8s ease-out .4s infinite;background:#f9731614;}
.v-ring-3{animation:vr 1.8s ease-out .8s infinite;background:#f9731608;}
@keyframes vr{0%{width:90px;height:90px;opacity:.8;}100%{width:160px;height:160px;opacity:0;}}
.voice-orb{width:92px;height:92px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;position:relative;font-size:38px;box-shadow:0 4px 28px #f9731650;transition:all .3s;}
.voice-orb:hover{transform:scale(1.05);}
.voice-orb.listening{background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 0 0 8px #ef444430;animation:orbP 1s infinite;}
.voice-orb.speaking{background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 4px 28px #22c55e60;}
.voice-orb.thinking{background:linear-gradient(135deg,#8b5cf6,#6d28d9);}
@keyframes orbP{0%,100%{transform:scale(1);}50%{transform:scale(1.07);}}
.voice-status{font-size:16px;font-weight:700;}
.voice-hint{font-size:11px;color:${v.muted};text-align:center;max-width:260px;}
.gender-row{display:flex;gap:8px;width:100%;}
.g-btn{flex:1;padding:10px;border-radius:12px;border:1.5px solid ${v.border};background:${v.surface2};color:${v.text};cursor:pointer;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;transition:all .2s;}
.g-btn.active{border-color:#f97316;background:#f9731615;color:#f97316;}
.spd-row{display:flex;gap:6px;width:100%;}
.spd-btn{flex:1;padding:8px;border-radius:10px;border:1.5px solid ${v.border};background:${v.surface2};color:${v.text};cursor:pointer;font-size:11px;font-weight:600;font-family:'Inter',sans-serif;transition:all .2s;}
.spd-btn.active{border-color:#f97316;color:#f97316;background:#f9731615;}
.v-end-btn{background:#ef444420;border:1.5px solid #ef4444;border-radius:12px;color:#ef4444;cursor:pointer;font-size:14px;font-weight:700;padding:12px;font-family:'Inter',sans-serif;width:100%;}
.v-last{background:${v.surface2};border-radius:12px;padding:10px 14px;width:100%;}
`;
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

export default function App() {
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
  const [hists, setHists] = useState([]);
  const [histLoad, setHistLoad] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [userData, setUserData] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [imgB64, setImgB64] = useState(null);
  const [imgPrev, setImgPrev] = useState(null);
  const [payDone, setPayDone] = useState(false);
  const [speakId, setSpeakId] = useState(null);
  // mic for text input
  const [micActive, setMicActive] = useState(false);
  // voice call page
  const [vStatus, setVStatus] = useState("idle"); // idle|listening|thinking|speaking
  const [vGender, setVGender] = useState("female");
  const [vSpeed, setVSpeed] = useState(0.92);
  const [copied, setCopied] = useState(null);

  const bottomRef = useRef(null);
  const galleryRef = useRef(null);
  const micRef = useRef(null);
  const voiceRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        setUser(u);
        const d = await getDoc(doc(db, "users", u.uid));
        if (d.exists()) setUserData(d.data());
      } else { setUser(null); setUserData(null); }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, loading]);

  useEffect(() => {
    if (user && page === "history") loadHists();
    if (user && page === "admin") loadAdmin();
    window.speechSynthesis?.cancel();
    setSpeakId(null);
    if (page !== "voice") endVoice();
  }, [page]);

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

  async function loadAdmin() {
    const snap = await getDocs(collection(db,"users"));
    setAdminUsers(snap.docs.map(d => ({ id:d.id, ...d.data() })));
  }

  async function handleAuth() {
    setFormErr(""); setFormOk("");
    if (forgotMode) {
      if (!form.email) { setFormErr("Email daalo!"); return; }
      setFormLoading(true);
      try {
        await sendPasswordResetEmail(auth, form.email);
        setFormOk("✅ Reset link bhej diya! Email check karo.");
        setForm(f => ({ ...f, email:"" }));
      } catch(e) { setFormErr("Email registered nahi hai!"); }
      setFormLoading(false); return;
    }
    if (!form.email || !form.pass) { setFormErr("Sab fields bharo!"); return; }
    if (form.pass.length < 8) { setFormErr("Password 8+ characters!"); return; }
    if (authMode === "signup" && !form.name) { setFormErr("Naam daalo!"); return; }
    setFormLoading(true);
    try {
      if (authMode === "signup") {
        const c = await createUserWithEmailAndPassword(auth, form.email, form.pass);
        await updateProfile(c.user, { displayName:form.name });
        await setDoc(doc(db,"users",c.user.uid), { name:form.name, email:form.email, premium:false, createdAt:serverTimestamp(), usageCount:0 });
        setUserData({ name:form.name, email:form.email, premium:false, usageCount:0 });
      } else {
        await signInWithEmailAndPassword(auth, form.email, form.pass);
        const d = await getDoc(doc(db,"users",auth.currentUser.uid));
        if (d.exists()) setUserData(d.data());
      }
      setForm({ name:"", email:"", pass:"" });
    } catch(e) {
      const errs = {"auth/email-already-in-use":"Email already registered!","auth/invalid-email":"Invalid email!","auth/wrong-password":"Wrong password!","auth/user-not-found":"Account nahi mila!","auth/invalid-credential":"Wrong email ya password!"};
      setFormErr(errs[e.code] || e.message);
    }
    setFormLoading(false);
  }

  // ── GALLERY — fixed to actually send image ──────────────────
  function handleGallery(e) {
    const file = e.target.files[0];
    if (!file) return;
    // Reset input so same file can be selected again
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target.result;
      setImgB64(result.split(",")[1]);
      setImgPrev(result);
    };
    reader.readAsDataURL(file);
  }

  // ── MIC for text input — fixed ──────────────────────────────
  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Chrome mein voice use karo!"); return; }
    if (micActive) {
      micRef.current?.abort();
      setMicActive(false);
      return;
    }
    const r = new SR();
    r.lang = navigator.language || "hi-IN";
    r.continuous = false;
    r.interimResults = false;
    r.onstart = () => setMicActive(true);
    r.onresult = e => {
      const t = e.results[0][0].transcript;
      setInput(prev => prev ? prev + " " + t : t);
    };
    r.onerror = () => setMicActive(false);
    r.onend = () => setMicActive(false);
    micRef.current = r;
    try { r.start(); } catch(e) { setMicActive(false); }
  }

  // ── SPEAK msg ───────────────────────────────────────────────
  function toggleSpeak(msgId, text) {
    if (speakId === msgId) { window.speechSynthesis?.cancel(); setSpeakId(null); return; }
    setSpeakId(msgId);
    speakText(text, vGender, vSpeed, () => setSpeakId(null));
  }

  function copyMsg(text, id) {
    navigator.clipboard?.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function shareWA(text) {
    window.open("https://wa.me/?text=" + encodeURIComponent("Saraswati AI:\n\n" + text.slice(0,500)), "_blank");
  }

  function exportChat() {
    if (!msgs.length) { alert("Koi chat nahi!"); return; }
    const txt = msgs.map(m => (m.role==="user"?"Aap":"Saraswati AI") + ":\n" + m.text).join("\n\n---\n\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type:"text/plain" }));
    a.download = "saraswati-chat.txt"; a.click();
  }

  // ── VOICE CALL ──────────────────────────────────────────────
  function endVoice() {
    voiceRef.current?.abort();
    window.speechSynthesis?.cancel();
    setVStatus("idle");
  }

  async function handleOrb() {
    if (vStatus === "listening") { voiceRef.current?.abort(); setVStatus("idle"); return; }
    if (vStatus === "speaking") { window.speechSynthesis?.cancel(); setVStatus("idle"); return; }
    if (vStatus === "thinking") return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Chrome use karo voice ke liye!"); return; }

    const r = new SR();
    r.lang = navigator.language || "hi-IN";
    r.continuous = false;
    r.interimResults = false;

    r.onresult = async e => {
      const transcript = e.results[0][0].transcript;
      if (!transcript.trim()) { setVStatus("idle"); return; }
      setVStatus("thinking");

      const ud = userData;
      if (!ud?.premium && (ud?.usageCount||0) >= FREE_LIMIT) { setShowLimit(true); setVStatus("idle"); return; }

      const uRef = await addDoc(collection(db,"messages"), { sessionId:sid, userId:user.uid, role:"user", text:transcript, createdAt:serverTimestamp() });
      const newMsgs = [...msgs, { id:uRef.id, role:"user", text:transcript, time:new Date() }];
      setMsgs(newMsgs);
      await setDoc(doc(db,"chats",sid), { userId:user.uid, title:transcript.slice(0,45), updatedAt:serverTimestamp(), createdAt:serverTimestamp() }, { merge:true });
      const nc = (ud?.usageCount||0) + 1;
      await setDoc(doc(db,"users",user.uid), { usageCount:nc }, { merge:true });
      setUserData(prev => ({ ...prev, usageCount:nc }));

      try {
        const aiText = await callAI(newMsgs, null);
        const tid = "tmp_" + Date.now();
        setMsgs(prev => [...prev, { id:tid, role:"ai", text:aiText, time:new Date() }]);
        await addDoc(collection(db,"messages"), { sessionId:sid, userId:user.uid, role:"ai", text:aiText, createdAt:serverTimestamp() });
        setVStatus("speaking");
        // Gender-matched voice: user female → AI female, user male → AI male (Saraswati)
        speakText(aiText, vGender, vSpeed, () => setVStatus("idle"));
      } catch(err) {
        setMsgs(prev => [...prev, { id:Date.now(), role:"ai", text:"❌ " + err.message, time:new Date() }]);
        setVStatus("idle");
      }
    };
    r.onerror = e => { console.error("Voice error:", e.error); setVStatus("idle"); };
    r.onend = () => { if (vStatus === "listening") setVStatus("idle"); };
    voiceRef.current = r;
    try { r.start(); setVStatus("listening"); } catch(e) { setVStatus("idle"); }
  }

  // ── SEND TEXT/IMAGE MSG ─────────────────────────────────────
  async function sendMsg(text) {
    const txt = text || input.trim();
    if ((!txt && !imgB64) || loading) return;
    const ud = userData;
    if (!ud?.premium && (ud?.usageCount||0) >= FREE_LIMIT) { setShowLimit(true); return; }
    const msgText = txt || "Is image mein kya hai?";
    setInput("");
    const b64 = imgB64, prev = imgPrev;
    setImgB64(null); setImgPrev(null);
    const uRef = await addDoc(collection(db,"messages"), { sessionId:sid, userId:user.uid, role:"user", text:msgText, image:prev||null, createdAt:serverTimestamp() });
    const newMsgs = [...msgs, { id:uRef.id, role:"user", text:msgText, image:prev, time:new Date() }];
    setMsgs(newMsgs);
    await setDoc(doc(db,"chats",sid), { userId:user.uid, title:msgText.slice(0,45), updatedAt:serverTimestamp(), createdAt:serverTimestamp() }, { merge:true });
    const nc = (ud?.usageCount||0) + 1;
    await setDoc(doc(db,"users",user.uid), { usageCount:nc }, { merge:true });
    setUserData(prev => ({ ...prev, usageCount:nc }));
    if (needsSearch(msgText)) setSearching(true);
    setLoading(true);
    try {
      const aiText = await callAI(newMsgs, b64);
      setSearching(false);
      const tid = "tmp_" + Date.now();
      setLoading(false);
      setMsgs(prev => [...prev, { id:tid, role:"ai", text:"", time:new Date() }]);
      let shown = "";
      for (let i = 0; i < aiText.length; i++) {
        shown += aiText[i];
        const s = shown;
        setMsgs(prev => prev.map(m => m.id === tid ? { ...m, text:s } : m));
        await new Promise(r => setTimeout(r, 8));
      }
      await addDoc(collection(db,"messages"), { sessionId:sid, userId:user.uid, role:"ai", text:aiText, createdAt:serverTimestamp() });
    } catch(e) {
      setSearching(false); setLoading(false);
      setMsgs(prev => [...prev, { id:Date.now(), role:"ai", text:"❌ Error: " + e.message, time:new Date() }]);
    }
  }

  async function loadSession(s) {
    try {
      setPage("chat"); setSid(s.id); setMsgs([]);
      const q = query(collection(db,"messages"), where("sessionId","==",s.id));
      const snap = await getDocs(q);
      setMsgs(snap.docs.map(d=>({id:d.id,...d.data(),time:d.data().createdAt})).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)));
    } catch(e) { alert("❌ " + e.message); }
  }

  async function delSession(id, e) {
    e.stopPropagation();
    await deleteDoc(doc(db,"chats",id));
    setHists(prev => prev.filter(h => h.id !== id));
  }

  async function adminToggle(uid, current) {
    await updateDoc(doc(db,"users",uid), { premium:!current, premiumPending:false });
    setAdminUsers(prev => prev.map(u => u.id===uid ? { ...u, premium:!current } : u));
  }

  async function adminDel(uid) {
    if (!window.confirm("Delete karo?")) return;
    await deleteDoc(doc(db,"users",uid));
    setAdminUsers(prev => prev.filter(u => u.id !== uid));
  }

  function newChat() {
    setSid(Date.now().toString()); setMsgs([]); setPage("chat");
    setShowMenu(false); setImgB64(null); setImgPrev(null); endVoice();
  }

  const isAdmin = user?.email === ADMIN_EMAIL;
  const chatsLeft = userData?.premium ? null : Math.max(0, FREE_LIMIT - (userData?.usageCount||0));
  const adminGraph = Array.from({length:7}, (_,i) => ({ l:["M","T","W","T","F","S","S"][i], v:Math.max(1, adminUsers.length ? Math.floor(adminUsers.length*(i+1)*0.15) : i+1) }));
  const maxG = Math.max(...adminGraph.map(d=>d.v), 1);
  const orbIcon = vStatus==="listening"?"🎙️":vStatus==="thinking"?"🤔":vStatus==="speaking"?"🔊":"🪷";
  const orbText = vStatus==="idle"?"Tap to speak":vStatus==="listening"?"Sun raha hoon... 👂":vStatus==="thinking"?"Soch rahi hoon... 💭":"Bol rahi hoon... 🔊";
  const displayName = userData?.name || user?.displayName || "User";

  if (!authReady) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100dvh",background:"#0f0f0f"}}>
      <style>{buildCSS(true)}</style>
      <span style={{fontSize:48}}>🪷</span>
      <div style={{marginTop:12,color:"#6b7280"}}>Loading...</div>
    </div>
  );

  if (!user) return (
    <div className="app">
      <style>{buildCSS(dark)}</style>
      <div className="auth">
        <div className="auth-logo">🪷</div>
        <div className="auth-title">Saraswati AI</div>
        <div className="auth-sub">Your intelligent AI assistant</div>
        <div className="auth-card">
          {forgotMode ? (
            <>
              <div className="auth-head">🔑 Forgot Password</div>
              <div className="inp-wrap">
                <div className="inp-label">EMAIL</div>
                <input className="inp" type="email" placeholder="email@example.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
              </div>
              {formErr&&<div className="err">{formErr}</div>}
              {formOk&&<div className="ok">{formOk}</div>}
              <button className="btn btn-primary" onClick={handleAuth} disabled={formLoading}>{formLoading?"Sending...":"📧 Send Reset Link"}</button>
              <div className="auth-switch"><span onClick={()=>{setForgotMode(false);setFormErr("");setFormOk("");}}>← Back</span></div>
            </>
          ) : (
            <>
              <div className="auth-head">{authMode==="login"?"Welcome Back 👋":"Create Account ✨"}</div>
              {authMode==="signup"&&<div className="inp-wrap"><div className="inp-label">NAME</div><input className="inp" placeholder="Apna naam" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>}
              <div className="inp-wrap"><div className="inp-label">EMAIL</div><input className="inp" type="email" placeholder="email@example.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
              <div className="inp-wrap">
                <div className="inp-label">PASSWORD</div>
                <input className="inp" type="password" placeholder="Min 8 characters" value={form.pass} onChange={e=>setForm(f=>({...f,pass:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
                <div className="inp-hint">⚠️ Min 8 characters</div>
              </div>
              {formErr&&<div className="err">{formErr}</div>}
              <button className="btn btn-primary" onClick={handleAuth} disabled={formLoading}>{formLoading?"Wait...":authMode==="login"?"Login →":"Create Account →"}</button>
              {authMode==="login"&&<div className="forgot-link" onClick={()=>{setForgotMode(true);setFormErr("");setFormOk("");}}>Forgot Password?</div>}
            </>
          )}
        </div>
        {!forgotMode&&<div className="auth-switch">
          {authMode==="login"?<>No account? <span onClick={()=>{setAuthMode("signup");setFormErr("");}}>Sign up</span></>:<>Have account? <span onClick={()=>{setAuthMode("login");setFormErr("");}}>Login</span></>}
        </div>}
      </div>
    </div>
  );

  return (
    <div className="app" onClick={()=>showMenu&&setShowMenu(false)}>
      <style>{buildCSS(dark)}</style>

      {/* HEADER — dots on LEFT */}
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
          <div className="drop-item" onClick={()=>{setDark(v=>!v);setShowMenu(false);}}>{dark?"☀️ Light":"🌙 Dark"}</div>
          <div className="drop-item" onClick={()=>{shareWA(msgs.filter(m=>m.role==="ai").pop()?.text||"");setShowMenu(false);}}>📤 Share Chat</div>
          <div className="drop-item" onClick={()=>{exportChat();setShowMenu(false);}}>📄 Export</div>
          <div className="drop-divider"/>
          {!userData?.premium&&<div className="drop-item" onClick={()=>{setShowUpgrade(true);setShowMenu(false);}}>⭐ Premium</div>}
          <div className="drop-item danger" onClick={()=>signOut(auth)}>🚪 Logout</div>
        </div>
      )}

      {page==="chat"&&<div className="usage-bar"><span>{userData?.premium?"⭐ Premium":"Free Plan"}</span><span className="usage-pill">{userData?.premium?"Unlimited":chatsLeft+" left"}</span></div>}

      {/* ── CHAT ── */}
      {page==="chat"&&(
        <>
          <div className="chat-area">
            {msgs.length===0&&(
              <div className="welcome">
                <span className="lotus" onClick={()=>setPage("voice")}>🪷</span>
                <h2>Saraswati AI</h2>
                <p className="welcome-sub">Type karo ya kamal phool 🪷 dabao voice call ke liye</p>
                <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:18,padding:"18px 22px",display:"flex",flexDirection:"column",alignItems:"center",gap:10,width:"100%",maxWidth:300}}>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",letterSpacing:".08em"}}>🎙️ VOICE CALL</div>
                  <div style={{fontSize:11,color:"var(--muted)",textAlign:"center"}}>100+ languages • Gender-matched voice • Real AI</div>
                  <button onClick={()=>setPage("voice")} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",borderRadius:12,color:"#fff",cursor:"pointer",fontSize:14,fontWeight:700,padding:"12px",fontFamily:"Inter,sans-serif",width:"100%"}}>🎙️ Start Voice Call</button>
                </div>
              </div>
            )}
            {msgs.map(m=>(
              <div key={m.id} className="msg-wrap">
                <div className={"msg-row "+m.role}>
                  {m.role==="ai"&&<div className="ai-av">🪷</div>}
                  <div className={"bubble "+m.role}>
                    {m.image&&<img src={m.image} className="msg-img" alt="img"/>}
                    {m.role==="ai"?<AIText text={m.text}/>:m.text}
                  </div>
                </div>
                {m.text&&(
                  <div className="msg-acts" style={{paddingLeft:m.role==="ai"?36:4}}>
                    {m.role==="ai"&&(
                      <button className={"act-btn"+(speakId===m.id?" on":"")} onClick={()=>toggleSpeak(m.id,m.text)}>
                        {speakId===m.id?"⏹ Stop":"🔊 Suno"}
                      </button>
                    )}
                    <button className={"act-btn"+(copied===m.id?" on":"")} onClick={()=>copyMsg(m.text,m.id)}>
                      {copied===m.id?"✓ Copied":"📋 Copy"}
                    </button>
                    {m.role==="ai"&&<button className="act-btn" onClick={()=>shareWA(m.text)}>📤 Share</button>}
                  </div>
                )}
                <div className={"msg-time "+m.role}>{fmtTime(m.time)}</div>
              </div>
            ))}
            {searching&&<div className="msg-row"><div className="ai-av">🪷</div><div className="search-ind">🌐 Searching...</div></div>}
            {loading&&!searching&&<div className="msg-row"><div className="ai-av">🪷</div><div className="typing-bub"><div className="dot"/><div className="dot"/><div className="dot"/></div></div>}
            <div ref={bottomRef}/>
          </div>
          {/* INPUT BAR */}
          <div className="input-bar">
            {/* Hidden file input */}
            <input
              type="file"
              ref={galleryRef}
              accept="image/*"
              style={{display:"none"}}
              onChange={handleGallery}
            />
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
              {imgPrev&&(
                <div className="img-prev">
                  <img src={imgPrev} alt="preview"/>
                  <button className="img-prev-x" onClick={()=>{setImgB64(null);setImgPrev(null);}}>✕</button>
                </div>
              )}
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                {/* + Gallery button */}
                <button
                  className="icon-btn"
                  onClick={() => { galleryRef.current && galleryRef.current.click(); }}
                  title="Image attach karo"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
                    <path d="m21 15-5-5L5 21"/>
                  </svg>
                </button>
                {/* Mic button */}
                <button
                  className={"icon-btn"+(micActive?" rec":"")}
                  onClick={toggleMic}
                  title="Voice input"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="2" width="6" height="11" rx="3" fill={micActive?"#ef4444":"currentColor"} stroke="none"/>
                    <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round"/>
                    <line x1="12" y1="18" x2="12" y2="22" strokeLinecap="round"/>
                    <line x1="8" y1="22" x2="16" y2="22" strokeLinecap="round"/>
                  </svg>
                </button>
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

      {/* ── VOICE CALL PAGE ── */}
      {page==="voice"&&(
        <div className="voice-page">
          <div className="voice-card">
            <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",letterSpacing:".08em"}}>🎙️ VOICE CALL — SARASWATI AI</div>

            {/* Gender select */}
            <div style={{width:"100%"}}>
              <div style={{fontSize:11,color:"var(--muted)",marginBottom:6,textAlign:"center"}}>Aapki awaaz / Your voice:</div>
              <div className="gender-row">
                <button className={"g-btn"+(vGender==="female"?" active":"")} onClick={()=>setVGender("female")}>👩 Female</button>
                <button className={"g-btn"+(vGender==="male"?" active":"")} onClick={()=>setVGender("male")}>👨 Male</button>
              </div>
            </div>

            {/* Speed */}
            <div style={{width:"100%"}}>
              <div style={{fontSize:11,color:"var(--muted)",marginBottom:6,textAlign:"center"}}>Speed:</div>
              <div className="spd-row">
                {[{l:"🐢 Slow",v:0.65},{l:"Normal",v:0.92},{l:"⚡ Fast",v:1.3}].map(s=>(
                  <button key={s.v} className={"spd-btn"+(vSpeed===s.v?" active":"")} onClick={()=>setVSpeed(s.v)}>{s.l}</button>
                ))}
              </div>
            </div>

            {/* Orb */}
            <div className="voice-orb-wrap">
              {(vStatus==="listening"||vStatus==="speaking")&&<><div className="v-ring v-ring-1"/><div className="v-ring v-ring-2"/><div className="v-ring v-ring-3"/></>}
              <div className={`voice-orb${vStatus==="listening"?" listening":vStatus==="speaking"?" speaking":vStatus==="thinking"?" thinking":""}`} onClick={handleOrb}>{orbIcon}</div>
            </div>

            <div className="voice-status">{orbText}</div>
            <div className="voice-hint">
              {vGender==="female"?"👩 Female boli → AI female voice mein jawab dega":"👨 Male bola → AI male voice mein jawab dega"}
            </div>
            <div className="voice-hint">Hindi • English • Urdu • Punjabi • 100+ languages</div>

            {msgs.filter(m=>m.role==="ai").length>0&&(
              <div className="v-last">
                <div style={{fontSize:11,color:"var(--muted)",marginBottom:4}}>Last reply:</div>
                <div style={{fontSize:12,lineHeight:1.5,color:"var(--text)"}}>{msgs.filter(m=>m.role==="ai").pop()?.text?.slice(0,120)}...</div>
              </div>
            )}

            <button className="v-end-btn" onClick={()=>{endVoice();setPage("chat");}}>📵 Call Khatam Karo</button>
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {page==="history"&&(
        <div className="page">
          <div className="page-title">📂 History</div>
          {histLoad?<div className="loading">⏳ Loading...</div>
          :hists.length===0?<div className="welcome"><span style={{fontSize:60}}>📭</span><h2>No history</h2></div>
          :hists.map(h=>(
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
              <h3>⭐ Upgrade Premium</h3><p>₹99/month — Unlimited!</p>
              <div className="pf">✅ Unlimited Chats</div>
              <div className="pf">✅ Web Search</div>
              <div className="pf">✅ Image AI</div>
              <div className="pf">✅ Voice Call</div>
            </div>
          )}
          <div className="sec-lbl">Account</div>
          <div className="set-card">
            <div className="set-row">
              <div style={{width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#fff",flexShrink:0}}>
                {displayName[0].toUpperCase()}
              </div>
              <div className="set-text"><div className="set-label">{displayName}</div><div className="set-desc">{user.email}</div></div>
              {userData?.premium&&<div className="badge">PREMIUM</div>}
              {isAdmin&&<div className="badge">ADMIN</div>}
            </div>
            <div className="set-row"><div className="set-icon">📊</div><div className="set-text"><div className="set-label">Usage</div><div className="set-desc">{userData?.premium?"Unlimited":chatsLeft+" free left"}</div></div></div>
          </div>
          <div className="sec-lbl">Voice</div>
          <div className="set-card">
            <div className="set-row">
              <div className="set-icon">🎙️</div>
              <div className="set-text"><div className="set-label">My Voice</div><div className="set-desc">AI reply matches gender</div></div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setVGender("female")} style={{background:vGender==="female"?"#f9731615":"var(--surface2)",border:"1px solid "+(vGender==="female"?"#f97316":"var(--border)"),borderRadius:8,color:vGender==="female"?"#f97316":"var(--text)",cursor:"pointer",padding:"4px 10px",fontFamily:"Inter,sans-serif",fontSize:11}}>👩 F</button>
                <button onClick={()=>setVGender("male")} style={{background:vGender==="male"?"#f9731615":"var(--surface2)",border:"1px solid "+(vGender==="male"?"#f97316":"var(--border)"),borderRadius:8,color:vGender==="male"?"#f97316":"var(--text)",cursor:"pointer",padding:"4px 10px",fontFamily:"Inter,sans-serif",fontSize:11}}>👨 M</button>
              </div>
            </div>
          </div>
          <div className="sec-lbl">Appearance</div>
          <div className="set-card">
            <div className="set-row" onClick={()=>setDark(v=>!v)}>
              <div className="set-icon">{dark?"☀️":"🌙"}</div>
              <div className="set-text"><div className="set-label">{dark?"Light Mode":"Dark Mode"}</div><div className="set-desc">Theme change karo</div></div>
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
          <div className="set-card" style={{padding:16}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",letterSpacing:".05em",marginBottom:4}}>ACTIVITY</div>
            <div className="graph-bars">
              {adminGraph.map((d,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <div style={{width:"100%",background:"#f97316",borderRadius:"3px 3px 0 0",height:Math.max(4,(d.v/maxG)*64),opacity:.85}}/>
                  <div className="graph-lbl">{d.l}</div>
                </div>
              ))}
            </div>
          </div>
          {adminUsers.some(u=>u.premiumPending&&!u.premium)&&(
            <>
              <div className="sec-lbl">⏳ Pending</div>
              {adminUsers.filter(u=>u.premiumPending&&!u.premium).map(u=>(
                <div key={u.id} className="u-card" style={{border:"1px solid #eab308"}}>
                  <div className="u-av">{u.name?.[0]?.toUpperCase()}</div>
                  <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{u.name}</div><div style={{fontSize:11,color:"var(--muted)"}}>{u.email}</div></div>
                  <button onClick={()=>adminToggle(u.id,false)} style={{background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,padding:"6px 12px"}}>✅ Approve</button>
                </div>
              ))}
            </>
          )}
          <div className="sec-lbl">All Users ({adminUsers.length})</div>
          {adminUsers.map(u=>(
            <div key={u.id} className="u-card" style={{flexDirection:"column",alignItems:"stretch",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div className="u-av">{u.name?.[0]?.toUpperCase()}</div>
                <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{u.name}</div><div style={{fontSize:11,color:"var(--muted)"}}>{u.email} • {u.usageCount||0} chats</div></div>
                {u.premium&&<div className="badge-g">⭐</div>}
                {u.email===ADMIN_EMAIL&&<div className="badge">ADMIN</div>}
                {u.premiumPending&&!u.premium&&<div className="badge-y">PENDING</div>}
              </div>
              {u.email!==ADMIN_EMAIL&&(
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>adminToggle(u.id,u.premium)} style={{flex:1,background:u.premium?"#ef444420":"#22c55e20",border:"1px solid "+(u.premium?"#ef4444":"#22c55e"),borderRadius:8,color:u.premium?"#ef4444":"#22c55e",cursor:"pointer",fontSize:12,fontWeight:700,padding:8}}>{u.premium?"❌ Remove":"✅ Premium"}</button>
                  <button onClick={()=>adminDel(u.id)} style={{background:"#ef444415",border:"1px solid #ef4444",borderRadius:8,color:"#ef4444",cursor:"pointer",fontSize:12,padding:"8px 12px"}}>🗑️</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODALS */}
      {showLimit&&(
        <div className="modal-bg" onClick={()=>setShowLimit(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-icon">⏳</div><h3>Free Limit!</h3>
            <p>Upgrade for unlimited access</p>
            <button className="btn btn-primary" onClick={()=>{setShowLimit(false);setShowUpgrade(true);}}>⭐ Upgrade ₹99/month</button>
            <button className="btn btn-secondary" onClick={()=>setShowLimit(false)}>Later</button>
          </div>
        </div>
      )}

      {showUpgrade&&(
        <div className="modal-bg" onClick={()=>setShowUpgrade(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-icon">⭐</div><h3>Saraswati AI Premium</h3>
            <p>₹99/month — Unlimited!</p>
            <div className="pay-box">
              <div style={{fontSize:13,fontWeight:700,color:"#f97316",textAlign:"center"}}>📱 PhonePe / UPI</div>
              <div className="pay-num">{PHONEPAY}</div>
              <div className="pay-step">1️⃣ <span>₹99 bhejo PhonePe/GPay mein</span></div>
              <div className="pay-step">2️⃣ <span>UTR/Screenshot note karo</span></div>
              <div className="pay-step">3️⃣ <span>"Payment Done" dabao</span></div>
            </div>
            {!payDone?(
              <button className="btn btn-primary" onClick={()=>setPayDone(true)}>✅ Payment Done</button>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{fontSize:13,color:"var(--muted)",textAlign:"center"}}>Admin 24 hrs mein activate karega</div>
                <button className="btn btn-primary" onClick={async()=>{
                  await setDoc(doc(db,"users",user.uid),{premiumPending:true,premiumRequestedAt:serverTimestamp()},{merge:true});
                  setUserData(p=>({...p,premiumPending:true}));
                  setShowUpgrade(false); setPayDone(false);
                  alert("✅ Request bhej di!");
                }}>📨 Submit Request</button>
              </div>
            )}
            <button className="btn btn-secondary" onClick={()=>{setShowUpgrade(false);setPayDone(false);}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
ENDOFFILE
echo "DONE"
wc -l /mnt/user-data/outputs/App.jsx
