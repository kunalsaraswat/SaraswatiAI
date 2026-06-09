import { useState, useEffect, useRef, useCallback } from "react";
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

const GROQ_API_KEY = "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";
const TAVILY_API_KEY = "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";
const ADMIN_EMAIL = "kunalsaraswat691@gmail.com";
const PHONEPAY_NUMBER = "8126630980";
const FREE_CHAT_LIMIT = 49;

async function webSearch(query) {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, query, search_depth: "basic", max_results: 3 })
    });
    const data = await res.json();
    if (!data.results) return null;
    return data.results.map(r => `${r.title}: ${r.content}`).join("\n\n");
  } catch { return null; }
}

function needsWebSearch(text) {
  const keywords = ["aaj","today","abhi","news","score","weather","mausam","latest","current","price","rate","result","live","winner","2024","2025","2026","kab","when","who won","kaun jita","match","election","sarkar","government","new","naya","mandi","bhav"];
  return keywords.some(k => text.toLowerCase().includes(k));
}

function isOwnerQuestion(text) {
  const keywords = ["kisne banaya","who made","who created","owner","creator","master","malik","tumhara owner","tumhara creator","tumhara master","aapka owner","aapka creator","banaya tumhe","tumhe kisne","kaun hai tera","tera malik","tera creator","apna owner","tumhari company","किसने बनाया","मालिक","क्रिएटर","ओनर"];
  return keywords.some(k => text.toLowerCase().includes(k));
}

function isHowMadeQuestion(text) {
  const keywords = ["kaise banaya","how made","how are you built","how were you created","kaise bana","technology","tech stack","kaun si technology","kis technology","source code","code kaise"];
  return keywords.some(k => text.toLowerCase().includes(k));
}

async function askAI(messages, imageBase64 = null) {
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.role === "user" && isOwnerQuestion(lastMsg.text)) {
    return "Mujhe **Kunal Saraswat** ne banaya hai! 😊 Wo mere creator aur owner hain.";
  }
  if (lastMsg?.role === "user" && isHowMadeQuestion(lastMsg.text)) {
    return "Yeh information **private** hai — main nahi bata sakta! 🔒";
  }
  let searchContext = "";
  if (lastMsg?.role === "user" && needsWebSearch(lastMsg.text)) {
    const results = await webSearch(lastMsg.text);
    if (results) searchContext = `\n\nWeb Search Results:\n${results}\n\nUse above info to answer accurately.`;
  }
  const systemPrompt = `You are Saraswati AI — an extremely intelligent, helpful and friendly AI assistant.

IMPORTANT IDENTITY RULES:
- If anyone asks who made you, who is your owner/creator/master → always say "Mujhe Kunal Saraswat ne banaya hai!"
- If anyone asks how you were built, what technology, source code → always say "Yeh private hai, main nahi bata sakta!"
- Never reveal you are made by Meta, Groq, or any other company.

LANGUAGE RULE:
- Always detect and reply in EXACTLY the same language as the user.
- Hindi → Hindi, English → English, Hinglish → Hinglish

PERSONALITY:
- Warm, casual, friendly like a best friend
- Understand emotion and intent
- Never robotic

CODE FORMATTING RULES (VERY IMPORTANT):
- When giving code, ALWAYS wrap it in proper markdown code blocks with language name
- Example: \`\`\`html ... \`\`\` or \`\`\`python ... \`\`\`
- Give complete, working code always
- Explain the code briefly after giving it

EXPERTISE:
- Coding: HTML, CSS, JavaScript, Python, React — complete working code
- Farming & agriculture (kisan sahayata)
- Math, science, history, general knowledge
- Creative writing, business ideas, health
- Latest news (web search)
- Image analysis${searchContext}`;

  const lastUserContent = imageBase64
    ? [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }, { type: "text", text: lastMsg.text }]
    : lastMsg.text;

  const apiMessages = [
    ...messages.slice(0, -1).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
    { role: "user", content: lastUserContent }
  ];

  const model = imageBase64 ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ_API_KEY },
    body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, ...apiMessages], max_tokens: 2048 })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "No response.";
}

