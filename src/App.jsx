import { useState, useEffect, useRef } from "react";

const GROQ_API_KEY = "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";
const ADMIN_EMAIL = "kunalsaraswat691@gmail.com";
const FREE_CHAT_LIMIT = 49;
const COOLDOWN_HOURS = 2;

// ── AUTH ──────────────────────────────────────────────────────
const Auth = {
  getUsers: () => JSON.parse(localStorage.getItem("sw_users") || "[]"),
  saveUsers: (u) => localStorage.setItem("sw_users", JSON.stringify(u)),
  getCurrent: () => JSON.parse(localStorage.getItem("sw_user") || "null"),
  setCurrent: (u) => localStorage.setItem("sw_user", JSON.stringify(u)),
  logout: () => localStorage.removeItem("sw_user"),
  signup(name, email, pass) {
    const users = this.getUsers();
    if (users.find(u => u.email === email)) return { error: "Email already registered!" };
    const user = { id: Date.now().toString(), name, email, pass: btoa(pass), premium: false, createdAt: new Date().toISOString() };
    users.push(user);
    this.saveUsers(users);
    this.setCurrent({ id: user.id, name, email, premium: false });
    return { user };
  },
  login(email, pass) {
    const users = this.getUsers();
    const user = users.find(u => u.email === email && u.pass === btoa(pass));
    if (!user) return { error: "Wrong email or password!" };
    this.setCurrent({ id: user.id, name: user.name, email, premium: user.premium || false });
    return { user };
  },
  upgradePremium(userId) {
    const users = this.getUsers();
    const u = users.find(u => u.id === userId);
    if (u) { u.premium = true; this.saveUsers(users); }
    const cur = this.getCurrent();
    if (cur) { cur.premium = true; this.setCurrent(cur); }
  }
};

// ── USAGE ─────────────────────────────────────────────────────
const Usage = {
  get: (uid) => JSON.parse(localStorage.getItem(`sw_usage_${uid}`) || '{"count":0,"resetAt":null}'),
  save: (uid, data) => localStorage.setItem(`sw_usage_${uid}`, JSON.stringify(data)),
  canChat(uid, premium) {
    if (premium) return { ok: true };
    const d = this.get(uid);
    if (d.resetAt && new Date() > new Date(d.resetAt)) {
      this.save(uid, { count: 0, resetAt: null });
      return { ok: true };
    }
    if (d.count >= FREE_CHAT_LIMIT) {
      const diff = d.resetAt ? Math.ceil((new Date(d.resetAt) - new Date()) / 60000) : 0;
      return { ok: false, mins: diff };
    }
    return { ok: true, left: FREE_CHAT_LIMIT - d.count };
  },
  increment(uid) {
    const d = this.get(uid);
    d.count = (d.count || 0) + 1;
    if (d.count >= FREE_CHAT_LIMIT && !d.resetAt) {
      d.resetAt = new Date(Date.now() + COOLDOWN_HOURS * 3600000).toISOString();
    }
    this.save(uid, d);
  }
};

// ── CHAT STORE ────────────────────────────────────────────────
const CS = {
  get: (uid) => JSON.parse(localStorage.getItem(`sw_chats_${uid}`) || "[]"),
  save: (uid, c) => localStorage.setItem(`sw_chats_${uid}`, JSON.stringify(c)),
  addMsg(uid, sid, role, text) {
    const chats = this.get(uid);
    const msg = { id: Date.now(), role, text, time: new Date().toISOString() };
    const s = chats.find(s => s.id === sid);
    if (s) { s.msgs.push(msg); s.updatedAt = msg.time; }
    else chats.unshift({ id: sid, title: text.slice(0, 45), msgs: [msg], createdAt: msg.time, updatedAt: msg.time });
    this.save(uid, chats);
    return msg;
  },
  delSession(uid, sid) { this.save(uid, this.get(uid).filter(s => s.id !== sid)); },
  clearAll(uid) { localStorage.removeItem(`sw_chats_${uid}`); }
};

// ── GROQ API ──────────────────────────────────────────────────
async function askAI(messages) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ_API_KEY },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "Tum Saraswati AI ho — ek helpful, smart aur friendly AI assistant. User jis bhi language mein baat kare — Hindi, English, Marathi, Punjabi, Urdu, Bengali, Tamil, Telugu, Gujarati, Kannada, ya koi bhi bhasha — tum usi language mein jawab do. Hamesha warm, helpful aur accurate raho." },
        ...messages.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }))
      ],
      max_tokens: 1024
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "Koi response nahi mila.";
}

