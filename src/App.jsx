import { useState, useEffect, useRef } from "react";
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
function compressImage(dataUrl, maxW = 200, quality = 0.6) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

// ── SOUNDS ──────────────────────────────────────────────────────
function playTypingSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 800 + Math.random() * 400; o.type = "sine";
    g.gain.setValueAtTime(0.03, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.04);
  } catch {}
}
function playSendSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [600,800,1000].forEach((f,i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f; o.type = "sine";
      g.gain.setValueAtTime(0.07, ctx.currentTime + i*0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.05 + 0.1);
      o.start(ctx.currentTime + i*0.05); o.stop(ctx.currentTime + i*0.05 + 0.1);
    });
  } catch {}
}

// ── WEB SEARCH ──────────────────────────────────────────────────
async function webSearch(q) {
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({api_key:TAVILY_KEY,query:q,search_depth:"basic",max_results:3})
    });
    const d = await r.json();
    return d.results?.map(x=>x.title+": "+x.content).join("\n\n") || null;
  } catch { return null; }
}

// ── IMAGE GEN ────────────────────────────────────────────────────
function needsImageGen(text) {
  return ["image banao","photo banao","tasveer banao","picture banao","draw","generate image","chitra banao","sketch banao","wallpaper banao","logo banao","poster banao"].some(k=>text.toLowerCase().includes(k));
}
function extractImagePrompt(text) {
  let p = text.toLowerCase();
  ["ek image banao","image banao","photo banao","tasveer banao","picture banao","generate image of","generate image","draw a","draw","sketch banao","wallpaper banao","logo banao","poster banao","ki","ka","of"].forEach(k=>{p=p.split(k).join(" ");});
  return p.trim()||text;
}
function getImageUrl(prompt) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&seed=${Math.floor(Math.random()*99999)}&nologo=true`;
}

// ── HELPERS ──────────────────────────────────────────────────────
function needsSearch(text) {
  return ["news","score","weather","mausam","price","rate","mandi","bhav","today","aaj","sona","gold","chandi","kisan","fasal","2025","2026","upsc","exam"].some(k=>text.toLowerCase().includes(k));
}
function isOwnerQ(text) {
  return ["kisne banaya","who made","who created","owner","creator","malik","kaun hai tera","tumhara malik"].some(k=>text.toLowerCase().includes(k));
}
function detectGender(t) {
  const fl=["behen","didi","aunty","madam","sister","ladki","main ladki","meri beti"];
  const ml=["bhai","bhaiya","yaar","dost","bro","ladka","main ladka","mera beta"];
  const tl=t.toLowerCase();
  const f=fl.filter(w=>tl.includes(w)).length, m=ml.filter(w=>tl.includes(w)).length;
  return f>m?"female":m>f?"male":null;
}
function fmtTime(ts) {
  if(!ts) return "";
  const d=ts.toDate?ts.toDate():new Date(ts);
  return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
}
function fmtDate(ts) {
  if(!ts) return "";
  const d=ts.toDate?ts.toDate():new Date(ts);
  return d.toLocaleDateString("en-IN",{day:"numeric",month:"short"});
}

// ── SMART TITLE from AI ──────────────────────────────────────────
async function generateChatTitle(firstMsg) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+GROQ_KEY},
      body:JSON.stringify({
        model:"llama-3.3-70b-versatile",
        messages:[{role:"system",content:"Generate a short 3-5 word Hindi/English chat title for this message. Only title, no quotes, no explanation."},{role:"user",content:firstMsg}],
        max_tokens:20
      })
    });
    const d = await res.json();
    return d.choices?.[0]?.message?.content?.trim()||firstMsg.slice(0,40);
  } catch { return firstMsg.slice(0,40); }
}

// ── AI CALL ──────────────────────────────────────────────────────
async function callAI(messages, imageB64, gender, userMode) {
  const last = messages[messages.length-1];
  if(last?.role==="user"&&isOwnerQ(last.text)) return "Mujhe **Kunal Saraswat** ne banaya hai! 😊 Woh ek talented developer hain.";
  let ctx="";
  if(last?.role==="user"&&needsSearch(last.text)){
    const r=await webSearch(last.text);
    if(r) ctx="\n\nLatest Info:\n"+r;
  }
  const gNote=gender==="female"
    ?"User ek LADKI/MAHILA hai — warm, caring dost ki tarah baat karo, 'didi/behen' use karo kabhi kabhi."
    :gender==="male"
    ?"User ek LADKA/AADMI hai — bhai/dost ki tarah baat karo, 'bhai/yaar' use karo."
    :"Neutral aur friendly raho.";
  const modeNote=userMode==="student"
    ?"User ek STUDENT hai — notes, summaries, exam tips, UPSC, concepts clearly explain karo."
    :userMode==="kisan"
    ?"User ek KISAN hai — crops, mandi rates, PM Kisan, Fasal Bima, fertilizers expert advice do."
    :userMode==="coder"
    ?"User ek CODER hai — complete working code, best practices, debugging help do."
    :"Sab ko help karo.";
  const sys=`You are Saraswati AI — Goddess of Knowledge, India's best AI assistant.
IDENTITY: Owner=Kunal Saraswat. Never say Groq/Meta/OpenAI.
LANGUAGE: Always reply in user's EXACT language. Hindi=Hindi, English=English, Hinglish=Hinglish.
PERSONALITY: Warm, friendly, emotional, like best friend. ${gNote}
USER TYPE: ${modeNote}
EDUCATION: Help students from class 1 to UPSC — notes, concepts, MCQs, summaries.
KISAN: Mandi rates, weather for farming, government schemes, crop advice.
CODING: Always give complete, working, copy-paste ready code.
EMOTION: Reply with feeling — not robotic.${ctx}`;
  const content=imageB64
    ?[{type:"image_url",image_url:{url:"data:image/jpeg;base64,"+imageB64}},{type:"text",text:last.text}]
    :last.text;
  const apiMsgs=[
    ...messages.slice(0,-1).map(m=>({role:m.role==="user"?"user":"assistant",content:m.text})),
    {role:"user",content}
  ];
  const model=imageB64?"llama-3.2-11b-vision-preview":"llama-3.3-70b-versatile";
  const res=await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+GROQ_KEY},
    body:JSON.stringify({model,messages:[{role:"system",content:sys},...apiMsgs],max_tokens:2048})
  });
  const data=await res.json();
  if(data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content||"No response.";
}

// ── TTS ──────────────────────────────────────────────────────────
function speakText(text, gender, speed, onDone) {
  window.speechSynthesis.cancel();
  const clean=text.replace(/```[\s\S]*?```/g,"code block").replace(/\*\*/g,"").replace(/`/g,"").replace(/#+\s/g,"").replace(/[^\x00-\x7F\u0900-\u097F ]/g,"").slice(0,600);
  const go=()=>{
    const voices=window.speechSynthesis.getVoices();
    let voice=null;
    if(gender==="female"){
      voice=voices.find(v=>/female|woman|girl|zira|heera|priya|aditi/i.test(v.name)&&v.lang.startsWith("hi"))
        ||voices.find(v=>v.lang==="hi-IN")
        ||voices.find(v=>/female|woman|girl/i.test(v.name))
        ||voices[0];
    } else {
      voice=voices.find(v=>/male|man|ravi|hemant|prabhat/i.test(v.name)&&!/female|woman/i.test(v.name)&&v.lang.startsWith("hi"))
        ||voices.find(v=>v.lang==="hi-IN"&&!/female|woman/i.test(v.name))
        ||voices.find(v=>v.lang.startsWith("hi"))
        ||voices[0];
    }
    const u=new SpeechSynthesisUtterance(clean);
    if(voice) u.voice=voice;
    u.lang="hi-IN"; u.rate=speed||0.92;
    u.pitch=gender==="female"?1.35:0.8; u.volume=1;
    u.onend=onDone||null; u.onerror=onDone||null;
    window.speechSynthesis.speak(u);
  };
  if(!window.speechSynthesis.getVoices().length){
    window.speechSynthesis.onvoiceschanged=()=>{window.speechSynthesis.onvoiceschanged=null;go();};
  } else go();
}

