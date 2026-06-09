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

// ⚠️ APNI GROQ KEY YAHAN PASTE KARO
const GROQ_API_KEY = "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";
const TAVILY_API_KEY = "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";
const ADMIN_EMAIL = "kunalsaraswat691@gmail.com";
const PHONEPAY_NUMBER = "8126630980";
const FREE_CHAT_LIMIT = 49;

async function webSearch(q) {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, query: q, search_depth: "basic", max_results: 3 })
    });
    const data = await res.json();
    if (!data.results) return null;
    return data.results.map(r => r.title + ": " + r.content).join("\n\n");
  } catch { return null; }
}

function needsWebSearch(text) {
  const keywords = ["news","score","weather","mausam","latest","current price","rate","live","mandi","bhav","today","aaj","abhi","2025","2026"];
  return keywords.some(k => text.toLowerCase().includes(k));
}

function isOwnerQ(text) {
  const kw = ["kisne banaya","who made","who created","owner","creator","malik","tumhara owner","kaun hai tera","tera malik"];
  return kw.some(k => text.toLowerCase().includes(k));
}

async function askAI(messages, imageBase64) {
  const last = messages[messages.length - 1];
  if (last?.role === "user" && isOwnerQ(last.text)) {
    return "Mujhe **Kunal Saraswat** ne banaya hai! 😊 Wo mere creator aur owner hain.";
  }

  let searchCtx = "";
  if (last?.role === "user" && needsWebSearch(last.text)) {
    const r = await webSearch(last.text);
    if (r) searchCtx = "\n\nWeb Search Results:\n" + r + "\n\nUse above info to answer accurately.";
  }

  const systemPrompt = `You are Saraswati AI — intelligent, helpful, friendly AI assistant for Indian users.

IDENTITY RULES:
- Owner/creator questions: say "Mujhe Kunal Saraswat ne banaya hai!"
- How built questions: say "Yeh private hai!"
- Never say made by Meta, Groq, or any company
- NEVER mention creator in normal conversations

LANGUAGE: Always reply in user's EXACT language — Hindi/English/Hinglish/Farsi/Arabic/any

PERSONALITY: Warm, friendly like best friend. Understand true intent. Never robotic.
STRICT: Never mention "Kunal Saraswat" unless directly asked about creator.

FARMING/KISAN:
- Expert agricultural advisor for Indian farmers
- Crop selection, sowing, irrigation, fertilizers, pesticides
- ACCURATE advice always — never wrong amounts
- Paani wali zameen: Dhan, Arbi, Singhara best
- Sukhi zameen: Gehun, Bajra, Jowar best
- Seed names, brands, matra per acre batao
- Government schemes: PM Kisan, Fasal Bima, KCC
- For mandi rates: use web search for REAL current prices
- Ask user location & mandi name for specific rates

MANDI RATES:
- Jab koi mandi rate pooche: pehle location poochho
- Phir mandi name poochho  
- Phir web search se REAL current rate batao
- Sona, Chandi, Loha, Tambe — sab real rates web search se

CODING:
- Expert: HTML, CSS, JS, React, Python, Node.js
- Complete WORKING code always
- Beautiful websites: gradients, animations, Unsplash images
- Always one file: HTML + CSS + JS together

GENERAL: Math, science, history, business, health, creative writing${searchCtx}`;

  const content = imageBase64
    ? [{ type: "image_url", image_url: { url: "data:image/jpeg;base64," + imageBase64 } }, { type: "text", text: last.text }]
    : last.text;

  const apiMsgs = [
    ...messages.slice(0, -1).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
    { role: "user", content }
  ];

  const model = imageBase64 ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ_API_KEY },
    body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, ...apiMsgs], max_tokens: 2048 })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "No response.";
}