// ── STYLES ────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#0f0f0f;--surface:#1a1a1a;--surface2:#222;--border:#2a2a2a;
  --accent:#f97316;--accent2:#fb923c;--text:#f5f5f5;--muted:#6b7280;
  --user:#f97316;--ai:#1e1e1e;--radius:18px;
}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);height:100dvh;overflow:hidden;}
.app{display:flex;flex-direction:column;height:100dvh;max-width:480px;margin:0 auto;background:var(--bg);position:relative;}

/* AUTH */
.auth{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;gap:20px;background:radial-gradient(ellipse at 50% -10%,#f9731620 0%,transparent 60%);}
.auth-logo{font-size:52px;}
.auth-title{font-size:26px;font-weight:700;color:#fff;}
.auth-sub{font-size:13px;color:var(--muted);text-align:center;}
.auth-card{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:14px;}
.auth-head{font-size:18px;font-weight:700;text-align:center;}
.inp-wrap{display:flex;flex-direction:column;gap:5px;}
.inp-label{font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.05em;}
.inp{background:#111;border:1.5px solid var(--border);border-radius:12px;color:var(--text);font-family:'Inter',sans-serif;font-size:15px;padding:13px 14px;outline:none;width:100%;transition:border-color .2s;}
.inp:focus{border-color:var(--accent);}
.btn{border:none;border-radius:12px;cursor:pointer;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;padding:14px;transition:all .2s;width:100%;}
.btn-primary{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;}
.btn-primary:hover{opacity:.9;transform:translateY(-1px);}
.btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border);}
.btn-danger{background:#ef4444;color:#fff;}
.btn-sm{padding:8px 14px;font-size:13px;width:auto;border-radius:10px;}
.auth-switch{font-size:13px;color:var(--muted);text-align:center;}
.auth-switch span{color:var(--accent2);cursor:pointer;font-weight:600;}
.err{color:#ef4444;font-size:13px;text-align:center;background:#ef444415;padding:10px;border-radius:10px;}

/* HEADER */
.header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--border);position:relative;z-index:20;}
.header-logo{font-size:24px;}
.header-info{flex:1;}
.header-name{font-size:16px;font-weight:700;}

.dots-btn{background:none;border:none;color:var(--text);cursor:pointer;font-size:22px;padding:6px;border-radius:10px;transition:background .2s;}
.dots-btn:hover{background:var(--surface2);}

/* DROPDOWN MENU */
.dropdown{position:absolute;top:56px;right:12px;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:8px;min-width:200px;z-index:100;box-shadow:0 8px 32px #0008;animation:fadeIn .15s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
.drop-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;transition:background .15s;}
.drop-item:hover{background:var(--surface2);}
.drop-item.danger{color:#ef4444;}
.drop-divider{height:1px;background:var(--border);margin:4px 0;}
.drop-user{padding:12px 14px;border-radius:10px;}
.drop-name{font-size:15px;font-weight:700;}
.drop-email{font-size:11px;color:var(--muted);margin-top:2px;}
.premium-tag{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-top:4px;display:inline-block;}

/* CHAT */
.chat-area{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:16px;scroll-behavior:smooth;}
.chat-area::-webkit-scrollbar{width:0;}
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:32px 20px;}
.welcome-icon{font-size:56px;}
.welcome h2{font-size:22px;font-weight:700;}
.welcome p{font-size:13px;color:var(--muted);line-height:1.6;}
.suggestions{display:flex;flex-direction:column;gap:8px;width:100%;margin-top:8px;}
.sug{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:11px 14px;font-size:13px;color:var(--text);cursor:pointer;text-align:left;transition:all .2s;font-family:'Inter',sans-serif;}
.sug:hover{border-color:var(--accent);color:var(--accent2);}

/* MESSAGES */
.msg-wrap{display:flex;flex-direction:column;gap:4px;animation:slideUp .25s ease;}
@keyframes slideUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.msg-row{display:flex;gap:8px;align-items:flex-end;}
.msg-row.user{flex-direction:row-reverse;}
.bubble{max-width:80%;padding:12px 16px;font-size:14px;line-height:1.65;word-break:break-word;white-space:pre-wrap;}
.bubble.user{background:var(--user);color:#fff;border-radius:20px 20px 4px 20px;}
.bubble.ai{background:var(--ai);color:var(--text);border:1px solid var(--border);border-radius:20px 20px 20px 4px;}
.msg-time{font-size:10px;color:var(--muted);padding:0 4px;font-variant-numeric:tabular-nums;}
.msg-time.user{text-align:right;}
.ai-av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.typing-bubble{background:var(--ai);border:1px solid var(--border);border-radius:20px 20px 20px 4px;padding:14px 18px;display:flex;gap:5px;width:fit-content;}
.dot{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:bounce 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}
.dot:nth-child(3){animation-delay:.4s;}
@keyframes bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-6px);}}

