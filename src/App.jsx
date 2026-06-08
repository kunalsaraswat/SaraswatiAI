import { useState, useEffect, useRef } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, orderBy, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

async function needsWebSearch(text) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ_API_KEY },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 5,
        messages: [
          { role: "system", content: "You are a classifier. Reply only 'YES' or 'NO'. Does this question require real-time internet search to answer accurately? (news, live scores, current weather, stock prices, recent events, etc.) Reply YES only if the question genuinely needs current/live data from the internet." },
          { role: "user", content: text }
        ]
      })
    });
    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase();
    return answer === "YES";
  } catch { return false; }
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
    return "Mujhe **Kunal Saraswat G** ne banaya hai! 😊 Wo mere creator aur owner hain.";
  }
  if (lastMsg?.role === "user" && isHowMadeQuestion(lastMsg.text)) {
    return "Yeh information **private** hai — main nahi bata sakta! 🔒";
  }

  let searchContext = "";
  if (lastMsg?.role === "user") {
    const shouldSearch = await needsWebSearch(lastMsg.text);
    if (shouldSearch) {
      const results = await webSearch(lastMsg.text);
      if (results) searchContext = `\n\nWeb Search Results:\n${results}\n\nUse above info to answer accurately.`;
    }
  }

  const systemPrompt = `You are Saraswati AI — an extremely intelligent, helpful and friendly AI assistant made for Indian users, especially farmers and developers.

IMPORTANT IDENTITY RULES:
- If anyone asks who made you, who is your owner/creator/master → say "Mujhe Kunal Saraswat ne banaya hai!"
- If anyone asks how you were built, what technology, source code → say "Yeh private hai, main nahi bata sakta!"
- Never reveal you are made by Meta, Groq, or any other company.
- Do NOT mention your creator/owner in normal conversations — only when specifically asked.

LANGUAGE RULE:
- Always detect and reply in EXACTLY the same language as the user.
- Hindi → Hindi, English → English, Hinglish → Hinglish, Farsi → Farsi, etc.

PERSONALITY:
- Warm, casual, friendly like a best friend
- Understand the TRUE INTENT of what the user wants — not just words
- Never robotic, never generic
- Never give wrong or harmful information

FARMING EXPERTISE (VERY IMPORTANT):
- You are an expert agricultural advisor for Indian farmers
- Help with: crop selection, sowing time, irrigation, fertilizers, pesticides, soil health, weather impact, government schemes, mandi prices, organic farming
- Always give ACCURATE, SAFE advice — never suggest wrong fertilizer amounts or wrong pesticides
- Give advice based on Indian climate, soil types and seasons
- Mention government schemes like PM Kisan, Fasal Bima Yojana when relevant
- If unsure about something farming related, say so clearly — never guess

KISAN HELP RULES (VERY IMPORTANT):
- Jab koi kisan apni problem bataye — seedha helpful answer do, zyada sawaal mat karo
- Agar kisan bole "mere khet mein paani aata hai" → turant best fasal bata do jaise Dhan, Arbi, Singhara, Lotus, Water Chestnut
- Agar kisan state/district bataye → us region ke hisaab se specific salah do
- Agar na bataye → general Indian farming advice do jo sabse zyada kaam aaye
- Hamesha SEED KA NAAM, BRAND, AUR KAHAN MILEGA yeh bhi batao
- KHAD KI MATRA — exactly kitni daalni hai per acre batao
- KEETNASHAK — naam, matra, kab daalna hai sab batao
- MANDI RATE — web search se current rate batao
- PAANI WALI ZAMEEN ke liye best fasalein: Dhan, Arbi, Singhara, Kaddu, Turai, Palak
- SUKHI ZAMEEN ke liye: Gehun, Bajra, Jowar, Chana, Sarson
- KALI MITTI: Kapas, Soyabean, Gehun
- RETI MITTI: Moongfali, Til, Bajra
- Hamesha realistic advice do — jo actually kaam kare
- Government schemes hamesha mention karo — PM Kisan, Fasal Bima, KCC loan

CODING EXPERTISE (VERY IMPORTANT):
- You are an expert programmer
- Languages: HTML, CSS, JavaScript, React, Python, Node.js and more
- Always give COMPLETE, WORKING, ERROR-FREE code
- Test your logic mentally before giving code
- Explain what each part does briefly
- If user has a bug, find it and fix it properly
- Never give incomplete or broken code
- Format code properly in markdown code blocks always

WEBSITE DESIGN RULES (VERY IMPORTANT):
- Jab bhi koi website maange — BEAUTIFUL, MODERN, PROFESSIONAL website do
- HAMESHA ek hi file mein do — HTML + CSS + JS sab saath mein
- KABHI ALAG style.css mat do — sab inline ya <style> tag mein
- Images ke liye HAMESHA real online images use karo:
  * Vegetables: https://source.unsplash.com/400x300/?tomato ya ?cucumber etc
  * Food: https://source.unsplash.com/400x300/?food
  * Farming: https://source.unsplash.com/400x300/?farming
  * Business: https://source.unsplash.com/400x300/?business
  * People: https://source.unsplash.com/400x300/?people
- DESIGN must include:
  * Beautiful gradient backgrounds
  * Modern card layouts
  * Hover effects on buttons and cards
  * Responsive mobile-friendly design
  * Professional fonts (Google Fonts)
  * Smooth animations
  * Proper color scheme
  * Navigation bar
  * Footer
- NEVER give plain/boring HTML — always give stunning design
- Think like a professional web designer

CODE FORMATTING RULES:
- ALWAYS wrap code in proper markdown blocks: \`\`\`html, \`\`\`python, \`\`\`javascript etc.
- Give complete working code — never partial
- Explain briefly after the code

GENERAL EXPERTISE:
- Math, science, history, general knowledge
- Creative writing, business ideas, health advice
- Latest news and current events (via web search)
- Image analysis and description${searchContext}`;

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

