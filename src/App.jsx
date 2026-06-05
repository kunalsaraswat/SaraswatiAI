import { useState, useEffect, useRef } from "react";

// ============================================================
// CONFIG — apne keys yahan daalo
// ============================================================
const GROQ_API_KEY = "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";
const ADMIN_EMAIL = "kunalsaraswat691@gmail.com";

// ============================================================
// SIMPLE AUTH STORE (localStorage-based, no Firebase needed)
// ============================================================
const Auth = {
  getUsers: () => JSON.parse(localStorage.getItem("ai_users") || "[]"),
  saveUsers: (u) => localStorage.setItem("ai_users", JSON.stringify(u)),
  getCurrentUser: () => JSON.parse(localStorage.getItem("ai_current_user") || "null"),
  setCurrentUser: (u) => localStorage.setItem("ai_current_user", JSON.stringify(u)),
  logout: () => localStorage.removeItem("ai_current_user"),
  signup: (name, email, password) => {
    const users = Auth.getUsers();
    if (users.find(u => u.email === email)) return { error: "Email already exists!" };
    const user = { id: Date.now().toString(), name, email, password: btoa(password), createdAt: new Date().toISOString() };
    users.push(user);
    Auth.saveUsers(users);
    Auth.setCurrentUser({ id: user.id, name: user.name, email: user.email });
    return { user };
  },
  login: (email, password) => {
    const users = Auth.getUsers();
    const user = users.find(u => u.email === email && u.password === btoa(password));
    if (!user) return { error: "Invalid email or password!" };
    Auth.setCurrentUser({ id: user.id, name: user.name, email: user.email });
    return { user };
  },
};

// ============================================================
// CHAT STORE
// ============================================================
const ChatStore = {
  getChats: (userId) => JSON.parse(localStorage.getItem(`ai_chats_${userId}`) || "[]"),
  saveChats: (userId, chats) => localStorage.setItem(`ai_chats_${userId}`, JSON.stringify(chats)),
  addMessage: (userId, sessionId, role, text) => {
    const chats = ChatStore.getChats(userId);
    const session = chats.find(s => s.id === sessionId);
    const msg = { id: Date.now(), role, text, time: new Date().toISOString() };
    if (session) {
      session.messages.push(msg);
      session.updatedAt = msg.time;
    } else {
      chats.unshift({ id: sessionId, title: text.slice(0, 40), messages: [msg], createdAt: msg.time, updatedAt: msg.time });
    }
    ChatStore.saveChats(userId, chats);
    return msg;
  },
  deleteSession: (userId, sessionId) => {
    const chats = ChatStore.getChats(userId).filter(s => s.id !== sessionId);
    ChatStore.saveChats(userId, chats);
  },
  clearAll: (userId) => localStorage.removeItem(`ai_chats_${userId}`),
};

// ============================================================
// ANTHROPIC API CALL (built-in — no key needed!)
// ============================================================
async function askGemini(messages) {
  const msgs = messages.map(m => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.text
  }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: "Tum Saraswati AI ho — ek helpful, smart aur friendly AI assistant. Tum Hindi aur English dono mein jawab de sakte ho. Gyan ki devi ki tarah helpful raho. Hamesha warm aur caring raho.",
      messages: msgs
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text || "Koi response nahi mila.";
}