// ── CODE BLOCK ─────────────────────────────────────────────────
function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div style={{background:"#0d0d0d",border:"1px solid #333",borderRadius:10,margin:"6px 0",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 12px",background:"#1a1a1a",borderBottom:"1px solid #333"}}>
        <span style={{fontSize:11,color:"#6b7280",fontFamily:"monospace"}}>{lang || "code"}</span>
        <button onClick={copy} style={{background:"none",border:"none",color:copied?"#22c55e":"#6b7280",cursor:"pointer",fontSize:11,padding:"2px 6px"}}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre style={{padding:"12px",margin:0,overflowX:"auto",fontSize:12,lineHeight:1.6,color:"#e5e7eb",fontFamily:"monospace",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
        {code}
      </pre>
    </div>
  );
}

// ── AI TEXT RENDERER ────────────────────────────────────────────
function AIText({ text }) {
  if (!text) return null;
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    parts.push({ type: "code", lang: match[1], content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ type: "text", content: text.slice(lastIndex) });

  return (
    <span style={{display:"flex",flexDirection:"column",gap:4}}>
      {parts.map((part, idx) => {
        if (part.type === "code") return <CodeBlock key={idx} code={part.content} lang={part.lang} />;
        const lines = part.content.split("\n");
        return lines.map((line, i) => {
          if (!line.trim()) return <span key={`${idx}-${i}`} style={{height:6}} />;
          const segments = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((s, j) => {
            if (s.startsWith("**") && s.endsWith("**")) return <strong key={j}>{s.slice(2,-2)}</strong>;
            if (s.startsWith("`") && s.endsWith("`")) return <code key={j} style={{background:"#ffffff18",borderRadius:4,padding:"1px 6px",fontFamily:"monospace",fontSize:12}}>{s.slice(1,-1)}</code>;
            return s;
          });
          if (line.trim().startsWith("- ") || line.trim().startsWith("• "))
            return <span key={`${idx}-${i}`} style={{display:"flex",gap:8,alignItems:"flex-start"}}><span style={{color:"#f97316",marginTop:2}}>•</span><span>{segments}</span></span>;
          if (/^\d+\.\s/.test(line.trim()))
            return <span key={`${idx}-${i}`} style={{display:"flex",gap:8}}><span style={{color:"#f97316",minWidth:16}}>{line.match(/^\d+/)[0]}.</span><span>{segments}</span></span>;
          if (line.startsWith("### ")) return <strong key={`${idx}-${i}`} style={{fontSize:15,color:"#f97316"}}>{line.slice(4)}</strong>;
          if (line.startsWith("## ")) return <strong key={`${idx}-${i}`} style={{fontSize:16,color:"#f97316"}}>{line.slice(3)}</strong>;
          if (line.startsWith("# ")) return <strong key={`${idx}-${i}`} style={{fontSize:17,color:"#f97316"}}>{line.slice(2)}</strong>;
          return <span key={`${idx}-${i}`}>{segments}</span>;
        });
      })}
    </span>
  );
}

// ── MINI BAR CHART ──────────────────────────────────────────────
function MiniBarChart({ data, label, color = "#f97316" }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      <div style={{fontSize:11,fontWeight:700,color:"#6b7280",letterSpacing:".05em"}}>{label}</div>
      <div style={{display:"flex",alignItems:"flex-end",gap:4,height:60}}>
        {data.map((d, i) => (
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <div style={{width:"100%",background:color,borderRadius:"3px 3px 0 0",height:`${(d.value/max)*52}px`,minHeight:2,opacity:.85}} />
            <div style={{fontSize:9,color:"#6b7280"}}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── THEME CSS BUILDER ───────────────────────────────────────────
function buildCSS(dark) {
  const v = dark ? {
    bg:"#0f0f0f", surface:"#1a1a1a", surface2:"#222", border:"#2a2a2a",
    text:"#f5f5f5", muted:"#6b7280", bubble_ai:"#1e1e1e", bubble_ai_border:"#2a2a2a", bubble_ai_text:"#f5f5f5"
  } : {
    bg:"#f8f8f8", surface:"#ffffff", surface2:"#f0f0f0", border:"#e0e0e0",
    text:"#1a1a1a", muted:"#888888", bubble_ai:"#ffffff", bubble_ai_border:"#e0e0e0", bubble_ai_text:"#1a1a1a"
  };
  return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:${v.bg};--surface:${v.surface};--surface2:${v.surface2};--border:${v.border};
  --accent:#f97316;--accent2:#fb923c;--text:${v.text};--muted:${v.muted};
  --bubble-ai:${v.bubble_ai};--bubble-ai-border:${v.bubble_ai_border};--bubble-ai-text:${v.bubble_ai_text};
}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);height:100dvh;overflow:hidden;}
.app{display:flex;flex-direction:column;height:100dvh;max-width:480px;margin:0 auto;background:var(--bg);}
.auth{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;gap:20px;background:radial-gradient(ellipse at 50% -10%,#f9731620 0%,transparent 60%);}
.auth-logo{font-size:52px;}.auth-title{font-size:26px;font-weight:700;}.auth-sub{font-size:13px;color:var(--muted);text-align:center;}
.auth-card{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:14px;}
.auth-head{font-size:18px;font-weight:700;text-align:center;}
.inp-wrap{display:flex;flex-direction:column;gap:5px;}.inp-label{font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.05em;}
.inp{background:${dark?"#111":v.surface2};border:1.5px solid var(--border);border-radius:12px;color:var(--text);font-family:'Inter',sans-serif;font-size:15px;padding:13px 14px;outline:none;width:100%;transition:border-color .2s;}
.inp:focus{border-color:var(--accent);}
.inp-hint{font-size:11px;color:var(--muted);}
.btn{border:none;border-radius:12px;cursor:pointer;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;padding:14px;transition:all .2s;width:100%;}
.btn-primary{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;}.btn-primary:hover{opacity:.9;}.btn-primary:disabled{opacity:.6;cursor:not-allowed;}
.btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border);}
.auth-switch{font-size:13px;color:var(--muted);text-align:center;}.auth-switch span{color:var(--accent2);cursor:pointer;font-weight:600;}
.forgot-link{font-size:13px;color:var(--accent2);text-align:center;cursor:pointer;font-weight:600;margin-top:-4px;}
.err{color:#ef4444;font-size:13px;text-align:center;background:#ef444415;padding:10px;border-radius:10px;}
.success-msg{color:#22c55e;font-size:13px;text-align:center;background:#22c55e15;padding:10px;border-radius:10px;}
.header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--border);position:relative;z-index:20;}
.header-logo{font-size:24px;}.header-name{font-size:16px;font-weight:700;flex:1;}
.dots-btn{background:none;border:none;color:var(--text);cursor:pointer;font-size:22px;padding:6px;border-radius:10px;}
.new-chat-btn{background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);cursor:pointer;font-size:13px;font-weight:600;padding:8px 14px;display:flex;align-items:center;gap:6px;}
.dropdown{position:absolute;top:56px;right:12px;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:8px;min-width:210px;z-index:100;box-shadow:0 8px 32px ${dark?"#0008":"#0002"};animation:fadeIn .15s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
.drop-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;transition:background .15s;}
.drop-item:hover{background:var(--surface2);}.drop-item.danger{color:#ef4444;}
.drop-divider{height:1px;background:var(--border);margin:4px 0;}
.drop-user{padding:12px 14px;}.drop-name{font-size:15px;font-weight:700;}.drop-email{font-size:11px;color:var(--muted);margin-top:2px;}
.premium-tag{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-top:4px;display:inline-block;}
.usage-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 16px;background:var(--surface);border-bottom:1px solid var(--border);font-size:11px;color:var(--muted);}
.usage-pill{background:var(--surface2);border-radius:20px;padding:3px 10px;font-weight:600;}
.chat-area{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:16px;scroll-behavior:smooth;}
.chat-area::-webkit-scrollbar{width:0;}
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:32px 20px;}
.welcome-icon{font-size:72px;}.welcome h2{font-size:24px;font-weight:700;}
.msg-wrap{display:flex;flex-direction:column;gap:4px;animation:slideUp .25s ease;}
@keyframes slideUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.msg-row{display:flex;gap:8px;align-items:flex-end;}.msg-row.user{flex-direction:row-reverse;}
.bubble{max-width:82%;padding:12px 16px;font-size:14px;line-height:1.65;word-break:break-word;}
.bubble.user{background:#f97316;color:#fff;border-radius:20px 20px 4px 20px;}
.bubble.ai{background:var(--bubble-ai);color:var(--bubble-ai-text);border:1px solid var(--bubble-ai-border);border-radius:20px 20px 20px 4px;}
.msg-time{font-size:10px;color:var(--muted);padding:0 4px;}.msg-time.user{text-align:right;}
.ai-av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.typing-bubble{background:var(--bubble-ai);border:1px solid var(--bubble-ai-border);border-radius:20px 20px 20px 4px;padding:14px 18px;display:flex;gap:5px;}
.dot{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:bounce 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}.dot:nth-child(3){animation-delay:.4s;}
@keyframes bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-6px);}}
.msg-actions{display:flex;gap:6px;padding:2px 4px;}
.msg-act-btn{background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;padding:3px 8px;border-radius:8px;display:flex;align-items:center;gap:4px;transition:color .15s;}
.msg-act-btn:hover{color:var(--accent);}
.input-bar{padding:10px 14px;border-top:1px solid var(--border);background:var(--bg);display:flex;gap:8px;align-items:flex-end;}
.msg-input{flex:1;background:var(--surface);border:1.5px solid var(--border);border-radius:24px;color:var(--text);font-family:'Inter',sans-serif;font-size:14px;padding:12px 18px;outline:none;resize:none;max-height:120px;min-height:48px;transition:border-color .2s;line-height:1.5;}
.msg-input:focus{border-color:var(--accent);}
.msg-input::placeholder{color:var(--muted);}
.send{background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:18px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.send:disabled{opacity:.4;cursor:not-allowed;}
.icon-btn{background:var(--surface2);border:1.5px solid var(--border);border-radius:50%;color:var(--text);cursor:pointer;font-size:18px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.icon-btn.active{border-color:#ef4444;color:#ef4444;}
.img-preview{position:relative;display:inline-block;margin-bottom:8px;}
.img-preview img{width:80px;height:80px;object-fit:cover;border-radius:12px;border:2px solid var(--accent);}
.img-preview-remove{position:absolute;top:-6px;right:-6px;background:#ef4444;border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:12px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;}
.msg-image{max-width:200px;border-radius:12px;margin-bottom:4px;}
.page{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
.page-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}
.page-title{font-size:18px;font-weight:700;}
.hist-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:border-color .2s;}
.hist-card:hover{border-color:var(--accent);}
.hist-info{flex:1;overflow:hidden;}.hist-title{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hist-meta{font-size:11px;color:var(--muted);margin-top:2px;}
.del-btn{background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:4px 6px;border-radius:8px;}.del-btn:hover{color:#ef4444;}
.set-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:4px;}
.set-row{display:flex;align-items:center;gap:14px;padding:15px 16px;border-bottom:1px solid var(--border);cursor:pointer;}.set-row:last-child{border-bottom:none;}
.set-icon{font-size:20px;width:28px;text-align:center;}.set-text{flex:1;}
.set-label{font-size:14px;font-weight:600;}.set-desc{font-size:12px;color:var(--muted);margin-top:2px;}
.section-lbl{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin:12px 0 6px;}
.badge{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
.badge-green{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
.badge-yellow{background:linear-gradient(135deg,#eab308,#ca8a04);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
.badge-red{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
.premium-card{background:linear-gradient(135deg,#f97316,#ea580c);border-radius:16px;padding:18px;margin-bottom:4px;cursor:pointer;}
.premium-card h3{font-size:18px;font-weight:700;color:#fff;}.premium-card p{font-size:13px;color:#fff9;margin-top:4px;}
.pf{font-size:13px;color:#fff;display:flex;align-items:center;gap:8px;margin-top:6px;}
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;}
.stat-val{font-size:30px;font-weight:800;color:var(--accent);}.stat-lbl{font-size:12px;color:var(--muted);margin-top:2px;}
.user-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;}
.user-av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:15px;flex-shrink:0;}
.modal-bg{position:fixed;inset:0;background:#000a;z-index:200;display:flex;align-items:flex-end;padding:16px;}
.modal{background:var(--surface);border-radius:24px 24px 16px 16px;padding:28px 24px;width:100%;max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:14px;}
.modal h3{font-size:20px;font-weight:700;text-align:center;}.modal p{font-size:14px;color:var(--muted);text-align:center;line-height:1.6;}
.modal-icon{font-size:52px;text-align:center;}
.search-indicator{font-size:11px;color:var(--accent);padding:4px 10px;background:#f9731615;border-radius:20px;display:inline-flex;align-items:center;gap:4px;margin-bottom:4px;}
.payment-box{background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;}
.payment-number{font-size:22px;font-weight:800;color:var(--accent);text-align:center;letter-spacing:2px;}
.payment-step{font-size:13px;color:var(--text);display:flex;gap:8px;align-items:flex-start;}
.loading-hist{text-align:center;color:var(--muted);padding:20px;font-size:14px;}
.graph-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;}
.admin-action-btn{background:none;border:1px solid var(--border);border-radius:8px;color:var(--text);cursor:pointer;font-size:12px;padding:4px 10px;font-family:'Inter',sans-serif;transition:all .2s;}
.admin-action-btn:hover{border-color:var(--accent);color:var(--accent);}
.admin-action-btn.danger:hover{border-color:#ef4444;color:#ef4444;}
.kisan-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;}
.kisan-card-title{font-size:15px;font-weight:700;margin-bottom:8px;}
.mandi-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:14px;}
.mandi-row:last-child{border-bottom:none;}
.mandi-price{font-weight:700;color:var(--accent);}
.mandi-change.up{color:#22c55e;font-size:12px;}
.mandi-change.down{color:#ef4444;font-size:12px;}
.fasal-month{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px;}
.fasal-month-name{font-size:12px;font-weight:700;color:var(--accent);margin-bottom:4px;}
.fasal-tag{display:inline-block;background:#f9731620;color:#f97316;border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600;margin:2px;}
.weather-card{background:linear-gradient(135deg,#1e40af,#3b82f6);border-radius:14px;padding:16px;color:#fff;}
.weather-temp{font-size:48px;font-weight:800;}
.weather-desc{font-size:14px;opacity:.9;margin-top:2px;}
.weather-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;}
.weather-item{background:#ffffff18;border-radius:8px;padding:8px;font-size:12px;}
.ai-kisan-btn{background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:12px;color:#fff;cursor:pointer;font-size:14px;font-weight:600;padding:12px 18px;width:100%;font-family:'Inter',sans-serif;margin-top:4px;}
.toggle-wrap{display:flex;align-items:center;gap:10px;}
.toggle{position:relative;width:44px;height:24px;background:var(--surface2);border-radius:12px;cursor:pointer;border:2px solid var(--border);transition:background .2s;}
.toggle.on{background:#f97316;border-color:#f97316;}
.toggle-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;}
.toggle.on .toggle-knob{left:22px;}
`;
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

const FASAL_CALENDAR = [
  { month: "January", fasals: ["Sarson", "Gehu", "Chana", "Matar"] },
  { month: "February", fasals: ["Gehu", "Sarson", "Methi", "Palak"] },
  { month: "March", fasals: ["Gehu Katai", "Chana Katai", "Tarbuj", "Kheera"] },
  { month: "April", fasals: ["Tarbuj", "Karela", "Bhindi", "Dhaan Biyai"] },
  { month: "May", fasals: ["Dhaan Biyai", "Moong", "Urad", "Bajra"] },
  { month: "June", fasals: ["Dhaan Ropai", "Makka", "Ganna", "Arhar"] },
  { month: "July", fasals: ["Dhaan", "Makka", "Soyabean", "Moongfali"] },
  { month: "August", fasals: ["Dhaan", "Arhar", "Toria", "Baingan"] },
  { month: "September", fasals: ["Arhar", "Dhaan Katai", "Tamatar", "Pyaaz Biyai"] },
  { month: "October", fasals: ["Gehu Biyai", "Sarson Biyai", "Pyaaz", "Aloo"] },
  { month: "November", fasals: ["Gehu", "Sarson", "Chana", "Matar"] },
  { month: "December", fasals: ["Gehu", "Chana", "Sarson", "Palak"] },
];

const MANDI_PRICES = [
  { name: "Gehu (Wheat)", price: "2180", change: "+15", up: true },
  { name: "Dhan (Paddy)", price: "2183", change: "-8", up: false },
  { name: "Sarson", price: "5400", change: "+45", up: true },
  { name: "Chana", price: "5200", change: "+20", up: true },
  { name: "Tamatar", price: "1800", change: "-200", up: false },
  { name: "Pyaaz", price: "1200", change: "+100", up: true },
  { name: "Aloo", price: "800", change: "-50", up: false },
  { name: "Moong", price: "7500", change: "+80", up: true },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [page, setPage] = useState("chat");
  const [authMode, setAuthMode] = useState("login");
  const [authSubMode, setAuthSubMode] = useState(""); // "forgot" | "reset"
  const [form, setForm] = useState({ name: "", email: "", pass: "", confirmPass: "" });
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
  const bottomRef = useRef(null);
  const galleryRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) setUserData(userDoc.data());
      } else { setUser(null); setUserData(null); }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  useEffect(() => {
    if (user && page === "history") loadHistories();
    if (user && page === "admin") loadAdminUsers();
  }, [user, page]);

  // Stop speech when page changes
  useEffect(() => {
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
  }, [page]);

  async function loadHistories() {
    setHistLoading(true);
    try {
      const q = query(collection(db, "chats"), where("userId", "==", user.uid), orderBy("updatedAt", "desc"));
      const snap = await getDocs(q);
      setHistories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) {
      try {
        const q2 = query(collection(db, "chats"), where("userId", "==", user.uid));
        const snap2 = await getDocs(q2);
        const sorted = snap2.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        setHistories(sorted);
      } catch(e2) { console.error(e2); }
    }
    setHistLoading(false);
  }

  async function loadAdminUsers() {
    const snap = await getDocs(collection(db, "users"));
    setAdminUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function handleAuth() {
    setFormErr(""); setFormSuccess("");
    if (authSubMode === "forgot") {
      if (!form.email) { setFormErr("Email daalo!"); return; }
      setFormLoading(true);
      try {
        await sendPasswordResetEmail(auth, form.email);
        setFormSuccess("✅ Reset link email par bhej diya! Check karo.");
        setForm(f => ({ ...f, email: "" }));
      } catch(e) {
        const errs = { "auth/user-not-found": "Yeh email registered nahi hai!", "auth/invalid-email": "Invalid email!" };
        setFormErr(errs[e.code] || e.message);
      }
      setFormLoading(false);
      return;
    }
    if (!form.email || !form.pass) { setFormErr("Please fill all fields!"); return; }
    if (form.pass.length < 8) { setFormErr("Password kam se kam 8 characters ka hona chahiye!"); return; }
    if (authMode === "signup" && !form.name) { setFormErr("Please enter your name!"); return; }
    setFormLoading(true);
    try {
      if (authMode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.pass);
        await updateProfile(cred.user, { displayName: form.name });
        await setDoc(doc(db, "users", cred.user.uid), { name: form.name, email: form.email, premium: false, createdAt: serverTimestamp(), chatCount: 0, usageCount: 0 });
        setUserData({ name: form.name, email: form.email, premium: false, chatCount: 0, usageCount: 0 });
      } else {
        await signInWithEmailAndPassword(auth, form.email, form.pass);
        const ud = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (ud.exists()) setUserData(ud.data());
      }
      setForm({ name: "", email: "", pass: "", confirmPass: "" });
    } catch (e) {
      const errs = { "auth/email-already-in-use": "Email already registered!", "auth/invalid-email": "Invalid email!", "auth/wrong-password": "Wrong password!", "auth/user-not-found": "Account not found!", "auth/weak-password": "Password too weak! Min 8 chars.", "auth/invalid-credential": "Wrong email or password!" };
      setFormErr(errs[e.code] || e.message);
    }
    setFormLoading(false);
  }

  function handleGallerySelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageBase64(ev.target.result.split(",")[1]);
      setImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  function startVoiceInput() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Aapka browser voice input support nahi karta!"); return; }
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const recognition = new SR();
    // Auto language detect — browser ki default language use karega, koi bhi language chalegi
    recognition.lang = navigator.language || "hi-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev ? prev + " " + transcript : transcript);
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  // SVG mic icon — same as uploaded logo
  function MicIcon({ active }) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="9" y="2" width="6" height="11" rx="3" stroke={active ? "#ef4444" : "currentColor"} strokeWidth="2" fill="none"/>
        <path d="M5 11a7 7 0 0 0 14 0" stroke={active ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" fill="none"/>
        <line x1="12" y1="18" x2="12" y2="22" stroke={active ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round"/>
        <line x1="8" y1="22" x2="16" y2="22" stroke={active ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }

  function speakText(msgId, text) {
    if (speakingId === msgId) {
      window.speechSynthesis?.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis?.cancel();
    const clean = text.replace(/```[\s\S]*?```/g, "code block").replace(/\*\*/g, "").replace(/`/g, "");
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = "hi-IN";
    utt.rate = 0.9;
    utt.onend = () => setSpeakingId(null);
    utt.onerror = () => setSpeakingId(null);
    setSpeakingId(msgId);
    window.speechSynthesis.speak(utt);
  }

  function shareOnWhatsApp(text) {
    const url = `https://wa.me/?text=${encodeURIComponent("Saraswati AI ka jawab:\n\n" + text.slice(0,500) + (text.length > 500 ? "..." : ""))}`;
    window.open(url, "_blank");
  }

  function exportChat() {
    if (msgs.length === 0) { alert("Koi chat nahi hai export karne ke liye!"); return; }
    const lines = msgs.map(m => `[${m.role === "user" ? "Aap" : "Saraswati AI"}]:\n${m.text}\n`);
    const content = "Saraswati AI — Chat Export\n" + new Date().toLocaleString("en-IN") + "\n\n" + lines.join("\n---\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `saraswati-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function shareFullChat() {
    if (msgs.length === 0) { alert("Koi chat nahi hai!"); return; }
    const text = msgs.map(m => `*${m.role === "user" ? "Aap" : "Saraswati AI"}:*\n${m.text}`).join("\n\n");
    shareOnWhatsApp(text);
  }

  async function sendMsg(text) {
    const txt = text || input.trim();
    if ((!txt && !imageBase64) || loading) return;
    const ud = userData;
    if (!ud?.premium && (ud?.usageCount || 0) >= FREE_CHAT_LIMIT) { setShowLimit(true); return; }
    const msgText = txt || "Is image mein kya hai?";
    setInput("");
    const imgB64 = imageBase64;
    const imgPrev = imagePreview;
    setImageBase64(null);
    setImagePreview(null);
    const uMsgRef = await addDoc(collection(db, "messages"), { sessionId, userId: user.uid, role: "user", text: msgText, image: imgPrev || null, createdAt: serverTimestamp() });
    const newMsgs = [...msgs, { id: uMsgRef.id, role: "user", text: msgText, image: imgPrev, time: new Date() }];
    setMsgs(newMsgs);
    await setDoc(doc(db, "chats", sessionId), { userId: user.uid, title: msgText.slice(0, 45), updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
    const newCount = (ud?.usageCount || 0) + 1;
    await setDoc(doc(db, "users", user.uid), { usageCount: newCount }, { merge: true });
    setUserData(prev => ({ ...prev, usageCount: newCount }));
    if (needsWebSearch(msgText)) setIsSearching(true);
    setLoading(true);
    try {
      const aiText = await askAI(newMsgs, imgB64);
      setIsSearching(false);
      const tempId = "temp_" + Date.now();
      setLoading(false);
      setMsgs(prev => [...prev, { id: tempId, role: "ai", text: "", time: new Date() }]);
      let displayed = "";
      for (let i = 0; i < aiText.length; i++) {
        displayed += aiText[i];
        const snap = displayed;
        setMsgs(prev => prev.map(m => m.id === tempId ? { ...m, text: snap } : m));
        await new Promise(r => setTimeout(r, 8));
      }
      await addDoc(collection(db, "messages"), { sessionId, userId: user.uid, role: "ai", text: aiText, createdAt: serverTimestamp() });
    } catch (e) {
      setIsSearching(false);
      setLoading(false);
      setMsgs(prev => [...prev, { id: Date.now(), role: "ai", text: "❌ Error: " + e.message, time: new Date() }]);
    }
  }

  async function loadSession(session) {
    try {
      setPage("chat");
      setSessionId(session.id);
      setMsgs([]);
      const q = query(collection(db, "messages"), where("sessionId", "==", session.id));
      const snap = await getDocs(q);
      const loadedMsgs = snap.docs.map(d => ({ id: d.id, ...d.data(), time: d.data().createdAt })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setMsgs(loadedMsgs);
    } catch(e) { console.error(e); alert("❌ Chat load nahi hui: " + e.message); }
  }

  async function deleteSession(sid, e) {
    e.stopPropagation();
    await deleteDoc(doc(db, "chats", sid));
    setHistories(prev => prev.filter(h => h.id !== sid));
  }

  async function adminTogglePremium(uid, current) {
    await updateDoc(doc(db, "users", uid), { premium: !current, premiumPending: false });
    setAdminUsers(prev => prev.map(u => u.id === uid ? { ...u, premium: !current, premiumPending: false } : u));
  }

  async function adminDeleteUser(uid) {
    if (!window.confirm("Sure? Is user ko delete karein?")) return;
    await deleteDoc(doc(db, "users", uid));
    setAdminUsers(prev => prev.filter(u => u.id !== uid));
  }

  function newChat() {
    setSessionId(Date.now().toString());
    setMsgs([]);
    setPage("chat");
    setShowMenu(false);
    setImageBase64(null);
    setImagePreview(null);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  }

  const isAdmin = user?.email === ADMIN_EMAIL;
  const chatsLeft = userData?.premium ? null : Math.max(0, FREE_CHAT_LIMIT - (userData?.usageCount || 0));

  // Admin graph data (last 7 days simulated from user data)
  const adminGraphData = Array.from({length:7}, (_, i) => ({
    label: ["Mo","Tu","We","Th","Fr","Sa","Su"][i],
    value: Math.max(1, Math.floor(adminUsers.length * Math.random() * 0.4 + i))
  }));
  const revenueData = Array.from({length:7}, (_, i) => ({
    label: ["Mo","Tu","We","Th","Fr","Sa","Su"][i],
    value: adminUsers.filter(u=>u.premium).length * 99 * (0.1 + Math.random()*0.2)
  }));

  const currentMonth = new Date().getMonth(); // 0-indexed

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
          {authSubMode === "forgot" ? (
            <>
              <div className="auth-head">🔑 Password Reset</div>
              <div style={{fontSize:13,color:"var(--muted)",textAlign:"center"}}>Apna registered email daalo — reset link bhejenge</div>
              <div className="inp-wrap">
                <div className="inp-label">EMAIL</div>
                <input className="inp" type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAuth()} />
              </div>
              {formErr && <div className="err">{formErr}</div>}
              {formSuccess && <div className="success-msg">{formSuccess}</div>}
              <button className="btn btn-primary" onClick={handleAuth} disabled={formLoading}>{formLoading ? "Bhej raha hoon..." : "📧 Reset Link Bhejo"}</button>
              <div className="auth-switch"><span onClick={() => { setAuthSubMode(""); setFormErr(""); setFormSuccess(""); }}>← Wapas Login par jao</span></div>
            </>
          ) : (
            <>
              <div className="auth-head">{authMode === "login" ? "Welcome Back 👋" : "Create Account ✨"}</div>
              {authMode === "signup" && (
                <div className="inp-wrap">
                  <div className="inp-label">FULL NAME</div>
                  <input className="inp" placeholder="Apna naam likho" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
              )}
              <div className="inp-wrap">
                <div className="inp-label">EMAIL</div>
                <input className="inp" type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="inp-wrap">
                <div className="inp-label">PASSWORD</div>
                <input className="inp" type="password" placeholder="Kam se kam 8 characters" value={form.pass} onChange={e => setForm(f => ({ ...f, pass: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAuth()} />
                <div className="inp-hint">⚠️ Password kam se kam 8 characters ka hona chahiye</div>
              </div>
              {formErr && <div className="err">{formErr}</div>}
              <button className="btn btn-primary" onClick={handleAuth} disabled={formLoading}>
                {formLoading ? "Please wait..." : authMode === "login" ? "Login →" : "Create Account →"}
              </button>
              {authMode === "login" && (
                <div className="forgot-link" onClick={() => { setAuthSubMode("forgot"); setFormErr(""); setFormSuccess(""); }}>🔑 Forgot Password?</div>
              )}
            </>
          )}
        </div>
        {authSubMode !== "forgot" && (
          <div className="auth-switch">
            {authMode === "login"
              ? <>Don't have an account? <span onClick={() => { setAuthMode("signup"); setFormErr(""); }}>Sign up</span></>
              : <>Already have an account? <span onClick={() => { setAuthMode("login"); setFormErr(""); }}>Login</span></>}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="app" onClick={() => showMenu && setShowMenu(false)}>
      <style>{buildCSS(darkMode)}</style>

      {/* HEADER */}
      <div className="header">
        <div className="header-logo">🪷</div>
        <div className="header-name">Saraswati AI</div>
        {page === "chat" && <button className="new-chat-btn" onClick={newChat}>✏️ New</button>}
        <button className="dots-btn" onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}>⋯</button>
      </div>

      {/* DROPDOWN MENU */}
      {showMenu && (
        <div className="dropdown" onClick={e => e.stopPropagation()}>
          <div className="drop-user">
            <div className="drop-name">{userData?.name || user.displayName}</div>
            <div className="drop-email">{user.email}</div>
            {userData?.premium && <div className="premium-tag">⭐ PREMIUM</div>}
          </div>
          <div className="drop-divider" />
          <div className="drop-item" onClick={() => { setPage("chat"); setShowMenu(false); }}>💬 Chat</div>
          <div className="drop-item" onClick={() => { setPage("history"); setShowMenu(false); }}>📂 History</div>
          <div className="drop-item" onClick={() => { setPage("kisan"); setShowMenu(false); }}>🌾 Kisan Helper</div>
          <div className="drop-item" onClick={() => { setPage("settings"); setShowMenu(false); }}>⚙️ Settings</div>
          {isAdmin && <div className="drop-item" onClick={() => { setPage("admin"); setShowMenu(false); }}>🛡️ Admin Panel</div>}
          <div className="drop-divider" />
          <div className="drop-item" onClick={() => { setDarkMode(v => !v); setShowMenu(false); }}>
            {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </div>
          {page === "chat" && msgs.length > 0 && (
            <>
              <div className="drop-item" onClick={() => { shareFullChat(); setShowMenu(false); }}>📤 Share Chat (WhatsApp)</div>
              <div className="drop-item" onClick={() => { exportChat(); setShowMenu(false); }}>📄 Chat Export (.txt)</div>
            </>
          )}
          <div className="drop-divider" />
          {!userData?.premium && <div className="drop-item" onClick={() => { setShowUpgrade(true); setShowMenu(false); }}>⭐ Upgrade to Premium</div>}
          <div className="drop-item danger" onClick={() => signOut(auth)}>🚪 Logout</div>
        </div>
      )}

      {/* USAGE BAR */}
      {page === "chat" && (
        <div className="usage-bar">
          <span>{userData?.premium ? "⭐ Premium" : "Free Plan"}</span>
          <span className="usage-pill">{userData?.premium ? "Unlimited" : `${chatsLeft} chats left`}</span>
        </div>
      )}

      {/* ── CHAT PAGE ── */}
      {page === "chat" && (
        <>
          <div className="chat-area">
            {msgs.length === 0 && (
              <div className="welcome">
                <div className="welcome-icon">🪷</div>
                <h2>Saraswati AI</h2>
                <p style={{color:"var(--muted)",fontSize:14}}>Kuch bhi poochho, main hoon na! 😊</p>
              </div>
            )}
            {msgs.map(m => (
              <div key={m.id} className="msg-wrap">
                <div className={`msg-row ${m.role}`}>
                  {m.role === "ai" && <div className="ai-av">🪷</div>}
                  <div className={`bubble ${m.role}`}>
                    {m.image && <img src={m.image} className="msg-image" alt="img" />}
                    {m.role === "ai" ? <AIText text={m.text} /> : m.text}
                  </div>
                </div>
                {m.role === "ai" && m.text && (
                  <div className="msg-actions" style={{paddingLeft:36}}>
                    <button className="msg-act-btn" onClick={() => speakText(m.id, m.text)}>
                      {speakingId === m.id ? "⏹ Roko" : "🔊 Suno"}
                    </button>
                    <button className="msg-act-btn" onClick={() => shareOnWhatsApp(m.text)}>📤 Share</button>
                  </div>
                )}
                <div className={`msg-time ${m.role}`}>{fmtTime(m.time)}</div>
              </div>
            ))}
            {isSearching && (
              <div className="msg-row">
                <div className="ai-av">🪷</div>
                <div className="search-indicator">🌐 Web search kar raha hoon...</div>
              </div>
            )}
            {loading && !isSearching && (
              <div className="msg-row">
                <div className="ai-av">🪷</div>
                <div className="typing-bubble"><div className="dot"/><div className="dot"/><div className="dot"/></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="input-bar">
            <input type="file" ref={galleryRef} accept="image/*" style={{display:"none"}} onChange={handleGallerySelect} />
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
              {imagePreview && (
                <div className="img-preview">
                  <img src={imagePreview} alt="preview" />
                  <button className="img-preview-remove" onClick={() => { setImageBase64(null); setImagePreview(null); }}>✕</button>
                </div>
              )}
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                <button className="icon-btn" onClick={() => galleryRef.current.click()} title="Image">📷</button>
                <button
                  onClick={startVoiceInput}
                  title={isRecording ? "Recording... tap to stop" : "Voice — Any Language 🌍"}
                  style={{
                    width:44,height:44,borderRadius:"50%",border:"none",cursor:"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                    background:isRecording?"radial-gradient(circle,#3a0000,#1a0000)":"radial-gradient(circle,#2a2a2a,#111111)",
                    boxShadow:isRecording?"0 0 0 3px #ef444466,0 2px 8px #0008":"0 2px 8px #0006",
                    transition:"all .2s",color:isRecording?"#ef4444":"#ffffff"
                  }}
                >
                  <MicIcon active={isRecording} />
                </button>
                <textarea className="msg-input" placeholder="Kuch bhi poochho..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} rows={1} />
                <button className="send" onClick={() => sendMsg()} disabled={(!input.trim() && !imageBase64) || loading}>➤</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── HISTORY PAGE ── */}
      {page === "history" && (
        <div className="page">
          <div className="page-top"><div className="page-title">📂 History</div></div>
          {histLoading
            ? <div className="loading-hist">⏳ Loading history...</div>
            : histories.length === 0
              ? <div className="welcome"><div className="welcome-icon">📭</div><h2>No history yet</h2></div>
              : histories.map(h => (
                <div key={h.id} className="hist-card" onClick={() => loadSession(h)}>
                  <div style={{fontSize:20}}>💬</div>
                  <div className="hist-info">
                    <div className="hist-title">{h.title}</div>
                    <div className="hist-meta">{fmtDate(h.updatedAt)}</div>
                  </div>
                  <button className="del-btn" onClick={(e) => deleteSession(h.id, e)}>🗑️</button>
                </div>
              ))
          }
        </div>
      )}

      {/* ── KISAN PAGE ── */}
      {page === "kisan" && (
        <div className="page">
          <div className="page-top"><div className="page-title">🌾 Kisan Helper</div></div>

          {/* Weather Card */}
          <div className="weather-card">
            <div style={{fontSize:13,opacity:.8,marginBottom:4}}>📍 Aapka Kshetra</div>
            <div className="weather-temp">32°C</div>
            <div className="weather-desc">☀️ Dhoop ke saath partly cloudy — garmi zyada hai</div>
            <div className="weather-grid">
              <div className="weather-item">💧 Humidity: 68%</div>
              <div className="weather-item">💨 Hawa: 12 km/h</div>
              <div className="weather-item">🌅 Sunrise: 5:42 AM</div>
              <div className="weather-item">🌇 Sunset: 7:18 PM</div>
            </div>
            <div style={{marginTop:10,fontSize:13,background:"#ffffff20",padding:"8px 12px",borderRadius:8}}>
              💡 Kisan Tip: Aaj dhoop tej hai — subah ya shaam ko paani do. Patte mein namak ka spray mat karo.
            </div>
          </div>

          {/* Mandi Bhav */}
          <div className="kisan-card">
            <div className="kisan-card-title">💰 Aaj Ke Mandi Bhav (₹/quintal)</div>
            {MANDI_PRICES.map((item, i) => (
              <div key={i} className="mandi-row">
                <span>{item.name}</span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span className="mandi-price">₹{item.price}</span>
                  <span className={`mandi-change ${item.up?"up":"down"}`}>{item.up?"▲":"▼"} {item.change}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Fasal Calendar */}
          <div className="kisan-card">
            <div className="kisan-card-title">📅 Is Mahine Ki Fasalein — {FASAL_CALENDAR[currentMonth].month}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
              {FASAL_CALENDAR[currentMonth].fasals.map((f, i) => (
                <span key={i} className="fasal-tag">🌱 {f}</span>
              ))}
            </div>
            <div className="kisan-card-title" style={{fontSize:13}}>Saare Mahine</div>
            {FASAL_CALENDAR.map((fm, i) => (
              <div key={i} className="fasal-month" style={{border: i===currentMonth?"1.5px solid #f97316":undefined}}>
                <div className="fasal-month-name">{i===currentMonth?"➤ ":""}{fm.month}</div>
                <div>{fm.fasals.map((f, j) => <span key={j} className="fasal-tag">{f}</span>)}</div>
              </div>
            ))}
          </div>

          <button className="ai-kisan-btn" onClick={() => { setPage("chat"); setInput("Kisan ke liye koi advice do — is mahine ki fasal ke baare mein batao"); }}>
            🤖 AI Se Kisan Sawaal Poochho
          </button>
        </div>
      )}

      {/* ── SETTINGS PAGE ── */}
      {page === "settings" && (
        <div className="page">
          {!userData?.premium && (
            <div className="premium-card" onClick={() => setShowUpgrade(true)}>
              <h3>⭐ Upgrade to Premium</h3>
              <p>Sirf ₹99/month — Unlimited access!</p>
              <div className="pf">✅ Unlimited Chats</div>
              <div className="pf">✅ Web Search</div>
              <div className="pf">✅ Image AI</div>
              <div className="pf">✅ Premium Badge</div>
            </div>
          )}
          <div className="section-lbl">Account</div>
          <div className="set-card">
            <div className="set-row">
              <div style={{width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#fff",flexShrink:0}}>
                {(userData?.name || user.displayName || "U")[0].toUpperCase()}
              </div>
              <div className="set-text">
                <div className="set-label">{userData?.name || user.displayName}</div>
                <div className="set-desc">{user.email}</div>
              </div>
              {userData?.premium && <div className="badge">PREMIUM</div>}
              {isAdmin && <div className="badge">ADMIN</div>}
            </div>
            <div className="set-row">
              <div className="set-icon">📊</div>
              <div className="set-text">
                <div className="set-label">Usage</div>
                <div className="set-desc">{userData?.premium ? "Unlimited" : `${chatsLeft} free chats remaining`}</div>
              </div>
            </div>
          </div>
          <div className="section-lbl">Appearance</div>
          <div className="set-card">
            <div className="set-row" onClick={() => setDarkMode(v => !v)}>
              <div className="set-icon">{darkMode ? "☀️" : "🌙"}</div>
              <div className="set-text">
                <div className="set-label">{darkMode ? "Light Mode" : "Dark Mode"}</div>
                <div className="set-desc">Theme badlo</div>
              </div>
              <div className={`toggle ${darkMode?"on":""}`}><div className="toggle-knob" /></div>
            </div>
          </div>
          <div className="section-lbl">Data</div>
          <div className="set-card">
            <div className="set-row" onClick={() => signOut(auth)}>
              <div className="set-icon">🚪</div>
              <div className="set-text">
                <div className="set-label" style={{color:"#ef4444"}}>Logout</div>
                <div className="set-desc">Sign out of your account</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN PAGE ── */}
      {page === "admin" && isAdmin && (
        <div className="page">
          <div style={{background:"#f9731615",border:"1px solid #f97316",borderRadius:12,padding:"12px 14px",fontSize:13,color:"#fb923c",marginBottom:4}}>
            🛡️ Admin Panel — Only visible to you
          </div>

          {/* Stats */}
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-val">{adminUsers.length}</div><div className="stat-lbl">Total Users</div></div>
            <div className="stat-card"><div className="stat-val">{adminUsers.filter(u => u.premium).length}</div><div className="stat-lbl">Premium</div></div>
            <div className="stat-card"><div className="stat-val">₹{adminUsers.filter(u => u.premium).length * 99}</div><div className="stat-lbl">Revenue</div></div>
            <div className="stat-card"><div className="stat-val">{adminUsers.reduce((s,u) => s+(u.usageCount||0), 0)}</div><div className="stat-lbl">Total Chats</div></div>
          </div>

          {/* Graphs */}
          <div className="graph-card">
            <MiniBarChart data={adminGraphData} label="USER ACTIVITY (LAST 7 DAYS)" color="#f97316" />
          </div>
          <div className="graph-card">
            <MiniBarChart data={revenueData} label="REVENUE TREND (₹)" color="#22c55e" />
          </div>

          {/* Pending Requests */}
          {adminUsers.some(u => u.premiumPending && !u.premium) && (
            <>
              <div className="section-lbl">⏳ Pending Premium Requests</div>
              {adminUsers.filter(u => u.premiumPending && !u.premium).map(u => (
                <div key={u.id} className="user-card" style={{border:"1px solid #eab308"}}>
                  <div className="user-av">{u.name?.[0]?.toUpperCase()}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600}}>{u.name}</div>
                    <div style={{fontSize:11,color:"var(--muted)"}}>{u.email}</div>
                  </div>
                  <button className="admin-action-btn" onClick={() => adminTogglePremium(u.id, false)} style={{borderColor:"#22c55e",color:"#22c55e"}}>✅ Approve</button>
                </div>
              ))}
            </>
          )}

          {/* All Users */}
          <div className="section-lbl">All Users ({adminUsers.length})</div>
          {adminUsers.map(u => (
            <div key={u.id} className="user-card">
              <div className="user-av">{u.name?.[0]?.toUpperCase()}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600}}>{u.name}</div>
                <div style={{fontSize:11,color:"var(--muted)"}}>{u.email}</div>
                <div style={{fontSize:11,color:"var(--muted)"}}>{u.usageCount||0} chats</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
                {u.email === ADMIN_EMAIL && <div className="badge">ADMIN</div>}
                {u.premium && <div className="badge-green">PREMIUM</div>}
                {u.premiumPending && !u.premium && <div className="badge-yellow">PENDING</div>}
                {u.email !== ADMIN_EMAIL && (
                  <div style={{display:"flex",gap:4,marginTop:2}}>
                    <button className="admin-action-btn" onClick={() => adminTogglePremium(u.id, u.premium)}>
                      {u.premium ? "🔴 OFF" : "🟢 ON"}
                    </button>
                    <button className="admin-action-btn danger" onClick={() => adminDeleteUser(u.id)}>🗑️</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODALS ── */}
      {showLimit && (
        <div className="modal-bg" onClick={() => setShowLimit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">⏳</div>
            <h3>Free Limit Reached!</h3>
            <p>Upgrade to Premium for unlimited access!</p>
            <button className="btn btn-primary" onClick={() => { setShowLimit(false); setShowUpgrade(true); }}>⭐ Upgrade — ₹99/month</button>
            <button className="btn btn-secondary" onClick={() => setShowLimit(false)}>Maybe later</button>
          </div>
        </div>
      )}

      {showUpgrade && (
        <div className="modal-bg" onClick={() => setShowUpgrade(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">⭐</div>
            <h3>Saraswati AI Premium</h3>
            <p>Sirf ₹99/month — Unlimited access!</p>
            <div className="payment-box">
              <div style={{fontSize:13,fontWeight:700,color:"var(--accent)",textAlign:"center"}}>📱 PhonePe / UPI se Pay Karo</div>
              <div className="payment-number">{PHONEPAY_NUMBER}</div>
              <div className="payment-step">1️⃣ <span>PhonePe/GPay/Paytm mein <strong>₹99</strong> bhejo</span></div>
              <div className="payment-step">2️⃣ <span>Screenshot ya UTR number note karo</span></div>
              <div className="payment-step">3️⃣ <span>Neeche "Payment Done" dabao</span></div>
            </div>
            {!paymentDone ? (
              <button className="btn btn-primary" onClick={() => setPaymentDone(true)}>✅ Payment Done — Activate Karo</button>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{fontSize:13,color:"var(--muted)",textAlign:"center"}}>Admin 24 hours mein activate karega</div>
                <button className="btn btn-primary" onClick={async () => {
                  await setDoc(doc(db, "users", user.uid), { premiumPending: true, premiumRequestedAt: serverTimestamp() }, { merge: true });
                  setUserData(prev => ({ ...prev, premiumPending: true }));
                  setShowUpgrade(false);
                  setPaymentDone(false);
                  alert("✅ Request bhej di! Admin 24 hours mein activate karega.");
                }}>📨 Request Submit Karo</button>
              </div>
            )}
            <button className="btn btn-secondary" onClick={() => { setShowUpgrade(false); setPaymentDone(false); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