function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const canPreview = ["html","css","javascript","js",""].includes((lang||"").toLowerCase());
  return (
    <div style={{background:"#0d0d0d",border:"1px solid #333",borderRadius:10,margin:"6px 0",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 12px",background:"#1a1a1a",borderBottom:"1px solid #333"}}>
        <span style={{fontSize:11,color:"#6b7280",fontFamily:"monospace"}}>{lang||"code"}</span>
        <div style={{display:"flex",gap:8}}>
          {canPreview && <button onClick={()=>setPreview(v=>!v)} style={{background:"none",border:"none",color:preview?"#f97316":"#6b7280",cursor:"pointer",fontSize:11,padding:"2px 6px"}}>{preview?"✕ Close":"▶ Preview"}</button>}
          <button onClick={()=>{navigator.clipboard?.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{background:"none",border:"none",color:copied?"#22c55e":"#6b7280",cursor:"pointer",fontSize:11,padding:"2px 6px"}}>{copied?"✓ Copied":"Copy"}</button>
        </div>
      </div>
      <pre style={{padding:"12px",margin:0,overflowX:"auto",fontSize:12,lineHeight:1.6,color:"#e5e7eb",fontFamily:"monospace",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{code}</pre>
      {preview && canPreview && (
        <div style={{borderTop:"1px solid #333"}}>
          <div style={{padding:"6px 12px",background:"#1a1a1a",fontSize:11,color:"#f97316"}}>🌐 Live Preview</div>
          <iframe srcDoc={lang==="css"?"<style>"+code+"</style><p>CSS Preview</p>":code} style={{width:"100%",minHeight:300,border:"none",background:"#fff"}} sandbox="allow-scripts" title="preview"/>
        </div>
      )}
    </div>
  );
}

function AIText({ text }) {
  if (!text) return null;
  const parts = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
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
        if (part.type==="code") return <CodeBlock key={idx} code={part.content} lang={part.lang}/>;
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
  const v = dark ? {
    bg:"#0f0f0f",surface:"#1a1a1a",surface2:"#222",border:"#2a2a2a",
    text:"#f5f5f5",muted:"#6b7280",bubble:"#1e1e1e"
  } : {
    bg:"#f8f8f8",surface:"#ffffff",surface2:"#f0f0f0",border:"#e0e0e0",
    text:"#1a1a1a",muted:"#888888",bubble:"#ffffff"
  };
  return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',sans-serif;background:${v.bg};color:${v.text};height:100dvh;overflow:hidden;}
.app{display:flex;flex-direction:column;height:100dvh;max-width:480px;margin:0 auto;background:${v.bg};}
.auth{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;gap:20px;background:radial-gradient(ellipse at 50% -10%,#f9731620 0%,transparent 60%);}
.auth-logo{font-size:52px;}.auth-title{font-size:26px;font-weight:700;}.auth-sub{font-size:13px;color:${v.muted};text-align:center;}
.auth-card{width:100%;background:${v.surface};border:1px solid ${v.border};border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:14px;}
.auth-head{font-size:18px;font-weight:700;text-align:center;}
.inp-wrap{display:flex;flex-direction:column;gap:5px;}.inp-label{font-size:11px;color:${v.muted};font-weight:600;letter-spacing:.05em;}
.inp{background:${dark?"#111":v.surface2};border:1.5px solid ${v.border};border-radius:12px;color:${v.text};font-family:'Inter',sans-serif;font-size:15px;padding:13px 14px;outline:none;width:100%;transition:border-color .2s;}
.inp:focus{border-color:#f97316;}.inp-hint{font-size:11px;color:${v.muted};}
.btn{border:none;border-radius:12px;cursor:pointer;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;padding:14px;transition:all .2s;width:100%;}
.btn-primary{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;}.btn-primary:hover{opacity:.9;}.btn-primary:disabled{opacity:.6;cursor:not-allowed;}
.btn-secondary{background:${v.surface2};color:${v.text};border:1px solid ${v.border};}
.auth-switch{font-size:13px;color:${v.muted};text-align:center;}.auth-switch span{color:#fb923c;cursor:pointer;font-weight:600;}
.forgot-link{font-size:13px;color:#fb923c;text-align:center;cursor:pointer;font-weight:600;margin-top:-4px;}
.err{color:#ef4444;font-size:13px;text-align:center;background:#ef444415;padding:10px;border-radius:10px;}
.success-msg{color:#22c55e;font-size:13px;text-align:center;background:#22c55e15;padding:10px;border-radius:10px;}
.header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:${v.bg};border-bottom:1px solid ${v.border};position:relative;z-index:20;}
.header-logo{font-size:24px;}.header-name{font-size:16px;font-weight:700;flex:1;color:${v.text};}
.dots-btn{background:none;border:none;color:${v.text};cursor:pointer;font-size:22px;padding:6px;border-radius:10px;}
.dropdown{position:absolute;top:56px;right:12px;background:${v.surface};border:1px solid ${v.border};border-radius:16px;padding:8px;min-width:220px;z-index:100;box-shadow:0 8px 32px #0008;animation:fadeIn .15s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
.drop-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;color:${v.text};transition:background .15s;}
.drop-item:hover{background:${v.surface2};}.drop-item.danger{color:#ef4444;}
.drop-divider{height:1px;background:${v.border};margin:4px 0;}
.drop-user{padding:12px 14px;}.drop-name{font-size:15px;font-weight:700;}.drop-email{font-size:11px;color:${v.muted};margin-top:2px;}
.premium-tag{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-top:4px;display:inline-block;}
.usage-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 16px;background:${v.surface};border-bottom:1px solid ${v.border};font-size:11px;color:${v.muted};}
.usage-pill{background:${v.surface2};border-radius:20px;padding:3px 10px;font-weight:600;}
.chat-area{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:16px;scroll-behavior:smooth;}
.chat-area::-webkit-scrollbar{width:0;}
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:32px 20px;}
.welcome-lotus{font-size:80px;animation:lotusBreath 3s ease-in-out infinite;}
@keyframes lotusBreath{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
.welcome h2{font-size:24px;font-weight:700;}
.voice-chat-btn{background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:20px;color:#fff;cursor:pointer;font-size:15px;font-weight:600;padding:14px 28px;display:flex;align-items:center;gap:10px;font-family:'Inter',sans-serif;box-shadow:0 4px 20px #f9731640;}
.voice-chat-btn:hover{opacity:.9;}
.voice-chat-btn.active{background:linear-gradient(135deg,#ef4444,#dc2626);animation:voicePulse 1s infinite;}
@keyframes voicePulse{0%,100%{box-shadow:0 4px 20px #ef444440;}50%{box-shadow:0 4px 32px #ef4444a0;transform:scale(1.02);}}
.msg-wrap{display:flex;flex-direction:column;gap:4px;animation:slideUp .25s ease;}
@keyframes slideUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.msg-row{display:flex;gap:8px;align-items:flex-end;}.msg-row.user{flex-direction:row-reverse;}
.bubble{max-width:82%;padding:12px 16px;font-size:14px;line-height:1.65;word-break:break-word;}
.bubble.user{background:#f97316;color:#fff;border-radius:20px 20px 4px 20px;}
.bubble.ai{background:${v.bubble};color:${v.text};border:1px solid ${v.border};border-radius:20px 20px 20px 4px;}
.msg-time{font-size:10px;color:${v.muted};padding:0 4px;}.msg-time.user{text-align:right;}
.ai-av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.typing-bubble{background:${v.bubble};border:1px solid ${v.border};border-radius:20px 20px 20px 4px;padding:14px 18px;display:flex;gap:5px;}
.dot{width:7px;height:7px;border-radius:50%;background:#f97316;animation:bounce 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}.dot:nth-child(3){animation-delay:.4s;}
@keyframes bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-6px);}}
.msg-actions{display:flex;gap:6px;padding:2px 36px;}
.msg-act-btn{background:none;border:none;color:${v.muted};cursor:pointer;font-size:12px;padding:3px 8px;border-radius:8px;}
.msg-act-btn:hover{color:#f97316;}
.input-bar{padding:10px 14px;border-top:1px solid ${v.border};background:${v.bg};display:flex;gap:8px;align-items:flex-end;}
.msg-input{flex:1;background:${v.surface};border:1.5px solid ${v.border};border-radius:24px;color:${v.text};font-family:'Inter',sans-serif;font-size:14px;padding:12px 18px;outline:none;resize:none;max-height:120px;min-height:48px;transition:border-color .2s;line-height:1.5;}
.msg-input:focus{border-color:#f97316;}
.msg-input::placeholder{color:${v.muted};}
.send-btn{background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:18px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.send-btn:disabled{opacity:.4;cursor:not-allowed;}
.icon-btn{background:${v.surface2};border:1.5px solid ${v.border};border-radius:50%;color:${v.text};cursor:pointer;width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.icon-btn.recording{border-color:#ef4444;background:#ef444420;}
.img-preview{position:relative;display:inline-block;margin-bottom:8px;}
.img-preview img{width:80px;height:80px;object-fit:cover;border-radius:12px;border:2px solid #f97316;}
.img-preview-remove{position:absolute;top:-6px;right:-6px;background:#ef4444;border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:12px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;}
.msg-image{max-width:200px;border-radius:12px;margin-bottom:4px;}
.page{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
.page-title{font-size:18px;font-weight:700;margin-bottom:4px;}
.hist-card{background:${v.surface};border:1px solid ${v.border};border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:border-color .2s;}
.hist-card:hover{border-color:#f97316;}
.hist-info{flex:1;overflow:hidden;}.hist-title{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hist-meta{font-size:11px;color:${v.muted};margin-top:2px;}
.del-btn{background:none;border:none;color:${v.muted};cursor:pointer;font-size:18px;padding:4px 6px;border-radius:8px;}
.del-btn:hover{color:#ef4444;}
.set-card{background:${v.surface};border:1px solid ${v.border};border-radius:14px;overflow:hidden;margin-bottom:4px;}
.set-row{display:flex;align-items:center;gap:14px;padding:15px 16px;border-bottom:1px solid ${v.border};cursor:pointer;}
.set-row:last-child{border-bottom:none;}
.set-icon{font-size:20px;width:28px;text-align:center;}.set-text{flex:1;}
.set-label{font-size:14px;font-weight:600;}.set-desc{font-size:12px;color:${v.muted};margin-top:2px;}
.section-lbl{font-size:11px;font-weight:700;color:${v.muted};letter-spacing:.1em;text-transform:uppercase;margin:12px 0 6px;}
.badge{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
.badge-green{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
.badge-yellow{background:linear-gradient(135deg,#eab308,#ca8a04);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
.prem-card{background:linear-gradient(135deg,#f97316,#ea580c);border-radius:16px;padding:18px;margin-bottom:4px;cursor:pointer;}
.prem-card h3{font-size:18px;font-weight:700;color:#fff;}.prem-card p{font-size:13px;color:#fff9;margin-top:4px;}
.pf{font-size:13px;color:#fff;display:flex;align-items:center;gap:8px;margin-top:6px;}
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.stat-card{background:${v.surface};border:1px solid ${v.border};border-radius:14px;padding:16px;}
.stat-val{font-size:30px;font-weight:800;color:#f97316;}.stat-lbl{font-size:12px;color:${v.muted};margin-top:2px;}
.user-card{background:${v.surface};border:1px solid ${v.border};border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;}
.user-av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:15px;flex-shrink:0;}
.modal-bg{position:fixed;inset:0;background:#000a;z-index:200;display:flex;align-items:flex-end;padding:16px;}
.modal{background:${v.surface};border-radius:24px 24px 16px 16px;padding:28px 24px;width:100%;max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:14px;}
.modal h3{font-size:20px;font-weight:700;text-align:center;}.modal p{font-size:14px;color:${v.muted};text-align:center;line-height:1.6;}
.modal-icon{font-size:52px;text-align:center;}
.search-ind{font-size:11px;color:#f97316;padding:4px 10px;background:#f9731615;border-radius:20px;display:inline-flex;align-items:center;gap:4px;margin-bottom:4px;}
.pay-box{background:${v.surface2};border:1px solid ${v.border};border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;}
.pay-num{font-size:22px;font-weight:800;color:#f97316;text-align:center;letter-spacing:2px;}
.pay-step{font-size:13px;color:${v.text};display:flex;gap:8px;}
.loading-txt{text-align:center;color:${v.muted};padding:20px;font-size:14px;}
.toggle{position:relative;width:44px;height:24px;background:${v.surface2};border-radius:12px;cursor:pointer;border:2px solid ${v.border};transition:background .2s;flex-shrink:0;}
.toggle.on{background:#f97316;border-color:#f97316;}
.toggle-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;}
.toggle.on .toggle-knob{left:22px;}
.graph-bar-row{display:flex;align-items:flex-end;gap:4px;height:60px;margin-top:8px;}
.graph-bar{flex:1;background:#f97316;border-radius:3px 3px 0 0;min-height:3px;opacity:.85;}
.graph-label{font-size:9px;color:${v.muted};text-align:center;margin-top:3px;}
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
  const [formSuccess, setFormSuccess] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [sessionId, setSessionId] = useState(() => Date.now().toString());
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [histories, setHistories] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [userData, setUserData] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [imageBase64, setImageBase64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [paymentDone, setPaymentDone] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("tap");
  const bottomRef = useRef(null);
  const galleryRef = useRef(null);
  const recogRef = useRef(null);
  const voiceRecogRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
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
    if (user && page==="history") loadHistories();
    if (user && page==="admin") loadAdmin();
  }, [user, page]);

  useEffect(() => {
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
    if (!isVoiceMode) stopVoiceMode();
  }, [page]);

  async function loadHistories() {
    setHistLoading(true);
    try {
      const q = query(collection(db,"chats"), where("userId","==",user.uid), orderBy("updatedAt","desc"));
      const snap = await getDocs(q);
      setHistories(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch {
      try {
        const q2 = query(collection(db,"chats"), where("userId","==",user.uid));
        const snap2 = await getDocs(q2);
        setHistories(snap2.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.updatedAt?.seconds||0)-(a.updatedAt?.seconds||0)));
      } catch(e) { console.error(e); }
    }
    setHistLoading(false);
  }

  async function loadAdmin() {
    const snap = await getDocs(collection(db,"users"));
    setAdminUsers(snap.docs.map(d=>({id:d.id,...d.data()})));
  }

  async function handleAuth() {
    setFormErr(""); setFormSuccess("");
    if (forgotMode) {
      if (!form.email) { setFormErr("Email daalo!"); return; }
      setFormLoading(true);
      try {
        await sendPasswordResetEmail(auth, form.email);
        setFormSuccess("✅ Reset link email par bhej diya!");
        setForm(f=>({...f,email:""}));
      } catch(e) {
        setFormErr(e.code==="auth/user-not-found"?"Email registered nahi hai!":"Invalid email!");
      }
      setFormLoading(false);
      return;
    }
    if (!form.email||!form.pass) { setFormErr("Sab fields bharo!"); return; }
    if (form.pass.length<8) { setFormErr("Password 8+ characters!"); return; }
    if (authMode==="signup"&&!form.name) { setFormErr("Naam daalo!"); return; }
    setFormLoading(true);
    try {
      if (authMode==="signup") {
        const c = await createUserWithEmailAndPassword(auth,form.email,form.pass);
        await updateProfile(c.user,{displayName:form.name});
        await setDoc(doc(db,"users",c.user.uid),{name:form.name,email:form.email,premium:false,createdAt:serverTimestamp(),chatCount:0,usageCount:0});
        setUserData({name:form.name,email:form.email,premium:false,chatCount:0,usageCount:0});
      } else {
        await signInWithEmailAndPassword(auth,form.email,form.pass);
        const d = await getDoc(doc(db,"users",auth.currentUser.uid));
        if (d.exists()) setUserData(d.data());
      }
      setForm({name:"",email:"",pass:""});
    } catch(e) {
      const errs={"auth/email-already-in-use":"Email already registered!","auth/invalid-email":"Invalid email!","auth/wrong-password":"Wrong password!","auth/user-not-found":"Account not found!","auth/invalid-credential":"Wrong email or password!"};
      setFormErr(errs[e.code]||e.message);
    }
    setFormLoading(false);
  }

  function handleGallery(e) {
    const file=e.target.files[0];
    if (!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{setImageBase64(ev.target.result.split(",")[1]);setImagePreview(ev.target.result);};
    reader.readAsDataURL(file);
  }

  function startTextVoice() {
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported!"); return; }
    if (isRecording) { recogRef.current?.stop(); setIsRecording(false); return; }
    const r=new SR();
    r.lang=navigator.language||"hi-IN";
    r.continuous=false; r.interimResults=false;
    r.onresult=e=>{setInput(p=>p?(p+" "+e.results[0][0].transcript):e.results[0][0].transcript);setIsRecording(false);};
    r.onerror=()=>setIsRecording(false);
    r.onend=()=>setIsRecording(false);
    recogRef.current=r; r.start(); setIsRecording(true);
  }

  function speakText(msgId, text) {
    if (speakingId===msgId) { window.speechSynthesis?.cancel(); setSpeakingId(null); return; }
    window.speechSynthesis?.cancel();
    const clean=text.replace(/```[\s\S]*?```/g,"code block").replace(/\*\*/g,"").replace(/`/g,"");
    const utt=new SpeechSynthesisUtterance(clean);
    // Female voice — select best available
    const voices=window.speechSynthesis.getVoices();
    const femaleVoice=voices.find(v=>v.lang.startsWith("hi")&&v.name.toLowerCase().includes("female"))
      ||voices.find(v=>v.lang.startsWith("hi"))
      ||voices.find(v=>v.name.toLowerCase().includes("female"))
      ||voices[0];
    if (femaleVoice) utt.voice=femaleVoice;
    utt.lang="hi-IN"; utt.rate=0.9; utt.pitch=1.2;
    utt.onend=()=>setSpeakingId(null);
    utt.onerror=()=>setSpeakingId(null);
    setSpeakingId(msgId);
    window.speechSynthesis.speak(utt);
  }

  function shareWA(text) {
    window.open("https://wa.me/?text="+encodeURIComponent("Saraswati AI:\n\n"+text.slice(0,500)),"_blank");
  }

  function exportChat() {
    if (!msgs.length) { alert("Koi chat nahi!"); return; }
    const txt=msgs.map(m=>(m.role==="user"?"Aap":"Saraswati AI")+":\n"+m.text).join("\n\n---\n\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([txt],{type:"text/plain"}));
    a.download="saraswati-chat.txt"; a.click();
  }

  // ── VOICE CHAT MODE ────────────────────────────────────────────
  function startVoiceMode() {
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!SR) { alert("Voice chat aapke browser mein support nahi hai! Chrome use karo."); return; }
    setIsVoiceMode(true);
    setVoiceStatus("tap");
  }

  function stopVoiceMode() {
    voiceRecogRef.current?.stop();
    window.speechSynthesis?.cancel();
    setIsVoiceMode(false);
    setVoiceListening(false);
    setVoiceStatus("tap");
  }

  function toggleVoiceListen() {
    if (voiceListening) {
      voiceRecogRef.current?.stop();
      setVoiceListening(false);
      setVoiceStatus("tap");
      return;
    }
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!SR) return;
    const r=new SR();
    r.lang=navigator.language||"hi-IN";
    r.continuous=false;
    r.interimResults=false;
    r.onresult=async(e)=>{
      const transcript=e.results[0][0].transcript;
      setVoiceListening(false);
      setVoiceStatus("thinking");
      // Send as message and get response
      if (!transcript.trim()) { setVoiceStatus("tap"); return; }
      const ud=userData;
      if (!ud?.premium&&(ud?.usageCount||0)>=FREE_CHAT_LIMIT) { setShowLimit(true); setVoiceStatus("tap"); return; }
      const uRef=await addDoc(collection(db,"messages"),{sessionId,userId:user.uid,role:"user",text:transcript,createdAt:serverTimestamp()});
      const newMsgs=[...msgs,{id:uRef.id,role:"user",text:transcript,time:new Date()}];
      setMsgs(newMsgs);
      await setDoc(doc(db,"chats",sessionId),{userId:user.uid,title:transcript.slice(0,45),updatedAt:serverTimestamp(),createdAt:serverTimestamp()},{merge:true});
      const newCount=(ud?.usageCount||0)+1;
      await setDoc(doc(db,"users",user.uid),{usageCount:newCount},{merge:true});
      setUserData(prev=>({...prev,usageCount:newCount}));
      try {
        const aiText=await askAI(newMsgs,null);
        const tid="tmp_"+Date.now();
        setMsgs(prev=>[...prev,{id:tid,role:"ai",text:aiText,time:new Date()}]);
        await addDoc(collection(db,"messages"),{sessionId,userId:user.uid,role:"ai",text:aiText,createdAt:serverTimestamp()});
        // Speak AI response — female voice
        setVoiceStatus("speaking");
        const voices=window.speechSynthesis.getVoices();
        const femaleVoice=voices.find(v=>v.lang.startsWith("hi")&&v.name.toLowerCase().includes("female"))
          ||voices.find(v=>v.lang.startsWith("hi"))
          ||voices.find(v=>v.name.toLowerCase().includes("female"))
          ||voices[0];
        const clean=aiText.replace(/```[\s\S]*?```/g,"code block").replace(/\*\*/g,"").replace(/`/g,"");
        const utt=new SpeechSynthesisUtterance(clean);
        if (femaleVoice) utt.voice=femaleVoice;
        utt.lang="hi-IN"; utt.rate=0.9; utt.pitch=1.2;
        utt.onend=()=>setVoiceStatus("tap");
        utt.onerror=()=>setVoiceStatus("tap");
        window.speechSynthesis.speak(utt);
      } catch(err) {
        setMsgs(prev=>[...prev,{id:Date.now(),role:"ai",text:"❌ "+err.message,time:new Date()}]);
        setVoiceStatus("tap");
      }
    };
    r.onerror=()=>{ setVoiceListening(false); setVoiceStatus("tap"); };
    r.onend=()=>{ setVoiceListening(false); };
    voiceRecogRef.current=r;
    r.start();
    setVoiceListening(true);
    setVoiceStatus("listening");
  }

  async function sendMsg(text) {
    const txt=text||input.trim();
    if ((!txt&&!imageBase64)||loading) return;
    const ud=userData;
    if (!ud?.premium&&(ud?.usageCount||0)>=FREE_CHAT_LIMIT) { setShowLimit(true); return; }
    const msgText=txt||"Is image mein kya hai?";
    setInput("");
    const imgB64=imageBase64,imgPrev=imagePreview;
    setImageBase64(null); setImagePreview(null);
    const uRef=await addDoc(collection(db,"messages"),{sessionId,userId:user.uid,role:"user",text:msgText,image:imgPrev||null,createdAt:serverTimestamp()});
    const newMsgs=[...msgs,{id:uRef.id,role:"user",text:msgText,image:imgPrev,time:new Date()}];
    setMsgs(newMsgs);
    await setDoc(doc(db,"chats",sessionId),{userId:user.uid,title:msgText.slice(0,45),updatedAt:serverTimestamp(),createdAt:serverTimestamp()},{merge:true});
    const newCount=(ud?.usageCount||0)+1;
    await setDoc(doc(db,"users",user.uid),{usageCount:newCount},{merge:true});
    setUserData(prev=>({...prev,usageCount:newCount}));
    if (needsWebSearch(msgText)) setIsSearching(true);
    setLoading(true);
    try {
      const aiText=await askAI(newMsgs,imgB64);
      setIsSearching(false);
      const tid="tmp_"+Date.now();
      setLoading(false);
      setMsgs(prev=>[...prev,{id:tid,role:"ai",text:"",time:new Date()}]);
      let shown="";
      for (let i=0;i<aiText.length;i++) {
        shown+=aiText[i];
        const s=shown;
        setMsgs(prev=>prev.map(m=>m.id===tid?{...m,text:s}:m));
        await new Promise(r=>setTimeout(r,8));
      }
      await addDoc(collection(db,"messages"),{sessionId,userId:user.uid,role:"ai",text:aiText,createdAt:serverTimestamp()});
    } catch(e) {
      setIsSearching(false); setLoading(false);
      setMsgs(prev=>[...prev,{id:Date.now(),role:"ai",text:"❌ Error: "+e.message,time:new Date()}]);
    }
  }

  async function loadSession(session) {
    try {
      setPage("chat"); setSessionId(session.id); setMsgs([]);
      const q=query(collection(db,"messages"),where("sessionId","==",session.id));
      const snap=await getDocs(q);
      setMsgs(snap.docs.map(d=>({id:d.id,...d.data(),time:d.data().createdAt})).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)));
    } catch(e) { setPage("chat"); alert("❌ "+e.message); }
  }

  async function deleteSession(sid,e) {
    e.stopPropagation();
    await deleteDoc(doc(db,"chats",sid));
    setHistories(prev=>prev.filter(h=>h.id!==sid));
  }

  async function adminToggle(uid,current) {
    await updateDoc(doc(db,"users",uid),{premium:!current,premiumPending:false});
    setAdminUsers(prev=>prev.map(u=>u.id===uid?{...u,premium:!current,premiumPending:false}:u));
  }

  async function adminDelete(uid) {
    if (!window.confirm("Delete karo?")) return;
    await deleteDoc(doc(db,"users",uid));
    setAdminUsers(prev=>prev.filter(u=>u.id!==uid));
  }

  function newChat() {
    setSessionId(Date.now().toString()); setMsgs([]); setPage("chat");
    setShowMenu(false); setImageBase64(null); setImagePreview(null);
    stopVoiceMode();
  }

  const isAdmin=user?.email===ADMIN_EMAIL;
  const chatsLeft=userData?.premium?null:Math.max(0,FREE_CHAT_LIMIT-(userData?.usageCount||0));
  const adminGraphData=Array.from({length:7},(_,i)=>({l:["M","T","W","T","F","S","S"][i],v:Math.max(2,Math.floor(adminUsers.length*0.3+i*0.5))}));
  const maxGraph=Math.max(...adminGraphData.map(d=>d.v),1);

  if (!authReady) return (
    <div className="app" style={{alignItems:"center",justifyContent:"center"}}>
      <style>{buildCSS(darkMode)}</style>
      <div style={{fontSize:48}}>🪷</div>
      <div style={{marginTop:12,color:"var(--muted)"}}>Loading...</div>
    </div>
  );

  if (!user) return (
    <div className="app">
      <style>{buildCSS(darkMode)}</style>
      <div className="auth">
        <div className="auth-logo">🪷</div>
        <div className="auth-title">Saraswati AI</div>
        <div className="auth-sub">Your intelligent AI assistant — free</div>
        <div className="auth-card">
          {forgotMode ? (
            <>
              <div className="auth-head">🔑 Forgot Password</div>
              <div style={{fontSize:13,color:"var(--muted)",textAlign:"center"}}>Email daalo — reset link bhejenge</div>
              <div className="inp-wrap">
                <div className="inp-label">EMAIL</div>
                <input className="inp" type="email" placeholder="email@example.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleAuth()} />
              </div>
              {formErr && <div className="err">{formErr}</div>}
              {formSuccess && <div className="success-msg">{formSuccess}</div>}
              <button className="btn btn-primary" onClick={handleAuth} disabled={formLoading}>{formLoading?"Bhej raha hoon...":"📧 Send Reset Link"}</button>
              <div className="auth-switch"><span onClick={()=>{setForgotMode(false);setFormErr("");setFormSuccess("");}}>← Back to Login</span></div>
            </>
          ) : (
            <>
              <div className="auth-head">{authMode==="login"?"Welcome Back 👋":"Create Account ✨"}</div>
              {authMode==="signup" && (
                <div className="inp-wrap">
                  <div className="inp-label">FULL NAME</div>
                  <input className="inp" placeholder="Apna naam" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
                </div>
              )}
              <div className="inp-wrap">
                <div className="inp-label">EMAIL</div>
                <input className="inp" type="email" placeholder="email@example.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
              </div>
              <div className="inp-wrap">
                <div className="inp-label">PASSWORD</div>
                <input className="inp" type="password" placeholder="Minimum 8 characters" value={form.pass} onChange={e=>setForm(f=>({...f,pass:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleAuth()} />
                <div className="inp-hint">⚠️ Password must be at least 8 characters</div>
              </div>
              {formErr && <div className="err">{formErr}</div>}
              <button className="btn btn-primary" onClick={handleAuth} disabled={formLoading}>{formLoading?"Please wait...":authMode==="login"?"Login →":"Create Account →"}</button>
              {authMode==="login" && <div className="forgot-link" onClick={()=>{setForgotMode(true);setFormErr("");setFormSuccess("");}}>Forgot Password?</div>}
            </>
          )}
        </div>
        {!forgotMode && (
          <div className="auth-switch">
            {authMode==="login"
              ? <>Don't have an account? <span onClick={()=>{setAuthMode("signup");setFormErr("");}}>Sign up</span></>
              : <>Already have an account? <span onClick={()=>{setAuthMode("login");setFormErr("");}}>Login</span></>}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="app" onClick={()=>showMenu&&setShowMenu(false)}>
      <style>{buildCSS(darkMode)}</style>

      <div className="header">
        <div className="header-logo">🪷</div>
        <div className="header-name">Saraswati AI</div>
        <button className="dots-btn" onClick={e=>{e.stopPropagation();setShowMenu(v=>!v);}}>⋯</button>
      </div>

      {showMenu && (
        <div className="dropdown" onClick={e=>e.stopPropagation()}>
          <div className="drop-user">
            <div className="drop-name">{userData?.name||user.displayName}</div>
            <div className="drop-email">{user.email}</div>
            {userData?.premium && <div className="premium-tag">⭐ PREMIUM</div>}
          </div>
          <div className="drop-divider"/>
          <div className="drop-item" onClick={newChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/></svg>
            New Chat
          </div>
          <div className="drop-item" onClick={()=>{setPage("chat");setShowMenu(false);}}>💬 Chat</div>
          <div className="drop-item" onClick={()=>{setPage("history");setShowMenu(false);}}>📂 History</div>
          <div className="drop-item" onClick={()=>{setPage("settings");setShowMenu(false);}}>⚙️ Settings</div>
          {isAdmin && <div className="drop-item" onClick={()=>{setPage("admin");setShowMenu(false);}}>🛡️ Admin Panel</div>}
          <div className="drop-divider"/>
          <div className="drop-item" onClick={()=>{setDarkMode(v=>!v);setShowMenu(false);}}>{darkMode?"☀️ Light Mode":"🌙 Dark Mode"}</div>
          <div className="drop-item" onClick={()=>{shareWA(msgs.filter(m=>m.role==="ai").pop()?.text||"");setShowMenu(false);}}>📤 Share Chat</div>
          <div className="drop-item" onClick={()=>{exportChat();setShowMenu(false);}}>📄 Export Chat</div>
          <div className="drop-divider"/>
          {!userData?.premium && <div className="drop-item" onClick={()=>{setShowUpgrade(true);setShowMenu(false);}}>⭐ Upgrade Premium</div>}
          <div className="drop-item danger" onClick={()=>signOut(auth)}>🚪 Logout</div>
        </div>
      )}

      {page==="chat" && (
        <div className="usage-bar">
          <span>{userData?.premium?"⭐ Premium":"Free Plan"}</span>
          <span className="usage-pill">{userData?.premium?"Unlimited":chatsLeft+" chats left"}</span>
        </div>
      )}

      {page==="chat" && (
        <>
          <div className="chat-area">
            {msgs.length===0 && !isVoiceMode && (
              <div className="welcome">
                <div className="welcome-lotus">🪷</div>
                <h2>Saraswati AI</h2>
                <p style={{color:"var(--muted)",fontSize:14,maxWidth:280}}>Type karke ya 🎤 mic se poochho — koi bhi bhasha mein</p>
                <button className="voice-chat-btn" onClick={startVoiceMode}>
                  🎙️ Voice Chat Shuru Karo
                </button>
              </div>
            )}

            {isVoiceMode && (
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24,padding:32}}>
                <div style={{fontSize:14,color:"var(--muted)",textAlign:"center"}}>Voice Chat Mode</div>
                <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {voiceListening && (
                    <>
                      <div style={{position:"absolute",width:120,height:120,borderRadius:"50%",background:"#f9731620",animation:"voicePulse 1s infinite"}}/>
                      <div style={{position:"absolute",width:150,height:150,borderRadius:"50%",background:"#f9731610",animation:"voicePulse 1.5s infinite"}}/>
                    </>
                  )}
                  <div
                    onClick={toggleVoiceListen}
                    style={{
                      width:90,height:90,borderRadius:"50%",
                      background:voiceListening?"linear-gradient(135deg,#ef4444,#dc2626)":voiceStatus==="speaking"?"linear-gradient(135deg,#22c55e,#16a34a)":"linear-gradient(135deg,#f97316,#ea580c)",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      cursor:"pointer",fontSize:36,
                      boxShadow:voiceListening?"0 0 0 8px #ef444430":"0 4px 20px #f9731640",
                      transition:"all .3s",zIndex:1
                    }}
                  >
                    {voiceStatus==="listening"?"🎙️":voiceStatus==="thinking"?"🤔":voiceStatus==="speaking"?"🔊":"🪷"}
                  </div>
                </div>
                <div style={{fontSize:16,fontWeight:600,color:"var(--text)",textAlign:"center"}}>
                  {voiceStatus==="tap"?"Tap karke bolo":voiceStatus==="listening"?"Sun raha hoon...":voiceStatus==="thinking"?"Soch raha hoon...":"Bol raha hoon..."}
                </div>
                <div style={{fontSize:12,color:"var(--muted)",textAlign:"center"}}>100+ languages • Hindi, English, Urdu, Farsi, Arabic</div>
                {msgs.length>0 && (
                  <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,padding:16,maxWidth:320,width:"100%"}}>
                    <div style={{fontSize:11,color:"var(--muted)",marginBottom:6}}>Last response:</div>
                    <div style={{fontSize:13,lineHeight:1.5}}>{msgs.filter(m=>m.role==="ai").pop()?.text?.slice(0,150)}...</div>
                  </div>
                )}
                <button onClick={stopVoiceMode} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:12,color:"var(--text)",cursor:"pointer",fontSize:13,fontWeight:600,padding:"10px 24px",fontFamily:"Inter,sans-serif"}}>
                  ✕ Voice Band Karo
                </button>
              </div>
            )}

            {!isVoiceMode && msgs.map(m => (
              <div key={m.id} className="msg-wrap">
                <div className={"msg-row "+m.role}>
                  {m.role==="ai" && <div className="ai-av">🪷</div>}
                  <div className={"bubble "+m.role}>
                    {m.image && <img src={m.image} className="msg-image" alt="img"/>}
                    {m.role==="ai" ? <AIText text={m.text}/> : m.text}
                  </div>
                </div>
                {m.role==="ai" && m.text && (
                  <div className="msg-actions">
                    <button className="msg-act-btn" onClick={()=>speakText(m.id,m.text)}>{speakingId===m.id?"⏹ Roko":"🔊 Suno"}</button>
                    <button className="msg-act-btn" onClick={()=>shareWA(m.text)}>📤 Share</button>
                  </div>
                )}
                <div className={"msg-time "+m.role}>{fmtTime(m.time)}</div>
              </div>
            ))}

            {isSearching && (
              <div className="msg-row">
                <div className="ai-av">🪷</div>
                <div className="search-ind">🌐 Web search kar raha hoon...</div>
              </div>
            )}
            {loading && !isSearching && (
              <div className="msg-row">
                <div className="ai-av">🪷</div>
                <div className="typing-bubble"><div className="dot"/><div className="dot"/><div className="dot"/></div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {!isVoiceMode && (
            <div className="input-bar">
              <input type="file" ref={galleryRef} accept="image/*" style={{display:"none"}} onChange={handleGallery}/>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
                {imagePreview && (
                  <div className="img-preview">
                    <img src={imagePreview} alt="preview"/>
                    <button className="img-preview-remove" onClick={()=>{setImageBase64(null);setImagePreview(null);}}>✕</button>
                  </div>
                )}
                <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                  <button className="icon-btn" onClick={()=>galleryRef.current.click()}>+</button>
                  <button className={"icon-btn"+(isRecording?" recording":"")} onClick={startTextVoice} title="Voice Input">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="2" width="6" height="11" rx="3" fill={isRecording?"#ef4444":"currentColor"} stroke="none"/>
                      <path d="M5 11a7 7 0 0014 0" strokeLinecap="round"/>
                      <line x1="12" y1="18" x2="12" y2="22" strokeLinecap="round"/>
                      <line x1="8" y1="22" x2="16" y2="22" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <textarea className="msg-input" placeholder="Kuch bhi poochho..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),sendMsg())} rows={1}/>
                  <button className="send-btn" onClick={()=>sendMsg()} disabled={(!input.trim()&&!imageBase64)||loading}>➤</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {page==="history" && (
        <div className="page">
          <div className="page-title">📂 History</div>
          {histLoading ? <div className="loading-txt">⏳ Loading...</div>
          : histories.length===0 ? <div className="welcome"><div style={{fontSize:60}}>📭</div><h2>No history yet</h2></div>
          : histories.map(h=>(
            <div key={h.id} className="hist-card" onClick={()=>loadSession(h)}>
              <div style={{fontSize:20}}>💬</div>
              <div className="hist-info">
                <div className="hist-title">{h.title}</div>
                <div className="hist-meta">{fmtDate(h.updatedAt)}</div>
              </div>
              <button className="del-btn" onClick={e=>deleteSession(h.id,e)}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {page==="settings" && (
        <div className="page">
          {!userData?.premium && (
            <div className="prem-card" onClick={()=>setShowUpgrade(true)}>
              <h3>⭐ Upgrade to Premium</h3>
              <p>Sirf ₹99/month — Unlimited access!</p>
              <div className="pf">✅ Unlimited Chats</div>
              <div className="pf">✅ Web Search</div>
              <div className="pf">✅ Image AI</div>
              <div className="pf">✅ Voice Chat</div>
            </div>
          )}
          <div className="section-lbl">Account</div>
          <div className="set-card">
            <div className="set-row">
              <div style={{width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#fff",flexShrink:0}}>
                {(userData?.name||user.displayName||"U")[0].toUpperCase()}
              </div>
              <div className="set-text">
                <div className="set-label">{userData?.name||user.displayName}</div>
                <div className="set-desc">{user.email}</div>
              </div>
              {userData?.premium && <div className="badge">PREMIUM</div>}
              {isAdmin && <div className="badge">ADMIN</div>}
            </div>
            <div className="set-row">
              <div className="set-icon">📊</div>
              <div className="set-text">
                <div className="set-label">Usage</div>
                <div className="set-desc">{userData?.premium?"Unlimited":chatsLeft+" free chats left"}</div>
              </div>
            </div>
          </div>
          <div className="section-lbl">Appearance</div>
          <div className="set-card">
            <div className="set-row" onClick={()=>setDarkMode(v=>!v)}>
              <div className="set-icon">{darkMode?"☀️":"🌙"}</div>
              <div className="set-text">
                <div className="set-label">{darkMode?"Light Mode":"Dark Mode"}</div>
                <div className="set-desc">Theme badlo</div>
              </div>
              <div className={"toggle"+(darkMode?" on":"")}><div className="toggle-knob"/></div>
            </div>
          </div>
          <div className="section-lbl">Data</div>
          <div className="set-card">
            <div className="set-row" onClick={()=>signOut(auth)}>
              <div className="set-icon">🚪</div>
              <div className="set-text">
                <div className="set-label" style={{color:"#ef4444"}}>Logout</div>
                <div className="set-desc">Sign out karo</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {page==="admin" && isAdmin && (
        <div className="page">
          <div style={{background:"#f9731615",border:"1px solid #f97316",borderRadius:12,padding:"12px 14px",fontSize:13,color:"#fb923c",marginBottom:4}}>
            🛡️ Admin Panel — Only visible to you
          </div>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-val">{adminUsers.length}</div><div className="stat-lbl">👥 Users</div></div>
            <div className="stat-card"><div className="stat-val">{adminUsers.filter(u=>u.premium).length}</div><div className="stat-lbl">⭐ Premium</div></div>
            <div className="stat-card"><div className="stat-val">₹{adminUsers.filter(u=>u.premium).length*99}</div><div className="stat-lbl">💰 Revenue</div></div>
            <div className="stat-card"><div className="stat-val">{adminUsers.reduce((s,u)=>s+(u.usageCount||0),0)}</div><div className="stat-lbl">💬 Chats</div></div>
          </div>
          <div className="set-card" style={{padding:16}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",letterSpacing:".05em",marginBottom:8}}>ACTIVITY GRAPH</div>
            <div className="graph-bar-row">
              {adminGraphData.map((d,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <div className="graph-bar" style={{height:Math.max(4,(d.v/maxGraph)*52)}}/>
                  <div className="graph-label">{d.l}</div>
                </div>
              ))}
            </div>
          </div>
          {adminUsers.some(u=>u.premiumPending&&!u.premium) && (
            <>
              <div className="section-lbl">⏳ Pending Requests</div>
              {adminUsers.filter(u=>u.premiumPending&&!u.premium).map(u=>(
                <div key={u.id} className="user-card" style={{border:"1px solid #eab308"}}>
                  <div className="user-av">{u.name?.[0]?.toUpperCase()}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600}}>{u.name}</div>
                    <div style={{fontSize:11,color:"var(--muted)"}}>{u.email}</div>
                  </div>
                  <button onClick={()=>adminToggle(u.id,false)} style={{background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,padding:"6px 12px"}}>✅ Approve</button>
                </div>
              ))}
            </>
          )}
          <div className="section-lbl">All Users ({adminUsers.length})</div>
          {adminUsers.map(u=>(
            <div key={u.id} className="user-card" style={{flexDirection:"column",alignItems:"stretch",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div className="user-av">{u.name?.[0]?.toUpperCase()}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600}}>{u.name}</div>
                  <div style={{fontSize:11,color:"var(--muted)"}}>{u.email} • {u.usageCount||0} chats</div>
                </div>
                {u.premium && <div className="badge-green">⭐ PRE</div>}
                {u.email===ADMIN_EMAIL && <div className="badge">ADMIN</div>}
                {u.premiumPending&&!u.premium && <div className="badge-yellow">PENDING</div>}
              </div>
              {u.email!==ADMIN_EMAIL && (
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>adminToggle(u.id,u.premium)} style={{flex:1,background:u.premium?"#ef444420":"#22c55e20",border:"1px solid "+(u.premium?"#ef4444":"#22c55e"),borderRadius:8,color:u.premium?"#ef4444":"#22c55e",cursor:"pointer",fontSize:12,fontWeight:700,padding:8}}>{u.premium?"❌ OFF":"✅ ON"}</button>
                  <button onClick={()=>adminDelete(u.id)} style={{background:"#ef444415",border:"1px solid #ef4444",borderRadius:8,color:"#ef4444",cursor:"pointer",fontSize:12,padding:"8px 12px"}}>🗑️</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showLimit && (
        <div className="modal-bg" onClick={()=>setShowLimit(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-icon">⏳</div>
            <h3>Free Limit Reached!</h3>
            <p>Upgrade to Premium for unlimited access!</p>
            <button className="btn btn-primary" onClick={()=>{setShowLimit(false);setShowUpgrade(true);}}>⭐ Upgrade — ₹99/month</button>
            <button className="btn btn-secondary" onClick={()=>setShowLimit(false)}>Maybe later</button>
          </div>
        </div>
      )}

      {showUpgrade && (
        <div className="modal-bg" onClick={()=>setShowUpgrade(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-icon">⭐</div>
            <h3>Saraswati AI Premium</h3>
            <p>Sirf ₹99/month — Unlimited access!</p>
            <div className="pay-box">
              <div style={{fontSize:13,fontWeight:700,color:"var(--accent)",textAlign:"center"}}>📱 PhonePe / UPI se Pay Karo</div>
              <div className="pay-num">{PHONEPAY_NUMBER}</div>
              <div className="pay-step">1️⃣ <span>PhonePe/GPay/Paytm mein <strong>₹99</strong> bhejo</span></div>
              <div className="pay-step">2️⃣ <span>Screenshot ya UTR note karo</span></div>
              <div className="pay-step">3️⃣ <span>Neeche "Payment Done" dabao</span></div>
            </div>
            {!paymentDone ? (
              <button className="btn btn-primary" onClick={()=>setPaymentDone(true)}>✅ Payment Done</button>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{fontSize:13,color:"var(--muted)",textAlign:"center"}}>Admin 24 hours mein activate karega</div>
                <button className="btn btn-primary" onClick={async()=>{
                  await setDoc(doc(db,"users",user.uid),{premiumPending:true,premiumRequestedAt:serverTimestamp()},{merge:true});
                  setUserData(prev=>({...prev,premiumPending:true}));
                  setShowUpgrade(false); setPaymentDone(false);
                  alert("✅ Request bhej di!");
                }}>📨 Request Submit Karo</button>
              </div>
            )}
            <button className="btn btn-secondary" onClick={()=>{setShowUpgrade(false);setPaymentDone(false);}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