/* INPUT */
.input-bar{padding:10px 14px;border-top:1px solid var(--border);background:var(--bg);display:flex;gap:10px;align-items:flex-end;}
.msg-input{flex:1;background:var(--surface);border:1.5px solid var(--border);border-radius:24px;color:var(--text);font-family:'Inter',sans-serif;font-size:14px;padding:12px 18px;outline:none;resize:none;max-height:120px;min-height:48px;transition:border-color .2s;line-height:1.5;}
.msg-input:focus{border-color:var(--accent);}
.send{background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:18px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;}
.send:hover{transform:scale(1.05);}
.send:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.usage-bar{padding:6px 16px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--muted);}
.usage-pill{background:var(--surface2);border-radius:20px;padding:3px 10px;font-weight:600;}

/* HISTORY PAGE */
.page{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
.page-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}
.page-title{font-size:18px;font-weight:700;}
.hist-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all .2s;}
.hist-card:hover{border-color:var(--accent);}
.hist-info{flex:1;overflow:hidden;}
.hist-title{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hist-meta{font-size:11px;color:var(--muted);margin-top:2px;}
.del-btn{background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:4px 6px;border-radius:8px;transition:all .2s;}
.del-btn:hover{color:#ef4444;background:#ef444415;}

/* SETTINGS */
.set-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:4px;}
.set-row{display:flex;align-items:center;gap:14px;padding:15px 16px;border-bottom:1px solid var(--border);}
.set-row:last-child{border-bottom:none;}
.set-icon{font-size:20px;width:28px;text-align:center;}
.set-text{flex:1;}
.set-label{font-size:14px;font-weight:600;}
.set-desc{font-size:12px;color:var(--muted);margin-top:2px;}
.section-lbl{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin:16px 0 6px;}

/* PREMIUM CARD */
.premium-card{background:linear-gradient(135deg,#f97316,#ea580c);border-radius:16px;padding:18px;margin-bottom:4px;cursor:pointer;}
.premium-card h3{font-size:18px;font-weight:700;color:#fff;}
.premium-card p{font-size:13px;color:#fff9;margin-top:4px;}
.premium-features{display:flex;flex-direction:column;gap:6px;margin-top:12px;}
.pf{font-size:13px;color:#fff;display:flex;align-items:center;gap:8px;}

/* LIMIT MODAL */
.modal-bg{position:fixed;inset:0;background:#000a;z-index:200;display:flex;align-items:flex-end;padding:16px;}
.modal{background:var(--surface);border-radius:24px 24px 16px 16px;padding:28px 24px;width:100%;max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:14px;}
.modal h3{font-size:20px;font-weight:700;text-align:center;}
.modal p{font-size:14px;color:var(--muted);text-align:center;line-height:1.6;}
.modal-icon{font-size:52px;text-align:center;}

/* ADMIN */
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px;}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;}
.stat-val{font-size:30px;font-weight:800;color:var(--accent);}
.stat-lbl{font-size:12px;color:var(--muted);margin-top:2px;}
.user-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;}
.user-av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#ea580c);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:15px;flex-shrink:0;}
.user-info{flex:1;}
.user-name{font-size:14px;font-weight:600;}
.user-email{font-size:11px;color:var(--muted);}
.badge{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;}
.admin-note{background:#f9731615;border:1px solid var(--accent);border-radius:12px;padding:12px 14px;font-size:13px;color:var(--accent2);margin-bottom:4px;}

/* NEW CHAT BTN */
.new-chat-btn{background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);cursor:pointer;font-size:13px;font-weight:600;padding:8px 14px;display:flex;align-items:center;gap:6px;transition:all .2s;}
.new-chat-btn:hover{border-color:var(--accent);}
`;

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// AI Text renderer — bold, code, lists support
function AIText({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <span style={{display:"flex",flexDirection:"column",gap:4}}>
      {lines.map((line, i) => {
        if (!line.trim()) return <span key={i} style={{height:6}} />;
        // Bold: **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) => {
          if (p.startsWith("**") && p.endsWith("**"))
            return <strong key={j}>{p.slice(2,-2)}</strong>;
          // Inline code: `code`
          const codeParts = p.split(/(`[^`]+`)/g).map((c, k) => {
            if (c.startsWith("`") && c.endsWith("`"))
              return <code key={k} style={{background:"#ffffff18",borderRadius:4,padding:"1px 6px",fontFamily:"monospace",fontSize:12}}>{c.slice(1,-1)}</code>;
            return c;
          });
          return <span key={j}>{codeParts}</span>;
        });
        // List items
        if (line.trim().startsWith("- ") || line.trim().startsWith("• "))
          return <span key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}><span style={{color:"#f97316",marginTop:2}}>•</span><span>{parts}</span></span>;
        // Numbered list
        if (/^\d+\.\s/.test(line.trim()))
          return <span key={i} style={{display:"flex",gap:8}}><span style={{color:"#f97316",minWidth:16}}>{line.match(/^\d+/)[0]}.</span><span>{parts}</span></span>;
        // Heading: ### 
        if (line.startsWith("### "))
          return <strong key={i} style={{fontSize:15,color:"#f97316"}}>{line.slice(4)}</strong>;
        if (line.startsWith("## "))
          return <strong key={i} style={{fontSize:16,color:"#f97316"}}>{line.slice(3)}</strong>;
        return <span key={i}>{parts}</span>;
      })}
    </span>
  );
}