// ============================================================
// STYLES
// ============================================================
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0a0f;
    --surface: #12121a;
    --surface2: #1a1a26;
    --border: #2a2a40;
    --accent: #f59e0b;
    --accent2: #ef4444;
    --text: #f0ebe8;
    --muted: #9ca3af;
    --danger: #dc2626;
    --success: #10b981;
    --user-bubble: #b45309;
    --ai-bubble: #1a1a26;
    --radius: 16px;
    --font: 'Sora', sans-serif;
    --mono: 'JetBrains Mono', monospace;
  }
  body { font-family: var(--font); background: var(--bg); color: var(--text); min-height: 100vh; }
  .app { display: flex; flex-direction: column; height: 100dvh; max-width: 480px; margin: 0 auto; position: relative; overflow: hidden; background: var(--bg); }
  
  /* AUTH */
  .auth-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; gap: 24px; background: radial-gradient(ellipse at 50% 0%, #f59e0b22 0%, transparent 60%); }
  .auth-logo { font-size: 48px; margin-bottom: 4px; }
  .auth-title { font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #fbbf24, #ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .auth-sub { color: var(--muted); font-size: 14px; text-align: center; }
  .auth-card { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px 24px; display: flex; flex-direction: column; gap: 16px; }
  .input-group { display: flex; flex-direction: column; gap: 6px; }
  .input-group label { font-size: 12px; color: var(--muted); font-weight: 600; letter-spacing: 0.05em; }
  .inp { background: var(--bg); border: 1.5px solid var(--border); border-radius: 10px; color: var(--text); font-family: var(--font); font-size: 15px; padding: 12px 14px; outline: none; transition: border-color 0.2s; width: 100%; }
  .inp:focus { border-color: var(--accent); }
  .btn { border: none; border-radius: 10px; cursor: pointer; font-family: var(--font); font-size: 15px; font-weight: 600; padding: 13px 20px; transition: all 0.2s; width: 100%; }
  .btn-primary { background: linear-gradient(135deg, #f59e0b, #b45309); color: #fff; }
  .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
  .btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-sm { padding: 8px 14px; font-size: 13px; width: auto; border-radius: 8px; }
  .auth-switch { text-align: center; font-size: 14px; color: var(--muted); }
  .auth-switch span { color: var(--accent2); cursor: pointer; font-weight: 600; }
  .error-msg { color: var(--danger); font-size: 13px; text-align: center; background: #ef444420; padding: 10px; border-radius: 8px; }
  
  /* HEADER */
  .header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--border); background: var(--surface); position: relative; z-index: 10; }
  .header-title { flex: 1; font-size: 16px; font-weight: 700; }
  .header-sub { font-size: 11px; color: var(--success); font-weight: 400; }
  .icon-btn { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; color: var(--text); cursor: pointer; font-size: 18px; padding: 8px 10px; transition: all 0.2s; }
  .icon-btn:hover { background: var(--border); }
  .avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent2)); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: #fff; flex-shrink: 0; }
  
  /* CHAT */
  .chat-wrap { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; scroll-behavior: smooth; }
  .chat-wrap::-webkit-scrollbar { width: 4px; }
  .chat-wrap::-webkit-scrollbar-track { background: transparent; }
  .chat-wrap::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  .bubble-row { display: flex; gap: 10px; animation: fadeUp 0.3s ease; }
  .bubble-row.user { flex-direction: row-reverse; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .bubble { max-width: 78%; padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.6; word-break: break-word; white-space: pre-wrap; }
  .bubble.user { background: var(--user-bubble); color: #fff; border-bottom-right-radius: 4px; }
  .bubble.ai { background: var(--ai-bubble); color: var(--text); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
  .bubble-time { font-size: 10px; color: var(--muted); margin-top: 4px; font-family: var(--mono); }
  .ai-avatar { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #ef4444); display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; margin-top: 4px; }
  .typing { display: flex; gap: 5px; padding: 14px 16px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent2); animation: bounce 1.2s infinite; }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-8px); } }
  .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--muted); padding: 40px; text-align: center; }
  .empty-icon { font-size: 52px; }
  .empty-state h3 { font-size: 18px; color: var(--text); font-weight: 600; }
  .suggestions { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 8px; }
  .suggestion { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: var(--text); cursor: pointer; text-align: left; transition: all 0.2s; }
  .suggestion:hover { border-color: var(--accent); color: var(--accent2); }
  
  /* INPUT */
  .input-bar { padding: 12px 16px; border-top: 1px solid var(--border); background: var(--surface); display: flex; gap: 10px; align-items: flex-end; }
  .msg-inp { flex: 1; background: var(--surface2); border: 1.5px solid var(--border); border-radius: 12px; color: var(--text); font-family: var(--font); font-size: 14px; padding: 12px 14px; outline: none; resize: none; max-height: 120px; min-height: 44px; transition: border-color 0.2s; }
  .msg-inp:focus { border-color: var(--accent); }
  .send-btn { background: linear-gradient(135deg, #f59e0b, #b45309); border: none; border-radius: 12px; color: #fff; cursor: pointer; font-size: 20px; padding: 10px 14px; transition: all 0.2s; flex-shrink: 0; }
  .send-btn:hover { opacity: 0.9; transform: scale(1.05); }
  .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  
  /* BOTTOM NAV */
  .bottom-nav { display: flex; border-top: 1px solid var(--border); background: var(--surface); }
  .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 4px; cursor: pointer; font-size: 11px; color: var(--muted); transition: all 0.2s; border: none; background: none; }
  .nav-item.active { color: var(--accent2); }
  .nav-item .nav-icon { font-size: 20px; }
  
  /* HISTORY */
  .page-wrap { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .page-title { font-size: 18px; font-weight: 700; }
  .history-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: all 0.2s; }
  .history-card:hover { border-color: var(--accent); }
  .history-info { flex: 1; overflow: hidden; }
  .history-title { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .history-meta { font-size: 11px; color: var(--muted); margin-top: 2px; font-family: var(--mono); }
  .del-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 18px; padding: 4px; border-radius: 6px; transition: all 0.2s; }
  .del-btn:hover { color: var(--danger); background: #ef444420; }
  
  /* SETTINGS */
  .setting-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .setting-row { display: flex; align-items: center; gap: 14px; padding: 16px; border-bottom: 1px solid var(--border); }
  .setting-row:last-child { border-bottom: none; }
  .setting-icon { font-size: 22px; }
  .setting-text { flex: 1; }
  .setting-label { font-size: 14px; font-weight: 600; }
  .setting-desc { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .badge { background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
  
  /* ADMIN */
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
  .stat-val { font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #fbbf24, #ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-family: var(--mono); }
  .stat-label { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .user-row { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; }
  .user-info { flex: 1; }
  .user-email { font-size: 12px; color: var(--muted); }
  .section-title { font-size: 13px; font-weight: 700; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; margin-top: 16px; }
  
  /* PREMIUM BANNER */
  .premium-banner { background: linear-gradient(135deg, #f59e0b, #ef4444); border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; margin-bottom: 4px; }
  .premium-text { flex: 1; }
  .premium-title { font-weight: 700; font-size: 15px; }
  .premium-sub { font-size: 12px; opacity: 0.85; }
`;

// ============================================================
// HELPERS
// ============================================================
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [user, setUser] = useState(Auth.getCurrentUser);
  const [page, setPage] = useState("chat");
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [formErr, setFormErr] = useState("");
  const [sessionId, setSessionId] = useState(() => Date.now().toString());
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [histories, setHistories] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => { if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { if (user) setHistories(ChatStore.getChats(user.id)); }, [user, page]);

  const isAdmin = user?.email === ADMIN_EMAIL;

  function handleAuth() {
    setFormErr("");
    if (!form.email || !form.password) { setFormErr("Sabhi fields bharo!"); return; }
    const res = authMode === "signup"
      ? Auth.signup(form.name, form.email, form.password)
      : Auth.login(form.email, form.password);
    if (res.error) { setFormErr(res.error); return; }
    setUser(Auth.getCurrentUser());
    setForm({ name: "", email: "", password: "" });
  }

  async function sendMessage(text) {
    const txt = text || input.trim();
    if (!txt || loading) return;
    setInput("");
    const userMsg = ChatStore.addMessage(user.id, sessionId, "user", txt);
    const newMsgs = [...messages, { ...userMsg, role: "user" }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const aiText = await askGemini(newMsgs.map(m => ({ role: m.role, text: m.text })));
      const aiMsg = ChatStore.addMessage(user.id, sessionId, "ai", aiText);
      setMessages(prev => [...prev, { ...aiMsg, role: "ai" }]);
    } catch (e) {
      const errMsg = ChatStore.addMessage(user.id, sessionId, "ai", "❌ Error: " + e.message);
      setMessages(prev => [...prev, { ...errMsg, role: "ai" }]);
    }
    setLoading(false);
  }

  function loadSession(session) {
    setSessionId(session.id);
    setMessages(session.messages);
    setPage("chat");
  }

  function newChat() {
    setSessionId(Date.now().toString());
    setMessages([]);
    setPage("chat");
  }

  function deleteSession(id) {
    ChatStore.deleteSession(user.id, id);
    setHistories(ChatStore.getChats(user.id));
    if (id === sessionId) newChat();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // ---- AUTH SCREEN ----
  if (!user) return (
    <div className="app">
      <style>{css}</style>
      <div className="auth-wrap">
        <div className="auth-logo">🪷</div>
        <div className="auth-title">Saraswati AI</div>
        <div className="auth-sub">Apna intelligent AI assistant — free mein</div>
        <div className="auth-card">
          <div style={{ fontSize: 20, fontWeight: 700, textAlign: "center" }}>{authMode === "login" ? "Welcome Back 👋" : "Create Account ✨"}</div>
          {authMode === "signup" && (
            <div className="input-group">
              <label>Full Name</label>
              <input className="inp" placeholder="Tumhara naam" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
          )}
          <div className="input-group">
            <label>Email</label>
            <input className="inp" type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input className="inp" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAuth()} />
          </div>
          {formErr && <div className="error-msg">{formErr}</div>}
          <button className="btn btn-primary" onClick={handleAuth}>{authMode === "login" ? "Login →" : "Create Account →"}</button>
        </div>
        <div className="auth-switch">
          {authMode === "login" ? <>Account nahi hai? <span onClick={() => { setAuthMode("signup"); setFormErr(""); }}>Signup karo</span></> : <>Already account hai? <span onClick={() => { setAuthMode("login"); setFormErr(""); }}>Login karo</span></>}
        </div>
      </div>
    </div>
  );

  // ---- MAIN APP ----
  const allUsers = Auth.getUsers();
  const totalChats = allUsers.reduce((sum, u) => sum + ChatStore.getChats(u.id).length, 0);

  return (
    <div className="app">
      <style>{css}</style>

      {/* HEADER */}
      <div className="header">
        {page === "chat" ? (
          <>
            <div className="ai-avatar" style={{ width: 36, height: 36, fontSize: 18, marginTop: 0 }}>🪷</div>
            <div style={{ flex: 1 }}>
              <div className="header-title">Saraswati AI</div>
              <div className="header-sub">● Online — Ready</div>
            </div>
            <button className="icon-btn" onClick={newChat} title="New Chat">✏️</button>
          </>
        ) : (
          <>
            <div style={{ flex: 1 }} className="header-title">{page === "history" ? "📂 History" : page === "settings" ? "⚙️ Settings" : "🛡️ Admin"}</div>
            <div className="avatar">{user.name[0].toUpperCase()}</div>
          </>
        )}
      </div>

      {/* CHAT PAGE */}
      {page === "chat" && (
        <>
          <div className="chat-wrap">
            {messages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🪷</div>
                <h3>Namaste! Kya poochna chahte ho?</h3>
                <p style={{ fontSize: 13 }}>Main Saraswati AI hoon — Gyan ki devi. Kuch bhi poocho!</p>
                <div className="suggestions">
                  {["Mujhe Python sikhao 🐍", "Ek kahani likho 📖", "Mera CV improve karo 📄", "Koi joke sunao 😄"].map(s => (
                    <button key={s} className="suggestion" onClick={() => sendMessage(s)}>{s}</button>
                  ))}
                </div>
              </div>
            ) : messages.map(m => (
              <div key={m.id} className={`bubble-row ${m.role}`}>
                {m.role === "ai" && <div className="ai-avatar">🪷</div>}
                <div>
                  <div className={`bubble ${m.role}`}>{m.text}</div>
                  <div className="bubble-time">{fmtTime(m.time)}</div>
                </div>
                {m.role === "user" && <div className="avatar">{user.name[0].toUpperCase()}</div>}
              </div>
            ))}
            {loading && (
              <div className="bubble-row">
                <div className="ai-avatar">🪷</div>
                <div className="bubble ai"><div className="typing"><div className="dot" /><div className="dot" /><div className="dot" /></div></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="input-bar">
            <textarea className="msg-inp" placeholder="Kuch bhi poocho..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} rows={1} />
            <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim() || loading}>➤</button>
          </div>
        </>
      )}

      {/* HISTORY PAGE */}
      {page === "history" && (
        <div className="page-wrap">
          <div className="page-header">
            <div className="page-title">Chat History</div>
            {histories.length > 0 && <button className="btn btn-danger btn-sm" onClick={() => { ChatStore.clearAll(user.id); setHistories([]); newChat(); }}>Clear All</button>}
          </div>
          {histories.length === 0 ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <div className="empty-icon">📭</div>
              <h3>Koi history nahi</h3>
              <p style={{ fontSize: 13 }}>Abhi chat karo aur yahan save hogi!</p>
            </div>
          ) : histories.map(h => (
            <div key={h.id} className="history-card" onClick={() => loadSession(h)}>
              <div style={{ fontSize: 22 }}>💬</div>
              <div className="history-info">
                <div className="history-title">{h.title || "Chat"}</div>
                <div className="history-meta">{h.messages.length} msgs · {fmtDate(h.updatedAt)}</div>
              </div>
              <button className="del-btn" onClick={e => { e.stopPropagation(); deleteSession(h.id); }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* SETTINGS PAGE */}
      {page === "settings" && (
        <div className="page-wrap">
          <div className="premium-banner" onClick={() => alert("🚀 Premium coming soon! Unlimited AI, faster responses, priority support.")}>
            <div style={{ fontSize: 28 }}>⚡</div>
            <div className="premium-text">
              <div className="premium-title">Saraswati AI Premium</div>
              <div className="premium-sub">Unlimited chats · Priority AI · No ads</div>
            </div>
            <div className="badge">UPGRADE</div>
          </div>
          <div className="section-title">Account</div>
          <div className="setting-card">
            <div className="setting-row">
              <div className="setting-icon">👤</div>
              <div className="setting-text">
                <div className="setting-label">{user.name}</div>
                <div className="setting-desc">{user.email}</div>
              </div>
              {isAdmin && <div className="badge">ADMIN</div>}
            </div>
            <div className="setting-row">
              <div className="setting-icon">📊</div>
              <div className="setting-text">
                <div className="setting-label">Total Chats</div>
                <div className="setting-desc">{ChatStore.getChats(user.id).length} conversations saved</div>
              </div>
            </div>
          </div>
          <div className="section-title">App</div>
          <div className="setting-card">
            <div className="setting-row" style={{ cursor: "pointer" }} onClick={() => { ChatStore.clearAll(user.id); newChat(); alert("History delete ho gai!"); }}>
              <div className="setting-icon">🗑️</div>
              <div className="setting-text">
                <div className="setting-label">Delete All History</div>
                <div className="setting-desc">Saari chats permanently delete</div>
              </div>
            </div>
            <div className="setting-row" style={{ cursor: "pointer" }} onClick={() => { Auth.logout(); setUser(null); }}>
              <div className="setting-icon">🚪</div>
              <div className="setting-text">
                <div className="setting-label" style={{ color: "var(--danger)" }}>Logout</div>
                <div className="setting-desc">Account se bahar jao</div>
              </div>
            </div>
          </div>
          <div className="section-title">Monetization</div>
          <div className="setting-card">
            <div className="setting-row">
              <div className="setting-icon">💰</div>
              <div className="setting-text">
                <div className="setting-label">Ads by Google AdSense</div>
                <div className="setting-desc">Apna AdSense ID yahan add karo (code mein)</div>
              </div>
            </div>
            <div className="setting-row">
              <div className="setting-icon">🌟</div>
              <div className="setting-text">
                <div className="setting-label">Premium Subscription</div>
                <div className="setting-desc">Razorpay/PayPal se integrate karo</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PAGE */}
      {page === "admin" && isAdmin && (
        <div className="page-wrap">
          <div style={{ background: "linear-gradient(135deg,#f59e0b22,#ef444422)", border: "1px solid var(--accent)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, fontSize: 13, color: "#fbbf24" }}>
            🛡️ Secret Admin Panel — Sirf tum dekh sakte ho
          </div>
          <div className="section-title">Platform Stats</div>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-val">{allUsers.length}</div><div className="stat-label">Total Users</div></div>
            <div className="stat-card"><div className="stat-val">{totalChats}</div><div className="stat-label">Total Chats</div></div>
            <div className="stat-card"><div className="stat-val">₹0</div><div className="stat-label">Revenue</div></div>
            <div className="stat-card"><div className="stat-val">{allUsers.length}</div><div className="stat-label">Active</div></div>
          </div>
          <div className="section-title">All Users ({allUsers.length})</div>
          {allUsers.map(u => (
            <div key={u.id} className="user-row">
              <div className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>{u.name[0]?.toUpperCase()}</div>
              <div className="user-info">
                <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</div>
                <div className="user-email">{u.email}</div>
                <div className="user-email">{ChatStore.getChats(u.id).length} chats · Joined {fmtDate(u.createdAt)}</div>
              </div>
              {u.email === ADMIN_EMAIL && <div className="badge">ADMIN</div>}
            </div>
          ))}
        </div>
      )}

      {/* BOTTOM NAV */}
      <div className="bottom-nav">
        {[
          { id: "chat", icon: "💬", label: "Chat" },
          { id: "history", icon: "📂", label: "History" },
          { id: "settings", icon: "⚙️", label: "Settings" },
          ...(isAdmin ? [{ id: "admin", icon: "🛡️", label: "Admin" }] : []),
        ].map(n => (
          <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => setPage(n.id)}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}