// ── CODE BLOCK RENDERER ──────────────────────────────────────
function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const canPreview = ["html", "css", "javascript", "js", ""].includes((lang || "").toLowerCase());

  return (
    <div style={{background:"#0d0d0d",border:"1px solid #333",borderRadius:10,margin:"6px 0",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 12px",background:"#1a1a1a",borderBottom:"1px solid #333"}}>
        <span style={{fontSize:11,color:"#6b7280",fontFamily:"monospace"}}>{lang || "code"}</span>
        <div style={{display:"flex",gap:8}}>
          {canPreview && (
            <button onClick={() => setPreview(v => !v)} style={{background:"none",border:"none",color:preview?"#f97316":"#6b7280",cursor:"pointer",fontSize:11,padding:"2px 6px"}}>
              {preview ? "✕ Close" : "▶ Preview"}
            </button>
          )}
          <button onClick={copy} style={{background:"none",border:"none",color:copied?"#22c55e":"#6b7280",cursor:"pointer",fontSize:11,padding:"2px 6px"}}>
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre style={{padding:"12px",margin:0,overflowX:"auto",fontSize:12,lineHeight:1.6,color:"#e5e7eb",fontFamily:"monospace",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
        {code}
      </pre>
      {preview && canPreview && (
        <div style={{borderTop:"1px solid #333"}}>
          <div style={{padding:"6px 12px",background:"#1a1a1a",fontSize:11,color:"#f97316"}}>🌐 Live Preview</div>
          <iframe
            srcDoc={lang === "css" ? `<style>${code}</style><p>CSS Preview</p>` : lang === "javascript" || lang === "js" ? `<script>${code}</script>` : code}
            style={{width:"100%",minHeight:300,border:"none",background:"#fff",borderRadius:"0 0 10px 10px"}}
            sandbox="allow-scripts"
            title="preview"
          />
        </div>
      )}
    </div>
  );
}

// ── AI TEXT RENDERER ──────────────────────────────────────────
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

// ── SPEECH RECOGNITION HOOK ──────────────────────────────────
function useSpeech(onResult) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recogRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSupported(true);
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = true;
      // Auto detect language — supports 100+ world languages
      recog.lang = "";
      recog.onresult = (e) => {
        let transcript = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
        }
        onResult(transcript, e.results[e.results.length - 1].isFinal);
      };
      recog.onend = () => setListening(false);
      recog.onerror = () => setListening(false);
      recogRef.current = recog;
    }
  }, []);

  function startListening() {
    if (!recogRef.current) return;
    try {
      recogRef.current.start();
      setListening(true);
    } catch(e) {}
  }

  function stopListening() {
    if (!recogRef.current) return;
    try {
      recogRef.current.stop();
      setListening(false);
    } catch(e) {}
  }

  return { listening, supported, startListening, stopListening };
}