export default function App() {
  const [user, setUser] = useState(Auth.getCurrent);
  const [page, setPage] = useState("chat");
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", pass: "" });
  const [formErr, setFormErr] = useState("");
  const [sessionId, setSessionId] = useState(() => Date.now().toString());
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [histories, setHistories] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const [limitMins, setLimitMins] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);
  useEffect(() => { if (user) setHistories(CS.get(user.id)); }, [user, page]);

  const isAdmin = user?.email === ADMIN_EMAIL;
  const allUsers = Auth.getUsers();
  const totalChats = allUsers.reduce((s, u) => s + CS.get(u.id).length, 0);

  function handleAuth() {
    setFormErr("");
    if (!form.email || !form.pass) { setFormErr("Please fill all fields!"); return; }
    if (authMode === "signup" && !form.name) { setFormErr("Please enter your name!"); return; }
    const res = authMode === "signup"
      ? Auth.signup(form.name, form.email, form.pass)
      : Auth.login(form.email, form.pass);
    if (res.error) { setFormErr(res.error); return; }
    setUser(Auth.getCurrent());
    setForm({ name: "", email: "", pass: "" });
  }

  async function sendMsg(text) {
    const txt = text || input.trim();
    if (!txt || loading) return;
    const check = Usage.canChat(user.id, user.premium);
    if (!check.ok) { setLimitMins(check.mins); setShowLimit(true); return; }
    setInput("");
    const uMsg = CS.addMsg(user.id, sessionId, "user", txt);
    const newMsgs = [...msgs, { ...uMsg, role: "user" }];
    setMsgs(newMsgs);
    setLoading(true);
    Usage.increment(user.id);
    try {
      const aiText = await askAI(newMsgs);
      // Typing effect — stream text char by char
      const tempId = Date.now();
      setLoading(false);
      setMsgs(prev => [...prev, { id: tempId, role: "ai", text: "", time: new Date().toISOString() }]);
      let displayed = "";
      for (let i = 0; i < aiText.length; i++) {
        displayed += aiText[i];
        const snap = displayed;
        setMsgs(prev => prev.map(m => m.id === tempId ? { ...m, text: snap } : m));
        await new Promise(r => setTimeout(r, 8));
      }
      CS.addMsg(user.id, sessionId, "ai", aiText);
    } catch (e) {
      setLoading(false);
      const eMsg = CS.addMsg(user.id, sessionId, "ai", "❌ Error: " + e.message);
      setMsgs(prev => [...prev, { ...eMsg, role: "ai" }]);
    }
    setHistories(CS.get(user.id));
  }

  function newChat() {
    setSessionId(Date.now().toString());
    setMsgs([]);
    setPage("chat");
    setShowMenu(false);
  }

  function loadSession(s) {
    setSessionId(s.id);
    setMsgs(s.msgs);
    setPage("chat");
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  }

  const usage = user ? Usage.get(user.id) : null;
  const chatsLeft = user && !user.premium ? Math.max(0, FREE_CHAT_LIMIT - (usage?.count || 0)) : null;

  // ── AUTH SCREEN ───────────────────────────────────────────
  if (!user) return (
    <div className="app">
      <style>{css}</style>
      <div className="auth">
        <div className="auth-logo">🪷</div>
        <div className="auth-title">Saraswati AI</div>
        <div className="auth-sub">Intelligent AI — Hindi, English, aur 10+ bhashao mein</div>
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
          <button className="btn btn-primary" onClick={handleAuth}>{authMode === "login" ? "Login →" : "Create Account →"}</button>
        </div>
        <div className="auth-switch">
          {authMode === "login"
            ? <>Don't have an account? <span onClick={() => { setAuthMode("signup"); setFormErr(""); }}>Sign up</span></>
            : <>Already have an account? <span onClick={() => { setAuthMode("login"); setFormErr(""); }}>Login</span></>}
        </div>
      </div>
    </div>
  );

  // ── MAIN APP ─────────────────────────────────────────────
  return (
    <div className="app" onClick={() => showMenu && setShowMenu(false)}>
      <style>{css}</style>

      {/* HEADER */}
      <div className="header">
        <div className="header-logo">🪷</div>
        <div className="header-info">
          <div className="header-name">Saraswati AI</div>

        </div>
        {page === "chat" && (
          <button className="new-chat-btn" onClick={newChat}>✏️ New</button>
        )}
        <button className="dots-btn" onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}>⋯</button>
      </div>

      {/* DROPDOWN MENU */}
      {showMenu && (
        <div className="dropdown" onClick={e => e.stopPropagation()}>
          <div className="drop-user">
            <div className="drop-name">{user.name}</div>
            <div className="drop-email">{user.email}</div>
            {user.premium && <div className="premium-tag">⭐ PREMIUM</div>}
          </div>
          <div className="drop-divider" />
          <div className="drop-item" onClick={() => { setPage("chat"); setShowMenu(false); }}>💬 Chat</div>
          <div className="drop-item" onClick={() => { setPage("history"); setShowMenu(false); }}>📂 History</div>
          <div className="drop-item" onClick={() => { setPage("settings"); setShowMenu(false); }}>⚙️ Settings</div>
          {isAdmin && <div className="drop-item" onClick={() => { setPage("admin"); setShowMenu(false); }}>🛡️ Admin Panel</div>}
          <div className="drop-divider" />
          {!user.premium && <div className="drop-item" onClick={() => { setShowUpgrade(true); setShowMenu(false); }}>⭐ Upgrade to Premium</div>}
          <div className="drop-item danger" onClick={() => { Auth.logout(); setUser(null); setShowMenu(false); }}>🚪 Logout</div>
        </div>
      )}

      {/* USAGE BAR */}
      {page === "chat" && !user.premium && (
        <div className="usage-bar">
          <span>Free Plan</span>
          <span className="usage-pill">{chatsLeft} chats left</span>
        </div>
      )}
      {page === "chat" && user.premium && (
        <div className="usage-bar">
          <span>⭐ Premium</span>
          <span className="usage-pill">Unlimited</span>
        </div>
      )}

      {/* CHAT PAGE */}
      {page === "chat" && (
        <>
          <div className="chat-area">
            {msgs.length === 0 ? (
              <div className="welcome">
                <div className="welcome-icon">🪷</div>
                <h2>Saraswati AI</h2>
                <p style={{color:"var(--muted)",fontSize:14,marginTop:4}}>Hey! I'm Saraswati AI</p>
              </div>
            ) : msgs.map(m => (
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

      {/* HISTORY PAGE */}
      {page === "history" && (
        <div className="page">
          <div className="page-top">
            <div className="page-title">📂 Chat History</div>
            {histories.length > 0 && <button className="btn btn-danger btn-sm" onClick={() => { CS.clearAll(user.id); setHistories([]); newChat(); }}>Clear All</button>}
          </div>
          {histories.length === 0 ? (
            <div className="welcome"><div className="welcome-icon">📭</div><h2>No history yet</h2><p>Start chatting!</p></div>
          ) : histories.map(h => (
            <div key={h.id} className="hist-card" onClick={() => loadSession(h)}>
              <div style={{ fontSize: 20 }}>💬</div>
              <div className="hist-info">
                <div className="hist-title">{h.title}</div>
                <div className="hist-meta">{h.msgs.length} messages · {fmtDate(h.updatedAt)}</div>
              </div>
              <button className="del-btn" onClick={e => { e.stopPropagation(); CS.delSession(user.id, h.id); setHistories(CS.get(user.id)); }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* SETTINGS PAGE */}
      {page === "settings" && (
        <div className="page">
          {!user.premium && (
            <div className="premium-card" onClick={() => setShowUpgrade(true)}>
              <h3>⭐ Upgrade to Premium</h3>
              <p>Unlimited chats, No Ads, Faster AI</p>
              <div className="premium-features">
                <div className="pf">✅ Unlimited Chats</div>
                <div className="pf">✅ No Ads</div>
                <div className="pf">✅ Priority AI Response</div>
                <div className="pf">✅ Premium Badge</div>
              </div>
            </div>
          )}
          <div className="section-lbl">Account</div>
          <div className="set-card">
            <div className="set-row">
              <div style={{width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#fff",flexShrink:0}}>{user.name?.[0]?.toUpperCase()}</div>
              <div className="set-text">
                <div className="set-label">{user.name}</div>
                <div className="set-desc">{user.email}</div>
              </div>
              {user.premium && <div className="badge">PREMIUM</div>}
              {isAdmin && <div className="badge">ADMIN</div>}
            </div>
            <div className="set-row">
              <div className="set-icon">📊</div>
              <div className="set-text">
                <div className="set-label">Usage</div>
                <div className="set-desc">{user.premium ? "Unlimited" : `${chatsLeft} free chats remaining`}</div>
              </div>
            </div>
          </div>
          <div className="section-lbl">Data</div>
          <div className="set-card">
            <div className="set-row" style={{ cursor: "pointer" }} onClick={() => { CS.clearAll(user.id); setHistories([]); newChat(); alert("History deleted!"); }}>
              <div className="set-icon">🗑️</div>
              <div className="set-text">
                <div className="set-label">Delete All History</div>
                <div className="set-desc">Permanently delete all chats</div>
              </div>
            </div>
            <div className="set-row" style={{ cursor: "pointer" }} onClick={() => { Auth.logout(); setUser(null); }}>
              <div className="set-icon">🚪</div>
              <div className="set-text">
                <div className="set-label" style={{ color: "#ef4444" }}>Logout</div>
                <div className="set-desc">Logout</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PAGE */}
      {page === "admin" && isAdmin && (
        <div className="page">
          <div className="admin-note">🛡️ Secret Admin Panel — Sirf tumhare liye</div>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-val">{allUsers.length}</div><div className="stat-lbl">Total Users</div></div>
            <div className="stat-card"><div className="stat-val">{totalChats}</div><div className="stat-lbl">Total Chats</div></div>
            <div className="stat-card"><div className="stat-val">{allUsers.filter(u => u.premium).length}</div><div className="stat-lbl">Premium Users</div></div>
            <div className="stat-card"><div className="stat-val">₹{allUsers.filter(u => u.premium).length * 99}</div><div className="stat-lbl">Revenue</div></div>
          </div>
          <div className="section-lbl">All Users</div>
          {allUsers.map(u => (
            <div key={u.id} className="user-card">
              <div className="user-av">{u.name?.[0]?.toUpperCase()}</div>
              <div className="user-info">
                <div className="user-name">{u.name}</div>
                <div className="user-email">{u.email}</div>
                <div className="user-email">{CS.get(u.id).length} chats</div>
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
            <p>Tumne {FREE_CHAT_LIMIT} free chats use kar li hain।<br />{limitMins > 0 ? `${limitMins} minutes remaining!` : `${COOLDOWN_HOURS} hours cooldown remaining!`}</p>
            <button className="btn btn-primary" onClick={() => { setShowLimit(false); setShowUpgrade(true); }}>⭐ Premium Lo — ₹99/month</button>
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
            <p>Sirf ₹99/month mein unlimited access!</p>
            <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, margin: "4px 0" }}>
              <div className="pf" style={{ color: "var(--text)" }}>✅ Unlimited Chats</div>
              <div className="pf" style={{ color: "var(--text)" }}>✅ No Ads</div>
              <div className="pf" style={{ color: "var(--text)" }}>✅ Faster AI Response</div>
              <div className="pf" style={{ color: "var(--text)" }}>✅ Premium Badge</div>
              <div className="pf" style={{ color: "var(--text)" }}>✅ Priority Support</div>
            </div>
            <button className="btn btn-primary" onClick={() => {
              Auth.upgradePremium(user.id);
              setUser(Auth.getCurrent());
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