// ── CODE BLOCK ───────────────────────────────────────────────────
function CodeBlock({code,lang}){
  const [cp,setCp]=useState(false);
  const [prev,setPrev]=useState(false);
  const ok=["html","css","js","javascript",""].includes((lang||"").toLowerCase());
  return(
    <div style={{background:"#0d0d0d",border:"1px solid #333",borderRadius:10,margin:"6px 0",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 12px",background:"#1a1a1a",borderBottom:"1px solid #333"}}>
        <span style={{fontSize:11,color:"#6b7280",fontFamily:"monospace"}}>{lang||"code"}</span>
        <div style={{display:"flex",gap:8}}>
          {ok&&<button onClick={()=>setPrev(v=>!v)} style={{background:"none",border:"none",color:prev?"#f97316":"#6b7280",cursor:"pointer",fontSize:11,padding:"2px 6px"}}>{prev?"✕":"▶ Preview"}</button>}
          <button onClick={()=>{navigator.clipboard?.writeText(code);setCp(true);setTimeout(()=>setCp(false),2000);}} style={{background:"none",border:"none",color:cp?"#22c55e":"#6b7280",cursor:"pointer",fontSize:11,padding:"2px 6px"}}>{cp?"✓ Copied":"Copy"}</button>
        </div>
      </div>
      <pre style={{padding:"12px",margin:0,overflowX:"auto",fontSize:12,lineHeight:1.6,color:"#e5e7eb",fontFamily:"monospace",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{code}</pre>
      {prev&&ok&&<div style={{borderTop:"1px solid #333"}}><div style={{padding:"4px 12px",background:"#1a1a1a",fontSize:11,color:"#f97316"}}>🌐 Preview</div><iframe srcDoc={lang==="css"?"<style>"+code+"</style><p>Preview</p>":code} style={{width:"100%",minHeight:240,border:"none",background:"#fff"}} sandbox="allow-scripts" title="p"/></div>}
    </div>
  );
}

// ── AI TEXT ──────────────────────────────────────────────────────
function AIText({text}){
  if(!text) return null;
  const parts=[]; const re=/```(\w*)\n?([\s\S]*?)```/g;
  let last=0,m;
  while((m=re.exec(text))!==null){
    if(m.index>last) parts.push({type:"text",content:text.slice(last,m.index)});
    parts.push({type:"code",lang:m[1],content:m[2].trim()});
    last=m.index+m[0].length;
  }
  if(last<text.length) parts.push({type:"text",content:text.slice(last)});
  return(
    <span style={{display:"flex",flexDirection:"column",gap:4}}>
      {parts.map((p,i)=>{
        if(p.type==="code") return <CodeBlock key={i} code={p.content} lang={p.lang}/>;
        return p.content.split("\n").map((line,j)=>{
          if(!line.trim()) return <span key={i+"-"+j} style={{height:5}}/>;
          const segs=line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((s,k)=>{
            if(s.startsWith("**")&&s.endsWith("**")) return <strong key={k}>{s.slice(2,-2)}</strong>;
            if(s.startsWith("`")&&s.endsWith("`")) return <code key={k} style={{background:"#ffffff18",borderRadius:4,padding:"1px 5px",fontFamily:"monospace",fontSize:12}}>{s.slice(1,-1)}</code>;
            return s;
          });
          if(line.trim().startsWith("- ")||line.trim().startsWith("• ")) return <span key={i+"-"+j} style={{display:"flex",gap:8}}><span style={{color:"#f97316"}}>•</span><span>{segs}</span></span>;
          if(/^\d+\.\s/.test(line.trim())) return <span key={i+"-"+j} style={{display:"flex",gap:8}}><span style={{color:"#f97316",minWidth:16}}>{line.match(/^\d+/)[0]}.</span><span>{segs}</span></span>;
          if(line.startsWith("### ")) return <strong key={i+"-"+j} style={{fontSize:15,color:"#f97316"}}>{line.slice(4)}</strong>;
          if(line.startsWith("## ")) return <strong key={i+"-"+j} style={{fontSize:16,color:"#f97316"}}>{line.slice(3)}</strong>;
          if(line.startsWith("# ")) return <strong key={i+"-"+j} style={{fontSize:17,color:"#f97316"}}>{line.slice(2)}</strong>;
          return <span key={i+"-"+j}>{segs}</span>;
        });
      })}
    </span>
  );
}

// ── SVG ICONS ────────────────────────────────────────────────────
const IcoSpeak = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>;
const IcoStop = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>;
const IcoCopy = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const IcoOk = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoShare = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>;
const IcoMic = ({active}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="11" rx="3" fill={active?"#ef4444":"currentColor"} stroke="none"/><path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round"/><line x1="12" y1="18" x2="12" y2="22" strokeLinecap="round"/><line x1="8" y1="22" x2="16" y2="22" strokeLinecap="round"/></svg>;
const IcoImg = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="m21 15-5-5L5 21"/></svg>;
const IcoSearch = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;

// ── CSS ──────────────────────────────────────────────────────────
function css(dark){
  const v=dark
    ?{bg:"#0f0f0f",sf:"#1a1a1a",sf2:"#222",bd:"#2a2a2a",tx:"#f5f5f5",mt:"#6b7280",bub:"#1e1e1e"}
    :{bg:"#f8f8f8",sf:"#ffffff",sf2:"#f0f0f0",bd:"#e0e0e0",tx:"#1a1a1a",mt:"#888",bub:"#ffffff"};
  return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',sans-serif;background:${v.bg};color:${v.tx};height:100dvh;overflow:hidden;}
.app{display:flex;flex-direction:column;height:100dvh;max-width:480px;margin:0 auto;background:${v.bg};}

/* SPLASH */
.splash{position:fixed;inset:0;z-index:999;background:linear-gradient(160deg,#0f0f0f,#1a0800);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;transition:opacity .5s;}
.splash.out{opacity:0;pointer-events:none;}
.s-logo{font-size:88px;animation:sP 1.4s ease-in-out infinite;}
@keyframes sP{0%,100%{transform:scale(1);}50%{transform:scale(1.1);}}
.s-title{font-size:30px;font-weight:800;color:#fff;letter-spacing:-0.5px;}
.s-sub{font-size:13px;color:#6b7280;}
.s-bar{width:160px;height:3px;background:#222;border-radius:3px;overflow:hidden;margin-top:6px;}
.s-prog{height:100%;background:linear-gradient(90deg,#f97316,#ea580c);border-radius:3px;animation:sL 2s ease forwards;}
@keyframes sL{from{width:0;}to{width:100%;}}

/* PWA */
.pwa{position:fixed;bottom:76px;left:10px;right:10px;background:${dark?"#1a1a1a":"#fff"};border:1.5px solid #f97316;border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:10px;z-index:150;box-shadow:0 6px 24px #0008;animation:slideUp .3s ease;}
@keyframes slideUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
.pwa-btn{background:#f97316;border:none;border-radius:10px;color:#fff;cursor:pointer;font-size:12px;font-weight:700;padding:7px 12px;font-family:'Inter',sans-serif;}
.pwa-x{background:none;border:none;color:${v.mt};cursor:pointer;font-size:16px;padding:2px 6px;}

/* ONBOARDING */
.onboard{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:32px 24px;background:radial-gradient(ellipse at 50% 0%,#f9731618,transparent 70%);}
.onboard h2{font-size:24px;font-weight:800;text-align:center;}
.onboard p{font-size:14px;color:${v.mt};text-align:center;line-height:1.6;}
.gender-cards{display:flex;gap:12px;width:100%;}
.gc{flex:1;background:${v.sf};border:2px solid ${v.bd};border-radius:20px;padding:24px 16px;display:flex;flex-direction:column;align-items:center;gap:10px;cursor:pointer;transition:all .2s;}
.gc:hover,.gc.sel{border-color:#f97316;background:#f9731610;}
.gc-icon{font-size:52px;}
.gc-label{font-size:15px;font-weight:700;}
.gc-sub{font-size:11px;color:${v.mt};text-align:center;}

/* AUTH */
.auth{flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;gap:18px;background:radial-gradient(ellipse at 50% -10%,#f9731618 0%,transparent 60%);}
.auth-logo{font-size:48px;}.auth-title{font-size:24px;font-weight:800;}.auth-sub{font-size:13px;color:${v.mt};text-align:center;}
.card{width:100%;background:${v.sf};border:1px solid ${v.bd};border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:13px;}
.card-head{font-size:17px;font-weight:700;text-align:center;}
.iw{display:flex;flex-direction:column;gap:4px;}
.ilbl{font-size:11px;color:${v.mt};font-weight:600;letter-spacing:.05em;}
.inp{background:${dark?"#111":v.sf2};border:1.5px solid ${v.bd};border-radius:12px;color:${v.tx};font-family:'Inter',sans-serif;font-size:15px;padding:12px 14px;outline:none;width:100%;transition:border-color .2s;}
.inp:focus{border-color:#f97316;}
.btn{border:none;border-radius:12px;cursor:pointer;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;padding:13px;transition:all .2s;width:100%;}
.btn-p{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;}.btn-p:hover{opacity:.9;}.btn-p:disabled{opacity:.6;cursor:not-allowed;}
.btn-s{background:${v.sf2};color:${v.tx};border:1px solid ${v.bd};}
.link{font-size:13px;color:${v.mt};text-align:center;}.link span{color:#fb923c;cursor:pointer;font-weight:600;}
.err{color:#ef4444;font-size:13px;text-align:center;background:#ef444414;padding:9px;border-radius:10px;}
.ok{color:#22c55e;font-size:13px;text-align:center;background:#22c55e14;padding:9px;border-radius:10px;}

/* HEADER */
.hdr{display:flex;align-items:center;gap:10px;padding:11px 16px;background:${v.bg};border-bottom:1px solid ${v.bd};z-index:20;flex-shrink:0;position:relative;}
.hdr-name{font-size:16px;font-weight:700;flex:1;}
.dots{background:none;border:none;color:${v.tx};cursor:pointer;font-size:22px;padding:5px;border-radius:10px;line-height:1;}
.nbtn{background:${v.sf2};border:1px solid ${v.bd};border-radius:10px;color:${v.tx};cursor:pointer;font-size:13px;font-weight:600;padding:7px 13px;}

/* DROPDOWN */
.dd{position:absolute;top:54px;left:10px;background:${v.sf};border:1px solid ${v.bd};border-radius:16px;padding:7px;min-width:210px;z-index:100;box-shadow:0 8px 32px #0009;animation:fadeIn .15s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(-7px);}to{opacity:1;transform:translateY(0);}}
.ddi{display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;color:${v.tx};transition:background .15s;}
.ddi:hover{background:${v.sf2};}.ddi.red{color:#ef4444;}
.ddiv{height:1px;background:${v.bd};margin:3px 0;}
.ddu{padding:12px 13px;}
.ddn{font-size:15px;font-weight:700;}.dde{font-size:11px;color:${v.mt};margin-top:2px;}
.ptag{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-top:4px;display:inline-block;}
.mode-chip{font-size:10px;padding:2px 7px;border-radius:20px;font-weight:700;border:1px solid #f97316;color:#f97316;display:inline-block;margin-top:3px;}

/* USAGE */
.ubar{display:flex;align-items:center;justify-content:space-between;padding:5px 15px;background:${v.sf};border-bottom:1px solid ${v.bd};font-size:11px;color:${v.mt};flex-shrink:0;}
.upill{background:${v.sf2};border-radius:20px;padding:2px 9px;font-weight:600;}

/* CHAT */
.chat{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;}
.chat::-webkit-scrollbar{width:0;}

/* WELCOME — NO ANIMATION HERE */
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:28px 20px;}
.w-lotus{font-size:96px;cursor:pointer;display:block;line-height:1;}
.welcome h2{font-size:26px;font-weight:800;}
.welcome-sub{font-size:13px;color:${v.mt};max-width:240px;line-height:1.7;}

/* MESSAGES */
.mwrap{display:flex;flex-direction:column;gap:2px;animation:mIn .2s ease;}
@keyframes mIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
.mrow{display:flex;gap:7px;align-items:flex-end;}.mrow.user{flex-direction:row-reverse;}
.bwrap{display:flex;flex-direction:column;}
.bub{padding:11px 15px;font-size:14px;line-height:1.65;word-break:break-word;}
.bub.user{background:#f97316;color:#fff;border-radius:20px 20px 4px 20px;}
.bub.ai{background:${v.bub};color:${v.tx};border:1px solid ${v.bd};border-radius:20px 20px 20px 4px;}
.rbar{display:flex;gap:2px;padding:3px 7px;background:${v.sf};border:1px solid ${v.bd};border-radius:20px;position:absolute;top:-38px;left:0;z-index:10;box-shadow:0 3px 12px #0006;animation:fadeIn .15s;}
.rbtn{background:none;border:none;cursor:pointer;font-size:19px;padding:2px 3px;border-radius:7px;transition:transform .12s;}.rbtn:hover{transform:scale(1.3);}
.react{font-size:15px;padding-left:4px;margin-top:2px;}
.acts{display:flex;gap:4px;padding:3px 2px 0;flex-wrap:wrap;}
.abtn{background:none;border:1px solid ${v.bd};color:${v.mt};cursor:pointer;padding:4px 7px;border-radius:20px;display:flex;align-items:center;justify-content:center;transition:all .15s;line-height:1;}
.abtn:hover{color:#f97316;border-color:#f97316;}.abtn.on{color:#f97316;border-color:#f97316;background:#f9731613;}
.abtn svg{display:block;}
.mtime{font-size:10px;color:${v.mt};padding:0 3px;}.mtime.user{text-align:right;}
.aiav{width:27px;height:27px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
.tbub{background:${v.bub};border:1px solid ${v.bd};border-radius:20px 20px 20px 4px;padding:13px 17px;display:flex;gap:5px;}
.dot{width:6px;height:6px;border-radius:50%;background:#f97316;animation:bounce 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}.dot:nth-child(3){animation-delay:.4s;}
@keyframes bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-5px);}}
.sind{font-size:11px;color:#f97316;padding:4px 10px;background:#f9731614;border-radius:20px;display:inline-flex;align-items:center;gap:4px;}
.mimg{max-width:200px;border-radius:12px;margin-bottom:4px;display:block;}
.mimg.gen{width:240px;max-width:100%;border-radius:14px;}

/* INPUT */
.ibar{padding:9px 13px;border-top:1px solid ${v.bd};background:${v.bg};display:flex;gap:7px;align-items:flex-end;flex-shrink:0;}
.tinp{flex:1;background:${v.sf};border:1.5px solid ${v.bd};border-radius:22px;color:${v.tx};font-family:'Inter',sans-serif;font-size:14px;padding:11px 17px;outline:none;resize:none;max-height:110px;min-height:46px;transition:border-color .2s;line-height:1.5;}
.tinp:focus{border-color:#f97316;}.tinp::placeholder{color:${v.mt};}
.sbtn{background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:17px;width:46px;height:46px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.sbtn:disabled{opacity:.4;cursor:not-allowed;}
.ibtn{background:${v.sf2};border:1.5px solid ${v.bd};border-radius:50%;color:${v.tx};cursor:pointer;width:42px;height:42px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;}
.ibtn:hover{border-color:#f97316;}.ibtn.rec{border-color:#ef4444;background:#ef444418;animation:mP 1s infinite;}
@keyframes mP{0%,100%{box-shadow:0 0 0 0 #ef444438;}50%{box-shadow:0 0 0 5px transparent;}}
.imgprev{position:relative;display:inline-block;margin-bottom:7px;}
.imgprev img{width:72px;height:72px;object-fit:cover;border-radius:12px;border:2px solid #f97316;}
.imgprev-x{position:absolute;top:-5px;right:-5px;background:#ef4444;border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:11px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;}

/* PAGES */
.page{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px;}
.ptitle{font-size:18px;font-weight:700;margin-bottom:3px;}
.sbar{display:flex;align-items:center;background:${v.sf};border:1.5px solid ${v.bd};border-radius:12px;padding:7px 13px;gap:7px;margin-bottom:3px;}
.sbar input{flex:1;background:none;border:none;outline:none;color:${v.tx};font-size:14px;font-family:'Inter',sans-serif;}
.hcard{background:${v.sf};border:1px solid ${v.bd};border-radius:14px;padding:13px 15px;display:flex;align-items:center;gap:11px;cursor:pointer;transition:border-color .2s;}
.hcard:hover{border-color:#f97316;}
.hi{flex:1;overflow:hidden;}.ht{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hm{font-size:11px;color:${v.mt};margin-top:2px;}
.dbtn{background:none;border:none;color:${v.mt};cursor:pointer;font-size:17px;padding:3px 5px;border-radius:7px;}.dbtn:hover{color:#ef4444;}
.scard{background:${v.sf};border:1px solid ${v.bd};border-radius:14px;overflow:hidden;margin-bottom:3px;}
.srow{display:flex;align-items:center;gap:13px;padding:14px 15px;border-bottom:1px solid ${v.bd};cursor:pointer;}.srow:last-child{border-bottom:none;}
.sicon{font-size:20px;width:27px;text-align:center;}.stxt{flex:1;}
.slbl{font-size:14px;font-weight:600;}.sdesc{font-size:12px;color:${v.mt};margin-top:2px;}
.sec{font-size:11px;font-weight:700;color:${v.mt};letter-spacing:.08em;text-transform:uppercase;margin:11px 0 5px;}
.badge{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
.badge-g{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
.badge-y{background:linear-gradient(135deg,#eab308,#ca8a04);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
.pc{background:linear-gradient(135deg,#f97316,#ea580c);border-radius:16px;padding:16px;margin-bottom:3px;cursor:pointer;}
.pc h3{font-size:17px;font-weight:700;color:#fff;}.pc p{font-size:12px;color:#fff9;margin-top:3px;}
.pf{font-size:13px;color:#fff;display:flex;align-items:center;gap:7px;margin-top:5px;}
.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
.sct{background:${v.sf};border:1px solid ${v.bd};border-radius:14px;padding:15px;}
.sv{font-size:26px;font-weight:800;color:#f97316;}.sl{font-size:12px;color:${v.mt};margin-top:2px;}
.ucard{background:${v.sf};border:1px solid ${v.bd};border-radius:12px;padding:11px 13px;display:flex;align-items:center;gap:11px;}
.uav{width:35px;height:35px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px;flex-shrink:0;}
.tgl{position:relative;width:42px;height:23px;background:${v.sf2};border-radius:12px;cursor:pointer;border:2px solid ${v.bd};transition:background .2s;flex-shrink:0;}
.tgl.on{background:#f97316;border-color:#f97316;}
.tk{position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;transition:left .2s;}
.tgl.on .tk{left:21px;}
.gbar{display:flex;align-items:flex-end;gap:4px;height:72px;margin-top:6px;}
.glbl{font-size:9px;color:${v.mt};text-align:center;margin-top:2px;}
.gval{font-size:8px;color:#f97316;text-align:center;margin-bottom:2px;}

/* PROFILE */
.pav{position:relative;display:inline-block;}
.pavimg{width:68px;height:68px;border-radius:50%;object-fit:cover;border:3px solid #f97316;}
.pavph{width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:#fff;}
.paved{position:absolute;bottom:0;right:0;background:#f97316;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;}

/* MODAL */
.mbg{position:fixed;inset:0;background:#000b;z-index:200;display:flex;align-items:flex-end;padding:14px;}
.modal{background:${v.sf};border-radius:22px 22px 14px 14px;padding:26px 22px;width:100%;max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:13px;max-height:88vh;overflow-y:auto;}
.modal h3{font-size:19px;font-weight:700;text-align:center;}
.modal p{font-size:13px;color:${v.mt};text-align:center;line-height:1.6;}
.mi{font-size:48px;text-align:center;}
.pbox{background:${v.sf2};border:1px solid ${v.bd};border-radius:13px;padding:14px;display:flex;flex-direction:column;gap:9px;}
.pnum{font-size:21px;font-weight:800;color:#f97316;text-align:center;letter-spacing:2px;}
.pstep{font-size:13px;color:${v.tx};display:flex;gap:7px;}
.ld{text-align:center;color:${v.mt};padding:18px;font-size:14px;}

/* VOICE */
.vpage{display:flex;flex-direction:column;height:100%;background:${dark?"#080808":v.bg};overflow:hidden;}
.vbody{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:18px;overflow-y:auto;}
.vorb-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:160px;height:160px;}
.vring{position:absolute;border-radius:50%;pointer-events:none;}
.vr1{animation:vra 1.8s ease-out infinite;background:#f9731622;}
.vr2{animation:vra 1.8s ease-out .4s infinite;background:#f9731614;}
.vr3{animation:vra 1.8s ease-out .8s infinite;background:#f9731608;}
@keyframes vra{0%{width:96px;height:96px;opacity:.9;}100%{width:178px;height:178px;opacity:0;}}
.vorb{width:106px;height:106px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;position:relative;font-size:42px;box-shadow:0 8px 36px #f9731658;transition:all .25s;}
.vorb.listen{background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 0 0 10px #ef444428;animation:op 1s infinite;}
.vorb.speak{background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 8px 36px #22c55e68;}
.vorb.think{background:linear-gradient(135deg,#8b5cf6,#6d28d9);box-shadow:0 8px 36px #8b5cf658;}
@keyframes op{0%,100%{transform:scale(1);}50%{transform:scale(1.07);}}
.vstatus{font-size:17px;font-weight:700;text-align:center;}
.vhint{font-size:12px;color:${v.mt};text-align:center;max-width:270px;line-height:1.6;}
.vgi{display:flex;align-items:center;gap:8px;padding:9px 14px;background:${v.sf};border:1px solid ${v.bd};border-radius:13px;font-size:13px;font-weight:600;}
.vgdot{width:8px;height:8px;border-radius:50%;}
.spdr{display:flex;gap:5px;}
.spdb{flex:1;padding:7px 5px;border-radius:9px;border:1.5px solid ${v.bd};background:transparent;color:${v.mt};cursor:pointer;font-size:11px;font-weight:600;font-family:'Inter',sans-serif;transition:all .2s;}
.spdb.on{border-color:#f97316;color:#f97316;background:#f9731613;}
.vlast{background:${v.sf};border:1px solid ${v.bd};border-radius:13px;padding:13px 15px;width:100%;}
.vendbtn{background:#ef444418;border:1.5px solid #ef4444;border-radius:13px;color:#ef4444;cursor:pointer;font-size:14px;font-weight:700;padding:13px 28px;font-family:'Inter',sans-serif;}
.vwave{display:flex;align-items:center;gap:3px;height:30px;}
.wb{width:3px;border-radius:3px;background:#22c55e;animation:wv 1s ease-in-out infinite;}
@keyframes wv{0%,100%{height:5px;opacity:.5;}50%{height:26px;opacity:1;}}

/* ADMIN CHAT MODAL */
.achat{max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:7px;padding:7px;background:${v.sf2};border-radius:11px;}
`;
}

// ── MAIN ─────────────────────────────────────────────────────────
export default function App(){
  // splash
  const [splash,setSplash]=useState(true);
  const [splashOut,setSplashOut]=useState(false);
  // pwa
  const [pwaEvt,setPwaEvt]=useState(null);
  const [showPwa,setShowPwa]=useState(false);
  // onboarding (gender pick after signup)
  const [showOnboard,setShowOnboard]=useState(false);
  // auth
  const [user,setUser]=useState(null);
  const [authReady,setAuthReady]=useState(false);
  const [authMode,setAuthMode]=useState("login");
  const [forgot,setForgot]=useState(false);
  const [form,setForm]=useState({name:"",email:"",pass:""});
  const [ferr,setFerr]=useState(""); const [fok,setFok]=useState(""); const [fload,setFload]=useState(false);
  // app state
  const [dark,setDark]=useState(true);
  const [page,setPage]=useState("chat");
  const [userData,setUserData]=useState(null);
  const [userGender,setUserGender]=useState("female"); // user's own gender
  const [userMode,setUserMode]=useState("general"); // student/kisan/coder/general
  // chat
  const [sid,setSid]=useState(()=>Date.now().toString());
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [searching,setSearching]=useState(false);
  const [reactions,setReactions]=useState({});
  const [showRx,setShowRx]=useState(null);
  // ui
  const [showMenu,setShowMenu]=useState(false);
  const [showLimit,setShowLimit]=useState(false);
  const [showUpgrade,setShowUpgrade]=useState(false);
  const [payDone,setPayDone]=useState(false);
  const [copied,setCopied]=useState(null);
  const [speakId,setSpeakId]=useState(null);
  const [micActive,setMicActive]=useState(false);
  const [imgB64,setImgB64]=useState(null);
  const [imgPrev,setImgPrev]=useState(null);
  // history
  const [hists,setHists]=useState([]);
  const [histLoad,setHistLoad]=useState(false);
  const [hSearch,setHSearch]=useState("");
  // profile
  const [showProfile,setShowProfile]=useState(false);
  const [pName,setPName]=useState("");
  const [pPhoto,setPPhoto]=useState(null); // new photo base64
  const [pPhotoUrl,setPPhotoUrl]=useState(null); // saved
  const [pSaving,setPSaving]=useState(false);
  // admin
  const [adminUsers,setAdminUsers]=useState([]);
  const [aSearch,setASearch]=useState("");
  const [aChat,setAChat]=useState(null);
  const [aChatLoad,setAChatLoad]=useState(false);
  // voice
  const [vs,setVs]=useState("idle"); // idle|listen|think|speak
  const [vGender,setVGender]=useState("female"); // AI voice gender (matches user)
  const [vDetected,setVDetected]=useState(false);
  const [vSpeed,setVSpeed]=useState(0.92);
  const [vLast,setVLast]=useState("");

  const bottomRef=useRef(null);
  const galleryRef=useRef(null);
  const pPhotoRef=useRef(null);
  const micRef=useRef(null);
  const voiceRef=useRef(null);

  // SPLASH
  useEffect(()=>{
    setTimeout(()=>{setSplashOut(true);setTimeout(()=>setSplash(false),600);},2400);
  },[]);

  // PWA
  useEffect(()=>{
    const h=e=>{e.preventDefault();setPwaEvt(e);setShowPwa(true);};
    window.addEventListener("beforeinstallprompt",h);
    return ()=>window.removeEventListener("beforeinstallprompt",h);
  },[]);

  // AUTH
  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async u=>{
      if(u){
        setUser(u);
        const d=await getDoc(doc(db,"users",u.uid));
        if(d.exists()){
          const data=d.data();
          setUserData(data);
          setPName(data.name||u.displayName||"");
          setPPhotoUrl(data.photoURL||null);
          if(data.gender) setUserGender(data.gender);
          if(data.mode) setUserMode(data.mode);
        }
      } else {setUser(null);setUserData(null);}
      setAuthReady(true);
    });
    return unsub;
  },[]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  useEffect(()=>{
    if(user&&page==="history") loadHists();
    if(user&&page==="admin") loadAdmin();
    if(page!=="voice") endVoice();
    window.speechSynthesis?.cancel();
    setSpeakId(null); setShowRx(null);
  },[page]);

  async function loadHists(){
    setHistLoad(true);
    try{
      const q=query(collection(db,"chats"),where("userId","==",user.uid),orderBy("updatedAt","desc"));
      const snap=await getDocs(q);
      setHists(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch{
      try{
        const q2=query(collection(db,"chats"),where("userId","==",user.uid));
        const s2=await getDocs(q2);
        setHists(s2.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.updatedAt?.seconds||0)-(a.updatedAt?.seconds||0)));
      } catch(e){console.error(e);}
    }
    setHistLoad(false);
  }

  async function loadAdmin(){
    const snap=await getDocs(collection(db,"users"));
    setAdminUsers(snap.docs.map(d=>({id:d.id,...d.data()})));
  }

  async function viewUserChat(u){
    setAChat({user:u,msgs:[]});
    setAChatLoad(true);
    try{
      let msgs2=[];
      try{
        const q=query(collection(db,"messages"),where("userId","==",u.id),orderBy("createdAt","desc"),limit(30));
        const snap=await getDocs(q);
        msgs2=snap.docs.map(d=>({id:d.id,...d.data()})).reverse();
      } catch{
        const q2=query(collection(db,"messages"),where("userId","==",u.id));
        const s2=await getDocs(q2);
        msgs2=s2.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)).slice(-30);
      }
      setAChat({user:u,msgs:msgs2});
    } catch(e){console.error(e);}
    setAChatLoad(false);
  }

  async function handleAuth(){
    setFerr(""); setFok("");
    if(forgot){
      if(!form.email){setFerr("Email daalo!");return;}
      setFload(true);
      try{await sendPasswordResetEmail(auth,form.email);setFok("✅ Reset link bhej diya!");setForm(f=>({...f,email:""}));}
      catch{setFerr("Email registered nahi hai!");}
      setFload(false);return;
    }
    if(!form.email||!form.pass){setFerr("Sab fields bharo!");return;}
    if(form.pass.length<8){setFerr("Password 8+ characters!");return;}
    if(authMode==="signup"&&!form.name){setFerr("Naam daalo!");return;}
    setFload(true);
    try{
      if(authMode==="signup"){
        const c=await createUserWithEmailAndPassword(auth,form.email,form.pass);
        await updateProfile(c.user,{displayName:form.name});
        await setDoc(doc(db,"users",c.user.uid),{name:form.name,email:form.email,premium:false,createdAt:serverTimestamp(),usageCount:0,gender:"female",mode:"general"});
        setUserData({name:form.name,email:form.email,premium:false,usageCount:0});
        setPName(form.name);
        setShowOnboard(true); // show gender picker after signup
      } else {
        await signInWithEmailAndPassword(auth,form.email,form.pass);
        const d=await getDoc(doc(db,"users",auth.currentUser.uid));
        if(d.exists()) setUserData(d.data());
      }
      setForm({name:"",email:"",pass:""});
    } catch(e){
      const errs={"auth/email-already-in-use":"Email already registered!","auth/invalid-email":"Invalid email!","auth/wrong-password":"Wrong password!","auth/user-not-found":"Account nahi mila!","auth/invalid-credential":"Wrong email ya password!"};
      setFerr(errs[e.code]||e.message);
    }
    setFload(false);
  }

  async function saveOnboard(gender, mode){
    setUserGender(gender); setUserMode(mode);
    setVGender(gender);
    await setDoc(doc(db,"users",user.uid),{gender,mode},{merge:true});
    setUserData(p=>({...p,gender,mode}));
    setShowOnboard(false);
  }

  async function saveProfile(){
    if(!pName.trim()){alert("Naam daalo!");return;}
    setPSaving(true);
    try{
      const updates={name:pName.trim()};
      if(pPhoto){
        // compress to ~100KB before saving
        const compressed=await compressImage(pPhoto,120,0.55);
        updates.photoURL=compressed;
        setPPhotoUrl(compressed);
      }
      await updateProfile(auth.currentUser,{displayName:pName.trim(),...(pPhoto&&{photoURL:updates.photoURL})});
      await setDoc(doc(db,"users",user.uid),updates,{merge:true});
      setUserData(p=>({...p,...updates}));
      setPPhoto(null);
      setShowProfile(false);
    } catch(e){alert("Error: "+e.message);}
    setPSaving(false);
  }

  function handleGallery(e){
    const file=e.target.files[0];if(!file) return;
    e.target.value="";
    const reader=new FileReader();
    reader.onload=ev=>{const r=ev.target.result;setImgB64(r.split(",")[1]);setImgPrev(r);};
    reader.onerror=()=>alert("Image load nahi hui!");
    reader.readAsDataURL(file);
  }

  function handlePPhoto(e){
    const file=e.target.files[0];if(!file) return;
    e.target.value="";
    const reader=new FileReader();
    reader.onload=ev=>setPPhoto(ev.target.result);
    reader.readAsDataURL(file);
  }

  // ── MIC (text input) ──
  function toggleMic(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Chrome ya Edge mein use karo!");return;}
    if(micActive){micRef.current?.stop();setMicActive(false);return;}
    const r=new SR();
    r.lang="hi-IN";r.continuous=false;r.interimResults=false;
    r.onstart=()=>setMicActive(true);
    r.onresult=e=>{const t=e.results[0][0].transcript;if(t) setInput(p=>p?p+" "+t:t);};
    r.onerror=err=>{if(err.error==="not-allowed") alert("Mic permission do browser settings mein!");setMicActive(false);};
    r.onend=()=>setMicActive(false);
    micRef.current=r;
    try{r.start();}catch{setMicActive(false);}
  }

  function toggleSpeak(id,text){
    if(speakId===id){window.speechSynthesis?.cancel();setSpeakId(null);return;}
    setSpeakId(id);
    speakText(text,vGender,vSpeed,()=>setSpeakId(null));
  }

  function copyMsg(text,id){
    navigator.clipboard?.writeText(text).catch(()=>{const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);});
    setCopied(id);setTimeout(()=>setCopied(null),2000);
  }

  function shareWA(text){window.open("https://wa.me/?text="+encodeURIComponent("Saraswati AI:\n\n"+text.slice(0,500)),"_blank");}

  function exportChat(){
    if(!msgs.length){alert("Koi chat nahi!");return;}
    const txt=msgs.map(m=>(m.role==="user"?"Aap":"Saraswati AI")+":\n"+m.text).join("\n\n---\n\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([txt],{type:"text/plain"}));
    a.download="saraswati-chat.txt";a.click();
  }

  // ── VOICE CALL ──
  function endVoice(){
    voiceRef.current?.stop?.();voiceRef.current?.abort?.();
    window.speechSynthesis?.cancel();setVs("idle");
  }

  async function handleOrb(){
    if(vs==="listen"){voiceRef.current?.stop?.();setVs("idle");return;}
    if(vs==="speak"){window.speechSynthesis?.cancel();setVs("idle");return;}
    if(vs==="think") return;
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Chrome ya Edge browser mein voice use karo! Microphone permission bhi do.");return;}
    const r=new SR();
    r.lang="hi-IN";r.continuous=false;r.interimResults=false;r.maxAlternatives=1;
    r.onresult=async e=>{
      const transcript=e.results[0][0].transcript;
      if(!transcript.trim()){setVs("idle");return;}
      // detect gender from what user said
      const det=detectGender(transcript);
      if(det){setVGender(det);setVDetected(true);}
      const cg=det||vGender;
      setVs("think");
      const ud=userData;
      if(!ud?.premium&&(ud?.usageCount||0)>=FREE_LIMIT){setShowLimit(true);setVs("idle");return;}
      const uRef=await addDoc(collection(db,"messages"),{sessionId:sid,userId:user.uid,role:"user",text:transcript,createdAt:serverTimestamp()});
      const newMsgs=[...msgs,{id:uRef.id,role:"user",text:transcript,time:new Date()}];
      setMsgs(newMsgs);
      // smart title
      const title=msgs.length===0?await generateChatTitle(transcript):undefined;
      await setDoc(doc(db,"chats",sid),{userId:user.uid,...(title&&{title}),updatedAt:serverTimestamp(),createdAt:serverTimestamp()},{merge:true});
      const nc=(ud?.usageCount||0)+1;
      await setDoc(doc(db,"users",user.uid),{usageCount:nc},{merge:true});
      setUserData(p=>({...p,usageCount:nc}));
      try{
        const aiText=await callAI(newMsgs,null,cg,userMode);
        const tid="v_"+Date.now();
        setMsgs(p=>[...p,{id:tid,role:"ai",text:aiText,time:new Date()}]);
        setVLast(aiText);
        await addDoc(collection(db,"messages"),{sessionId:sid,userId:user.uid,role:"ai",text:aiText,createdAt:serverTimestamp()});
        setVs("speak");
        speakText(aiText,cg,vSpeed,()=>setVs("idle"));
      } catch(err){setMsgs(p=>[...p,{id:Date.now(),role:"ai",text:"❌ "+err.message,time:new Date()}]);setVs("idle");}
    };
    r.onerror=e=>{
      console.error("Voice err:",e.error);
      if(e.error==="not-allowed"||e.error==="permission-denied") alert("Mic permission do! Browser settings > Site Settings > Microphone");
      else if(e.error==="no-speech") setVs("idle"); // just reset silently
      else if(e.error==="network") alert("Network error — internet check karo");
      setVs("idle");
    };
    r.onend=()=>{if(vs==="listen") setVs("idle");};
    voiceRef.current=r;
    try{r.start();setVs("listen");}catch(e){console.error(e);setVs("idle");}
  }

  // ── SEND MSG ──
  async function sendMsg(text){
    const txt=text||input.trim();
    if((!txt&&!imgB64)||loading) return;
    const ud=userData;
    if(!ud?.premium&&(ud?.usageCount||0)>=FREE_LIMIT){setShowLimit(true);return;}
    const msgText=txt||"Is image mein kya hai?";
    setInput("");
    const b64=imgB64,prev=imgPrev;
    setImgB64(null);setImgPrev(null);
    playSendSound();
    const uRef=await addDoc(collection(db,"messages"),{sessionId:sid,userId:user.uid,role:"user",text:msgText,image:prev||null,createdAt:serverTimestamp()});
    const newMsgs=[...msgs,{id:uRef.id,role:"user",text:msgText,image:prev,time:new Date()}];
    setMsgs(newMsgs);
    // smart title for first message
    const isFirst=msgs.length===0;
    const title=isFirst?await generateChatTitle(msgText):undefined;
    await setDoc(doc(db,"chats",sid),{userId:user.uid,...(title?{title}:{title:msgText.slice(0,40)}),updatedAt:serverTimestamp(),createdAt:serverTimestamp()},{merge:true});
    const nc=(ud?.usageCount||0)+1;
    await setDoc(doc(db,"users",user.uid),{usageCount:nc},{merge:true});
    setUserData(p=>({...p,usageCount:nc}));
    if(!b64&&needsImageGen(msgText)){
      setLoading(true);
      const prompt=extractImagePrompt(msgText);
      const url=getImageUrl(prompt);
      await new Promise(r=>setTimeout(r,500));
      const tid="img_"+Date.now();
      const aiText="🎨 Yeh raha aapka image — \""+prompt+"\"";
      setLoading(false);
      setMsgs(p=>[...p,{id:tid,role:"ai",text:aiText,image:url,time:new Date()}]);
      await addDoc(collection(db,"messages"),{sessionId:sid,userId:user.uid,role:"ai",text:aiText,image:url,createdAt:serverTimestamp()});
      return;
    }
    if(needsSearch(msgText)) setSearching(true);
    setLoading(true);
    try{
      const aiText=await callAI(newMsgs,b64,vGender,userMode);
      setSearching(false);
      const tid="ai_"+Date.now();
      setLoading(false);
      setMsgs(p=>[...p,{id:tid,role:"ai",text:"",time:new Date()}]);
      let shown="",sc=0;
      for(let i=0;i<aiText.length;i++){
        shown+=aiText[i];const s=shown;
        setMsgs(p=>p.map(m=>m.id===tid?{...m,text:s}:m));
        sc++;if(sc%10===0) playTypingSound();
        await new Promise(r=>setTimeout(r,7));
      }
      await addDoc(collection(db,"messages"),{sessionId:sid,userId:user.uid,role:"ai",text:aiText,createdAt:serverTimestamp()});
    } catch(e){setSearching(false);setLoading(false);setMsgs(p=>[...p,{id:Date.now(),role:"ai",text:"❌ Error: "+e.message,time:new Date()}]);}
  }

  async function loadSession(s){
    try{
      setPage("chat");setSid(s.id);setMsgs([]);
      const q=query(collection(db,"messages"),where("sessionId","==",s.id));
      const snap=await getDocs(q);
      setMsgs(snap.docs.map(d=>({id:d.id,...d.data(),time:d.data().createdAt})).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)));
    } catch(e){alert("❌ "+e.message);}
  }

  async function delSession(id,e){e.stopPropagation();await deleteDoc(doc(db,"chats",id));setHists(p=>p.filter(h=>h.id!==id));}

  async function adminToggle(uid,cur){
    await updateDoc(doc(db,"users",uid),{premium:!cur,premiumPending:false});
    setAdminUsers(p=>p.map(u=>u.id===uid?{...u,premium:!cur}:u));
  }
  async function adminDel(uid){
    if(!window.confirm("Delete karo?")) return;
    await deleteDoc(doc(db,"users",uid));
    setAdminUsers(p=>p.filter(u=>u.id!==uid));
  }

  function newChat(){setSid(Date.now().toString());setMsgs([]);setPage("chat");setShowMenu(false);setImgB64(null);setImgPrev(null);endVoice();setReactions({});}

  const isAdmin=user?.email===ADMIN_EMAIL;
  const chatsLeft=userData?.premium?null:Math.max(0,FREE_LIMIT-(userData?.usageCount||0));
  const displayName=userData?.name||user?.displayName||"User";

  const filtHists=hists.filter(h=>(h.title||"").toLowerCase().includes(hSearch.toLowerCase()));
  const filtAdminU=adminUsers.filter(u=>(u.name||"").toLowerCase().includes(aSearch.toLowerCase())||(u.email||"").toLowerCase().includes(aSearch.toLowerCase()));

  // Real user graph
  const adminGraph=Array.from({length:7},(_,i)=>{
    const day=adminUsers.filter(u=>{
      if(!u.createdAt?.seconds) return false;
      const da=Math.floor((Date.now()-u.createdAt.seconds*1000)/86400000);
      return da===(6-i);
    }).length;
    return {l:["M","T","W","T","F","S","S"][i],v:day};
  });
  const maxG=Math.max(...adminGraph.map(d=>d.v),1);

  const vOrbIcon=vs==="listen"?"🎙️":vs==="think"?"🤔":vs==="speak"?"🔊":"🪷";
  const vStatusTxt={idle:"Tap karke baat karo",listen:"Sun raha hoon... 👂",think:"Soch rahi hoon... 💭",speak:"Bol rahi hoon... 🔊"}[vs];
  const modeEmoji={general:"🌸",student:"📚",kisan:"🌾",coder:"💻"}[userMode]||"🌸";

  if(!authReady) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100dvh",background:"#0f0f0f"}}>
      <style>{css(true)}</style>
      <span style={{fontSize:56}}>🪷</span>
      <div style={{marginTop:10,color:"#6b7280",fontSize:14}}>Loading...</div>
    </div>
  );

  // ── NOT LOGGED IN ──
  if(!user) return(
    <div className="app">
      <style>{css(dark)}</style>
      {splash&&<div className={`splash${splashOut?" out":""}`}><span className="s-logo">🪷</span><div className="s-title">Saraswati AI</div><div className="s-sub">Aapki apni AI assistant</div><div className="s-bar"><div className="s-prog"/></div></div>}
      <div className="auth">
        <div className="auth-logo">🪷</div>
        <div className="auth-title">Saraswati AI</div>
        <div className="auth-sub">India's best AI assistant — Students, Kisans, Coders sabke liye</div>
        <div className="card">
          {forgot?(
            <>
              <div className="card-head">🔑 Password Reset</div>
              <div className="iw"><div className="ilbl">EMAIL</div><input className="inp" type="email" placeholder="email@example.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/></div>
              {ferr&&<div className="err">{ferr}</div>}
              {fok&&<div className="ok">{fok}</div>}
              <button className="btn btn-p" onClick={handleAuth} disabled={fload}>{fload?"Bhej raha hoon...":"📧 Reset Link Bhejo"}</button>
              <div className="link"><span onClick={()=>{setForgot(false);setFerr("");setFok("");}}>← Wapas</span></div>
            </>
          ):(
            <>
              <div className="card-head">{authMode==="login"?"Swagat Hai! 👋":"Account Banao ✨"}</div>
              {authMode==="signup"&&<div className="iw"><div className="ilbl">NAAM</div><input className="inp" placeholder="Apna naam" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>}
              <div className="iw"><div className="ilbl">EMAIL</div><input className="inp" type="email" placeholder="email@example.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
              <div className="iw">
                <div className="ilbl">PASSWORD</div>
                <input className="inp" type="password" placeholder="Min 8 characters" value={form.pass} onChange={e=>setForm(f=>({...f,pass:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
              </div>
              {ferr&&<div className="err">{ferr}</div>}
              <button className="btn btn-p" onClick={handleAuth} disabled={fload}>{fload?"Ruko...":authMode==="login"?"Login →":"Account Banao →"}</button>
              {authMode==="login"&&<div className="link" style={{color:"#fb923c",cursor:"pointer",fontWeight:600}} onClick={()=>{setForgot(true);setFerr("");setFok("");}}>Password bhool gaye?</div>}
            </>
          )}
        </div>
        {!forgot&&<div className="link">{authMode==="login"?<>Account nahi hai? <span onClick={()=>{setAuthMode("signup");setFerr("");}}>Sign Up karo</span></>:<>Account hai? <span onClick={()=>{setAuthMode("login");setFerr("");}}>Login karo</span></>}</div>}
      </div>
    </div>
  );

  // ── ONBOARDING (gender+mode) ──
  if(showOnboard) return(
    <div className="app">
      <style>{css(dark)}</style>
      <div className="onboard">
        <span style={{fontSize:64}}>🪷</span>
        <h2>Namaste {displayName}! 🙏</h2>
        <p>Aap kaun hain? Main aapke liye personalize ho jaati hoon!</p>
        <div style={{width:"100%"}}>
          <div className="sec">Aap kaun hain?</div>
          <div className="gender-cards">
            <div className="gc" onClick={()=>setUserGender("female")} style={userGender==="female"?{borderColor:"#f97316",background:"#f9731612"}:{}}>
              <div className="gc-icon">👩</div>
              <div className="gc-label">Ladki / Mahila</div>
              <div className="gc-sub">Female voice & tone</div>
            </div>
            <div className="gc" onClick={()=>setUserGender("male")} style={userGender==="male"?{borderColor:"#f97316",background:"#f9731612"}:{}}>
              <div className="gc-icon">👨</div>
              <div className="gc-label">Ladka / Aadmi</div>
              <div className="gc-sub">Male voice & tone</div>
            </div>
          </div>
        </div>
        <div style={{width:"100%"}}>
          <div className="sec">Main kya hoon?</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[{k:"student",i:"📚",l:"Student",s:"Padhai, notes, UPSC"},{k:"kisan",i:"🌾",l:"Kisan",s:"Fasal, mandi, scheme"},{k:"coder",i:"💻",l:"Coder",s:"Code, debug, build"},{k:"general",i:"🌸",l:"General",s:"Sab kuch"}].map(({k,i,l,s})=>(
              <div key={k} className="gc" style={userMode===k?{borderColor:"#f97316",background:"#f9731612"}:{}} onClick={()=>setUserMode(k)}>
                <div className="gc-icon" style={{fontSize:36}}>{i}</div>
                <div className="gc-label" style={{fontSize:14}}>{l}</div>
                <div className="gc-sub">{s}</div>
              </div>
            ))}
          </div>
        </div>
        <button className="btn btn-p" style={{width:"100%",marginTop:4}} onClick={()=>saveOnboard(userGender,userMode)}>Shuru Karo → 🚀</button>
      </div>
    </div>
  );

  // ── MAIN APP ──
  return(
    <div className="app" onClick={()=>{showMenu&&setShowMenu(false);showRx&&setShowRx(null);}}>
      <style>{css(dark)}</style>

      {/* SPLASH */}
      {splash&&<div className={`splash${splashOut?" out":""}`}><span className="s-logo">🪷</span><div className="s-title">Saraswati AI</div><div className="s-sub">Namaste, {displayName}! 🙏</div><div className="s-bar"><div className="s-prog"/></div></div>}

      {/* PWA BANNER */}
      {showPwa&&pwaEvt&&(
        <div className="pwa">
          <span style={{fontSize:26}}>🪷</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13}}>App Install Karo!</div>
            <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>Home screen pe add karo</div>
          </div>
          <button className="pwa-btn" onClick={async()=>{pwaEvt.prompt();await pwaEvt.userChoice;setShowPwa(false);}}>Install</button>
          <button className="pwa-x" onClick={()=>setShowPwa(false)}>✕</button>
        </div>
      )}

      {/* HEADER */}
      <div className="hdr">
        <button className="dots" onClick={e=>{e.stopPropagation();setShowMenu(v=>!v);}}>⋯</button>
        <span style={{fontSize:22}}>🪷</span>
        <div className="hdr-name">Saraswati AI</div>
        {page==="chat"&&<button className="nbtn" onClick={newChat}>✏️ New</button>}
        {page==="voice"&&<button className="nbtn" style={{background:"#ef444418",borderColor:"#ef4444",color:"#ef4444"}} onClick={()=>{endVoice();setPage("chat");}}>📵 End</button>}
      </div>

      {/* DROPDOWN */}
      {showMenu&&(
        <div className="dd" onClick={e=>e.stopPropagation()}>
          <div className="ddu">
            {pPhotoUrl?<img src={pPhotoUrl} alt="" style={{width:38,height:38,borderRadius:"50%",objectFit:"cover",border:"2px solid #f97316",marginBottom:5}}/>:<div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#fff",fontSize:17,marginBottom:5}}>{displayName[0]?.toUpperCase()}</div>}
            <div className="ddn">{displayName}</div>
            <div className="dde">{user.email}</div>
            {userData?.premium&&<div className="ptag">⭐ PREMIUM</div>}
            <div className="mode-chip">{modeEmoji} {userMode}</div>
          </div>
          <div className="ddiv"/>
          <div className="ddi" onClick={newChat}>✏️ New Chat</div>
          <div className="ddi" onClick={()=>{setPage("chat");setShowMenu(false);}}>💬 Chat</div>
          <div className="ddi" onClick={()=>{setPage("voice");setShowMenu(false);}}>🎙️ Voice Call</div>
          <div className="ddi" onClick={()=>{setPage("history");setShowMenu(false);}}>📂 History</div>
          <div className="ddi" onClick={()=>{setPage("settings");setShowMenu(false);}}>⚙️ Settings</div>
          {isAdmin&&<div className="ddi" onClick={()=>{setPage("admin");setShowMenu(false);}}>🛡️ Admin</div>}
          <div className="ddiv"/>
          <div className="ddi" onClick={()=>{setDark(v=>!v);setShowMenu(false);}}>{dark?"☀️ Light Mode":"🌙 Dark Mode"}</div>
          <div className="ddi" onClick={()=>{shareWA(msgs.filter(m=>m.role==="ai").pop()?.text||"");setShowMenu(false);}}>📤 Share Chat</div>
          <div className="ddi" onClick={()=>{exportChat();setShowMenu(false);}}>📄 Export</div>
          <div className="ddiv"/>
          {!userData?.premium&&<div className="ddi" onClick={()=>{setShowUpgrade(true);setShowMenu(false);}}>⭐ Premium</div>}
          <div className="ddi red" onClick={()=>signOut(auth)}>🚪 Logout</div>
        </div>
      )}

      {page==="chat"&&<div className="ubar"><span>{userData?.premium?"⭐ Premium":`Free ${modeEmoji}`}</span><span className="upill">{userData?.premium?"Unlimited":chatsLeft+" left"}</span></div>}

      {/* ── CHAT ── */}
      {page==="chat"&&(
        <>
          <div className="chat">
            {msgs.length===0&&(
              <div className="welcome">
                {/* NO ANIMATION on welcome lotus — just static */}
                <span className="w-lotus" onClick={()=>setPage("voice")}>🪷</span>
                <h2>Saraswati AI</h2>
                <p className="welcome-sub">Kuch bhi poochho — ya lotus dabao voice call ke liye</p>
                <div style={{fontSize:13,color:"#f97316",fontWeight:600}}>{modeEmoji} {userMode==="student"?"Student Mode — Notes, UPSC, Concepts ready!":userMode==="kisan"?"Kisan Mode — Mandi, Fasal, Scheme ready!":userMode==="coder"?"Coder Mode — Full code always ready!":"Sab ke liye ready hoon!"}</div>
              </div>
            )}
            {msgs.map(m=>(
              <div key={m.id} className="mwrap">
                <div className={"mrow "+m.role} style={{position:"relative"}}>
                  {m.role==="ai"&&<div className="aiav">🪷</div>}
                  <div className="bwrap" style={m.role==="user"?{alignItems:"flex-end"}:{alignItems:"flex-start"}}>
                    {showRx===m.id&&(
                      <div className="rbar" onClick={e=>e.stopPropagation()}>
                        {REACTIONS.map(em=><button key={em} className="rbtn" onClick={()=>{setReactions(p=>({...p,[m.id]:em}));setShowRx(null);}}>{em}</button>)}
                      </div>
                    )}
                    <div className={"bub "+m.role} onDoubleClick={()=>setShowRx(p=>p===m.id?null:m.id)}>
                      {m.image&&(m.role==="ai"?<a href={m.image} target="_blank" rel="noreferrer"><img src={m.image} className="mimg gen" alt="gen"/></a>:<img src={m.image} className="mimg" alt="img"/>)}
                      {m.role==="ai"?<AIText text={m.text}/>:m.text}
                    </div>
                    {reactions[m.id]&&<div className="react">{reactions[m.id]}</div>}
                    {m.text&&(
                      <div className="acts" style={m.role==="user"?{justifyContent:"flex-end"}:{}}>
                        {m.role==="ai"&&<button className={"abtn"+(speakId===m.id?" on":"")} onClick={()=>toggleSpeak(m.id,m.text)}>{speakId===m.id?<IcoStop s={13}/>:<IcoSpeak s={13}/>}</button>}
                        <button className={"abtn"+(copied===m.id?" on":"")} onClick={()=>copyMsg(m.text,m.id)}>{copied===m.id?<IcoOk s={13}/>:<IcoCopy s={13}/>}</button>
                        {m.role==="ai"&&<button className="abtn" onClick={()=>shareWA(m.text)}><IcoShare s={13}/></button>}
                        <button className="abtn" onClick={()=>setShowRx(p=>p===m.id?null:m.id)} style={{fontSize:11}}>😊</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className={"mtime "+m.role}>{fmtTime(m.time)}</div>
              </div>
            ))}
            {searching&&<div className="mrow"><div className="aiav">🪷</div><div className="sind">🌐 Search ho raha hai...</div></div>}
            {loading&&!searching&&<div className="mrow"><div className="aiav">🪷</div><div className="tbub"><div className="dot"/><div className="dot"/><div className="dot"/></div></div>}
            <div ref={bottomRef}/>
          </div>
          <div className="ibar">
            <input type="file" ref={galleryRef} accept="image/*" style={{display:"none"}} onChange={handleGallery}/>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
              {imgPrev&&<div className="imgprev"><img src={imgPrev} alt="p"/><button className="imgprev-x" onClick={()=>{setImgB64(null);setImgPrev(null);}}>✕</button></div>}
              <div style={{display:"flex",gap:7,alignItems:"flex-end"}}>
                <button className="ibtn" onClick={()=>galleryRef.current?.click()}><IcoImg/></button>
                <button className={"ibtn"+(micActive?" rec":"")} onClick={toggleMic}><IcoMic active={micActive}/></button>
                <textarea className="tinp" placeholder={micActive?"Sun raha hoon...":"Kuch bhi poochho..."} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),sendMsg())} rows={1} style={micActive?{borderColor:"#ef4444"}:{}}/>
                <button className="sbtn" onClick={()=>sendMsg()} disabled={(!input.trim()&&!imgB64)||loading}>➤</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── VOICE PAGE ── */}
      {page==="voice"&&(
        <div className="vpage">
          <div className="vbody">
            <div className="vgi">
              <div className="vgdot" style={{background:vGender==="female"?"#ec4899":"#3b82f6"}}/>
              {vDetected?(vGender==="female"?"👩 Ladki detect — Female AI voice":"👨 Ladka detect — Male AI voice"):"Tap karo — gender auto-detect hoga"}
            </div>
            {/* VOICE ORB — animation only here */}
            <div className="vorb-wrap">
              {(vs==="listen"||vs==="speak")&&<><div className="vring vr1"/><div className="vring vr2"/><div className="vring vr3"/></>}
              <div className={`vorb${vs==="listen"?" listen":vs==="speak"?" speak":vs==="think"?" think":""}`} onClick={handleOrb}>{vOrbIcon}</div>
            </div>
            <div className="vstatus">{vStatusTxt}</div>
            {vs==="speak"&&<div className="vwave">{[0,1,2,3,4].map(i=><div key={i} className="wb" style={{animationDelay:`${i*0.1}s`}}/>)}</div>}
            <div className="vhint">Hindi • English • Urdu • Punjabi • 100+ languages</div>
            <div className="vhint" style={{fontSize:11}}>Double tap = stop • Tap again = new question</div>
            <div className="spdr">
              {[{l:"🐢",v:0.65},{l:"Normal",v:0.92},{l:"⚡",v:1.3}].map(s=>(
                <button key={s.v} className={"spdb"+(vSpeed===s.v?" on":"")} onClick={()=>setVSpeed(s.v)}>{s.l}</button>
              ))}
            </div>
            {vLast&&<div className="vlast"><div style={{fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:4}}>Pichla Jawab:</div><div style={{fontSize:13,lineHeight:1.6}}>{vLast.slice(0,180)}{vLast.length>180?"...":""}</div></div>}
            <button className="vendbtn" onClick={()=>{endVoice();setPage("chat");}}>📵 Call Khatam Karo</button>
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {page==="history"&&(
        <div className="page">
          <div className="ptitle">📂 History</div>
          <div className="sbar"><IcoSearch/><input placeholder="Chat dhundho..." value={hSearch} onChange={e=>setHSearch(e.target.value)}/></div>
          {histLoad?<div className="ld">⏳ Load ho raha hai...</div>
          :filtHists.length===0?<div className="welcome"><span style={{fontSize:56}}>📭</span><h2>Koi history nahi</h2></div>
          :filtHists.map(h=>(
            <div key={h.id} className="hcard" onClick={()=>loadSession(h)}>
              <div style={{fontSize:19}}>💬</div>
              <div className="hi"><div className="ht">{h.title}</div><div className="hm">{fmtDate(h.updatedAt)}</div></div>
              <button className="dbtn" onClick={e=>delSession(h.id,e)}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* ── SETTINGS ── */}
      {page==="settings"&&(
        <div className="page">
          {!userData?.premium&&(
            <div className="pc" onClick={()=>setShowUpgrade(true)}>
              <h3>⭐ Premium Lelo</h3><p>₹99/month — Sab unlimited!</p>
              <div className="pf">✅ Unlimited Chat & Voice</div>
              <div className="pf">✅ Web Search + Image AI</div>
              <div className="pf">✅ Priority Support</div>
            </div>
          )}
          <div className="sec">Profile</div>
          <div className="scard">
            <div className="srow" onClick={()=>setShowProfile(true)}>
              <div className="pav">
                {pPhotoUrl?<img src={pPhotoUrl} className="pavimg" alt=""/>:<div className="pavph">{displayName[0]?.toUpperCase()}</div>}
                <div className="paved">📷</div>
              </div>
              <div className="stxt"><div className="slbl">{displayName}</div><div className="sdesc">{user.email}</div></div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",justifyContent:"flex-end"}}>
                {userData?.premium&&<div className="badge">PREMIUM</div>}
                {isAdmin&&<div className="badge">ADMIN</div>}
              </div>
            </div>
            <div className="srow"><div className="sicon">📊</div><div className="stxt"><div className="slbl">Usage</div><div className="sdesc">{userData?.premium?"Unlimited":chatsLeft+" free bache"}</div></div></div>
          </div>
          <div className="sec">Mode</div>
          <div className="scard">
            <div className="srow">
              <div className="sicon">{modeEmoji}</div>
              <div className="stxt"><div className="slbl">Current Mode</div><div className="sdesc">{userMode}</div></div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {["student","kisan","coder","general"].map(m=>(
                  <button key={m} onClick={async()=>{setUserMode(m);await setDoc(doc(db,"users",user.uid),{mode:m},{merge:true});setUserData(p=>({...p,mode:m}));}} style={{background:userMode===m?"#f9731618":"transparent",border:"1px solid "+(userMode===m?"#f97316":"#444"),borderRadius:7,color:userMode===m?"#f97316":"#888",cursor:"pointer",padding:"3px 8px",fontFamily:"Inter,sans-serif",fontSize:10,fontWeight:600}}>{m}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="sec">Voice</div>
          <div className="scard">
            <div className="srow">
              <div className="sicon">🎙️</div>
              <div className="stxt"><div className="slbl">Aapki Awaaz</div><div className="sdesc">Voice call mein auto-detect hoga</div></div>
              <div style={{display:"flex",gap:5}}>
                {["female","male"].map(g=>(
                  <button key={g} onClick={async()=>{setUserGender(g);setVGender(g);await setDoc(doc(db,"users",user.uid),{gender:g},{merge:true});}} style={{background:userGender===g?"#f9731618":"transparent",border:"1px solid "+(userGender===g?"#f97316":"#444"),borderRadius:8,color:userGender===g?"#f97316":"#888",cursor:"pointer",padding:"4px 9px",fontFamily:"Inter,sans-serif",fontSize:11}}>{g==="female"?"👩 F":"👨 M"}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="sec">Appearance</div>
          <div className="scard">
            <div className="srow" onClick={()=>setDark(v=>!v)}>
              <div className="sicon">{dark?"☀️":"🌙"}</div>
              <div className="stxt"><div className="slbl">{dark?"Light Mode":"Dark Mode"}</div><div className="sdesc">Theme badlo</div></div>
              <div className={"tgl"+(dark?" on":"")}><div className="tk"/></div>
            </div>
          </div>
          <div className="sec">Account</div>
          <div className="scard">
            <div className="srow" onClick={()=>signOut(auth)}><div className="sicon">🚪</div><div className="stxt"><div className="slbl" style={{color:"#ef4444"}}>Logout</div><div className="sdesc">Sign out karo</div></div></div>
          </div>
        </div>
      )}

      {/* ── ADMIN ── */}
      {page==="admin"&&isAdmin&&(
        <div className="page">
          <div style={{background:"#f9731614",border:"1px solid #f97316",borderRadius:11,padding:"11px 13px",fontSize:13,color:"#fb923c"}}>🛡️ Admin Panel</div>
          <div className="sgrid">
            <div className="sct"><div className="sv">{adminUsers.length}</div><div className="sl">👥 Users</div></div>
            <div className="sct"><div className="sv">{adminUsers.filter(u=>u.premium).length}</div><div className="sl">⭐ Premium</div></div>
            <div className="sct"><div className="sv">₹{adminUsers.filter(u=>u.premium).length*99}</div><div className="sl">💰 Revenue</div></div>
            <div className="sct"><div className="sv">{adminUsers.reduce((s,u)=>s+(u.usageCount||0),0)}</div><div className="sl">💬 Chats</div></div>
          </div>
          <div className="scard" style={{padding:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"#6b7280",letterSpacing:".05em",marginBottom:3}}>NEW SIGNUPS — LAST 7 DAYS</div>
            <div className="gbar">
              {adminGraph.map((d,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div className="gval">{d.v>0?d.v:""}</div>
                  <div style={{width:"100%",background:"#f97316",borderRadius:"3px 3px 0 0",height:Math.max(d.v===0?2:(d.v/maxG)*56,2),opacity:d.v===0?.25:.9}}/>
                  <div className="glbl">{d.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="sbar"><IcoSearch/><input placeholder="User dhundho..." value={aSearch} onChange={e=>setASearch(e.target.value)}/></div>
          {adminUsers.some(u=>u.premiumPending&&!u.premium)&&(
            <>
              <div className="sec">⏳ Pending ({adminUsers.filter(u=>u.premiumPending&&!u.premium).length})</div>
              {adminUsers.filter(u=>u.premiumPending&&!u.premium).map(u=>(
                <div key={u.id} className="ucard" style={{border:"1px solid #eab308"}}>
                  <div className="uav">{u.name?.[0]?.toUpperCase()}</div>
                  <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{u.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{u.email}</div></div>
                  <button onClick={()=>adminToggle(u.id,false)} style={{background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,padding:"6px 11px"}}>✅ Approve</button>
                </div>
              ))}
            </>
          )}
          <div className="sec">All Users ({filtAdminU.length})</div>
          {filtAdminU.map(u=>(
            <div key={u.id} className="ucard" style={{flexDirection:"column",alignItems:"stretch",gap:7}}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                {u.photoURL?<img src={u.photoURL} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}} alt=""/>:<div className="uav">{u.name?.[0]?.toUpperCase()}</div>}
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600}}>{u.name}</div>
                  <div style={{fontSize:11,color:"#6b7280"}}>{u.email} • {u.usageCount||0} chats • {u.mode||"general"}</div>
                </div>
                {u.premium&&<div className="badge-g">⭐</div>}
                {u.email===ADMIN_EMAIL&&<div className="badge">ADMIN</div>}
                {u.premiumPending&&!u.premium&&<div className="badge-y">PENDING</div>}
              </div>
              {u.email!==ADMIN_EMAIL&&(
                <div style={{display:"flex",gap:7}}>
                  <button onClick={()=>viewUserChat(u)} style={{flex:1,background:"#3b82f618",border:"1px solid #3b82f6",borderRadius:8,color:"#3b82f6",cursor:"pointer",fontSize:12,fontWeight:700,padding:7}}>💬 Chats</button>
                  <button onClick={()=>adminToggle(u.id,u.premium)} style={{flex:1,background:u.premium?"#ef444418":"#22c55e18",border:"1px solid "+(u.premium?"#ef4444":"#22c55e"),borderRadius:8,color:u.premium?"#ef4444":"#22c55e",cursor:"pointer",fontSize:12,fontWeight:700,padding:7}}>{u.premium?"❌ Remove":"✅ Premium"}</button>
                  <button onClick={()=>adminDel(u.id)} style={{background:"#ef444414",border:"1px solid #ef4444",borderRadius:8,color:"#ef4444",cursor:"pointer",fontSize:12,padding:"7px 11px"}}>🗑️</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── MODALS ── */}
      {showLimit&&(
        <div className="mbg" onClick={()=>setShowLimit(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="mi">⏳</div><h3>Free Limit Ho Gai!</h3><p>Unlimited ke liye Premium lo</p>
            <button className="btn btn-p" onClick={()=>{setShowLimit(false);setShowUpgrade(true);}}>⭐ Premium — ₹99/month</button>
            <button className="btn btn-s" onClick={()=>setShowLimit(false)}>Baad mein</button>
          </div>
        </div>
      )}

      {showUpgrade&&(
        <div className="mbg" onClick={()=>setShowUpgrade(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="mi">⭐</div><h3>Saraswati AI Premium</h3><p>₹99/month — Sab unlimited!</p>
            <div className="pbox">
              <div style={{fontSize:13,fontWeight:700,color:"#f97316",textAlign:"center"}}>📱 PhonePe / GPay / UPI</div>
              <div className="pnum">{PHONEPAY}</div>
              <div className="pstep">1️⃣ <span>₹99 bhejo PhonePe ya GPay se</span></div>
              <div className="pstep">2️⃣ <span>UTR ya screenshot note karo</span></div>
              <div className="pstep">3️⃣ <span>"Payment Ho Gayi" dabao</span></div>
            </div>
            {!payDone?(
              <button className="btn btn-p" onClick={()=>setPayDone(true)}>✅ Payment Ho Gayi</button>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{fontSize:13,color:"#6b7280",textAlign:"center"}}>Admin 24 ghante mein activate karega</div>
                <button className="btn btn-p" onClick={async()=>{
                  await setDoc(doc(db,"users",user.uid),{premiumPending:true,premiumRequestedAt:serverTimestamp()},{merge:true});
                  setUserData(p=>({...p,premiumPending:true}));
                  setShowUpgrade(false);setPayDone(false);
                  alert("✅ Request bhej di gai!");
                }}>📨 Submit Karo</button>
              </div>
            )}
            <button className="btn btn-s" onClick={()=>{setShowUpgrade(false);setPayDone(false);}}>Cancel</button>
          </div>
        </div>
      )}

      {showProfile&&(
        <div className="mbg" onClick={()=>setShowProfile(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3>✏️ Profile Edit</h3>
            <input type="file" ref={pPhotoRef} accept="image/*" style={{display:"none"}} onChange={handlePPhoto}/>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7}}>
              <div className="pav" style={{cursor:"pointer"}} onClick={()=>pPhotoRef.current?.click()}>
                {(pPhoto||pPhotoUrl)?<img src={pPhoto||pPhotoUrl} className="pavimg" alt=""/>:<div className="pavph">{pName[0]?.toUpperCase()||"?"}</div>}
                <div className="paved">📷</div>
              </div>
              <div style={{fontSize:12,color:"#6b7280"}}>Photo pe tap karo change ke liye</div>
            </div>
            <div className="iw"><div className="ilbl">NAAM</div><input className="inp" placeholder="Apna naam" value={pName} onChange={e=>setPName(e.target.value)}/></div>
            <button className="btn btn-p" onClick={saveProfile} disabled={pSaving}>{pSaving?"Save ho raha hai...":"💾 Save Karo"}</button>
            <button className="btn btn-s" onClick={()=>setShowProfile(false)}>Cancel</button>
          </div>
        </div>
      )}

      {aChat&&(
        <div className="mbg" onClick={()=>setAChat(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3>💬 {aChat.user.name}</h3>
            <p style={{fontSize:11}}>{aChat.user.email} • {aChat.user.usageCount||0} chats</p>
            {aChatLoad?<div className="ld">⏳ Load ho raha hai...</div>:(
              <div className="achat">
                {aChat.msgs.length===0?<div style={{textAlign:"center",color:"#6b7280",fontSize:13}}>Koi messages nahi</div>:aChat.msgs.map((m,i)=>(
                  <div key={i} style={{display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start",gap:1}}>
                    <div style={{background:m.role==="user"?"#f97316":"#2a2a2a",color:"#fff",borderRadius:m.role==="user"?"14px 14px 3px 14px":"14px 14px 14px 3px",padding:"7px 11px",fontSize:12,maxWidth:"86%"}}>{m.text?.slice(0,200)}{m.text?.length>200?"...":""}</div>
                    <div style={{fontSize:9,color:"#6b7280"}}>{m.role==="user"?"User":"AI"} • {fmtTime(m.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-s" onClick={()=>setAChat(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