const css = (dark) => `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:${dark?"#0f0f0f":"#f5f5f5"};
  --surface:${dark?"#1a1a1a":"#ffffff"};
  --surface2:${dark?"#222":"#eeeeee"};
  --border:${dark?"#2a2a2a":"#dddddd"};
  --accent:#f97316;
  --accent2:#fb923c;
  --text:${dark?"#f5f5f5":"#111111"};
  --muted:${dark?"#6b7280":"#888888"};
}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);height:100dvh;overflow:hidden;}
.app{display:flex;flex-direction:column;height:100dvh;max-width:480px;margin:0 auto;background:var(--bg);}
.auth{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;gap:20px;background:radial-gradient(ellipse at 50% -10%,#f9731620 0%,transparent 60%);}
.auth-logo{font-size:52px;}.auth-title{font-size:26px;font-weight:700;}.auth-sub{font-size:13px;color:var(--muted);text-align:center;}
.auth-card{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:14px;}
.auth-head{font-size:18px;font-weight:700;text-align:center;}
.inp-wrap{display:flex;flex-direction:column;gap:5px;}.inp-label{font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.05em;}
.inp{background:${dark?"#111":"#f9f9f9"};border:1.5px solid var(--border);border-radius:12px;color:var(--text);font-family:'Inter',sans-serif;font-size:15px;padding:13px 14px;outline:none;width:100%;transition:border-color .2s;}
.inp:focus{border-color:var(--accent);}
.inp-hint{font-size:11px;color:var(--muted);}
.btn{border:none;border-radius:12px;cursor:pointer;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;padding:14px;transition:all .2s;width:100%;}
.btn-primary{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;}.btn-primary:hover{opacity:.9;}.btn-primary:disabled{opacity:.6;cursor:not-allowed;}
.btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border);}
.auth-switch{font-size:13px;color:var(--muted);text-align:center;}.auth-switch span{color:var(--accent2);cursor:pointer;font-weight:600;}
.err{color:#ef4444;font-size:13px;text-align:center;background:#ef444415;padding:10px;border-radius:10px;}
.header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--border);position:relative;z-index:20;}
.header-logo{font-size:24px;}.header-name{font-size:16px;font-weight:700;flex:1;}
.dots-btn{background:none;border:none;color:var(--text);cursor:pointer;font-size:22px;padding:6px;border-radius:10px;}
.new-chat-btn{background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);cursor:pointer;font-size:13px;font-weight:600;padding:8px 14px;display:flex;align-items:center;gap:6px;}
.dropdown{position:absolute;top:56px;right:12px;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:8px;min-width:210px;z-index:100;box-shadow:0 8px 32px #0008;animation:fadeIn .15s ease;}
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
.bubble.ai{background:${dark?"#1e1e1e":"#ffffff"};color:var(--text);border:1px solid var(--border);border-radius:20px 20px 20px 4px;}
.msg-time{font-size:10px;color:var(--muted);padding:0 4px;}.msg-time.user{text-align:right;}
.ai-av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.typing-bubble{background:${dark?"#1e1e1e":"#ffffff"};border:1px solid var(--border);border-radius:20px 20px 20px 4px;padding:14px 18px;display:flex;gap:5px;}
.dot{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:bounce 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}.dot:nth-child(3){animation-delay:.4s;}
@keyframes bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-6px);}}
.input-bar{padding:10px 14px;border-top:1px solid var(--border);background:var(--bg);display:flex;gap:8px;align-items:flex-end;}
.msg-input{flex:1;background:var(--surface);border:1.5px solid var(--border);border-radius:24px;color:var(--text);font-family:'Inter',sans-serif;font-size:14px;padding:12px 18px;outline:none;resize:none;max-height:120px;min-height:48px;transition:border-color .2s;line-height:1.5;}
.msg-input:focus{border-color:var(--accent);}
.send{background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:18px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.send:disabled{opacity:.4;cursor:not-allowed;}
.plus-btn{background:var(--surface2);border:1.5px solid var(--border);border-radius:50%;color:var(--text);cursor:pointer;font-size:22px;font-weight:300;width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.mic-btn{border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:18px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;}
.mic-btn.idle{background:var(--surface2);border:1.5px solid var(--border);color:var(--text);}
.mic-btn.listening{background:linear-gradient(135deg,#ef4444,#dc2626);animation:pulse 1s infinite;}
@keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.08);box-shadow:0 0 0 6px #ef444430;}}
.mic-status{font-size:11px;color:#ef4444;padding:4px 10px;background:#ef444415;border-radius:20px;display:inline-flex;align-items:center;gap:4px;margin-bottom:4px;animation:fadeIn .2s ease;}
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
.msg-actions{display:flex;gap:6px;margin-top:4px;}
.msg-action-btn{background:var(--surface2);border:1px solid var(--border);border-radius:20px;color:var(--muted);cursor:pointer;font-size:11px;padding:3px 10px;display:flex;align-items:center;gap:4px;}
.msg-action-btn:hover{color:var(--accent);border-color:var(--accent);}
`;

