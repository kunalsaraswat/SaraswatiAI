import { useState, useEffect, useRef } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, orderBy, getDocs, deleteDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── FIREBASE CONFIG ───────────────────────────────────────────
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
const ADMIN_EMAIL = "kunalsaraswat691@gmail.com";
const FREE_CHAT_LIMIT = 49;
const COOLDOWN_HOURS = 2;

// ── GROQ API ──────────────────────────────────────────────────
async function askAI(messages) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ_API_KEY },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are Saraswati AI — a friendly, smart and helpful AI assistant like ChatGPT. Always start your first reply with a warm greeting like Hey! or Hello!. If the user writes in Hindi, reply in simple Hindi. If in English, reply in English. If in Hinglish, reply in Hinglish. Never use formal Urdu words. Always be casual, warm and helpful like a friend. Keep replies clear and well formatted." },
        ...messages.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }))
      ],
      max_tokens: 1024
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "No response.";
}

// ── AI TEXT RENDERER ──────────────────────────────────────────
function AIText({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <span style={{display:"flex",flexDirection:"column",gap:4}}>
      {lines.map((line, i) => {
        if (!line.trim()) return <span key={i} style={{height:6}} />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) => {
          if (p.startsWith("**") && p.endsWith("**"))
            return <strong key={j}>{p.slice(2,-2)}</strong>;
          const codeParts = p.split(/(`[^`]+`)/g).map((c, k) => {
            if (c.startsWith("`") && c.endsWith("`"))
              return <code key={k} style={{background:"#ffffff18",borderRadius:4,padding:"1px 6px",fontFamily:"monospace",fontSize:12}}>{c.slice(1,-1)}</code>;
            return c;
          });
          return <span key={j}>{codeParts}</span>;
        });
        if (line.trim().startsWith("- ") || line.trim().startsWith("• "))
          return <span key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}><span style={{color:"#f97316",marginTop:2}}>•</span><span>{parts}</span></span>;
        if (/^\d+\.\s/.test(line.trim()))
          return <span key={i} style={{display:"flex",gap:8}}><span style={{color:"#f97316",minWidth:16}}>{line.match(/^\d+/)[0]}.</span><span>{parts}</span></span>;
        if (line.startsWith("### "))
          return <strong key={i} style={{fontSize:15,color:"#f97316"}}>{line.slice(4)}</strong>;
        if (line.startsWith("## "))
          return <strong key={i} style={{fontSize:16,color:"#f97316"}}>{line.slice(3)}</strong>;
        return <span key={i}>{parts}</span>;
      })}
    </span>
  );
}

// ── STYLES ────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#0f0f0f;--surface:#1a1a1a;--surface2:#222;--border:#2a2a2a;
  --accent:#f97316;--accent2:#fb923c;--text:#f5f5f5;--muted:#6b7280;
  --radius:18px;
}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);height:100dvh;overflow:hidden;}
.app{display:flex;flex-direction:column;height:100dvh;max-width:480px;margin:0 auto;background:var(--bg);}

/* AUTH */
.auth{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;gap:20px;background:radial-gradient(ellipse at 50% -10%,#f9731620 0%,transparent 60%);}
.auth-logo{font-size:52px;}
.auth-title{font-size:26px;font-weight:700;}
.auth-sub{font-size:13px;color:var(--muted);text-align:center;}
.auth-card{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:14px;}
.auth-head{font-size:18px;font-weight:700;text-align:center;}
.inp-wrap{display:flex;flex-direction:column;gap:5px;}
.inp-label{font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.05em;}
.inp{background:#111;border:1.5px solid var(--border);border-radius:12px;color:var(--text);font-family:'Inter',sans-serif;font-size:15px;padding:13px 14px;outline:none;width:100%;transition:border-color .2s;}
.inp:focus{border-color:var(--accent);}
.btn{border:none;border-radius:12px;cursor:pointer;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;padding:14px;transition:all .2s;width:100%;}
.btn-primary{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;}
.btn-primary:hover{opacity:.9;}
.btn-primary:disabled{opacity:.6;cursor:not-allowed;}
.btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border);}
.btn-danger{background:#ef4444;color:#fff;}
.btn-sm{padding:8px 14px;font-size:13px;width:auto;border-radius:10px;}
.auth-switch{font-size:13px;color:var(--muted);text-align:center;}
.auth-switch span{color:var(--accent2);cursor:pointer;font-weight:600;}
.err{color:#ef4444;font-size:13px;text-align:center;background:#ef444415;padding:10px;border-radius:10px;}

/* HEADER */
.header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--border);position:relative;z-index:20;}
.header-logo{font-size:24px;}
.header-name{font-size:16px;font-weight:700;flex:1;}
.dots-btn{background:none;border:none;color:var(--text);cursor:pointer;font-size:22px;padding:6px;border-radius:10px;}
.new-chat-btn{background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);cursor:pointer;font-size:13px;font-weight:600;padding:8px 14px;display:flex;align-items:center;gap:6px;}

/* DROPDOWN */
.dropdown{position:absolute;top:56px;right:12px;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:8px;min-width:210px;z-index:100;box-shadow:0 8px 32px #0008;animation:fadeIn .15s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
.drop-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;transition:background .15s;}
.drop-item:hover{background:var(--surface2);}
.drop-item.danger{color:#ef4444;}
.drop-divider{height:1px;background:var(--border);margin:4px 0;}
.drop-user{padding:12px 14px;}
.drop-name{font-size:15px;font-weight:700;}
.drop-email{font-size:11px;color:var(--muted);margin-top:2px;}
.premium-tag{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-top:4px;display:inline-block;}

/* USAGE BAR */
.usage-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 16px;background:var(--surface);border-bottom:1px solid var(--border);font-size:11px;color:var(--muted);}
.usage-pill{background:var(--surface2);border-radius:20px;padding:3px 10px;font-weight:600;}

/* CHAT */
.chat-area{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:16px;scroll-behavior:smooth;}
.chat-area::-webkit-scrollbar{width:0;}
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:32px 20px;}
.welcome-icon{font-size:56px;}
.welcome h2{font-size:22px;font-weight:700;}
.welcome p{font-size:14px;color:var(--muted);}
.msg-wrap{display:flex;flex-direction:column;gap:4px;animation:slideUp .25s ease;}
@keyframes slideUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.msg-row{display:flex;gap:8px;align-items:flex-end;}
.msg-row.user{flex-direction:row-reverse;}
.bubble{max-width:80%;padding:12px 16px;font-size:14px;line-height:1.65;word-break:break-word;white-space:pre-wrap;}
.bubble.user{background:#f97316;color:#fff;border-radius:20px 20px 4px 20px;}
.bubble.ai{background:#1e1e1e;color:var(--text);border:1px solid var(--border);border-radius:20px 20px 20px 4px;}
.msg-time{font-size:10px;color:var(--muted);padding:0 4px;}
.msg-time.user{text-align:right;}
.ai-av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.typing-bubble{background:#1e1e1e;border:1px solid var(--border);border-radius:20px 20px 20px 4px;padding:14px 18px;display:flex;gap:5px;}
.dot{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:bounce 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}
.dot:nth-child(3){animation-delay:.4s;}
@keyframes bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-6px);}}

/* INPUT */
.input-bar{padding:10px 14px;border-top:1px solid var(--border);background:var(--bg);display:flex;gap:10px;align-items:flex-end;}
.msg-input{flex:1;background:var(--surface);border:1.5px solid var(--border);border-radius:24px;color:var(--text);font-family:'Inter',sans-serif;font-size:14px;padding:12px 18px;outline:none;resize:none;max-height:120px;min-height:48px;transition:border-color .2s;line-height:1.5;}
.msg-input:focus{border-color:var(--accent);}
.send{background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:18px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;}
.send:disabled{opacity:.4;cursor:not-allowed;}

/* PAGES */
.page{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
.page-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}
.page-title{font-size:18px;font-weight:700;}
.hist-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:border-color .2s;}
.hist-card:hover{border-color:var(--accent);}
.hist-info{flex:1;overflow:hidden;}
.hist-title{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hist-meta{font-size:11px;color:var(--muted);margin-top:2px;}
.del-btn{background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:4px 6px;border-radius:8px;}
.del-btn:hover{color:#ef4444;}
.set-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:4px;}
.set-row{display:flex;align-items:center;gap:14px;padding:15px 16px;border-bottom:1px solid var(--border);cursor:pointer;}
.set-row:last-child{border-bottom:none;}
.set-icon{font-size:20px;width:28px;text-align:center;}
.set-text{flex:1;}
.set-label{font-size:14px;font-weight:600;}
.set-desc{font-size:12px;color:var(--muted);margin-top:2px;}
.section-lbl{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin:12px 0 6px;}
.badge{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
.premium-card{background:linear-gradient(135deg,#f97316,#ea580c);border-radius:16px;padding:18px;margin-bottom:4px;cursor:pointer;}
.premium-card h3{font-size:18px;font-weight:700;color:#fff;}
.premium-card p{font-size:13px;color:#fff9;margin-top:4px;}
.pf{font-size:13px;color:#fff;display:flex;align-items:center;gap:8px;margin-top:6px;}

/* ADMIN */
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;}
.stat-val{font-size:30px;font-weight:800;color:var(--accent);}
.stat-lbl{font-size:12px;color:var(--muted);margin-top:2px;}
.user-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;}
.user-av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:15px;flex-shrink:0;}

/* MODAL */
.modal-bg{position:fixed;inset:0;background:#000a;z-index:200;display:flex;align-items:flex-end;padding:16px;}
.modal{background:var(--surface);border-radius:24px 24px 16px 16px;padding:28px 24px;width:100%;max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:14px;}
.modal h3{font-size:20px;font-weight:700;text-align:center;}
.modal p{font-size:14px;color:var(--muted);text-align:center;line-height:1.6;}
.modal-icon{font-size:52px;text-align:center;}
.loading{display:flex;align-items:center;justify-content:center;padding:20px;color:var(--muted);font-size:14px;gap:10px;}
`;

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
  const [histories, setHistories] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [userData, setUserData] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const bottomRef = useRef(null);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) setUserData(userDoc.data());
      } else {
        setUser(null);
        setUserData(null);
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  // Load histories when page changes
  useEffect(() => {
    if (user && page === "history") loadHistories();
    if (user && page === "admin") loadAdminUsers();
  }, [user, page]);

  async function loadHistories() {
    const q = query(collection(db, "chats"), where("userId", "==", user.uid), orderBy("updatedAt", "desc"));
    const snap = await getDocs(q);
    setHistories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function loadAdminUsers() {
    const snap = await getDocs(collection(db, "users"));
    setAdminUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function handleAuth() {
    setFormErr("");
    if (!form.email || !form.pass) { setFormErr("Please fill all fields!"); return; }
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
      const msgs = {
        "auth/email-already-in-use": "Email already registered!",
        "auth/invalid-email": "Invalid email!",
        "auth/wrong-password": "Wrong password!",
        "auth/user-not-found": "Account not found!",
        "auth/weak-password": "Password too weak! Min 6 chars.",
        "auth/invalid-credential": "Wrong email or password!"
      };
      setFormErr(msgs[e.code] || e.message);
    }
    setFormLoading(false);
  }

  async function sendMsg(text) {
    const txt = text || input.trim();
    if (!txt || loading) return;
    // Check usage limit
    const ud = userData;
    if (!ud?.premium && (ud?.usageCount || 0) >= FREE_CHAT_LIMIT) {
      setShowLimit(true); return;
    }
    setInput("");
    const uMsgRef = await addDoc(collection(db, "messages"), {
      sessionId, userId: user.uid, role: "user", text: txt, createdAt: serverTimestamp()
    });
    const newMsgs = [...msgs, { id: uMsgRef.id, role: "user", text: txt, time: new Date() }];
    setMsgs(newMsgs);
    // Update/create session
    await setDoc(doc(db, "chats", sessionId), {
      userId: user.uid, title: txt.slice(0, 45),
      updatedAt: serverTimestamp(), createdAt: serverTimestamp()
    }, { merge: true });
    // Update usage
    const newCount = (ud?.usageCount || 0) + 1;
    await setDoc(doc(db, "users", user.uid), { usageCount: newCount }, { merge: true });
    setUserData(prev => ({ ...prev, usageCount: newCount }));
    setLoading(true);
    try {
      const aiText = await askAI(newMsgs);
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
      setLoading(false);
      setMsgs(prev => [...prev, { id: Date.now(), role: "ai", text: "❌ Error: " + e.message, time: new Date() }]);
    }
  }

  async function loadSession(session) {
    setSessionId(session.id);
    const q = query(collection(db, "messages"), where("sessionId", "==", session.id), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data(), time: d.data().createdAt })));
    setPage("chat");
  }

  async function deleteSession(sessionId) {
    await deleteDoc(doc(db, "chats", sessionId));
    setHistories(prev => prev.filter(h => h.id !== sessionId));
  }

  function newChat() {
    setSessionId(Date.now().toString());
    setMsgs([]);
    setPage("chat");
    setShowMenu(false);
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

  // AUTH SCREEN
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
              <input className="inp" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
          )}
          <div className="inp-wrap">
            <div className="inp-label">EMAIL</div>
            <input className="inp" type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="inp-wrap">
            <div className="inp-label">PASSWORD</div>
            <input className="inp" type="password" placeholder="••••••••" value={form.pass} onChange={e => setForm(f => ({ ...f, pass: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAuth()} />
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

      {/* HEADER */}
      <div className="header">
        <div className="header-logo">🪷</div>
        <div className="header-name">Saraswati AI</div>
        {page === "chat" && <button className="new-chat-btn" onClick={newChat}>✏️ New</button>}
        <button className="dots-btn" onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}>⋯</button>
      </div>

      {/* DROPDOWN */}
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
          <div className="drop-item" onClick={() => { setPage("settings"); setShowMenu(false); }}>⚙️ Settings</div>
          {isAdmin && <div className="drop-item" onClick={() => { setPage("admin"); setShowMenu(false); }}>🛡️ Admin Panel</div>}
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

      {/* CHAT PAGE */}
      {page === "chat" && (
        <>
          <div className="chat-area">
            {msgs.length === 0 && (
              <div className="welcome">
                <div className="welcome-icon">🪷</div>
                <h2>Saraswati AI</h2>
                <p>Hey! I'm Saraswati AI</p>
              </div>
            )}
            {msgs.map(m => (
              <div key={m.id} className="msg-wrap">
                <div className={`msg-row ${m.role}`}>
                  {m.role === "ai" && <div className="ai-av">🪷</div>}
                  <div className={`bubble ${m.role}`}>
                    {m.role === "ai" ? <AIText text={m.text} /> : m.text}
                  </div>
                </div>
                <div className={`msg-time ${m.role}`}>{fmtTime(m.time)}</div>
              </div>
            ))}
            {loading && (
              <div className="msg-row">
                <div className="ai-av">🪷</div>
                <div className="typing-bubble"><div className="dot"/><div className="dot"/><div className="dot"/></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="input-bar">
            <textarea className="msg-input" placeholder="Ask me anything..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} rows={1} />
            <button className="send" onClick={() => sendMsg()} disabled={!input.trim() || loading}>➤</button>
          </div>
        </>
      )}

      {/* HISTORY */}
      {page === "history" && (
        <div className="page">
          <div className="page-top">
            <div className="page-title">📂 History</div>
          </div>
          {histories.length === 0
            ? <div className="welcome"><div className="welcome-icon">📭</div><h2>No history yet</h2><p>Start chatting!</p></div>
            : histories.map(h => (
              <div key={h.id} className="hist-card" onClick={() => loadSession(h)}>
                <div style={{fontSize:20}}>💬</div>
                <div className="hist-info">
                  <div className="hist-title">{h.title}</div>
                  <div className="hist-meta">{fmtDate(h.updatedAt)}</div>
                </div>
                <button className="del-btn" onClick={e => { e.stopPropagation(); deleteSession(h.id); }}>🗑️</button>
              </div>
            ))}
        </div>
      )}

      {/* SETTINGS */}
      {page === "settings" && (
        <div className="page">
          {!userData?.premium && (
            <div className="premium-card" onClick={() => setShowUpgrade(true)}>
              <h3>⭐ Upgrade to Premium</h3>
              <p>Unlimited chats, No Ads, Faster AI</p>
              <div className="pf">✅ Unlimited Chats</div>
              <div className="pf">✅ No Ads</div>
              <div className="pf">✅ Priority AI Response</div>
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

      {/* ADMIN */}
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
              {u.email === ADMIN_EMAIL && <div className="badge">ADMIN</div>}
            </div>
          ))}
        </div>
      )}

      {/* LIMIT MODAL */}
      {showLimit && (
        <div className="modal-bg" onClick={() => setShowLimit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">⏳</div>
            <h3>Free Limit Reached!</h3>
            <p>You've used all {FREE_CHAT_LIMIT} free chats.<br/>Upgrade to Premium for unlimited access!</p>
            <button className="btn btn-primary" onClick={() => { setShowLimit(false); setShowUpgrade(true); }}>⭐ Upgrade — ₹99/month</button>
            <button className="btn btn-secondary" onClick={() => setShowLimit(false)}>Maybe later</button>
          </div>
        </div>
      )}

      {/* UPGRADE MODAL */}
      {showUpgrade && (
        <div className="modal-bg" onClick={() => setShowUpgrade(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">⭐</div>
            <h3>Saraswati AI Premium</h3>
            <p>Just ₹99/month for unlimited access!</p>
            <div style={{background:"var(--surface2)",borderRadius:12,padding:"14px 16px",display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontSize:14,display:"flex",gap:8}}>✅ <span>Unlimited Chats</span></div>
              <div style={{fontSize:14,display:"flex",gap:8}}>✅ <span>No Ads</span></div>
              <div style={{fontSize:14,display:"flex",gap:8}}>✅ <span>Faster AI Response</span></div>
              <div style={{fontSize:14,display:"flex",gap:8}}>✅ <span>Premium Badge</span></div>
            </div>
            <button className="btn btn-primary" onClick={async () => {
              await setDoc(doc(db, "users", user.uid), { premium: true }, { merge: true });
              setUserData(prev => ({ ...prev, premium: true }));
              setShowUpgrade(false);
              alert("🎉 Welcome to Premium! Enjoy unlimited chats!");
            }}>🚀 Upgrade Now — ₹99/month</button>
            <button className="btn btn-secondary" onClick={() => setShowUpgrade(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