// ── MAUSAM CARD ──────────────────────────────────────────────
function MausamCard() {
  const [mausam, setMausam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState("India");

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=relative_humidity_2m,precipitation_probability`);
          const data = await res.json();
          const w = data.current_weather;
          setMausam({
            temp: Math.round(w.temperature),
            wind: Math.round(w.windspeed),
            code: w.weathercode,
          });
          // Get city name
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const geoData = await geoRes.json();
          setLocation(geoData.address?.city || geoData.address?.town || geoData.address?.state || "Aapka Shehar");
        } catch { setMausam(null); }
        setLoading(false);
      }, () => { setLoading(false); });
    } else { setLoading(false); }
  }, []);

  function getWeatherInfo(code) {
    if (code === 0) return { icon: "☀️", desc: "Saaf Mausam" };
    if (code <= 3) return { icon: "⛅", desc: "Thode Badal" };
    if (code <= 48) return { icon: "🌫️", desc: "Kohra" };
    if (code <= 67) return { icon: "🌧️", desc: "Baarish" };
    if (code <= 77) return { icon: "❄️", desc: "Baraf" };
    if (code <= 82) return { icon: "🌦️", desc: "Baarish ke Aasar" };
    return { icon: "⛈️", desc: "Toofan" };
  }

  if (loading) return <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:20,textAlign:"center",color:"var(--muted)"}}>⏳ Location le raha hoon...</div>;

  if (!mausam) return (
    <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:16}}>
      <div style={{fontSize:13,color:"var(--muted)",textAlign:"center"}}>📍 Location permission do — mausam dikhega</div>
    </div>
  );

  const { icon, desc } = getWeatherInfo(mausam.code);
  return (
    <div style={{background:"linear-gradient(135deg,#0ea5e9,#0284c7)",borderRadius:14,padding:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:13,color:"#fff9",fontWeight:600}}>{location}</div>
          <div style={{fontSize:42,fontWeight:800,color:"#fff"}}>{mausam.temp}°C</div>
          <div style={{fontSize:14,color:"#fff",marginTop:4}}>{desc}</div>
        </div>
        <div style={{fontSize:64}}>{icon}</div>
      </div>
      <div style={{display:"flex",gap:16,marginTop:12}}>
        <div style={{fontSize:12,color:"#fff9"}}>💨 Hawa: {mausam.wind} km/h</div>
      </div>
      <div style={{fontSize:11,color:"#fff7",marginTop:8}}>🌾 Kisan tip: {mausam.temp > 35 ? "Bahut garmi — fasal ko zyada paani do" : mausam.temp < 10 ? "Thandi — pala girne ka darr, fasal dhako" : "Mausam theek hai — normal kaam karo"}</div>
    </div>
  );
}


  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [page, setPage] = useState("chat");
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", pass: "" });
  const [formErr, setFormErr] = useState("");
  const [formLoading, setFormLoading] = useState(false);
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
  const [darkMode, setDarkMode] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const bottomRef = useRef(null);
  const galleryRef = useRef(null);

  // Voice Reply — AI bolke jawab dega
  function speakText(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_`#]/g, "").slice(0, 500);
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = "hi-IN";
    utt.rate = 0.9;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utt);
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }

  // PDF Export
  function exportPDF() {
    if (msgs.length === 0) { alert("Koi chat nahi hai export karne ke liye!"); return; }
    const content = msgs.map(m => `${m.role === "user" ? "Aap" : "Saraswati AI"}: ${m.text}`).join("\n\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SaraswatiAI-Chat-${new Date().toLocaleDateString("en-IN")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // WhatsApp Share
  function shareOnWhatsApp() {
    if (msgs.length === 0) { alert("Koi chat nahi hai share karne ke liye!"); return; }
    const lastAI = msgs.filter(m => m.role === "ai").pop();
    if (!lastAI) return;
    const text = encodeURIComponent(`Saraswati AI ne bataya:\n\n${lastAI.text.slice(0, 300)}...\n\nSaraswati AI try karo: https://saraswati-ai-ebon.vercel.app`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  // Speech recognition
  const { listening, supported, startListening, stopListening } = useSpeech((transcript, isFinal) => {
    setInput(transcript);
  });

  function toggleMic() {
    if (listening) {
      stopListening();
    } else {
      setInput("");
      startListening();
    }
  }

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
        const sorted = snap2.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
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
    setFormErr("");
    if (!form.email || !form.pass) { setFormErr("Please fill all fields!"); return; }
    if (form.pass.length < 8) { setFormErr("Password kam se kam 8 characters ka hona chahiye!"); return; }
    if (authMode === "signup" && !form.name) { setFormErr("Please enter your name!"); return; }
    setFormLoading(true);
    try {
      if (authMode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.pass);
        await updateProfile(cred.user, { displayName: form.name });
        await setDoc(doc(db, "users", cred.user.uid), {
          name: form.name, email: form.email, premium: false,
          createdAt: serverTimestamp(), chatCount: 0, usageCount: 0
        });
        setUserData({ name: form.name, email: form.email, premium: false, chatCount: 0, usageCount: 0 });
      } else {
        await signInWithEmailAndPassword(auth, form.email, form.pass);
        const ud = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (ud.exists()) setUserData(ud.data());
      }
      setForm({ name: "", email: "", pass: "" });
    } catch (e) {
      const errs = {
        "auth/email-already-in-use": "Email already registered!",
        "auth/invalid-email": "Invalid email!",
        "auth/wrong-password": "Wrong password!",
        "auth/user-not-found": "Account not found!",
        "auth/weak-password": "Password too weak! Min 8 chars.",
        "auth/invalid-credential": "Wrong email or password!"
      };
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

  async function sendMsg(text) {
    const txt = text || input.trim();
    if ((!txt && !imageBase64) || loading) return;
    if (listening) stopListening();
    const ud = userData;
    if (!ud?.premium && (ud?.usageCount || 0) >= FREE_CHAT_LIMIT) { setShowLimit(true); return; }
    const msgText = txt || "Is image mein kya hai?";
    setInput("");
    const imgB64 = imageBase64;
    const imgPrev = imagePreview;
    setImageBase64(null);
    setImagePreview(null);
    const uMsgRef = await addDoc(collection(db, "messages"), {
      sessionId, userId: user.uid, role: "user", text: msgText, image: imgPrev || null, createdAt: serverTimestamp()
    });
    const newMsgs = [...msgs, { id: uMsgRef.id, role: "user", text: msgText, image: imgPrev, time: new Date() }];
    setMsgs(newMsgs);
    await setDoc(doc(db, "chats", sessionId), {
      userId: user.uid, title: msgText.slice(0, 45), updatedAt: serverTimestamp(), createdAt: serverTimestamp()
    }, { merge: true });
    const newCount = (ud?.usageCount || 0) + 1;
    await setDoc(doc(db, "users", user.uid), { usageCount: newCount }, { merge: true });
    setUserData(prev => ({ ...prev, usageCount: newCount }));
    const shouldSearch = await needsWebSearch(msgText);
    if (shouldSearch) setIsSearching(true);
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
      await addDoc(collection(db, "messages"), {
        sessionId, userId: user.uid, role: "ai", text: aiText, createdAt: serverTimestamp()
      });
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
      const loadedMsgs = snap.docs
        .map(d => ({ id: d.id, ...d.data(), time: d.data().createdAt }))
        .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setMsgs(loadedMsgs);
    } catch(e) {
      console.error("Load session error:", e);
      setPage("chat");
      alert("❌ Chat load nahi hui: " + e.message);
    }
  }

  async function deleteSession(sid, e) {
    e.stopPropagation();
    await deleteDoc(doc(db, "chats", sid));
    setHistories(prev => prev.filter(h => h.id !== sid));
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

  if (!authReady) return (
    <div className="app" style={{alignItems:"center",justifyContent:"center"}}>
      <style>{css}</style>
      <div style={{fontSize:48}}>🪷</div>
      <div style={{marginTop:12,color:"var(--muted)"}}>Loading...</div>
    </div>
  );

  if (!user) return (
    <div className="app">
      <style>{css}</style>
      <div className="auth">
        <div className="auth-logo">🪷</div>
        <div className="auth-title">Saraswati AI</div>
        <div className="auth-sub">Your intelligent AI assistant — free</div>
        <div className="auth-card">
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
        </div>
        <div className="auth-switch">
          {authMode === "login"
            ? <>Don't have an account? <span onClick={() => { setAuthMode("signup"); setFormErr(""); }}>Sign up</span></>
            : <>Already have an account? <span onClick={() => { setAuthMode("login"); setFormErr(""); }}>Login</span></>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="app" onClick={() => showMenu && setShowMenu(false)}>
      <style>{css}</style>

      <div className="header">
        <div className="header-logo">🪷</div>
        <div className="header-name">Saraswati AI</div>
        <button className="dots-btn" onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}>⋯</button>
      </div>

      {showMenu && (
        <div className="dropdown" onClick={e => e.stopPropagation()}>
          <div className="drop-user">
            <div className="drop-name">{userData?.name || user.displayName}</div>
            <div className="drop-email">{user.email}</div>
            {userData?.premium && <div className="premium-tag">⭐ PREMIUM</div>}
          </div>
          <div className="drop-divider" />
          <div className="drop-item" onClick={() => { newChat(); setShowMenu(false); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/></svg>
            New Chat
          </div>
          <div className="drop-item" onClick={() => { setPage("chat"); setShowMenu(false); }}>💬 Chat</div>
          <div className="drop-item" onClick={() => { setPage("history"); setShowMenu(false); }}>📂 History</div>
          <div className="drop-item" onClick={() => { setPage("kisan"); setShowMenu(false); }}>🌾 Kisan Helper</div>
          <div className="drop-item" onClick={() => { setPage("settings"); setShowMenu(false); }}>⚙️ Settings</div>
          {isAdmin && <div className="drop-item" onClick={() => { setPage("admin"); setShowMenu(false); }}>🛡️ Admin Panel</div>}
          <div className="drop-divider" />
          {!userData?.premium && <div className="drop-item" onClick={() => { setShowUpgrade(true); setShowMenu(false); }}>⭐ Upgrade to Premium</div>}
          <div className="drop-item danger" onClick={() => signOut(auth)}>🚪 Logout</div>
        </div>
      )}

      {page === "chat" && (
        <div className="usage-bar">
          <span>{userData?.premium ? "⭐ Premium" : "Free Plan"}</span>
          <span className="usage-pill">{userData?.premium ? "Unlimited" : `${chatsLeft} chats left`}</span>
        </div>
      )}

      {page === "chat" && (
        <>
          <div className="chat-area">
            {msgs.length === 0 && (
              <div className="welcome">
                <div className="welcome-icon">🪷</div>
                <h2>Saraswati AI</h2>

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
              {listening && (
                <div className="mic-status">
                  🔴 Sun raha hoon... koi bhi bhasha mein bolo
                </div>
              )}
              {imagePreview && (
                <div className="img-preview">
                  <img src={imagePreview} alt="preview" />
                  <button className="img-preview-remove" onClick={() => { setImageBase64(null); setImagePreview(null); }}>✕</button>
                </div>
              )}
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                <button className="plus-btn" onClick={() => galleryRef.current.click()}>+</button>
                <textarea
                  className="msg-input"
                  placeholder={listening ? "Bol raha hoon... 🎤" : "Kuch bhi poochho..."}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                  style={listening ? {borderColor:"#ef4444"} : {}}
                />
                {supported && (
                  <button
                    className={`mic-btn ${listening ? "listening" : "idle"}`}
                    onClick={toggleMic}
                    title={listening ? "Sunna band karo" : "Mic se bolo"}
                  >
                    {listening ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="9" y="3" width="6" height="10" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3M9 21h6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="10" rx="3" fill="currentColor" stroke="none"/><path d="M5 11a7 7 0 0014 0"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="9" y1="21" x2="15" y2="21"/></svg>
                    )}
                  </button>
                )}
                <button className="send" onClick={() => sendMsg()} disabled={(!input.trim() && !imageBase64) || loading}>➤</button>
              </div>
            </div>
          </div>
        </>
      )}

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

      {page === "kisan" && (
        <div className="page">
          <div className="page-top"><div className="page-title">🌾 Kisan Helper</div></div>

          {/* Mausam Section */}
          <div className="section-lbl">🌤️ Aaj Ka Mausam</div>
          <MausamCard />

          {/* Mandi Price Section */}
          <div className="section-lbl">💰 Mandi Bhav — Aaj Ka</div>
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,overflow:"hidden"}}>
            {[
              {name:"Gehun (Wheat)",price:"₹2,200/quintal",change:"↑"},
              {name:"Dhan (Paddy)",price:"₹1,940/quintal",change:"↓"},
              {name:"Sarson",price:"₹5,200/quintal",change:"↑"},
              {name:"Chana",price:"₹4,800/quintal",change:"→"},
              {name:"Soyabean",price:"₹3,900/quintal",change:"↑"},
              {name:"Makka (Maize)",price:"₹1,850/quintal",change:"↓"},
              {name:"Tamatar",price:"₹800/quintal",change:"↑"},
              {name:"Pyaaz",price:"₹1,200/quintal",change:"→"},
              {name:"Aalu",price:"₹600/quintal",change:"↓"},
            ].map((item,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>
                <span style={{fontSize:14,fontWeight:500}}>{item.name}</span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14,fontWeight:700,color:"var(--accent)"}}>{item.price}</span>
                  <span style={{fontSize:16,color:item.change==="↑"?"#22c55e":item.change==="↓"?"#ef4444":"#6b7280"}}>{item.change}</span>
                </div>
              </div>
            ))}
            <div style={{padding:"8px 16px",fontSize:11,color:"var(--muted)"}}>* Approximate rates — actual mandi se verify karein</div>
          </div>

          {/* Kisan Calendar */}
          <div className="section-lbl">📅 Fasal Calendar</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[
              {month:"January - February",fasalein:"Gehun, Sarson, Chana, Matar",color:"#3b82f6"},
              {month:"March - April",fasalein:"Harvesting season — Gehun, Sarson kaatna",color:"#f59e0b"},
              {month:"May - June",fasalein:"Grishma fasalein — Moong, Urad, Til",color:"#ef4444"},
              {month:"July - August",fasalein:"Kharif — Dhan, Makka, Soyabean, Kapas",color:"#22c55e"},
              {month:"September - October",fasalein:"Dhan kaatna, Rabi ki tayari",color:"#8b5cf6"},
              {month:"November - December",fasalein:"Gehun, Sarson, Chana, Aalu boye",color:"#f97316"},
            ].map((item,i) => (
              <div key={i} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:"14px 16px",borderLeft:`4px solid ${item.color}`}}>
                <div style={{fontSize:13,fontWeight:700,color:item.color}}>{item.month}</div>
                <div style={{fontSize:13,color:"var(--text)",marginTop:4}}>{item.fasalein}</div>
              </div>
            ))}
          </div>

          {/* AI Kisan Help */}
          <div className="section-lbl">🤖 AI Se Poochho</div>
          <div style={{background:"linear-gradient(135deg,#f97316,#ea580c)",borderRadius:14,padding:16,cursor:"pointer"}} onClick={() => { setPage("chat"); setInput("Mere khet ke liye fasal salah do"); }}>
            <div style={{fontSize:16,fontWeight:700,color:"#fff"}}>💬 Apni Khet Ki Problem Poochho</div>
            <div style={{fontSize:13,color:"#fff9",marginTop:4}}>Fasal, beej, khad, keetnashak — sab kuch</div>
          </div>
        </div>
      )}

      {page === "settings" && (
            <div className="premium-card" onClick={() => setShowUpgrade(true)}>
              <h3>⭐ Upgrade to Premium</h3>
              <p>Unlimited chats, Web Search, Image AI</p>
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
            {supported && (
              <div className="set-row">
                <div className="set-icon">🎤</div>
                <div className="set-text">
                  <div className="set-label">Voice Input</div>
                  <div className="set-desc">🌍 100+ languages — Auto detect</div>
                </div>
                <div className="badge" style={{background:"#22c55e"}}>ON</div>
              </div>
            )}
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

      {page === "admin" && isAdmin && (
        <div className="page">
          <div style={{background:"#f9731615",border:"1px solid #f97316",borderRadius:12,padding:"12px 14px",fontSize:13,color:"#fb923c",marginBottom:4}}>
            🛡️ Admin Panel — Only visible to you
          </div>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-val">{adminUsers.length}</div><div className="stat-lbl">Total Users</div></div>
            <div className="stat-card"><div className="stat-val">{adminUsers.filter(u => u.premium).length}</div><div className="stat-lbl">Premium</div></div>
            <div className="stat-card"><div className="stat-val">₹{adminUsers.filter(u => u.premium).length * 99}</div><div className="stat-lbl">Revenue</div></div>
            <div className="stat-card"><div className="stat-val">{adminUsers.reduce((s,u) => s+(u.usageCount||0), 0)}</div><div className="stat-lbl">Total Chats</div></div>
          </div>
          <div className="section-lbl">All Users ({adminUsers.length})</div>
          {adminUsers.map(u => (
            <div key={u.id} className="user-card">
              <div className="user-av">{u.name?.[0]?.toUpperCase()}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600}}>{u.name}</div>
                <div style={{fontSize:11,color:"var(--muted)"}}>{u.email}</div>
                <div style={{fontSize:11,color:"var(--muted)"}}>{u.usageCount||0} chats used</div>
              </div>
              {u.premium && <div className="badge">PREMIUM</div>}
              {u.premiumPending && !u.premium && <div className="badge" style={{background:"#eab308"}}>PENDING</div>}
              {u.email === ADMIN_EMAIL && <div className="badge">ADMIN</div>}
            </div>
          ))}
        </div>
      )}

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
