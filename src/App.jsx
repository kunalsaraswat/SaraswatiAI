import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, addDoc, query,
  where, orderBy, getDocs, deleteDoc, serverTimestamp, updateDoc, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── CONFIG ───────────────────────────────────────────────────────
const FB = {
  apiKey: "AIzaSyAM-o-ZvEV2T1Efso1oiIC7__PFxh4YCxk",
  authDomain: "saraswatiai-51593.firebaseapp.com",
  projectId: "saraswatiai-51593",
  storageBucket: "saraswatiai-51593.firebasestorage.app",
  messagingSenderId: "352789553358",
  appId: "1:352789553358:web:ce3dcc024a98c96c82f09f"
};
const fapp = initializeApp(FB);
const auth = getAuth(fapp);
const db = getFirestore(fapp);

const GROQ = import.meta.env.VITE_GROQ_API_KEY || "";
const TAVILY = import.meta.env.VITE_TAVILY_API_KEY || "";
const SARVAM = import.meta.env.VITE_SARVAM_API_KEY || "";
const ADMIN = "kunalsaraswat691@gmail.com";
const UPI = "8126630980";
const FREE_LIMIT = 49;
const REACTIONS = ["👍","❤️","😂","😮","🙏","🔥"];
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const CHAT_MODEL   = "llama-3.3-70b-versatile";
const TRIVIAL = /^(hi|hello|hey|hii|ok|okay|hmm|ha|bhai|yaar|bro|dost|thanks|thx|yes|no|nahi|haan|k|👍|😊)[\s!?.]*$/i;

// ── ACCENT PALETTES ──────────────────────────────────────────────
const ACCENTS = {
  orange: { primary:"#f97316", grad:"linear-gradient(135deg,#f97316,#ea580c)", glow:"#f9731640" },
  blue:   { primary:"#3b82f6", grad:"linear-gradient(135deg,#3b82f6,#1d4ed8)", glow:"#3b82f640" },
  gold:   { primary:"#f59e0b", grad:"linear-gradient(135deg,#f59e0b,#d97706)", glow:"#f59e0b40" },
};

// ── THEMES ───────────────────────────────────────────────────────
const THEMES = {
  dark:  { bg:"#0a0a0a", sf:"#141414", sf2:"#1c1c1c", bd:"#252525", tx:"#f0f0f0", mt:"#5a5a5a", bub:"#161616", navBg:"#0e0e0e" },
  light: { bg:"#f5f5f5", sf:"#ffffff", sf2:"#eeeeee", bd:"#e0e0e0", tx:"#111111", mt:"#888888", bub:"#ffffff", navBg:"#fafafa" },
  blue:  { bg:"#060b18", sf:"#0d1526", sf2:"#111d30", bd:"#1a2d4a", tx:"#e8f0fe", mt:"#4a6fa5", bub:"#0d1526", navBg:"#08101f" },
  gold:  { bg:"#0a0800", sf:"#12100a", sf2:"#1a1710", bd:"#2e2a1a", tx:"#fef3c7", mt:"#a89060", bub:"#111009", navBg:"#0d0b06" },
};

// ── UTILS ────────────────────────────────────────────────────────
function compressImage(dataUrl, maxW = 180, q = 0.5) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = img.width * sc; c.height = img.height * sc;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", q));
    };
    img.src = dataUrl;
  });
}

const ATTACH_PER_FILE_LIMIT = 8000;
const ATTACH_TOTAL_LIMIT = 20000;

function loadScriptOnce(url, globalCheck) {
  return new Promise((resolve, reject) => {
    if (globalCheck()) return resolve();
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load " + url)));
      if (globalCheck()) resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + url));
    document.head.appendChild(s);
  });
}

async function extractPdfText(arrayBuffer) {
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", () => !!window.pdfjsLib);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  const maxPages = Math.min(pdf.numPages, 30);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(" ") + "\n\n";
    if (text.length > ATTACH_PER_FILE_LIMIT) break;
  }
  return text;
}

async function extractDocxText(arrayBuffer) {
  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js", () => !!window.mammoth);
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsText(file);
  });
}
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

async function extractFileText(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  try {
    let text = "";
    if (ext === "pdf") {
      const buf = await readFileAsArrayBuffer(file);
      text = await extractPdfText(buf);
    } else if (ext === "docx") {
      const buf = await readFileAsArrayBuffer(file);
      text = await extractDocxText(buf);
    } else if (["txt", "csv", "md", "json", "log"].includes(ext)) {
      text = await readFileAsText(file);
    } else if (ext === "xlsx" || ext === "xls") {
      await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", () => !!window.XLSX);
      const buf = await readFileAsArrayBuffer(file);
      const wb = window.XLSX.read(buf, { type: "array" });
      const rows = [];
      wb.SheetNames.slice(0, 5).forEach(name => {
        const ws = wb.Sheets[name];
        const csv = window.XLSX.utils.sheet_to_csv(ws);
        rows.push(`[Sheet: ${name}]\n${csv}`);
      });
      text = rows.join("\n\n");
    } else if (ext === "pptx") {
      // Extract text from PPTX using JSZip (available via cdnjs)
      await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", () => !!window.JSZip);
      const buf = await readFileAsArrayBuffer(file);
      const zip = await window.JSZip.loadAsync(buf);
      const slideTexts = [];
      const slideFiles = Object.keys(zip.files).filter(f => /ppt\/slides\/slide[0-9]+\.xml$/.test(f)).sort();
      for (const sf of slideFiles.slice(0, 20)) {
        const xml = await zip.files[sf].async("string");
        const text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (text) slideTexts.push(text);
      }
      text = slideTexts.join("\n\n");
    } else {
      return { name: file.name, ext, error: "Unsupported file type. Supported: PDF, DOCX, TXT, CSV, XLSX, PPTX" };
    }
    text = (text || "").trim();
    if (text.length > ATTACH_PER_FILE_LIMIT) text = text.slice(0, ATTACH_PER_FILE_LIMIT) + "\n...[truncated]";
    return { name: file.name, ext, text, size: file.size };
  } catch (e) {
    return { name: file.name, ext, error: e.message || "Could not read file" };
  }
}

function playTypingSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 800 + Math.random() * 400; o.type = "sine";
    g.gain.setValueAtTime(0.02, ctx.currentTime);
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
      g.gain.setValueAtTime(0.05, ctx.currentTime + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.09);
      o.start(ctx.currentTime + i * 0.05); o.stop(ctx.currentTime + i * 0.05 + 0.09);
    });
  } catch {}
}
async function webSearch(q) {
  const tl = q.toLowerCase();
  const isWeather = ["weather","mausam","temperature","temp","garmi","sardi","barish","rain","thand","degree"].some(k => tl.includes(k));
  const isMandi = ["mandi","rate","bhav","price","daam","keemat","fasal",
    // Grains
    "sarso","sarson","wheat","gehu","rice","chawal","paddy","dhan","bajra","jowar","maize","makka","barley","jau","ragi",
    // Pulses
    "chana","gram","urad","moong","masur","arhar","tur","toor","matar","rajma","moth",
    // Oilseeds
    "soybean","soya","groundnut","moongfali","sunflower","til","sesame","alsi","linseed","castor","arandi","cotton","kapas","safflower","niger",
    // Vegetables
    "onion","pyaaz","potato","aloo","tomato","tamatar","garlic","lahsun","ginger","adrak","gobhi","cauliflower","cabbage","baingan","brinjal","bhindi","lauki","karela","capsicum","shimla","mirch","dhaniya","coriander","palak","spinach","gajar","carrot","mooli","radish","beetroot","chukandar","arbi","mushroom","parwal","tinda","kakdi","cucumber","kheera","tori","torai",
    // Fruits
    "mango","aam","banana","kela","apple","seb","orange","santra","grapes","angoor","pomegranate","anar","watermelon","tarbooz","muskmelon","kharbooja","papaya","papita","guava","amrood","lemon","nimbu","pineapple","ananas","coconut","nariyal","pear","nashpati","litchi","chikoo","sapota","mosambi","kinnow","amla","tamarind","imli","dates","khajoor","strawberry",
    // Spices
    "haldi","turmeric","jeera","cumin","ajwain","kali mirch","pepper","cardamom","elaichi","clove","laung","dalchini","cinnamon","saunf","fennel","hing","asafoetida","kalonji",
    // Dry fruits
    "cashew","kaju","almond","badam","walnut","akhrot","pista","kishmish","raisin",
    // Cash crops
    "ganna","sugarcane","jute","tobacco","tambaku",
    // Flowers
    "genda","marigold","rose","gulab","jasmine","chameli",
    // General
    "kisan","sabzi","vegetable","fruit","phal"
  ].some(k => tl.includes(k));

  // Try mandi rate API first for farming queries
  if (isMandi) {
    const mandiData = await getMandiRate(q);
    if (mandiData) return mandiData;
  }

  // Try free weather API for weather queries
  if (isWeather) {
    const weatherData = await getWeather(q);
    if (weatherData) return weatherData;
  }

  // Try Tavily for general search
  if (TAVILY) {
    try {
      const r = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: TAVILY, query: q, search_depth: "basic", max_results: 3 })
      });
      const d = await r.json();
      if (d.results?.length) return d.results.map(x => x.title + ": " + x.content).join("\n\n");
    } catch {}
  }

  return null;
}
// ── Smart Image Generation Detection ───────────────────────────────────
// Instead of matching rigid exact phrases (which missed cases like
// "youtube logo create kro"), this checks for ANY combination of a
// creation-verb + a visual-noun anywhere in the sentence, in any order,
// in Hinglish or English. Much more reliable for natural phrasing.
const IMG_VERBS = [
  "create","generate","make","draw","design","sketch","paint","render","illustrate",
  "banao","banaiye","banado","bana do","bnao","bnado"
];
const IMG_NOUNS = [
  "image","photo","picture","pic","logo","poster","wallpaper","illustration","drawing",
  "sketch","painting","design","banner","thumbnail","avatar","icon","graphic","artwork",
  "tasveer","tasvir","chitra","photo banao"
];
// Phrases that are unambiguous on their own (no verb+noun pairing needed)
const IMG_DIRECT_PHRASES = [
  "image banao","photo banao","tasveer banao","picture banao","generate image","logo banao",
  "ai image","render an image","paint a","painting of","draw me","draw a"
];

function needsImageGen(t) {
  const lower = " " + t.toLowerCase() + " ";
  // 1) Direct unambiguous phrases
  if (IMG_DIRECT_PHRASES.some(k => lower.includes(k))) return true;
  // 2) Any creation-verb present AND any visual-noun present, anywhere in the sentence
  const hasVerb = IMG_VERBS.some(v => lower.includes(" " + v) || lower.includes(v + " "));
  const hasNoun = IMG_NOUNS.some(n => lower.includes(n));
  return hasVerb && hasNoun;
}

function extractPrompt(t) {
  let p = " " + t.toLowerCase() + " ";
  // Strip the verbs and nouns/filler so what's left is the actual subject
  // e.g. "youtube logo create kro logo name xyz game" -> "youtube name xyz game"
  // Uses word-boundary regex so we don't accidentally chop mid-word
  // (e.g. stripping "ke" must not turn "bakery" into "ba ry").
  const stripWords = [
    ...IMG_DIRECT_PHRASES, ...IMG_VERBS, ...IMG_NOUNS,
    "kro","karo","kr do","kar do","kijiye","plz","please","ek","for me","mujhe",
    "of","ki","ka","ke","liye","chahiye","a","an"
  ];
  stripWords.sort((a, b) => b.length - a.length); // longest phrases first
  stripWords.forEach(k => {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    p = p.replace(new RegExp("\\b" + escaped + "\\b", "g"), " ");
  });
  return p.replace(/\s+/g, " ").trim() || t;
}
// Pollinations is used only as an automatic fallback if the Gemini backend call fails.
function getImgUrl(p) { return `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=768&height=768&seed=${Math.floor(Math.random() * 99999)}&nologo=true`; }

// ── Gemini Image Generation (secure, via serverless backend) ──────────────
// Calls our own /api/generate-image route. The Google AI Studio API key
// lives only in Vercel's server-side environment variables and is never
// sent to or readable by the browser.
async function generateImageGemini(prompt) {
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) {
    let msg = "Image generation failed";
    try { const j = await res.json(); msg = j.error || msg; } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  if (!data.image) throw new Error("No image returned");
  return data.image; // data URL or hosted URL, returned by the backend
}
// ── MEDIA LINK FEATURE ──────────────────────────────────────────
function needsMediaLink(t) {
  const tl = t.toLowerCase();
  // Action words - user must ask for link/show/search
  const actionWords = [
    "link do","link dedo","link bhejo","link chahiye","link send","link dena",
    "dikhao","dikha do","dikha","dekhna hai","dekhna","watch karna","play karo",
    "download","youtube pe","yt pe","youtube par","youtube link","video link",
    "search karo","dhundo","kahan dekhe","kahan dekhun","kahan milega","kaise dekhe",
    "app link","app download","play store","app store","install"
  ];
  const hasAction = actionWords.some(k => tl.includes(k));
  if (!hasAction) return false;

  // Content keywords - what they want
  const contentWords = [
    "cartoon","motu patlu","doremon","doraemon","shinchan","shin chan","chhota bheem","chota bheem",
    "oggy","tom and jerry","tom jerry","pokemon","dragon ball","naruto","spider man","spiderman",
    "batman","superman","avengers","ninja hattori","hatim","krishna","bal ganesh","hanuman","little singham",
    "movie","film","natak","serial","show","web series","webseries","episode",
    "song","gana","gaana","music","video",
    "netflix","hotstar","amazon prime","zee5","sonyliv","voot","jiocinema","mx player","youtube"
  ];
  return contentWords.some(k => tl.includes(k));
}

function getMediaLinks(query) {
  const tl = query.toLowerCase();
  const ytQuery = encodeURIComponent(query.replace(/link do|link dedo|dikhao|dikha do|chahiye|please|plz|send karo/gi, "").trim());
  
  // Detect type
  const isApp = tl.includes("app") || tl.includes("download") || tl.includes("install") || tl.includes("play store");
  const isMovie = tl.includes("movie") || tl.includes("film") || tl.includes("cinema");
  const isSong = tl.includes("song") || tl.includes("gana") || tl.includes("gaana") || tl.includes("music");
  const isNetflix = tl.includes("netflix");
  const isHotstar = tl.includes("hotstar");
  const isPrime = tl.includes("prime") || tl.includes("amazon");
  
  const links = [];
  
  // Always add YouTube search
  links.push({
    platform: "YouTube",
    icon: "▶",
    color: "#ff0000",
    url: `https://www.youtube.com/results?search_query=${ytQuery}`,
    label: "Search on YouTube"
  });
  
  // Platform specific
  if (isNetflix) {
    links.push({ platform: "Netflix", icon: "N", color: "#e50914", url: "https://www.netflix.com/search?q=" + ytQuery, label: "Netflix pe dekho" });
  }
  if (isHotstar) {
    links.push({ platform: "Hotstar", icon: "★", color: "#1f80e0", url: "https://www.hotstar.com/in/search?q=" + encodeURIComponent(query), label: "Hotstar pe dekho" });
  }
  if (isPrime) {
    links.push({ platform: "Prime Video", icon: "P", color: "#00a8e0", url: "https://www.primevideo.com/search?phrase=" + ytQuery, label: "Prime Video pe dekho" });
  }
  
  // For cartoons/kids content - add specific platforms
  const isKids = ["motu","doremon","doraemon","shinchan","bheem","oggy","tom jerry","pokemon","ninja","krishna","hanuman","bal ganesh","little singham"].some(k => tl.includes(k));
  if (isKids) {
    links.push({ platform: "Nickelodeon", icon: "🎨", color: "#f90", url: "https://www.youtube.com/@NickelodeonIndia/search?query=" + ytQuery, label: "Nickelodeon India" });
    links.push({ platform: "Hotstar Kids", icon: "⭐", color: "#1f80e0", url: "https://www.hotstar.com/in/search?q=" + encodeURIComponent(query), label: "Hotstar pe dekho" });
  }
  
  // For movies add OTT
  if (isMovie && !isNetflix && !isHotstar && !isPrime) {
    links.push({ platform: "JioCinema", icon: "J", color: "#8b5cf6", url: "https://www.jiocinema.com/search/" + ytQuery, label: "JioCinema pe dekho" });
    links.push({ platform: "Hotstar", icon: "★", color: "#1f80e0", url: "https://www.hotstar.com/in/search?q=" + encodeURIComponent(query), label: "Hotstar pe dekho" });
  }
  
  // For songs
  if (isSong) {
    links.push({ platform: "Spotify", icon: "♪", color: "#1db954", url: "https://open.spotify.com/search/" + ytQuery, label: "Spotify pe suno" });
    links.push({ platform: "Gaana", icon: "🎵", color: "#e72c30", url: "https://gaana.com/search/" + encodeURIComponent(query), label: "Gaana pe suno" });
  }
  
  // For apps - Play Store
  if (isApp) {
    links.push({ platform: "Play Store", icon: "▲", color: "#01875f", url: "https://play.google.com/store/search?q=" + ytQuery + "&c=apps", label: "Android ke liye" });
    links.push({ platform: "App Store", icon: "⬡", color: "#007aff", url: "https://apps.apple.com/in/search?term=" + ytQuery, label: "iPhone ke liye" });
  }
  
  return links;
}
function needsSearch(t) {
  const tl = t.toLowerCase();
  return [
    // Weather
    "weather","mausam","temperature","temp","kitna degree","barish","rain","forecast","aaj ka mausam","kal ka mausam","humidity","garmi","sardi","thand",
    // News & current events
    "news","aaj ki khabar","latest","abhi","current","today","aaj","kal",
    // Prices
    "price","rate","mandi","gold","sona","silver","chandi","petrol","diesel","onion","pyaaz",
    // Sports
    "score","match","ipl","cricket","result",
    // Finance
    "stock","share market","sensex","nifty",
    // Farming
    "kisan","fasal","crop","kheti",
    // Year-specific
    "2025","2026",
    // Exams
    "upsc","result","exam"
  ].some(k => tl.includes(k));
}

// Comprehensive Mandi Rate API - data.gov.in (All fruits, vegetables, grains, spices)
async function getMandiRate(query) {
  try {
    const tl = query.toLowerCase();

    // ── COMPREHENSIVE COMMODITY MAP ──────────────────────────────
    const commodities = {
      // Grains / Anaaj
      "sarso":"Mustard","sarson":"Mustard","mustard":"Mustard","rape seed":"Mustard",
      "wheat":"Wheat","gehu":"Wheat","gehun":"Wheat","gahu":"Wheat",
      "rice":"Rice","chawal":"Rice","dhan":"Paddy","paddy":"Paddy",
      "bajra":"Bajra","jowar":"Jowar","ragi":"Ragi","maize":"Maize","makka":"Maize","corn":"Maize",
      "barley":"Barley","jau":"Barley","oats":"Oats","jwar":"Jowar",

      // Pulses / Dals
      "chana":"Gram","gram":"Gram","chickpea":"Gram","chole":"Gram",
      "urad":"Urad","urad dal":"Urad","black gram":"Urad",
      "moong":"Moong","mung":"Moong","green gram":"Moong",
      "masur":"Lentil","masoor":"Lentil","lentil":"Lentil","dal":"Lentil",
      "arhar":"Arhar (Tur/Red Gram)","tur":"Arhar (Tur/Red Gram)","toor":"Arhar (Tur/Red Gram)","pigeon pea":"Arhar (Tur/Red Gram)",
      "moath":"Moth","moth":"Moth","rajma":"Rajma","kidney bean":"Rajma",
      "peas":"Peas","matar":"Peas","green peas":"Peas",

      // Oilseeds / Tilhan
      "soybean":"Soybean","soya":"Soybean","soy":"Soybean",
      "groundnut":"Groundnut","moongfali":"Groundnut","peanut":"Groundnut","mungfali":"Groundnut",
      "sunflower":"Sunflower","surajmukhi":"Sunflower",
      "sesame":"Sesamum (Sesame)","til":"Sesamum (Sesame)","tilli":"Sesamum (Sesame)",
      "linseed":"Linseed","alsi":"Linseed","flaxseed":"Linseed",
      "castor":"Castor Seed","arandi":"Castor Seed","castor seed":"Castor Seed",
      "safflower":"Safflower","kusum":"Safflower",
      "niger":"Niger Seed","ramtil":"Niger Seed",
      "cotton":"Cotton","kapas":"Cotton","kapas (raw)":"Cotton",

      // Vegetables / Sabzi
      "onion":"Onion","pyaaz":"Onion","pyaz":"Onion","kanda":"Onion",
      "potato":"Potato","aloo":"Potato","alu":"Potato",
      "tomato":"Tomato","tamatar":"Tomato",
      "garlic":"Garlic","lahsun":"Garlic","lasan":"Garlic",
      "ginger":"Ginger","adrak":"Ginger","adarak":"Ginger",
      "cauliflower":"Cauliflower","phool gobhi":"Cauliflower","gobhi":"Cauliflower",
      "cabbage":"Cabbage","patta gobhi":"Cabbage","band gobhi":"Cabbage",
      "brinjal":"Brinjal","baingan":"Brinjal","eggplant":"Brinjal",
      "bhindi":"Bhindi(Ladies Finger)","ladies finger":"Bhindi(Ladies Finger)","okra":"Bhindi(Ladies Finger)",
      "bottle gourd":"Bottle Gourd","lauki":"Bottle Gourd","ghia":"Bottle Gourd","kaddu":"Bottle Gourd",
      "bitter gourd":"Bitter Gourd","karela":"Bitter Gourd","bittergourd":"Bitter Gourd",
      "ridge gourd":"Ridge Gourd","tori":"Ridge Gourd","torai":"Ridge Gourd",
      "sponge gourd":"Sponge Gourd","galka":"Sponge Gourd",
      "pumpkin":"Pumpkin","sitaphal":"Pumpkin","kaddoo":"Pumpkin",
      "capsicum":"Capsicum","shimla mirch":"Capsicum","bell pepper":"Capsicum",
      "green chilli":"Green Chilli","hari mirch":"Green Chilli","mirchi":"Green Chilli",
      "red chilli":"Dry Chilli","lal mirch":"Dry Chilli","sukhi mirch":"Dry Chilli",
      "coriander":"Coriander","dhaniya":"Coriander","dhania":"Coriander",
      "fenugreek":"Fenugreek","methi":"Fenugreek",
      "spinach":"Spinach","palak":"Spinach",
      "carrot":"Carrot","gajar":"Carrot",
      "radish":"Radish","mooli":"Radish","muli":"Radish",
      "turnip":"Turnip","shalgam":"Turnip",
      "beetroot":"Beetroot","chukandar":"Beetroot",
      "sweet potato":"Sweet Potato","shakarkand":"Sweet Potato",
      "yam":"Yam","jimikand":"Yam","suran":"Yam",
      "drumstick":"Drumstick","sahjan":"Drumstick","moringa":"Drumstick",
      "beans":"Beans","sem":"Beans","french beans":"Beans",
      "cucumber":"Cucumber","kheera":"Cucumber","kakdi":"Cucumber",
      "snake gourd":"Snake Gourd","chichinda":"Snake Gourd",
      "ash gourd":"Ash Gourd","petha":"Ash Gourd",
      "tinda":"Tinda","apple gourd":"Tinda",
      "parwal":"Pointed Gourd","pointed gourd":"Pointed Gourd",
      "arbi":"Arvi (Taro)","taro":"Arvi (Taro)","colocasia":"Arvi (Taro)",
      "lotus stem":"Lotus Stem","kamal kakdi":"Lotus Stem",
      "raw papaya":"Raw Papaya","kaccha papita":"Raw Papaya",
      "raw banana":"Raw Banana","kaccha kela":"Raw Banana",
      "jackfruit":"Jack Fruit","kathal":"Jack Fruit",
      "broccoli":"Broccoli","hari gobhi":"Broccoli",
      "celery":"Celery","ajwain leaves":"Celery",
      "leek":"Leek","leeks":"Leek",
      "mushroom":"Mushroom","khumb":"Mushroom",
      "elephant yam":"Elephant Yam","zimikand":"Elephant Yam",
      "curry leaves":"Curry Leaves","kadi patta":"Curry Leaves",

      // Fruits / Phal
      "mango":"Mango","aam":"Mango","keri":"Mango",
      "banana":"Banana","kela":"Banana","kele":"Banana",
      "apple":"Apple","seb":"Apple","saib":"Apple",
      "orange":"Orange","santra":"Orange","narangi":"Orange","malta":"Orange",
      "grapes":"Grapes","angoor":"Grapes","draksh":"Grapes",
      "pomegranate":"Pomegranate","anar":"Pomegranate",
      "watermelon":"Water Melon","tarbooz":"Water Melon","tarbuj":"Water Melon",
      "muskmelon":"Musk Melon","kharbooja":"Musk Melon","kharbuja":"Musk Melon",
      "papaya":"Papaya","papita":"Papaya",
      "guava":"Guava","amrood":"Guava","amrud":"Guava",
      "lemon":"Lemon","nimbu":"Lemon","neembu":"Lemon",
      "lime":"Lime","kagzi nimbu":"Lime",
      "pineapple":"Pineapple","ananas":"Pineapple",
      "coconut":"Coconut","nariyal":"Coconut","nariyal (whole)":"Coconut",
      "pear":"Pear","nashpati":"Pear","babugosa":"Pear",
      "plum":"Plum","aloo bukhara":"Plum","ber":"Plum",
      "peach":"Peach","aadoo":"Peach","aroo":"Peach",
      "cherry":"Cherry","gilash":"Cherry",
      "apricot":"Apricot","khubani":"Apricot","khumani":"Apricot",
      "fig":"Fig","anjeer":"Fig",
      "strawberry":"Strawberry","strawberi":"Strawberry",
      "litchi":"Litchi","lychee":"Litchi",
      "chikoo":"Sapota","sapota":"Sapota","sapodilla":"Sapota",
      "custard apple":"Custard Apple","sharifa":"Custard Apple","sitaphal":"Custard Apple",
      "wood apple":"Wood Apple","bael":"Wood Apple","bel":"Wood Apple",
      "mulberry":"Mulberry","shahtoot":"Mulberry","toot":"Mulberry",
      "jackfruit":"Jack Fruit","kathal":"Jack Fruit",
      "amla":"Amla (Indian Gooseberry)","awla":"Amla (Indian Gooseberry)","gooseberry":"Amla (Indian Gooseberry)",
      "tamarind":"Tamarind","imli":"Tamarind","amli":"Tamarind",
      "dates":"Dates","khajoor":"Dates","chuara":"Dates",
      "kiwi":"Kiwi","kivi":"Kiwi",
      "avocado":"Avocado","makhanphal":"Avocado",
      "dragon fruit":"Dragon Fruit","pitaya":"Dragon Fruit",
      "passion fruit":"Passion Fruit",
      "pomelo":"Pomelo","chakotra":"Pomelo",
      "sweet lime":"Sweet Lime","mosambi":"Sweet Lime","musambi":"Sweet Lime",
      "mandarin":"Mandarin","kinnow":"Kinnow",

      // Spices / Masale
      "turmeric":"Turmeric","haldi":"Turmeric","haridra":"Turmeric",
      "jeera":"Cumin (Jeera)","cumin":"Cumin (Jeera)","zeera":"Cumin (Jeera)",
      "ajwain":"Ajwan","carom":"Ajwan","thymol seeds":"Ajwan",
      "black pepper":"Black Pepper","kali mirch":"Black Pepper","gol mirch":"Black Pepper",
      "cardamom":"Cardamom","elaichi":"Cardamom","illaichi":"Cardamom",
      "clove":"Clove","laung":"Clove","lavang":"Clove",
      "cinnamon":"Cinnamon","dalchini":"Cinnamon","daalchini":"Cinnamon",
      "bay leaf":"Bay Leaf","tej patta":"Bay Leaf","tejpat":"Bay Leaf",
      "fennel":"Fennel","saunf":"Fennel","sonf":"Fennel",
      "nutmeg":"Nutmeg","jaiphal":"Nutmeg","jayaphal":"Nutmeg",
      "mace":"Mace","javitri":"Mace","jawitri":"Mace",
      "star anise":"Star Anise","chakra phool":"Star Anise",
      "asafoetida":"Asafoetida","hing":"Asafoetida","heeng":"Asafoetida",
      "kalonji":"Kalonji","nigella":"Kalonji","onion seeds":"Kalonji",

      // Cash Crops
      "sugarcane":"Sugarcane","ganna":"Sugarcane","iksha":"Sugarcane",
      "jute":"Jute","paat":"Jute","san":"Jute",
      "tobacco":"Tobacco","tambaku":"Tobacco","tambaakoo":"Tobacco",
      "tea":"Tea","chai":"Tea","chay":"Tea",
      "coffee":"Coffee","kaafi":"Coffee",
      "rubber":"Rubber","ratanjot":"Rubber",

      // Flowers / Phool
      "rose":"Rose","gulab":"Rose",
      "marigold":"Marigold","genda":"Marigold","genda phool":"Marigold",
      "jasmine":"Jasmine","chameli":"Jasmine","mogra":"Jasmine",
      "chrysanthemum":"Chrysanthemum","guldaudi":"Chrysanthemum",
      "lotus":"Lotus","kamal":"Lotus",
      "tuberose":"Tuberose","rajnigandha":"Tuberose",

      // Dry Fruits
      "cashew":"Cashew Nut","kaju":"Cashew Nut",
      "almond":"Almond","badam":"Almond","badaam":"Almond",
      "walnut":"Walnut","akhrot":"Walnut",
      "pistachio":"Pista","pista":"Pista",
      "raisin":"Raisin","kishmish":"Raisin","munakka":"Raisin",
    };

    // ── STATE MAP ────────────────────────────────────────────────
    const states = {
      "rajasthan":"Rajasthan","rajstan":"Rajasthan",
      "punjab":"Punjab","haryana":"Haryana",
      "up":"Uttar Pradesh","uttar pradesh":"Uttar Pradesh","yup":"Uttar Pradesh",
      "mp":"Madhya Pradesh","madhya pradesh":"Madhya Pradesh","madhyapradesh":"Madhya Pradesh",
      "gujarat":"Gujarat","gujrat":"Gujarat",
      "maharashtra":"Maharashtra","maha":"Maharashtra",
      "bihar":"Bihar","jharkhand":"Jharkhand",
      "wb":"West Bengal","bengal":"West Bengal","west bengal":"West Bengal","bangal":"West Bengal",
      "karnataka":"Karnataka","karnatak":"Karnataka",
      "ap":"Andhra Pradesh","andhra":"Andhra Pradesh","andhra pradesh":"Andhra Pradesh",
      "telangana":"Telangana","ts":"Telangana",
      "odisha":"Odisha","orissa":"Odisha",
      "assam":"Assam","manipur":"Manipur","nagaland":"Nagaland",
      "himachal":"Himachal Pradesh","hp":"Himachal Pradesh","himachal pradesh":"Himachal Pradesh",
      "uttarakhand":"Uttarakhand","uttrakhand":"Uttarakhand","uk":"Uttarakhand",
      "chhattisgarh":"Chhattisgarh","chattisgadh":"Chhattisgarh",
      "kerala":"Kerala","kerla":"Kerala",
      "tamil nadu":"Tamil Nadu","tamilnadu":"Tamil Nadu","tn":"Tamil Nadu",
      "goa":"Goa","j&k":"Jammu & Kashmir","jammu":"Jammu & Kashmir","kashmir":"Jammu & Kashmir",
      "delhi":"Delhi","new delhi":"Delhi","dilli":"Delhi",
    };

    // Find commodity
    let commodity = null;
    // Sort by length desc so longer phrases match first
    const sortedKeys = Object.keys(commodities).sort((a,b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (tl.includes(key)) { commodity = commodities[key]; break; }
    }
    if (!commodity) return null;

    // Find state
    let state = null;
    const sortedStates = Object.keys(states).sort((a,b) => b.length - a.length);
    for (const key of sortedStates) {
      if (tl.includes(key)) { state = states[key]; break; }
    }

    // Call data.gov.in Agmarknet API
    const stateParam = state ? `&filters[State.keyword]=${encodeURIComponent(state)}` : "";
    const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001cdd3946e44ce4aab825d4c8eb6d18c18&format=json&limit=10&filters[Commodity.keyword]=${encodeURIComponent(commodity)}${stateParam}`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    if (!data.records?.length) {
      return `${commodity} rates are currently unavailable${state ? ` ${state} in` : ""}. Kripya Agmarknet.gov.in ya apni local mandi check karein.`;
    }

    const records = data.records.slice(0, 6);
    const lines = records.map(r =>
      `• ${r.Market || r.District}${r.State ? ` (${r.State})` : ""}: Min ₹${r.Min_Price} | Max ₹${r.Max_Price} | Modal ₹${r.Modal_Price}/quintal`
    ).join("\n");

    const dateNote = records[0]?.Arrival_Date ? ` — ${records[0].Arrival_Date}` : "";
    return `📊 ${commodity} Mandi Rates${dateNote}:\n\n${lines}\n\n📌 Source: Agmarknet / data.gov.in`;
  } catch { return null; }
}
async function getWeather(query) {
  try {
    // Step 1: Geocode city name to lat/lon using Open-Meteo geocoding
    const cityRaw = query
      .replace(/weather|mausam|temperature|temp|kitna|degree|bata|hai|kya|ka|ki|ke|in|mere|gaon|village|sheher|city/gi, " ")
      .trim().split(/\s+/).filter(w => w.length > 1).join(" ");
    const city = cityRaw || query.trim();
    if (!city || city.length < 2) return null;

    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`
    );
    const geoData = await geoRes.json();
    const loc = geoData.results?.[0];
    if (!loc) return null;

    // Step 2: Get current weather
    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true&hourly=relativehumidity_2m&timezone=auto&forecast_days=1`
    );
    const wData = await wRes.json();
    const cw = wData.current_weather;
    if (!cw) return null;

    const humidity = wData.hourly?.relativehumidity_2m?.[new Date().getHours()] || "N/A";
    const wCode = cw.weathercode;
    const desc = wCode <= 1 ? "Clear/Sunny" : wCode <= 3 ? "Partly Cloudy" : wCode <= 48 ? "Foggy" : wCode <= 67 ? "Rainy" : wCode <= 77 ? "Snowy" : wCode <= 82 ? "Heavy Rain" : "Thunderstorm";

    return `${loc.name} (${loc.country}) ka abhi temperature: ${cw.temperature}°C. Mausam: ${desc}. Humidity: ${humidity}%. Wind: ${cw.windspeed} km/h.`;
  } catch { return null; }
}
function isOwnerQ(t) { return ["kisne banaya","who made","who created","owner","creator","malik","kaun hai tera","who built"].some(k => t.toLowerCase().includes(k)); }
function detectTone(t) {
  const tl = t.toLowerCase();
  if (["behen","didi","sister","madam","mam"].some(w => tl.includes(w))) return "female";
  if (["bhai","bhaiya","yaar","bro","dost","sir"].some(w => tl.includes(w))) return "male";
  return null;
}
function fmtTime(ts) { if (!ts) return ""; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(ts) { if (!ts) return ""; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }); }

async function genTitle(msg) {
  if (TRIVIAL.test(msg.trim())) return null;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ }, body: JSON.stringify({ model: CHAT_MODEL, messages: [{ role: "system", content: "Generate a 3-5 word descriptive chat title. Return ONLY the title — no quotes, no punctuation at end." }, { role: "user", content: msg }], max_tokens: 15 }) });
    const d = await r.json();
    const t = d.choices?.[0]?.message?.content?.trim();
    return (t && t.length > 2) ? t : null;
  } catch { return null; }
}

async function callAI(messages, imageB64, tone, memories, language, agentOrNote = "") {
  const last = messages[messages.length - 1];
  if (last?.role === "user" && isOwnerQ(last.text)) return "I was created by **Kunal Saraswat**! 😊";
  let ctx = "";
  if (last?.role === "user" && needsSearch(last.text)) { const r = await webSearch(last.text); if (r) ctx = "\n\nLatest Info:\n" + r; }
  const tNote = tone === "female" ? "Respond warmly like a helpful sister/friend." : tone === "male" ? "Respond like a helpful brother/friend." : "Be warm and friendly.";
  let memCtx = "";
  if (memories && memories.length) {
    // Smart: inject only relevant memories for this query
    const relevant = getRelevantMemories(memories, last?.text || "");
    if (relevant.length) {
      memCtx = "\n\nMemories about this user (use naturally when relevant, never list unless asked):\n" +
        relevant.map(m => `- [${m.category || "personal"}] ${m.memory_content || m.text}`).join("\n");
    }
  }
  const langInstruction = {
    hindi: "ALWAYS reply in Hindi (Devanagari script), regardless of what language the user writes in.",
    english: "ALWAYS reply in English, regardless of what language the user writes in.",
    hinglish: "ALWAYS reply in Hinglish (Hindi words written in Roman/English script), regardless of what language the user writes in.",
  }[language] || "Reply in the EXACT language the user writes (Hindi→Hindi, English→English, Hinglish→Hinglish).";
  // Agent override
  const agent = (agentOrNote && typeof agentOrNote === "object") ? agentOrNote : null;
  const extraNote = (agentOrNote && typeof agentOrNote === "string") ? agentOrNote : "";
  const toneMap = { friendly: "Be warm and friendly.", professional: "Be professional and formal.", funny: "Be funny and crack jokes.", strict: "Be strict, stay on topic only." };
  // ── Expert Agent System Prompt (uses all generated fields + PDF) ──
  const agentSys = agent ? (() => {
    const agName = agent.name || "AI Assistant";
    const agEmoji = agent.emoji || "🤖";
    const agCategory = agent.category || "";

    // Use systemPrompt if available (new agents), else fallback to instructions
    const coreInstructions = agent.systemPrompt || agent.instructions || `You are ${agName}, a helpful AI assistant.`;

    // Personality + conversation style
    const personalityLine = agent.personality ? `Personality: ${agent.personality}.` : "";
    const styleLine = agent.conversationStyle ? `Conversation Style: ${agent.conversationStyle}.` : "";
    const expertiseLine = agent.expertise ? `Core Expertise: ${agent.expertise}.` : "";

    // Language instruction
    const langLine = agent.language
      ? `Always respond in ${agent.language}. Match user's language naturally.`
      : (toneMap[agent.lang] || langInstruction);

    // Skills
    const skillsLine = (agent.skills && agent.skills.length > 0)
      ? `Your top skills: ${agent.skills.join(", ")}.`
      : "";

    // PDF Knowledge (optional — used only as additional context)
    const pdfLine = agent.pdfKnowledge
      ? `

ADDITIONAL KNOWLEDGE BASE (from uploaded PDF):
${agent.pdfKnowledge.slice(0, 3000)}

Use this knowledge to give more accurate answers when relevant.`
      : "";

    // Category-specific behavior
    const catLine = agCategory
      ? `You are a specialized expert in: ${agCategory}. Always give category-specific, professional, accurate answers.`
      : "";

    return `You are ${agEmoji} ${agName}${agCategory ? ` — Expert in ${agCategory}` : ""}.

${coreInstructions}

${catLine}
${expertiseLine}
${personalityLine}
${styleLine}
${skillsLine}
${langLine}

RULES:
- Always behave like a real ${agCategory || "domain"} expert
- Give specific, accurate, practical answers — never generic
- Use examples relevant to ${agCategory || "your domain"}
- Never break character or reveal you are an AI language model
- If user asks something outside your expertise, politely redirect to your domain

GLOBAL AI RULE (CRITICAL — always follow):
- Always provide accurate, fact-checked answers
- NEVER invent false information, fake statistics, fake names, or made-up facts
- If you are not 100% sure about something, clearly say "I'm not fully certain about this, but..." and give your best possible guidance
- It is always better to admit uncertainty than to confidently state something wrong
- When discussing numbers, dates, schemes, prices, or facts that may have changed, mention that the user should verify current details
${memCtx}${ctx}${pdfLine}`;
  })() : null;

  const sys = agentSys || `You are Saraswati AI — India's best AI assistant, created by Kunal Saraswat.
Never mention Groq, Meta, Llama, OpenAI or any model name.
${langInstruction}
${tNote}
Personality: Be warm, friendly, and expressive like a best friend. Naturally use emojis in your responses — not every sentence, but organically (1-3 emojis per response feels natural). Examples: use 😊 when being helpful, 🤔 when thinking through something, ✅ for confirmations, 💡 for ideas, 🔥 for exciting things, 👍 for agreements, 😄 for light moments. Never overdo it — keep it natural and human.
For coding: always provide complete, working, copy-paste ready code.
For education: clear explanations with examples, from beginner to advanced level.
For farming/mandi rates specifically: if user hasn't mentioned state/district, ask first.
For weather: use Latest Info directly if available.
For images: carefully read ALL visible text, describe objects, colors, and context in detail.
For media/video/cartoon/movie/song requests: give direct YouTube/platform links always.

GLOBAL AI RULE (CRITICAL — always follow):
Always provide accurate answers. Never invent false information, fake facts, fake names, or made-up statistics. If unsure about something, clearly say so (e.g. "Mujhe iske baare mein pura confidence nahi hai, lekin...") and give the best possible guidance instead of confidently stating something wrong. For dates, prices, schemes, or facts that may have changed, mention the user should verify current details.${memCtx}${ctx}${extraNote}`;

  if (imageB64) {
    const visionMsgs = [
      { role: "system", content: sys },
      { role: "user", content: [
        { type: "image_url", image_url: { url: "data:image/jpeg;base64," + imageB64 } },
        { type: "text", text: last.text || "What is in this image? Describe all details — text, objects, colors, and context." }
      ]}
    ];
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: visionMsgs,
        max_tokens: 2048,
        temperature: 0.6,
        top_p: 0.9,
        frequency_penalty: 0.6,
        presence_penalty: 0.4
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return dedupeRepeatedSentences(data.choices?.[0]?.message?.content || "No response.");
  }

  const lastContent = last.fileContext ? last.text + last.fileContext : last.text;
  const apiMsgs = [...messages.slice(0, -1).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.fileContext ? m.text + m.fileContext : m.text })), { role: "user", content: lastContent }];
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [{ role: "system", content: sys }, ...apiMsgs],
      max_tokens: 2048,
      temperature: 0.6,
      top_p: 0.9,
      frequency_penalty: 0.6,
      presence_penalty: 0.4
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  let answer = data.choices?.[0]?.message?.content || "No response.";
  answer = dedupeRepeatedSentences(answer);
  return answer;
}

// Guards against the model looping the same clause/sentence over and over
// (seen e.g. on "duniya ka sabse amir aadmi kaun hai" style prompts on llama-3.3).
function dedupeRepeatedSentences(text) {
  if (!text) return text;
  const parts = text.split(/(?<=[.!?।])\s+/);
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const key = p.trim().toLowerCase().replace(/\s+/g, " ");
    if (key.length > 8 && seen.has(key)) continue; // skip exact repeat sentence
    if (key.length > 8) seen.add(key);
    out.push(p);
  }
  return out.join(" ").trim();
}

// ── LONG-TERM MEMORY SYSTEM (ChatGPT-style) ─────────────────────
const MEM_CATEGORIES = ["preferences", "goals", "projects", "work", "learning", "personal", "custom"];
const MEM_CATEGORY_LABELS = {
  preferences: "⭐ Preferences", goals: "🎯 Goals", projects: "📁 Projects",
  work: "💼 Work", learning: "📚 Learning", personal: "👤 Personal", custom: "✏️ Custom"
};

// Detect explicit "remember that..." commands
function isExplicitMemoryCommand(text) {
  const t = text.toLowerCase().trim();
  return /^(remember (that|this|:)?|save (this|that|to memory)|note (that|this)|yaad rakho|yaad kar|memory in daal|store (this|that))/.test(t);
}

// Extract the fact from "remember that I am a developer" → "User is a developer"
function extractExplicitFact(text) {
  return text
    .replace(/^(remember (that|this|:)?|save (this|that|to memory)|note (that|this)|yaad rakho|yaad kar|memory in daal|store (this|that))\s*/i, "")
    .trim();
}

// Simple keyword-based semantic relevance score (0–1) between query and memory
function memoryRelevanceScore(memText, queryText) {
  if (!memText || !queryText) return 0;
  const m = memText.toLowerCase();
  const q = queryText.toLowerCase();
  const qWords = q.split(/\s+/).filter(w => w.length > 3);
  if (!qWords.length) return 0;
  const hits = qWords.filter(w => m.includes(w)).length;
  return hits / qWords.length;
}

// Fetch top-N most relevant memories for a given query
function getRelevantMemories(allMemories, queryText, topN = 8) {
  if (!allMemories || !allMemories.length) return [];
  const scored = allMemories.map(m => ({
    ...m,
    _score: (m.importance_score || 5) * 0.4 + memoryRelevanceScore(m.memory_content || m.text, queryText) * 0.6
  }));
  const sorted = scored.sort((a, b) => b._score - a._score);
  // Always include high-importance memories (>=8) regardless of keyword match
  const highImp = sorted.filter(m => (m.importance_score || 5) >= 8);
  const rest = sorted.filter(m => (m.importance_score || 5) < 8).slice(0, Math.max(0, topN - highImp.length));
  return [...highImp, ...rest].slice(0, topN);
}

// Full AI-powered memory analysis: detect save/update/skip, category, importance
async function analyzeMemory(userText, existingMemories) {
  if (!userText || userText.trim().length < 3) return null;
  try {
    const existingList = (existingMemories || []).slice(0, 40).map((m, i) =>
      `[${i}] (id:${m.id}) [${m.category || "personal"}] ${m.memory_content || m.text}`
    ).join("\n");

    const sys = `You are a memory manager for a personal AI assistant (like ChatGPT memory).

Your job: analyze the user's message and decide if any long-term memory should be saved, updated, or skipped.

Rules:
- SAVE: personal facts, preferences, skills, goals, projects, work info, learning topics, relationships, important dates
- UPDATE: if the new info contradicts or replaces an existing memory (e.g. "I now use Vue" replaces "I use React")
- SKIP: questions, generic requests, greetings, temporary context, one-time tasks
- EXPLICIT: if user says "remember that X", always SAVE or UPDATE

Categories: preferences | goals | projects | work | learning | personal | custom

Importance score 1-10:
- 10: name, profession, major life fact
- 7-9: skills, tools, preferences, goals
- 4-6: interests, habits, minor preferences
- 1-3: trivial facts

Existing memories:
${existingList || "(none yet)"}

Respond with ONLY valid JSON (no markdown):
{
  "action": "save" | "update" | "skip",
  "memory_content": "concise third-person fact (e.g. 'User is a software engineer')",
  "category": "preferences|goals|projects|work|learning|personal|custom",
  "importance_score": 1-10,
  "update_id": "existing memory id to replace, or null"
}`;

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ },
      body: JSON.stringify({ model: CHAT_MODEL, messages: [{ role: "system", content: sys }, { role: "user", content: userText }], max_tokens: 200, temperature: 0.1 })
    });
    const d = await r.json();
    let raw = (d.choices?.[0]?.message?.content || "").trim();
    // Strip markdown code fences if present
    raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    // Extract JSON object if wrapped in extra text
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || parsed.action === "skip" || !parsed.memory_content) return null;
    return {
      action: parsed.action === "update" ? "update" : "save",
      memory_content: String(parsed.memory_content).trim(),
      category: MEM_CATEGORIES.includes(parsed.category) ? parsed.category : "personal",
      importance_score: Math.min(10, Math.max(1, parseInt(parsed.importance_score) || 5)),
      update_id: parsed.update_id && parsed.update_id !== "null" ? String(parsed.update_id) : null
    };
  } catch { return null; }
}

const SARASWATI_VOICE_PRIORITY = [
  /Google हिन्दी/i,
  /Microsoft Swara/i,
  /female.*hi-IN/i,
  /hi-IN/i,
  /female|woman|girl|zira|heera|priya|aditi/i,
];

function pickSaraswatiVoice(vs) {
  for (const pattern of SARASWATI_VOICE_PRIORITY) {
    const found = vs.find(x => pattern.test(x.name) || pattern.test(x.lang));
    if (found) return found;
  }
  return vs[0] || null;
}

// Was flipping between Orpheus (English voice) and the browser's Hindi
// voice from one reply to the next whenever the ratio of Devanagari vs
// Latin characters tipped slightly — that's what caused the voice to
// noticeably "change/baari-baari" mid-conversation. Since this app is
// Hindi-first (Hinglish replies), we now only switch to the English
// Orpheus voice when the text is OVERWHELMINGLY English (almost no
// Devanagari at all) — any real Hindi content keeps the consistent
// Hindi voice instead of toggling engines every other message.
function isMostlyDevanagari(text) {
  const dev = (text.match(/[\u0900-\u097F]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (dev === 0 && latin === 0) return true; // no letters (emojis/numbers) — stay on Hindi voice
  if (dev > 0) return true;                  // any Devanagari at all → Hindi voice (sticky)
  return latin === 0;                        // pure non-Latin, non-Devanagari edge case
}

// Splits text into chunks no longer than `max` chars, breaking on sentence
// boundaries where possible (Orpheus TTS has a 200-char input limit).
function chunkForTTS(text, max = 190) {
  const sentences = text.split(/(?<=[.!?।])\s+/);
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + " " + s).trim().length > max) {
      if (cur.trim()) chunks.push(cur.trim());
      cur = s.length > max ? s.slice(0, max) : s; // hard-truncate runaway sentence
    } else {
      cur = (cur + " " + s).trim();
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [text.slice(0, max)];
}

let ttsAudioRef = null; // tracks the currently-playing Orpheus <audio> element

function stopOrpheusAudio() {
  if (ttsAudioRef) {
    try { ttsAudioRef.pause(); ttsAudioRef.src = ""; } catch {}
    ttsAudioRef = null;
  }
}

function stopAllSpeech() {
  stopOrpheusAudio();
  try { window.speechSynthesis?.cancel(); } catch {}
}

// ── SARVAM AI — Natural Hindi TTS (Indian Startup) ──────────────
// Sarvam AI is an Indian AI startup with best-in-class Hindi/Hinglish TTS.
// Model: bulbul:v2 — supports hi-IN, natural prosody, male & female voices.
// Voices: anushka (female), arjun (male)
async function speakWithSarvam(text, tone, onDone, opts = {}) {
  if (!SARVAM) throw new Error("No Sarvam API key");
  const chunks = chunkForTTS(text, 500);
  const speaker = tone === "male" ? "arjun" : "anushka";
  const pitch = opts.pitch ?? 0;
  const pace = opts.pace ?? 1.15;
  const loudness = opts.loudness ?? 1.5;
  for (const chunk of chunks) {
    const res = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": SARVAM
      },
      body: JSON.stringify({
        inputs: [chunk],
        target_language_code: "hi-IN",
        speaker,
        pitch,
        pace,
        loudness,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: "bulbul:v2"
      })
    });
    if (!res.ok) throw new Error("Sarvam TTS failed: " + res.status);
    const data = await res.json();
    // Sarvam returns base64 audio
    const b64 = data.audios?.[0];
    if (!b64) throw new Error("No audio from Sarvam");
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      const audio = new Audio(url);
      ttsAudioRef = audio;
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("playback failed")); };
      audio.play().catch(reject);
    });
  }
  if (onDone) onDone();
}

async function speakWithOrpheus(text, voice, onDone) {
  const chunks = chunkForTTS(text);
  for (let i = 0; i < chunks.length; i++) {
    const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ },
      body: JSON.stringify({
        model: "canopylabs/orpheus-v1-english",
        voice,
        input: chunks[i],
        response_format: "mp3"
      })
    });
    if (!res.ok) throw new Error("TTS request failed: " + res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      const audio = new Audio(url);
      ttsAudioRef = audio;
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("playback failed")); };
      audio.play().catch(reject);
    });
  }
  if (onDone) onDone();
}

function speakWithBrowserTTS(text, speed, onDone) {
  // Check browser speech synthesis support (Samsung Internet, UC Browser may not support)
  if (!window.speechSynthesis) { if (onDone) onDone(); return; }
  window.speechSynthesis.cancel();
  const clean = text.replace(/```[\s\S]*?```/g, "code block").replace(/\*\*/g, "").replace(/`/g, "").replace(/#+\s/g, "").replace(/[^ -ऀ-ॿ .,!?]/g, "").slice(0, 600);
  const go = () => {
    const vs = window.speechSynthesis.getVoices();
    const v = pickSaraswatiVoice(vs);
    const u = new SpeechSynthesisUtterance(clean);
    if (v) u.voice = v;
    u.lang = "hi-IN";
    u.rate = speed || 1.1;
    u.pitch = 1.05;
    u.volume = 1;
    u.onend = onDone || null; u.onerror = onDone || null;
    window.speechSynthesis.speak(u);
  };
  if (!window.speechSynthesis.getVoices().length) { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; go(); }; } else go();
}

// ── MAIN TTS ROUTER ─────────────────────────────────────────────
// Priority: Hindi → Sarvam AI (natural) → Browser TTS (fallback)
//           English → Orpheus (Groq) → Browser TTS (fallback)
function speakText(text, tone, speed, onDone) {
  stopOrpheusAudio();
  window.speechSynthesis.cancel();
  const clean = text.replace(/```[\s\S]*?```/g, " code block ").replace(/\*\*/g, "").replace(/`/g, "").replace(/#+\s/g, "").trim();
  if (!clean) { if (onDone) onDone(); return; }

  if (isMostlyDevanagari(clean)) {
    speakWithSarvam(clean.slice(0, 2000), tone, onDone).catch(() => {
      speakWithBrowserTTS(clean, speed, onDone);
    });
    return;
  }
  // English greeting - detect "Hey! I am Saraswati" for expressive delivery
  const isGreeting = clean.includes("I am Saraswati");

  // English/Hinglish — use Orpheus (Groq) for natural English voice
  const voice = tone === "male" ? "austin" : "hannah";
  speakWithOrpheus(clean.slice(0, 1800), voice, onDone).catch(() => {
    speakWithBrowserTTS(clean, speed, onDone);
  });
  void isGreeting; // used above for future opts
}

// ── SARASWATI LOGO — Premium Saffron Lotus ─────────────────────
function SaraswatiLogo({ size = 32, animate = false, state = "idle" }) {
  const animStyle = {
    idle:     { animation: "logoGlow 3s ease-in-out infinite" },
    thinking: { animation: "logoRotate 1.6s linear infinite" },
    speaking: { animation: "logoPulse 0.7s ease-in-out infinite" },
  }[state] || {};
  const finalStyle = animate ? animStyle : {};

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={finalStyle}>
      <defs>
        <linearGradient id="saffronGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff9933"/>
          <stop offset="100%" stopColor="#e8650a"/>
        </linearGradient>
        <linearGradient id="deepSaffron" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#c94e00"/>
          <stop offset="100%" stopColor="#ff7722"/>
        </linearGradient>
        <linearGradient id="petalGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffb347"/>
          <stop offset="100%" stopColor="#e8550a"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Outer ring */}
      <circle cx="24" cy="24" r="22" stroke="url(#saffronGrad)" strokeWidth="0.8" opacity="0.4"/>
      <circle cx="24" cy="24" r="18" stroke="url(#deepSaffron)" strokeWidth="0.5" opacity="0.3"/>

      {/* 8 lotus petals — saffron bhagva */}
      {[0,45,90,135,180,225,270,315].map((deg, i) => (
        <g key={i} transform={`rotate(${deg} 24 24)`} filter="url(#glow)">
          <ellipse cx="24" cy="10" rx="2.8" ry="7" fill="url(#petalGrad)" opacity={i % 2 === 0 ? 0.95 : 0.65}/>
          <line x1="24" y1="5" x2="24" y2="15" stroke="#ffd280" strokeWidth="0.4" opacity="0.7"/>
        </g>
      ))}

      {/* Inner gold ring */}
      <circle cx="24" cy="24" r="7" fill="url(#saffronGrad)" filter="url(#glow)"/>
      {/* Center white core */}
      <circle cx="24" cy="24" r="4" fill="white" opacity="0.95"/>
      {/* Center dot */}
      <circle cx="24" cy="24" r="1.5" fill="url(#saffronGrad)"/>
    </svg>
  );
}

// ── CODE BLOCK ─────────────────────────────────────────────────
function CodeBlock({ code, lang }) {
  const [cp, setCp] = useState(false);
  const [pv, setPv] = useState(false);
  const ok = ["html","css","js","javascript",""].includes((lang || "").toLowerCase());
  return (
    <div style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 10, margin: "6px 0", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 12px", background: "#141414", borderBottom: "1px solid #222" }}>
        <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{lang || "code"}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {ok && <button onClick={() => setPv(v => !v)} style={{ background: "none", border: "none", color: pv ? "#f97316" : "#6b7280", cursor: "pointer", fontSize: 11, padding: "2px 6px" }}>{pv ? "✕ Close" : "▶ Preview"}</button>}
          <button onClick={() => { navigator.clipboard?.writeText(code); setCp(true); setTimeout(() => setCp(false), 2000); }} style={{ background: "none", border: "none", color: cp ? "#22c55e" : "#6b7280", cursor: "pointer", fontSize: 11, padding: "2px 6px" }}>{cp ? "✓ Copied" : "Copy"}</button>
        </div>
      </div>
      <pre style={{ padding: "12px", margin: 0, overflowX: "auto", fontSize: 12, lineHeight: 1.6, color: "#e5e7eb", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{code}</pre>
      {pv && ok && <div style={{ borderTop: "1px solid #222" }}><div style={{ padding: "4px 12px", background: "#141414", fontSize: 11, color: "#f97316" }}>🌐 Live Preview</div><iframe srcDoc={lang === "css" ? "<style>" + code + "</style><p>Preview</p>" : code} style={{ width: "100%", minHeight: 200, border: "none", background: "#fff" }} sandbox="allow-scripts" title="preview" /></div>}
    </div>
  );
}
function getLinkMeta(url) {
  if (url.includes("youtube.com") || url.includes("youtu.be"))
    return { label: "YouTube pe dekho", icon: "▶", color: "#ff0000", bg: "#ff00001a" };
  if (url.includes("spotify.com"))
    return { label: "Spotify pe suno", icon: "♪", color: "#1db954", bg: "#1db9541a" };
  if (url.includes("hotstar.com"))
    return { label: "Hotstar pe dekho", icon: "★", color: "#1f80e0", bg: "#1f80e01a" };
  if (url.includes("netflix.com"))
    return { label: "Netflix pe dekho", icon: "N", color: "#e50914", bg: "#e509141a" };
  if (url.includes("primevideo.com") || url.includes("amazon.com"))
    return { label: "Prime Video", icon: "P", color: "#00a8e0", bg: "#00a8e01a" };
  if (url.includes("jiocinema.com"))
    return { label: "JioCinema pe dekho", icon: "J", color: "#8b5cf6", bg: "#8b5cf61a" };
  if (url.includes("play.google.com"))
    return { label: "Play Store", icon: "▲", color: "#01875f", bg: "#01875f1a" };
  if (url.includes("gaana.com"))
    return { label: "Gaana pe suno", icon: "🎵", color: "#e72c30", bg: "#e72c301a" };
  return { label: url.replace(/^https?:\/\//, "").slice(0, 30), icon: "🔗", color: "var(--accent)", bg: "var(--sf2)" };
}

function LinkCard({ url }) {
  const meta = getLinkMeta(url);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6,
        background: meta.bg, border: "1px solid " + meta.color + "44",
        borderRadius: 14, padding: "10px 14px", textDecoration: "none",
        color: "var(--tx)", cursor: "pointer" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{meta.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--tx)" }}>{meta.label}</div>
        <div style={{ fontSize: 11, color: "var(--mt)", marginTop: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url.replace(/^https?:\/\//, "")}</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mt)" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    </a>
  );
}

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
          // URL detection — render as clickable LinkCard
          const urlRe = /(https?:\/\/[^\s\)\]>"]+)/g;
          if (urlRe.test(line)) {
            urlRe.lastIndex = 0;
            const lineSegs = []; let lLast = 0, um;
            while ((um = urlRe.exec(line)) !== null) {
              if (um.index > lLast) lineSegs.push(<span key={lLast}>{line.slice(lLast, um.index)}</span>);
              lineSegs.push(<LinkCard key={um.index} url={um[1]} />);
              lLast = um.index + um[0].length;
            }
            if (lLast < line.length) lineSegs.push(<span key={lLast}>{line.slice(lLast)}</span>);
            return <span key={i + "-" + j} style={{ display: "flex", flexDirection: "column" }}>{lineSegs}</span>;
          }
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

// ── ICONS — Gemini/Google Style ────────────────────────────────
const Ico = {
  // Speaker icon — rounded wave style
  Speak: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4V5z"/>
    <path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>
  </svg>,

  // Stop — rounded square
  Stop: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="5" width="14" height="14" rx="3"/>
  </svg>,

  // Copy — Google style two-page icon
  Copy: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="12" height="12" rx="2.5"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>,

  // Check — thick rounded tick
  Check: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17 4 12"/>
  </svg>,

  // Share — upload style arrow
  Share: ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
    <polyline points="16 8 12 4 8 8"/><line x1="12" y1="4" x2="12" y2="16"/>
  </svg>,

  // Mic — Google style rounded mic
  Mic: ({ on }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="9" y="2" width="6" height="12" rx="3" fill={on ? "#ef4444" : "none"} stroke={on ? "#ef4444" : "currentColor"} strokeWidth="1.8"/>
    <path d="M5 10a7 7 0 0 0 14 0"/>
    <line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/>
  </svg>,

  // Search — clean circle + handle
  Search: ({ s = 15 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
  </svg>,

  // Chevron right
  ChevRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>,

  // Back arrow
  Back: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>,

  // Chat bubble — Google rounded style
  Chat: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>,

  // Settings — gear Gemini style
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>,

  // Voice — waveform style (Gemini)
  Voice: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>,

  // Project folder — rounded
  Project: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
  </svg>,

  // More — vertical 3 dots (Gemini style)
  More: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
  </svg>,

  // History — clock with arrow
  History: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
  </svg>,

  // Regen — refresh arrows
  Regen: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
    <path d="M3 21v-5h5"/>
  </svg>,

  // Delete — trash
  Delete: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>,

  // Hamburger menu
  Menu: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>,
};

// ── STYLES ──────────────────────────────────────────────────────
function buildStyles(themeKey, accentKey, fontSize) {
  const v = THEMES[themeKey] || THEMES.dark;
  const a = ACCENTS[accentKey] || ACCENTS.orange;
  const dark = themeKey !== "light";
  const fs = fontSize || 14;
  return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
:root{--accent:${a.primary};--grad:${a.grad};--glow:${a.glow};--bd:${v.bd};--mt:${v.mt};--sf2:${v.sf2};--tx:${v.tx};}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
html,body{height:100%;overflow:hidden;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${v.bg};color:${v.tx};font-size:${fs}px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
.app{display:flex;flex-direction:column;height:100vh;height:100dvh;max-width:480px;margin:0 auto;background:${v.bg};position:relative;overflow:hidden;}

.pwa{position:fixed;bottom:70px;left:10px;right:10px;background:${dark?"#1a1a1a":"#fff"};border:1.5px solid var(--accent);border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:10px;z-index:150;box-shadow:0 8px 28px #0009;animation:fadeUp .3s ease;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
.pwa-btn{background:var(--accent);border:none;border-radius:10px;color:#fff;cursor:pointer;font-size:12px;font-weight:700;padding:7px 13px;font-family:'Inter',sans-serif;}
.pwa-x{background:none;border:none;color:${v.mt};cursor:pointer;font-size:17px;padding:2px 6px;}

.sb-overlay{position:fixed;inset:0;background:#0009;z-index:50;animation:fadeIn .2s ease;}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
.sidebar{position:fixed;top:0;left:0;bottom:0;width:86%;max-width:320px;background:${v.navBg};z-index:51;display:flex;flex-direction:column;animation:sbIn .25s cubic-bezier(.4,0,.2,1);overflow:hidden;border-right:1px solid ${v.bd};}
@keyframes sbIn{from{transform:translateX(-100%);}to{transform:translateX(0);}}
.sb-head{display:flex;align-items:center;gap:10px;padding:18px 16px 14px;border-bottom:1px solid ${v.bd};}
.sb-logo{font-size:26px;}
.sb-title{font-size:17px;font-weight:800;flex:1;letter-spacing:-.4px;}
.sb-close{background:none;border:none;color:${v.mt};cursor:pointer;font-size:20px;padding:4px 8px;line-height:1;border-radius:8px;}
.sb-user{display:flex;align-items:center;gap:11px;padding:14px 16px;border-bottom:1px solid ${v.bd};}
.sb-uinfo{flex:1;min-width:0;}
.sb-uname{font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sb-email{font-size:11px;color:${v.mt};margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sb-nav{flex:1;overflow-y:auto;padding:8px 8px 0;}
.sb-nav::-webkit-scrollbar{width:0;}.sb-nav{scrollbar-width:none;-ms-overflow-style:none;}
.sb-section{font-size:10px;font-weight:700;color:${v.mt};letter-spacing:.12em;text-transform:uppercase;padding:12px 10px 5px;}
.sb-item{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:500;color:${v.tx};transition:background .15s;margin-bottom:1px;width:100%;}
.sb-item:hover{background:${v.sf2};}
.sb-item.active{background:${v.sf2};color:var(--accent);font-weight:600;}
.sb-item.active svg{stroke:var(--accent);}
.sb-recent{max-height:200px;overflow-y:auto;padding:0 2px;}
.sb-recent::-webkit-scrollbar{width:0;}.sb-recent{scrollbar-width:none;-ms-overflow-style:none;}
.sb-ritem{display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:10px;cursor:pointer;font-size:13px;color:${v.mt};transition:background .15s;}
.sb-ritem:hover{background:${v.sf2};color:${v.tx};}
.sb-rtxt{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;}
.sb-rdate{font-size:10px;opacity:.6;flex-shrink:0;}
.sb-bottom{padding:10px 8px;border-top:1px solid ${v.bd};}
.sb-logout{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:500;color:#ef4444;}
.sb-logout:hover{background:#ef444414;}
.sb-upgrade{margin:0 0 6px;background:var(--grad);border-radius:14px;padding:14px;cursor:pointer;}
.sb-upgrade h4{font-size:14px;font-weight:700;color:#fff;}
.sb-upgrade p{font-size:11px;color:#ffffffaa;margin-top:3px;}

.auth{flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 22px;gap:14px;}
.auth-logo{font-size:50px;}
.auth-title{font-size:24px;font-weight:800;letter-spacing:-.5px;}
.auth-sub{font-size:13px;color:${v.mt};text-align:center;}
.card{width:100%;background:${v.sf};border:1px solid ${v.bd};border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:12px;}
.card-head{font-size:17px;font-weight:700;text-align:center;}
.iw{display:flex;flex-direction:column;gap:4px;}
.ilbl{font-size:10px;color:${v.mt};font-weight:700;letter-spacing:.07em;text-transform:uppercase;}
.inp{background:${dark?"#111":v.sf2};border:1.5px solid ${v.bd};border-radius:12px;color:${v.tx};font-family:'Inter',sans-serif;font-size:16px;padding:12px 14px;outline:none;width:100%;transition:border-color .2s;-webkit-appearance:none;appearance:none;}
.inp:focus{border-color:var(--accent);}
.btn{border:none;border-radius:12px;cursor:pointer;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;padding:13px;transition:all .2s;width:100%;}
.btn-p{background:var(--grad);color:#fff;}.btn-p:hover{opacity:.9;}.btn-p:disabled{opacity:.55;cursor:not-allowed;}
.btn-s{background:${v.sf2};color:${v.tx};border:1px solid ${v.bd};}
.btn-danger{background:#ef4444;color:#fff;}.btn-danger:hover{opacity:.9;}.btn-danger:disabled{opacity:.55;cursor:not-allowed;}
.lnk{font-size:13px;color:${v.mt};text-align:center;}.lnk span{color:var(--accent);cursor:pointer;font-weight:600;}
.err{color:#ef4444;font-size:13px;text-align:center;background:#ef444412;padding:9px;border-radius:10px;}
.ok{color:#22c55e;font-size:13px;text-align:center;background:#22c55e12;padding:9px;border-radius:10px;}

.hdr{display:flex;align-items:center;gap:10px;padding:11px 14px;background:${v.bg};border-bottom:1px solid ${v.bd};flex-shrink:0;position:relative;z-index:10;}
.hdr-name{font-size:17px;font-weight:800;flex:1;letter-spacing:-.3px;}
.dots{background:none;border:none;color:${v.tx};cursor:pointer;padding:5px;border-radius:10px;line-height:1;display:flex;align-items:center;justify-content:center;}
.nbtn{background:${v.sf2};border:1px solid ${v.bd};border-radius:10px;color:${v.tx};cursor:pointer;font-size:13px;font-weight:600;padding:6px 12px;}

.chat{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;}
.chat::-webkit-scrollbar{width:0;}.chat{scrollbar-width:none;-ms-overflow-style:none;}
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:40px 20px;}
.wlotus{font-size:96px;cursor:pointer;line-height:1;display:block;animation:wFloat 4s ease-in-out infinite;}
@keyframes wFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
.welcome h2{font-size:26px;font-weight:800;letter-spacing:-.5px;}
.wsub{font-size:13px;color:${v.mt};max-width:220px;line-height:1.7;}

.mwrap{display:flex;flex-direction:column;gap:2px;animation:mIn .2s ease;}
@keyframes mIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
.mrow{display:flex;gap:7px;align-items:flex-end;}.mrow.user{flex-direction:row-reverse;}
.bwrap{display:flex;flex-direction:column;max-width:82%;}
.bub{padding:11px 15px;font-size:${fs}px;line-height:1.65;word-break:break-word;}
.bub.user{background:var(--grad);color:#fff;border-radius:20px 20px 4px 20px;}
.bub.ai{background:${v.bub};color:${v.tx};border:1px solid ${v.bd};border-radius:20px 20px 20px 4px;}
.rbar{display:flex;gap:2px;padding:4px 8px;background:${v.sf};border:1px solid ${v.bd};border-radius:24px;position:absolute;top:-42px;left:0;z-index:10;box-shadow:0 4px 16px #0007;animation:fadeIn .15s;}
.rbtn{background:none;border:none;cursor:pointer;font-size:20px;padding:2px 4px;border-radius:8px;transition:transform .12s;}.rbtn:hover{transform:scale(1.3);}
.react{font-size:15px;padding-left:4px;margin-top:2px;}
.acts{display:flex;gap:4px;padding:3px 2px 0;flex-wrap:wrap;}
.abtn{background:none;border:1px solid ${v.bd};color:${v.mt};cursor:pointer;padding:4px 7px;border-radius:20px;display:flex;align-items:center;justify-content:center;transition:all .15s;line-height:1;}
.abtn:hover{color:var(--accent);border-color:var(--accent);}.abtn.on{color:var(--accent);border-color:var(--accent);background:var(--glow);}
.mtime{font-size:10px;color:${v.mt};padding:0 3px;}.mtime.user{text-align:right;}
.aiav{width:27px;height:27px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
.tbub{background:${v.bub};border:1px solid ${v.bd};border-radius:20px 20px 20px 4px;padding:13px 17px;display:flex;gap:5px;}
.dot{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:bou 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}.dot:nth-child(3){animation-delay:.4s;}
@keyframes bou{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-5px);}}
.sind{font-size:11px;color:var(--accent);padding:4px 10px;background:var(--glow);border-radius:20px;display:inline-flex;align-items:center;gap:4px;}
.mimg{max-width:200px;border-radius:12px;margin-bottom:4px;display:block;cursor:pointer;}
.mimg.gen{width:240px;max-width:100%;border-radius:14px;cursor:pointer;}

.imgviewer{position:fixed;inset:0;background:#000e;z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease;}
.imgviewer img{max-width:100%;max-height:90dvh;border-radius:12px;object-fit:contain;}
.imgviewer-x{position:absolute;top:18px;right:18px;background:#fff2;border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:20px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);}

.sb-premium{margin:0 0 8px;border-radius:16px;padding:2px;background:var(--grad);position:relative;overflow:hidden;}
.sb-premium::after{content:'';position:absolute;inset:0;background:var(--grad);animation:premGlow 3s ease-in-out infinite;opacity:.5;pointer-events:none;}
@keyframes premGlow{0%,100%{opacity:.3;}50%{opacity:.8;}}
.sb-premium-inner{background:${dark?"#0d0d0d":v.sf};border-radius:14px;padding:14px;position:relative;z-index:1;}
.sb-prem-plans{display:flex;gap:8px;margin-top:10px;}
.pplan{flex:1;border-radius:12px;padding:10px 8px;cursor:pointer;text-align:center;border:1.5px solid transparent;transition:all .2s;}
.pplan.month{background:var(--grad);}.pplan.week{background:transparent;border-color:var(--accent);}
.pplan-price{font-size:16px;font-weight:800;color:#fff;}.pplan.week .pplan-price{color:var(--accent);}
.pplan-label{font-size:10px;color:rgba(255,255,255,.75);margin-top:2px;}.pplan.week .pplan-label{color:var(--accent);}
.pplan-feats{font-size:10px;margin-top:6px;color:rgba(255,255,255,.85);line-height:1.6;text-align:left;white-space:pre-line;}.pplan.week .pplan-feats{color:${v.mt};}

@keyframes fabPop{0%,100%{box-shadow:0 6px 24px ${a.glow};}50%{box-shadow:0 6px 32px ${a.glow},0 0 0 8px ${a.glow.replace("40","15")};}}
.fab{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--grad);border:none;border-radius:50px;color:#fff;cursor:pointer;display:flex;align-items:center;gap:8px;padding:14px 26px;font-size:14px;font-weight:700;font-family:'Inter',sans-serif;z-index:40;animation:fabPop 3s ease-in-out infinite;transition:transform .2s;}
.fab:hover{transform:translateX(-50%) scale(1.05);}
.fab:active{transform:translateX(-50%) scale(.97);}

.hactions{display:flex;gap:4px;flex-shrink:0;}
.hact{background:none;border:none;color:${v.mt};cursor:pointer;padding:5px 6px;border-radius:8px;font-size:15px;line-height:1;}
.hact:hover{color:var(--accent);background:${v.sf2};}
.hact.del:hover{color:#ef4444;}

.ibar{padding:0 12px 12px;background:${v.bg};flex-shrink:0;}
.ibar-upgrade{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:${v.sf2};border-radius:14px 14px 0 0;margin-bottom:0;border:1px solid ${v.bd};border-bottom:none;}
.ibar-upgrade-txt{font-size:12px;color:${v.mt};}
.ibar-upgrade-btn{font-size:12px;font-weight:700;color:var(--accent);cursor:pointer;border:none;background:none;font-family:'Inter',sans-serif;}
.ibar-box{background:${v.sf};border:1.5px solid ${v.bd};border-radius:${dark?"0 0 18px 18px":"0 0 18px 18px"};padding:12px 14px 10px;}
.tinp{width:100%;background:transparent;border:none;color:${v.tx};font-family:'Inter',sans-serif;font-size:${fs}px;padding:0;outline:none;resize:none;max-height:130px;min-height:24px;line-height:1.6;}
.tinp::placeholder{color:${v.mt};}
.ibar-bottom{display:flex;align-items:center;justify-content:space-between;margin-top:10px;}
.ibar-left{display:flex;align-items:center;gap:8px;}
.ibar-right{display:flex;align-items:center;gap:8px;}
.ibtn{background:${v.sf2};border:1.5px solid ${v.bd};border-radius:50%;color:${v.tx};cursor:pointer;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;}
.ibtn:hover{border-color:var(--accent);}.ibtn.rec{border-color:#ef4444;background:#ef444418;animation:mPulse 1s infinite;}
.model-pill{background:${v.sf2};border:1.5px solid ${v.bd};border-radius:20px;color:${v.mt};font-size:12px;font-weight:600;padding:6px 12px;cursor:pointer;font-family:'Inter',sans-serif;}
.sbtn{background:var(--grad);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:18px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .15s;}
.sbtn:hover{transform:scale(1.05);}.sbtn:disabled{opacity:.4;cursor:not-allowed;}
@keyframes mPulse{0%,100%{box-shadow:0 0 0 0 #ef444438;}50%{box-shadow:0 0 0 5px transparent;}}
.imgprev{position:relative;display:inline-block;margin-bottom:7px;}
.imgprev img{width:72px;height:72px;object-fit:cover;border-radius:12px;border:2px solid var(--accent);}
.imgprev-x{position:absolute;top:-5px;right:-5px;background:#ef4444;border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:11px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;}

.page{flex:1;overflow-y:auto;display:flex;flex-direction:column;}
.page::-webkit-scrollbar{width:0;}.page{scrollbar-width:none;-ms-overflow-style:none;}
.page-inner{padding:14px 14px 30px;flex:1;}
.ptitle{font-size:20px;font-weight:800;margin-bottom:16px;letter-spacing:-.4px;}

.sbar{display:flex;align-items:center;background:${v.sf};border:1.5px solid ${v.bd};border-radius:12px;padding:8px 13px;gap:7px;margin-bottom:10px;}
.sbar input{flex:1;background:none;border:none;outline:none;color:${v.tx};font-size:14px;font-family:'Inter',sans-serif;}
.sec{font-size:10px;font-weight:700;color:${v.mt};letter-spacing:.12em;text-transform:uppercase;padding:16px 0 6px;}
.scard{background:${v.sf};border:1px solid ${v.bd};border-radius:16px;overflow:hidden;margin-bottom:8px;}
.srow{display:flex;align-items:center;gap:13px;padding:14px 16px;border-bottom:1px solid ${v.bd};min-height:54px;}
.srow:last-child{border-bottom:none;}
.sicon{font-size:18px;width:26px;text-align:center;flex-shrink:0;}
.stxt{flex:1;min-width:0;}
.slbl{font-size:14px;font-weight:600;}
.sdesc{font-size:12px;color:${v.mt};margin-top:2px;}
.sright{flex-shrink:0;display:flex;align-items:center;gap:6px;}
.sexpand{overflow:hidden;transition:max-height .28s cubic-bezier(.4,0,.2,1);}
.sexpand-inner{padding:12px 16px 16px;display:flex;flex-direction:column;gap:8px;border-top:1px solid ${v.bd};}
.opt-row{display:flex;gap:6px;flex-wrap:wrap;}
.opt-pill{padding:7px 14px;border-radius:20px;border:1.5px solid ${v.bd};background:transparent;color:${v.mt};cursor:pointer;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;transition:all .2s;}
.opt-pill.sel{border-color:var(--accent);color:var(--accent);background:var(--glow);}
.cdot{width:24px;height:24px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:all .2s;}
.cdot.sel{border-color:var(--accent);box-shadow:0 0 0 2px var(--glow);}
.tgl{position:relative;width:44px;height:24px;background:${v.sf2};border-radius:12px;cursor:pointer;border:2px solid ${v.bd};transition:background .2s;flex-shrink:0;}
.tgl.on{background:var(--accent);border-color:var(--accent);}
.tk{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;}
.tgl.on .tk{left:22px;}

.pav{position:relative;display:inline-block;}
.pavimg{width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid var(--accent);}
.pavph{width:64px;height:64px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;}
.paved{position:absolute;bottom:0;right:0;background:var(--accent);border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;}

.hcard{background:${v.sf};border:1px solid ${v.bd};border-radius:14px;padding:13px 15px;display:flex;align-items:center;gap:11px;cursor:pointer;transition:border-color .2s;margin-bottom:6px;}
.hcard:hover{border-color:var(--accent);}
.hi{flex:1;overflow:hidden;}
.ht{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hm{font-size:11px;color:${v.mt};margin-top:2px;}
.dbtn{background:none;border:none;color:${v.mt};cursor:pointer;font-size:16px;padding:5px 7px;border-radius:8px;}
.dbtn:hover{color:#ef4444;}

.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:10px;}
.sct{background:${v.sf};border:1px solid ${v.bd};border-radius:14px;padding:15px;}
.sv{font-size:26px;font-weight:800;color:var(--accent);}
.sl{font-size:12px;color:${v.mt};margin-top:2px;}
.ucard{background:${v.sf};border:1px solid ${v.bd};border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:11px;margin-bottom:6px;}
.uav{width:36px;height:36px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:15px;flex-shrink:0;}
.badge{background:var(--grad);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
.badge-g{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
.badge-y{background:linear-gradient(135deg,#eab308,#ca8a04);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
.gbar{display:flex;align-items:flex-end;gap:4px;height:64px;margin-top:4px;}

.mbg{position:fixed;inset:0;background:#000c;z-index:200;display:flex;align-items:flex-end;padding:14px;}
.modal{background:${v.sf};border-radius:24px 24px 16px 16px;padding:26px 22px;width:100%;max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:13px;max-height:88vh;overflow-y:auto;}
.modal h3{font-size:20px;font-weight:700;text-align:center;}
.modal p{font-size:13px;color:${v.mt};text-align:center;line-height:1.6;}
.mi{font-size:50px;text-align:center;}
.pbox{background:${v.sf2};border:1px solid ${v.bd};border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:9px;}
.pnum{font-size:22px;font-weight:800;color:var(--accent);text-align:center;letter-spacing:2px;}
.pstep{font-size:13px;color:${v.tx};display:flex;gap:7px;}
.ld{text-align:center;color:${v.mt};padding:20px;font-size:14px;}

.vpage{position:fixed;inset:0;background:#000;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:60px 24px 48px;}
.vorb-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:200px;height:200px;}
.vring{position:absolute;border-radius:50%;pointer-events:none;}
.vr1{animation:vra 2.2s ease-out infinite;background:radial-gradient(circle,#ff993440,transparent);}
.vr2{animation:vra 2.2s ease-out .7s infinite;background:radial-gradient(circle,#ff772240,transparent);}
@keyframes vra{0%{width:120px;height:120px;opacity:1;}100%{width:240px;height:240px;opacity:0;}}
.vorb{width:130px;height:130px;border-radius:50%;background:linear-gradient(135deg,#c94e00,#ff9933);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;position:relative;box-shadow:0 0 60px #ff993360;transition:all .3s;}
.vorb.listen{background:linear-gradient(135deg,#c94e00,#ffb347);box-shadow:0 0 80px #ff9933aa;animation:orbBreath 1.5s ease-in-out infinite;}
.vorb.think{background:linear-gradient(135deg,#e8650a,#ff7722);box-shadow:0 0 60px #ff772280;}
.vorb.speak{background:linear-gradient(135deg,#ff7722,#ff9933);box-shadow:0 0 80px #ff9933cc;animation:orbPulse 0.8s ease-in-out infinite;}
@keyframes orbBreath{0%,100%{transform:scale(1);}50%{transform:scale(1.06);}}
@keyframes orbPulse{0%,100%{transform:scale(1);box-shadow:0 0 60px #3b82f6aa;}50%{transform:scale(1.08);box-shadow:0 0 100px #3b82f6ee;}}
.vtranscript{min-height:60px;max-height:120px;width:100%;text-align:center;font-size:16px;color:#fff;line-height:1.6;padding:0 12px;}
.vtranscript-interim{color:#93c5fd;font-style:italic;}
.vstatus{font-size:16px;font-weight:600;color:#fff;text-align:center;letter-spacing:.3px;}
.vsub{font-size:13px;color:#4b5563;text-align:center;}
.vwave{display:flex;align-items:center;gap:4px;height:32px;justify-content:center;}
.wb{width:3px;border-radius:3px;background:#ff9933;animation:wv .9s ease-in-out infinite;}
@keyframes wv{0%,100%{height:5px;opacity:.4;}50%{height:28px;opacity:1;}}
.vbottom{display:flex;align-items:center;gap:24px;}
.vbtn{width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;transition:all .2s;}
.vbtn-end{background:#ef4444;color:#fff;width:70px;height:70px;font-size:26px;}
.vbtn-end:hover{background:#dc2626;}
.vbtn-mute{background:#1f2937;color:#9ca3af;}
.vbtn-mute.active{background:#374151;color:#fff;}

.achat{max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:7px;background:${v.sf2};border-radius:12px;}

.pc{background:var(--grad);border-radius:18px;padding:18px;margin-bottom:6px;cursor:pointer;}
.pc h3{font-size:17px;font-weight:800;color:#fff;}
.pc p{font-size:12px;color:#ffffffaa;margin-top:3px;}
.pf{font-size:13px;color:#fff;display:flex;align-items:center;gap:7px;margin-top:5px;}

.toast{position:fixed;top:70px;left:50%;transform:translateX(-50%);background:${v.sf};border:1px solid var(--accent);border-radius:20px;padding:8px 16px;font-size:12px;font-weight:600;color:var(--accent);z-index:500;animation:fadeUp .3s ease;white-space:nowrap;box-shadow:0 4px 20px #0006;}
@keyframes logoGlow{0%,100%{filter:drop-shadow(0 0 3px #ff993380);}50%{filter:drop-shadow(0 0 12px #ff9933cc);}}
@keyframes logoRotate{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
@keyframes logoPulse{0%,100%{transform:scale(1);filter:drop-shadow(0 0 4px #ff993380);}50%{transform:scale(1.18);filter:drop-shadow(0 0 16px #ff9933cc);}}
.plusmenu{position:absolute;bottom:100%;left:0;margin-bottom:8px;background:${v.sf};border:1px solid ${v.bd};border-radius:16px;padding:8px;display:flex;flex-direction:column;gap:4px;z-index:50;box-shadow:0 8px 28px #0008;animation:fadeUp .18s ease;min-width:140px;}
.plusmenu-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;color:${v.tx};border:none;background:none;width:100%;text-align:left;font-family:'Inter',sans-serif;}
.plusmenu-item:hover{background:${v.sf2};}

/* ── CROSS-BROWSER & CROSS-DEVICE FIXES ── */

/* iOS Safari: prevent viewport jump when keyboard opens */
@supports (-webkit-touch-callout: none) {
  .app { height: -webkit-fill-available; }
  .ibar { padding-bottom: max(10px, env(safe-area-inset-bottom)); }
}

/* Safe area insets - notch phones (iPhone X+, punch-hole Android) */
.hdr { padding-top: max(11px, env(safe-area-inset-top)); }
.ibar { padding-bottom: max(10px, env(safe-area-inset-bottom)); padding-left: max(10px, env(safe-area-inset-left)); padding-right: max(10px, env(safe-area-inset-right)); }

/* Tablet */
@media (min-width: 500px) and (max-width: 900px) {
  body { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .app { max-width: 540px; border-left: 1px solid var(--bd); border-right: 1px solid var(--bd); box-shadow: 0 0 60px #0008; }
  .sidebar { max-width: 300px; }
  .mbg { align-items: center; }
  .modal { border-radius: 20px; }
}

/* Desktop - center with max width */
@media (min-width: 768px) {
  .app { max-width: 800px; margin: 0 auto; border-left: 1px solid var(--bd); border-right: 1px solid var(--bd); box-shadow: 0 0 60px #0008; }
  .auth { padding: 40px; }
  .card { max-width: 440px; }
  .mbg { align-items: center; }
  .modal { max-width: 560px; border-radius: 20px; }
}

/* Touch feedback - all clickable elements */
button, .sb-item, .sb-ritem, .hcard, a { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }

/* Prevent text selection on UI elements */
button, .sb-item, .hdr, .ibar, .acts, .sbtn, .ibtn { -webkit-user-select: none; user-select: none; }

/* Firefox scrollbar hiding */
* { scrollbar-width: none; -ms-overflow-style: none; }

/* Smooth scrolling on iOS */
.chat, .page, .sb-nav, .sb-recent, .modal, .auth { -webkit-overflow-scrolling: touch; overflow-y: auto; }

/* Textarea/input cross-browser */
.iarea { -webkit-appearance: none; appearance: none; resize: none; }

/* Fix button appearance on iOS */
button { -webkit-appearance: none; appearance: none; cursor: pointer; }

/* Prevent double-tap zoom on buttons */
button, a { touch-action: manipulation; }

/* Image rendering quality */
img { image-rendering: -webkit-optimize-contrast; -webkit-user-drag: none; }

/* Transition smoothness on all browsers */
.bub, .btn, .sbtn, .ibtn, .sb-item { will-change: auto; }

/* Fix font rendering on Windows Chrome */
body { text-rendering: optimizeLegibility; }

.chat-ctx{position:fixed;background:${v.sf};border:1px solid ${v.bd};border-radius:18px;padding:8px;z-index:200;box-shadow:0 12px 40px #0009;animation:fadeIn .15s ease;min-width:200px;}
.chat-ctx-title{font-size:11px;font-weight:700;color:${v.mt};padding:6px 12px 4px;letter-spacing:.05em;text-transform:uppercase;}
.chat-ctx-item{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:12px;cursor:pointer;font-size:15px;font-weight:500;color:${v.tx};border:none;background:none;width:100%;text-align:left;font-family:'Inter',sans-serif;gap:12px;}
.chat-ctx-item:hover{background:${v.sf2};}
.chat-ctx-item.red{color:#ef4444;}
.chat-ctx-item.red:hover{background:#ef444414;}
.chat-ctx-sep{height:1px;background:${v.bd};margin:4px 0;}
.topbar{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid ${v.bd};background:${v.bg};flex-shrink:0;}
.topbar input{flex:1;background:${v.sf};border:1.5px solid ${v.bd};border-radius:20px;color:${v.tx};font-size:13px;padding:8px 14px;outline:none;font-family:'Inter',sans-serif;}
.topbar input:focus{border-color:var(--accent);}
.think-step{font-size:11px;color:var(--accent);margin-left:6px;font-style:italic;}
`;
}

// ── EXPAND ROW ─────────────────────────────────────────────────
function ExpandRow({ icon, label, desc, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--bd,#2a2a2a)" }}>
      <div className="srow" style={{ borderBottom: "none", cursor: "pointer" }} onClick={() => setOpen(v => !v)}>
        <div className="sicon">{icon}</div>
        <div className="stxt"><div className="slbl">{label}</div>{desc && <div className="sdesc">{desc}</div>}</div>
        <div style={{ color: "var(--mt,#6b7280)", transition: "transform .2s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}><Ico.ChevRight /></div>
      </div>
      <div className="sexpand" style={{ maxHeight: open ? "400px" : "0px" }}>
        <div className="sexpand-inner">{children}</div>
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────
export default function App() {
  const [pwaEvt, setPwaEvt] = useState(null);
  const [showPwa, setShowPwa] = useState(false);
  const [showSb, setShowSb] = useState(false);
  const [sbAgentsExpanded, setSbAgentsExpanded] = useState(false);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [forgot, setForgot] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", pass: "", newPass: "", confirmPass: "" });
  const [ferr, setFerr] = useState(""); const [fok, setFok] = useState(""); const [fload, setFload] = useState(false);
  // ── Magic Link (Email Link) Login state ──
  const [mlStep, setMlStep] = useState("email");   // "email" | "sent" | "verifying"
  const [mlEmail, setMlEmail] = useState("");
  const [themeKey, setThemeKey] = useState("dark");
  const [accentKey, setAccentKey] = useState("orange");
  const [fontSize, setFontSize] = useState(14);
  const [language, setLanguage] = useState("auto");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [showDeleteAcc, setShowDeleteAcc] = useState(false);
  const [delConfirmText, setDelConfirmText] = useState("");
  const [delLoading, setDelLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState("chat");
  const [agents, setAgents] = useState([]);
  const [activeAgent, setActiveAgent] = useState(null);
  const [showAgentBuilder, setShowAgentBuilder] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentForm, setAgentForm] = useState({ name: "", emoji: "🤖", instructions: "", tone: "friendly", lang: "english" });
  // ── AGENTS PAGE (PART 1) ──────────────────────────────────────
  const [agentTab, setAgentTab] = useState("my");
  const [agentCatSearch, setAgentCatSearch] = useState("");
  const [agentCreateForm, setAgentCreateForm] = useState({ name:"", category:"" });
  const [agentGenLoading, setAgentGenLoading] = useState(false);
  const [agentGenData, setAgentGenData] = useState(null);
  const [agentSaving, setAgentSaving] = useState(false);
  const [agentEditId, setAgentEditId] = useState(null);
  const [agentAvatarFile, setAgentAvatarFile] = useState(null);
  const [agentAvatarPreview, setAgentAvatarPreview] = useState(null);
  const [agentPdfFile, setAgentPdfFile] = useState(null);
  const [agentPdfName, setAgentPdfName] = useState("");
  const [agentPdfText, setAgentPdfText] = useState("");
  // ── MARKETPLACE (PART 2) ─────────────────────────────────────
  const [mkTab, setMkTab] = useState("trending");
  const [mkSearch, setMkSearch] = useState("");
  const [mkCatFilter, setMkCatFilter] = useState("All");
  const [mkRatingFilter, setMkRatingFilter] = useState(0);
  const [mkPriceFilter, setMkPriceFilter] = useState("all");
  const [mkAgents, setMkAgents] = useState([]);
  const [mkLoading, setMkLoading] = useState(false);
  const [mkDetail, setMkDetail] = useState(null);
  const [mkReviewText, setMkReviewText] = useState("");
  const [mkReviewRating, setMkReviewRating] = useState(5);
  const [mkReviewLoading, setMkReviewLoading] = useState(false);
  const [mkReviews, setMkReviews] = useState([]);
  const [mkOwnedIds, setMkOwnedIds] = useState([]);
  const [mkCreatorProfile, setMkCreatorProfile] = useState(null);
  // ── CREATOR DASHBOARD (PART 3) ───────────────────────────────
  const [showCreatorDash, setShowCreatorDash] = useState(false);
  const [creatorTab, setCreatorTab] = useState("overview");
  const [creatorData, setCreatorData] = useState(null);
  const [creatorSales, setCreatorSales] = useState([]);
  const [creatorWithdrawals, setCreatorWithdrawals] = useState([]);
  const [creatorLoading, setCreatorLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawUpi, setWithdrawUpi] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [creatorUpiEdit, setCreatorUpiEdit] = useState(false);
  const [creatorUpiVal, setCreatorUpiVal] = useState("");
  const [showPublishFee, setShowPublishFee] = useState(false);
  const [publishFeeAgent, setPublishFeeAgent] = useState(null);
  const [publishFeeDone, setPublishFeeDone] = useState(false);
  const [publishFeeLoading, setPublishFeeLoading] = useState(false);
  const [publishPayStatus, setPublishPayStatus] = useState(null); // null | "success" | "fail"
  const [publishedSuccess, setPublishedSuccess] = useState(false); // final "Agent Published" screen
  const [agentPrice, setAgentPrice] = useState("0");
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyModalAgent, setBuyModalAgent] = useState(null);
  const [buyPayDone, setBuyPayDone] = useState(false);
  // ── ADMIN PANEL (PART 4) ─────────────────────────────────────
  const [adminTab, setAdminTab] = useState("overview");
  const [adminAllAgents, setAdminAllAgents] = useState([]);
  const [adminPurchases, setAdminPurchases] = useState([]);
  const [adminWithdraws, setAdminWithdraws] = useState([]);
  const [adminTransactions, setAdminTransactions] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminEditPriceId, setAdminEditPriceId] = useState(null);
  const [adminEditPriceVal, setAdminEditPriceVal] = useState("");
  const [adminEditCommission, setAdminEditCommission] = useState(false);
  const [adminCommissionVal, setAdminCommissionVal] = useState("20");
  const [adminCommission, setAdminCommission] = useState(20);
  const [adminCategories, setAdminCategories] = useState([]);
  const [adminNewCat, setAdminNewCat] = useState("");
  const [adminCatEditId, setAdminCatEditId] = useState(null);
  const [adminCatEditVal, setAdminCatEditVal] = useState("");
  const [adminFeaturedIds, setAdminFeaturedIds] = useState([]);
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState("all");
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifLoading, setNotifLoading] = useState(false);
  const [showNotifCenter, setShowNotifCenter] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifsLoaded, setNotifsLoaded] = useState(false);
  const [userData, setUserData] = useState(null);
  const [sessionTone, setSessionTone] = useState(null);
  const [sid, setSid] = useState(() => Date.now().toString());
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [reactions, setReactions] = useState({});
  const [showRx, setShowRx] = useState(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [chatContextMenu, setChatContextMenu] = useState(null); // { histId, x, y }
  const [loadingStep, setLoadingStep] = useState(""); // "Searching...", "Thinking...", etc.
  const [chatSearch, setChatSearch] = useState(null); // null=hidden, ""=open empty
  const [showLimit, setShowLimit] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // null | "terms" | "privacy" | "usage"
  // Reusable custom confirm modal — replaces native window.confirm() popups,
  // which show up as ugly unstyled browser dialogs with whatever language
  // was hardcoded (was showing Hinglish "Is chat ko delete karein?").
  const [confirmState, setConfirmState] = useState(null); // { title, message, danger, onConfirm }
  function askConfirm({ title = "Are you sure?", message, danger = true, onConfirm }) {
    setConfirmState({ title, message, danger, onConfirm });
  }
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [payDone, setPayDone] = useState(false);
  const [payStatus, setPayStatus] = useState(null); // null | "success" | "fail"
  const [agentChatCounts, setAgentChatCounts] = useState({}); // { agentId: count }
  const [copied, setCopied] = useState(null);
  const [speakId, setSpeakId] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [micPerm, setMicPerm] = useState("unknown");
  const [imgB64, setImgB64] = useState(null);
  const [imgPrev, setImgPrev] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const [hists, setHists] = useState([]);
  const [histLoad, setHistLoad] = useState(false);
  const [hSearch, setHSearch] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [hFilter, setHFilter] = useState("all");
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [viewerSrc, setViewerSrc] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projLoad, setProjLoad] = useState(false);
  const [showNewProj, setShowNewProj] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [renamingProjId, setRenamingProjId] = useState(null);
  const [renameProjVal, setRenameProjVal] = useState("");
  const [upgradePlan, setUpgradePlan] = useState("monthly");
  const [showProfile, setShowProfile] = useState(false);
  const [pName, setPName] = useState("");
  const [pPhoto, setPPhoto] = useState(null);
  const [pPhotoUrl, setPPhotoUrl] = useState(null);
  const [pSaving, setPSaving] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [aSearch, setASearch] = useState("");
  const [aChat, setAChat] = useState(null);
  const [aChatLoad, setAChatLoad] = useState(false);
  const [vs, setVs] = useState("idle");
  const [vLast, setVLast] = useState("");
  const [vTone, setVTone] = useState("female");
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [vTranscript, setVTranscript] = useState(""); // live user speech transcript
  const [showChangePw, setShowChangePw] = useState(false);
  const [cpForm, setCpForm] = useState({ current: "", newP: "", confirm: "" });
  const [cpErr, setCpErr] = useState(""); const [cpOk, setCpOk] = useState(""); const [cpLoad, setCpLoad] = useState(false);
  const [memories, setMemories] = useState([]);
  const [memLoad, setMemLoad] = useState(false);
  const [memSaved, setMemSaved] = useState(false);
  const [showAddMem, setShowAddMem] = useState(false);
  const [newMemText, setNewMemText] = useState("");
  const [newMemCat, setNewMemCat] = useState("personal");
  const [newMemImportance, setNewMemImportance] = useState(5);
  const [editingMemId, setEditingMemId] = useState(null);
  const [editMemVal, setEditMemVal] = useState("");

  // ════════════════════════════════════════════════════════════════
  // PART 5 — AI COMMAND CENTER STATE
  // ════════════════════════════════════════════════════════════════
  const [cmdInput, setCmdInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState([]); // [{role,text,data,action,ts}]
  const [cmdLoading, setCmdLoading] = useState(false);
  const [cmdPending, setCmdPending] = useState(null); // action awaiting confirm
  const [cmdReport, setCmdReport] = useState(null);   // daily business report
  const [cmdReportLoading, setCmdReportLoading] = useState(false);
  const [cmdReportDate, setCmdReportDate] = useState("");
  const [showReportModal, setShowReportModal] = useState(false); // full report modal
  const [scheduledReportEnabled, setScheduledReportEnabled] = useState(false);
  const [userSearchResult, setUserSearchResult] = useState(null); // email search result
  // Agent Architecture Registry — scalable slots for future agent types
  const AGENT_REGISTRY = {
    voice:        { label:"Voice Agents",        icon:"🎙", status:"ready",   desc:"Real-time voice conversations, STT/TTS pipeline" },
    image:        { label:"Image Analysis",      icon:"🖼", status:"ready",   desc:"Vision AI for image understanding & generation" },
    whatsapp:     { label:"WhatsApp Agents",     icon:"💬", status:"planned", desc:"WhatsApp Business API integration" },
    team:         { label:"Team Agents",         icon:"👥", status:"planned", desc:"Multi-agent collaboration & task delegation" },
    subscription: { label:"Subscription Agents", icon:"🔄", status:"planned", desc:"Recurring billing & membership management" },
    business:     { label:"AI Business Agents",  icon:"🏢", status:"planned", desc:"CRM, analytics, lead generation automation" },
  };

  const bottomRef = useRef(null);
  const galleryRef = useRef(null);
  const fileRef = useRef(null);
  const pPhotoRef = useRef(null);
  const micRef = useRef(null);
  const voiceRef = useRef(null);
  const voiceActiveRef = useRef(false);
  const vsRef = useRef("idle");

  useEffect(() => { vsRef.current = vs; }, [vs]);

  useEffect(() => {
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "microphone" }).then(p => {
        setMicPerm(p.state === "granted" ? "granted" : p.state === "denied" ? "denied" : "unknown");
        p.onchange = () => setMicPerm(p.state === "granted" ? "granted" : p.state === "denied" ? "denied" : "unknown");
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const h = e => { e.preventDefault(); setPwaEvt(e); setShowPwa(true); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  // ── Check if page loaded from a Magic Link email ──────────────────
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    const savedEmail = localStorage.getItem("saraswati_ml_email") || "";
    setMlStep("verifying");
    setMlEmail(savedEmail);
    completeMagicLinkLogin(savedEmail, window.location.href);
  }, []);

  useEffect(() => {
    let unsubUserDoc = null;
    const unsub = onAuthStateChanged(auth, async u => {
      if (unsubUserDoc) { unsubUserDoc(); unsubUserDoc = null; }
      if (u) {
        setUser(u);
        // Real-time listener instead of a one-time getDoc — this is what
        // makes admin-granted premium (or any other account change) show
        // up immediately in the user's already-open app, instead of only
        // after they log out and log back in.
        unsubUserDoc = onSnapshot(doc(db, "users", u.uid), d => {
          if (d.exists()) {
            const data = d.data();
            setUserData(data);
            setPName(data.name || u.displayName || "");
            setPPhotoUrl(data.photoURL || null);
            if (data.theme) setThemeKey(data.theme);
            if (data.accent) setAccentKey(data.accent);
            if (data.fontSize) setFontSize(data.fontSize);
            if (data.language) setLanguage(data.language);
            if (data.memoryEnabled === false) setMemoryEnabled(false);
          }
        }, () => {}); // ignore transient listener errors (e.g. brief offline)
        loadMemories(u.uid);
      } else { setUser(null); setUserData(null); setMemories([]); }
      setAuthReady(true);
    });
    return () => { unsub(); if (unsubUserDoc) unsubUserDoc(); };
  }, []);

  // Handle Google redirect result on mobile
  useEffect(() => {
    getRedirectResult(auth).then(async result => {
      if (result) {
        try { await handleGoogleResult(result); } catch {}
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  useEffect(() => {
    if (user && page === "history") loadHists();
    if (user) loadAgents(user.uid);
    if (user && page === "admin") loadAdmin();
    if (user && page === "projects") loadProjects();
    if (user && page === "memory") loadMemories(user.uid);
    if (page === "marketplace") loadMarketplace();
    if (user && page === "admin") loadAdminFull();
    if (page !== "voice") endVoice();
    stopAllSpeech();
    setSpeakId(null); setShowRx(null);
  }, [page]);

  async function loadMemories(uid) {
    setMemLoad(true);
    try {
      const q = query(collection(db, "memories"), where("userId", "==", uid || user.uid), orderBy("createdAt", "desc"), limit(50));
      const snap = await getDocs(q);
      setMemories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      try {
        const q2 = query(collection(db, "memories"), where("userId", "==", uid || user.uid));
        const s2 = await getDocs(q2);
        setMemories(s2.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      } catch (e) { console.error(e); }
    }
    setMemLoad(false);
  }

  async function addMemory(text, category, importance) {
    if (!text.trim()) return;
    const now = { seconds: Date.now() / 1000 };
    const data = {
      userId: user.uid,
      memory_content: text.trim(),
      text: text.trim(),
      category: category || "personal",
      importance_score: importance || 5,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      const ref = await addDoc(collection(db, "memories"), data);
      setMemories(p => [{ id: ref.id, ...data, createdAt: now, updatedAt: now }, ...p]);
    } catch (e) { alert("Memory save failed: " + e.message); }
  }

  async function editMemory(id, text) {
    if (!text.trim()) return;
    try {
      await updateDoc(doc(db, "memories", id), {
        memory_content: text.trim(),
        text: text.trim(),
        updatedAt: serverTimestamp()
      });
      setMemories(p => p.map(m => m.id === id
        ? { ...m, memory_content: text.trim(), text: text.trim(), updatedAt: { seconds: Date.now() / 1000 } }
        : m
      ));
    } catch (e) { alert("Memory update failed: " + e.message); }
    setEditingMemId(null);
  }

  async function deleteMemory(id) {
    askConfirm({
      title: "Delete Memory?",
      message: "This memory will be permanently removed.",
      onConfirm: async () => {
        await deleteDoc(doc(db, "memories", id));
        setMemories(p => p.filter(m => m.id !== id));
      }
    });
  }

  async function maybeSaveMemory(userText) {
    // Handle explicit "remember that..." commands immediately
    let textToAnalyze = userText;
    const isExplicit = isExplicitMemoryCommand(userText);
    if (isExplicit) textToAnalyze = extractExplicitFact(userText) || userText;

    // Capture memories snapshot at call time to avoid stale closure
    const memoriesSnapshot = memories;
    const result = await analyzeMemory(textToAnalyze, memoriesSnapshot);
    if (!result) return;

    const now = { seconds: Date.now() / 1000 };
    const memData = {
      userId: user.uid,
      memory_content: result.memory_content,
      // Keep .text alias for backward compat with old records
      text: result.memory_content,
      category: result.category,
      importance_score: result.importance_score,
      updatedAt: serverTimestamp(),
    };

    if (result.action === "update" && result.update_id) {
      // Update existing memory instead of creating duplicate
      const existingIdx = memoriesSnapshot.findIndex(m => m.id === result.update_id);
      if (existingIdx !== -1) {
        try {
          await updateDoc(doc(db, "memories", result.update_id), { ...memData, updatedAt: serverTimestamp() });
          setMemories(p => p.map(m => m.id === result.update_id
            ? { ...m, ...memData, updatedAt: now }
            : m
          ));
          setMemSaved("updated");
          setTimeout(() => setMemSaved(false), 2500);
          return;
        } catch { /* fall through to save new */ }
      }
    }

    // Save new memory
    const ref = await addDoc(collection(db, "memories"), {
      ...memData,
      createdAt: serverTimestamp(),
    });
    setMemories(p => [{
      id: ref.id,
      ...memData,
      createdAt: now,
      updatedAt: now,
    }, ...p]);
    setMemSaved("saved");
    setTimeout(() => setMemSaved(false), 2500);
  }

  async function loadHists() {
    setHistLoad(true);
    try {
      const q = query(collection(db, "chats"), where("userId", "==", user.uid), orderBy("updatedAt", "desc"));
      const snap = await getDocs(q);
      const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // For each chat without searchIndex, load last 5 messages and build index
      const enriched = await Promise.all(chats.map(async h => {
        if (h.searchIndex) return h; // already indexed
        try {
          const mq = query(
            collection(db, "messages"),
            where("sessionId", "==", h.id),
            orderBy("createdAt", "desc"),
            limit(5)
          );
          const mSnap = await getDocs(mq);
          const texts = mSnap.docs.map(d => d.data().text || "").join(" ");
          const searchIndex = texts.slice(0, 500).toLowerCase();
          // Save index back to Firestore for future searches
          if (searchIndex) {
            setDoc(doc(db, "chats", h.id), { searchIndex }, { merge: true }).catch(() => {});
          }
          return { ...h, searchIndex };
        } catch {
          return h;
        }
      }));

      setHists(enriched);
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
      let m2 = [];
      try {
        const q = query(collection(db, "messages"), where("userId", "==", u.id), orderBy("createdAt", "desc"), limit(40));
        const snap = await getDocs(q);
        m2 = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
      } catch {
        const q2 = query(collection(db, "messages"), where("userId", "==", u.id));
        const s2 = await getDocs(q2);
        m2 = s2.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)).slice(-40);
      }
      setAChat({ user: u, msgs: m2 });
    } catch (e) { console.error(e); }
    setAChatLoad(false);
  }

  async function handleAuth() {
    setFerr(""); setFok("");
    if (forgot) {
      if (!form.newPass || !form.confirmPass) { setFerr("Please fill all fields!"); return; }
      if (form.newPass.length < 8) { setFerr("Password must be 8+ characters!"); return; }
      if (form.newPass !== form.confirmPass) { setFerr("Passwords do not match!"); return; }
      if (!form.email) { setFerr("Please enter your email!"); return; }
      setFload(true);
      try {
        await sendPasswordResetEmail(auth, form.email);
        setFok("✅ ✅ Reset link sent! Check your Inbox and Spam/Junk folder. Please wait 2-3 minutes.");
        setForm(f => ({ ...f, email: "", newPass: "", confirmPass: "" }));
      } catch { setFerr("Email not registered!"); }
      setFload(false);
      return;
    }
    if (!form.email || !form.pass) { setFerr("Please fill all fields!"); return; }
    if (form.pass.length < 8) { setFerr("Password must be 8+ characters!"); return; }
    if (authMode === "signup" && !form.name) { setFerr("Enter your name!"); return; }
    setFload(true);
    try {
      if (authMode === "signup") {
        const c = await createUserWithEmailAndPassword(auth, form.email, form.pass);
        await updateProfile(c.user, { displayName: form.name });
        await setDoc(doc(db, "users", c.user.uid), { name: form.name, email: form.email, premium: false, createdAt: serverTimestamp(), usageCount: 0, theme: "dark", accent: "orange", fontSize: 14 });
        setUserData({ name: form.name, email: form.email, premium: false, usageCount: 0 });
        setPName(form.name);
      } else {
        await signInWithEmailAndPassword(auth, form.email, form.pass);
        const d = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (d.exists()) {
          const data = d.data(); setUserData(data);
          if (data.theme) setThemeKey(data.theme);
          if (data.accent) setAccentKey(data.accent);
          if (data.fontSize) setFontSize(data.fontSize);
          if (data.language) setLanguage(data.language);
          if (data.memoryEnabled === false) setMemoryEnabled(false);
        }
      }
      setForm({ name: "", email: "", pass: "", newPass: "", confirmPass: "" });
    } catch (e) {
      const errs = { "auth/email-already-in-use": "Email already registered!", "auth/invalid-email": "Invalid email!", "auth/wrong-password": "Wrong password!", "auth/user-not-found": "Account not found!", "auth/invalid-credential": "Wrong email or password!" };
      setFerr(errs[e.code] || e.message);
    }
    setFload(false);
  }

  async function handleGoogleResult(result) {
    if (!result) return;
    const u = result.user;
    const userRef = doc(db, "users", u.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        name: u.displayName || "User",
        email: u.email,
        premium: false,
        createdAt: serverTimestamp(),
        usageCount: 0,
        theme: "dark",
        accent: "orange",
        fontSize: 14
      });
      setUserData({ name: u.displayName || "User", email: u.email, premium: false, usageCount: 0 });
      setPName(u.displayName || "User");
    } else {
      const data = snap.data(); setUserData(data);
      if (data.theme) setThemeKey(data.theme);
      if (data.accent) setAccentKey(data.accent);
      if (data.fontSize) setFontSize(data.fontSize);
      if (data.language) setLanguage(data.language);
      if (data.memoryEnabled === false) setMemoryEnabled(false);
    }
  }

  async function handleGoogleAuth() {
    setFload(true); setFerr("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      await handleGoogleResult(result);
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        setFerr("Google sign-in failed. Try again!");
      }
    }
    setFload(false);
  }

  // ── EMAIL MAGIC LINK LOGIN ───────────────────────────────────────
  // Flow: Email enter → Firebase sends a magic link → User clicks link
  //       in Gmail → Page detects link → Auto login/signup. No password,
  //       no OTP typing, no third-party email service needed.

  async function sendMagicLink(email) {
    setFerr(""); setFok("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFerr("Please enter a valid email address!");
      return;
    }
    setFload(true);
    try {
      const actionCodeSettings = {
        url: window.location.origin + window.location.pathname, // redirect back to app
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);
      localStorage.setItem("saraswati_ml_email", cleanEmail);
      setMlEmail(cleanEmail);
      setMlStep("sent");
      setFok("✅ Verification link sent!");
    } catch (e) {
      if (e.code === "auth/operation-not-allowed") {
        setFerr("Email link sign-in is not enabled. Please enable it in Firebase Console.");
      } else {
        setFerr("Could not send link. Please try again!");
      }
    }
    setFload(false);
  }

  async function completeMagicLinkLogin(email, href) {
    setFerr(""); setFload(true);
    let useEmail = email;
    try {
      if (!useEmail) {
        useEmail = window.prompt("Please enter your email to confirm login:") || "";
      }
      if (!useEmail) { setFerr("Email required to complete login."); setFload(false); return; }

      const result = await signInWithEmailLink(auth, useEmail, href);
      localStorage.removeItem("saraswati_ml_email");

      // Clean URL so the link tokens don't stay in address bar
      window.history.replaceState({}, document.title, window.location.pathname);

      // New user — create Firestore profile
      const userRef = doc(db, "users", result.user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const name = useEmail.split("@")[0];
        await setDoc(userRef, {
          name, email: useEmail, premium: false,
          createdAt: serverTimestamp(), usageCount: 0,
          theme: "dark", accent: "orange", fontSize: 14,
          authMethod: "email_link"
        });
        await updateProfile(result.user, { displayName: name });
        setUserData({ name, email: useEmail, premium: false, usageCount: 0 });
        setPName(name);
      } else {
        const data = snap.data(); setUserData(data);
        if (data.theme) setThemeKey(data.theme);
        if (data.accent) setAccentKey(data.accent);
        if (data.fontSize) setFontSize(data.fontSize);
        if (data.language) setLanguage(data.language);
        if (data.memoryEnabled === false) setMemoryEnabled(false);
      }
      setMlStep("email"); setMlEmail("");
    } catch (e) {
      setFerr("Link verification failed. Please request a new link.");
      setMlStep("email");
    }
    setFload(false);
  }

  function resetMagicLink() {
    setMlStep("email"); setMlEmail(""); setFerr(""); setFok("");
    localStorage.removeItem("saraswati_ml_email");
  }

  async function savePref(key, val) {
    if (key === "theme") setThemeKey(val);
    if (key === "accent") setAccentKey(val);
    if (key === "fontSize") setFontSize(val);
    if (key === "language") setLanguage(val);
    if (key === "memoryEnabled") setMemoryEnabled(val);
    try { await setDoc(doc(db, "users", user.uid), { [key]: val }, { merge: true }); setUserData(p => ({ ...p, [key]: val })); } catch {}
  }

  async function saveProfile() {
    if (!pName.trim()) { alert("Enter your name!"); return; }
    setPSaving(true);
    try {
      const updates = { name: pName.trim() };
      if (pPhoto) { const compressed = await compressImage(pPhoto, 120, 0.55); updates.photoURL = compressed; setPPhotoUrl(compressed); }
      await updateProfile(auth.currentUser, { displayName: pName.trim() });
      await setDoc(doc(db, "users", user.uid), updates, { merge: true });
      setUserData(p => ({ ...p, ...updates }));
      setPPhoto(null); setShowProfile(false);
    } catch (e) { alert("Error: " + e.message); }
    setPSaving(false);
  }

  async function handleChangePw() {
    setCpErr(""); setCpOk("");
    if (!cpForm.current || !cpForm.newP || !cpForm.confirm) { setCpErr("Fill all fields!"); return; }
    if (cpForm.newP.length < 8) { setCpErr("New password must be 8+ characters!"); return; }
    if (cpForm.newP !== cpForm.confirm) { setCpErr("Passwords do not match!"); return; }
    setCpLoad(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, cpForm.current);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, cpForm.newP);
      setCpOk("✅ Password changed successfully!");
      setCpForm({ current: "", newP: "", confirm: "" });
      setTimeout(() => setShowChangePw(false), 1500);
    } catch (e) {
      const errs = { "auth/wrong-password": "Current password is incorrect!", "auth/invalid-credential": "Current password is incorrect!", "auth/too-many-requests": "Too many attempts. Try again later." };
      setCpErr(errs[e.code] || "Error: " + e.message);
    }
    setCpLoad(false);
  }

  function handleGallery(e) {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = "";
    const r = new FileReader();
    r.onload = async ev => {
      try {
        const raw = ev.target.result;
        const compressed = await compressImage(raw, 800, 0.85);
        setImgPrev(compressed);
        setImgB64(compressed.split(",")[1]);
      } catch {
        const d = ev.target.result;
        setImgPrev(d);
        setImgB64(d.split(",")[1]);
      }
    };
    r.onerror = () => alert("Could not load image.");
    r.readAsDataURL(file);
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setAttachLoading(true);
    for (const file of files) {
      const result = await extractFileText(file);
      setAttachments(p => [...p, result]);
    }
    setAttachLoading(false);
  }
  function removeAttachment(idx) {
    setAttachments(p => p.filter((_, i) => i !== idx));
  }

  function handlePPhoto(e) {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = "";
    const r = new FileReader();
    r.onload = ev => setPPhoto(ev.target.result);
    r.onerror = () => alert("Could not load image.");
    r.readAsDataURL(file);
  }

  // ── SPEECH TO TEXT — Any-language auto-detect (Groq Whisper) ────
  // Browser's built-in SpeechRecognition only supports ONE fixed language
  // per session and can't truly auto-detect — so we record raw audio and
  // send it to Whisper, which detects the spoken language itself and
  // transcribes in that language/script automatically.
  const [micTranscript, setMicTranscript] = useState("");
  const micActiveRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [micBusy, setMicBusy] = useState(false); // transcribing spinner state

  async function toggleMic() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Microphone is not supported in this browser.");
      return;
    }

    // STOP — finish recording, send to Whisper
    if (micActive) {
      micActiveRef.current = false;
      setMicActive(false);
      try { mediaRecorderRef.current?.stop(); } catch {}
      return;
    }

    // START — begin recording
    try {
      // Better mic constraints = cleaner audio = fewer Whisper mis-hears.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      // Cross-browser mimeType: Chrome→webm, iOS Safari→mp4, Firefox→ogg, fallback→default
      const mimeType = ["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus","audio/ogg",""].find(t => !t || MediaRecorder.isTypeSupported(t));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        try { mediaStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
        const blob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
        audioChunksRef.current = [];
        if (blob.size < 1000) { setMicTranscript(""); setMicBusy(false); return; } // too short / silence
        setMicBusy(true);
        try {
          const text = await transcribeWithWhisper(blob, mimeType);
          if (text && text.trim()) {
            setInput(p => (p.trim() + " " + text.trim()).trim());
          }
        } catch (err) {
          alert("Voice transcription failed: " + (err?.message || "try again"));
        } finally {
          setMicBusy(false);
          setMicTranscript("");
        }
      };

      mediaRecorderRef.current = recorder;
      micActiveRef.current = true;
      setMicActive(true);
      setMicTranscript("");
      recorder.start();
    } catch (err) {
      if (err?.name === "NotAllowedError") {
        alert("Microphone permission required.\n\nSteps:\n1. Tap the lock icon in the address bar\n2. Set Microphone → Allow\n3. Reload the page\n4. Try mic again");
      } else {
        alert("Microphone could not start: " + (err?.message || "unknown error"));
      }
      micActiveRef.current = false;
      setMicActive(false);
    }
  }

  async function transcribeWithWhisper(blob, mimeType) {
    const ext = mimeType?.includes("mp4") ? "m4a" : "webm";
    const form = new FormData();
    form.append("file", blob, `recording.${ext}`);
    // whisper-large-v3 (non-turbo) has a meaningfully lower error rate
    // (~8.4% WER) than whisper-large-v3-turbo (~12% WER) — turbo is faster
    // but mishears more words, which was the complaint. Accuracy > speed here.
    form.append("model", "whisper-large-v3");
    // Forcing language="hi" — without it, Whisper auto-detect would
    // sometimes mistake Hindi speech for Urdu (very acoustically similar)
    // and transcribe it in Urdu/Arabic script instead of Devanagari, which
    // was the bug. Hindi speakers naturally mix in English words too —
    // Whisper handles that fine under the "hi" setting (transliterates
    // English words into Devanagari rather than switching scripts).
    form.append("language", "hi");
    form.append("prompt", "नमस्ते, यह हिंदी और इंग्लिश मिक्स बातचीत है।");
    // NOTE: deliberately NOT setting temperature=0 here. Forcing fully
    // deterministic decoding on whisper-large-v3 is a known trigger for a
    // failure mode on longer (multi-sentence) audio: the model can get
    // stuck in a repetitive loop emitting non-speech tokens for a whole
    // chunk, which then get silently stripped — the result is large gaps
    // (usually the beginning) missing from the transcript, leaving only
    // the last sentence or two. Omitting temperature lets Whisper use its
    // built-in temperature-fallback retry behavior, which fixes this.
    form.append("response_format", "json");
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + GROQ },
      body: form
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.text || "";
  }

  function toggleSpeak(id, text) {
    if (speakId === id) { stopAllSpeech(); setSpeakId(null); return; }
    setSpeakId(id);
    speakText(text, sessionTone || "female", 0.95, () => setSpeakId(null));
  }

  function copyMsg(text, id) {
    // Cross-browser clipboard: modern API with fallback for older browsers and HTTP
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => {
        const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        try { document.execCommand("copy"); } catch {}
        document.body.removeChild(ta);
      });
    } else {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  }

  function shareWA(text) { window.open("https://wa.me/?text=" + encodeURIComponent("Saraswati AI:\n\n" + text.slice(0, 500)), "_blank"); }

  async function shareChat(histId) {
    // Find chat in hists or use current msgs
    const chatMsgs = histId === sid ? msgs : null;
    let exportText = `Saraswati AI — Chat Export\n${"=".repeat(30)}\n\n`;
    if (chatMsgs) {
      exportText += chatMsgs.map(m => `${m.role === "user" ? "You" : "Saraswati AI"}:\n${m.text}`).join("\n\n---\n\n");
    } else {
      // Load from Firestore
      try {
        const q = query(collection(db, "messages"), where("sessionId", "==", histId));
        const snap = await getDocs(q);
        const loaded = snap.docs.map(d => d.data()).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        exportText += loaded.map(m => `${m.role === "user" ? "You" : "Saraswati AI"}:\n${m.text || ""}`).join("\n\n---\n\n");
      } catch { exportText += "(Could not load messages)"; }
    }
    // Try native share (mobile) → clipboard (desktop/modern) → execCommand (old) → WhatsApp
    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      try { await navigator.share({ title: "Saraswati AI Chat", text: exportText.slice(0, 2000) }); return; } catch {}
    }
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(exportText); alert("Chat copied to clipboard!"); return; } catch {}
    }
    // execCommand fallback (IE11, old Android browsers)
    try {
      const ta = document.createElement("textarea"); ta.value = exportText; ta.style.cssText = "position:fixed;opacity:0;top:0;left:0;";
      document.body.appendChild(ta); ta.focus(); ta.select();
      if (document.execCommand("copy")) { document.body.removeChild(ta); alert("Chat copied!"); return; }
      document.body.removeChild(ta);
    } catch {}
    window.open("https://wa.me/?text=" + encodeURIComponent(exportText.slice(0, 1000)), "_blank");
  }

  function exportChat() {
    if (!msgs.length) { alert("No messages to export."); return; }
    const txt = msgs.map(m => (m.role === "user" ? "You" : "Saraswati AI") + ":\n" + m.text).join("\n\n---\n\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" })); a.download = "saraswati-chat.txt"; a.click();
  }

  async function exportAllData() {
    setExporting(true);
    try {
      const exportObj = { exportedAt: new Date().toISOString(), profile: null, chats: [], memories: [], projects: [] };
      try { const d = await getDoc(doc(db, "users", user.uid)); if (d.exists()) exportObj.profile = { email: user.email, ...d.data() }; } catch {}
      try {
        const chatsSnap = await getDocs(query(collection(db, "chats"), where("userId", "==", user.uid)));
        for (const cd of chatsSnap.docs) {
          const chat = { id: cd.id, ...cd.data() };
          try {
            const msgSnap = await getDocs(query(collection(db, "messages"), where("sessionId", "==", cd.id)));
            chat.messages = msgSnap.docs.map(md => ({ id: md.id, ...md.data() }));
          } catch { chat.messages = []; }
          exportObj.chats.push(chat);
        }
      } catch {}
      try {
        const memSnap = await getDocs(query(collection(db, "memories"), where("userId", "==", user.uid)));
        exportObj.memories = memSnap.docs.map(md => ({ id: md.id, ...md.data() }));
      } catch {}
      try {
        const projSnap = await getDocs(query(collection(db, "projects"), where("userId", "==", user.uid)));
        exportObj.projects = projSnap.docs.map(pd => ({ id: pd.id, ...pd.data() }));
      } catch {}
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "saraswati-ai-data-export.json";
      a.click();
    } catch (e) { alert("Export error: " + e.message); }
    setExporting(false);
  }

  async function clearAllMemories() {
    askConfirm({
      title: "Delete All Memories?",
      message: "This cannot be undone. All saved memories will be permanently removed.",
      onConfirm: async () => {
        try {
          const snap = await getDocs(query(collection(db, "memories"), where("userId", "==", user.uid)));
          for (const d of snap.docs) { await deleteDoc(doc(db, "memories", d.id)); }
          setMemories([]);
        } catch (e) { alert("Error: " + e.message); }
      }
    });
  }

  async function clearAllChatHistory() {
    askConfirm({
      title: "Delete All Chat History?",
      message: "This cannot be undone. All your chats will be permanently removed.",
      onConfirm: async () => {
        try {
          const chatsSnap = await getDocs(query(collection(db, "chats"), where("userId", "==", user.uid)));
          for (const cd of chatsSnap.docs) {
            try {
              const msgSnap = await getDocs(query(collection(db, "messages"), where("sessionId", "==", cd.id)));
              for (const md of msgSnap.docs) { await deleteDoc(doc(db, "messages", md.id)); }
            } catch {}
            await deleteDoc(doc(db, "chats", cd.id));
          }
          setHists([]);
          setMsgs([]);
          setSid(Date.now().toString());
        } catch (e) { alert("Error: " + e.message); }
      }
    });
  }

  async function deleteAccount() {
    if (delConfirmText.trim().toUpperCase() !== "DELETE") return;
    setDelLoading(true);
    try {
      const uid = user.uid;
      try {
        const chatsSnap = await getDocs(query(collection(db, "chats"), where("userId", "==", uid)));
        for (const cd of chatsSnap.docs) {
          try {
            const msgSnap = await getDocs(query(collection(db, "messages"), where("sessionId", "==", cd.id)));
            for (const md of msgSnap.docs) { await deleteDoc(doc(db, "messages", md.id)); }
          } catch {}
          await deleteDoc(doc(db, "chats", cd.id));
        }
      } catch {}
      try {
        const memSnap = await getDocs(query(collection(db, "memories"), where("userId", "==", uid)));
        for (const md of memSnap.docs) { await deleteDoc(doc(db, "memories", md.id)); }
      } catch {}
      try {
        const projSnap = await getDocs(query(collection(db, "projects"), where("userId", "==", uid)));
        for (const pd of projSnap.docs) { await deleteDoc(doc(db, "projects", pd.id)); }
      } catch {}
      try { await deleteDoc(doc(db, "users", uid)); } catch {}
      await deleteUser(auth.currentUser);
    } catch (e) {
      alert("Error deleting account: " + e.message);
    }
    setDelLoading(false);
  }

  function endVoice() {
    voiceActiveRef.current = false;
    voiceRef.current?.stop?.();
    voiceRef.current?.abort?.();
    stopAllSpeech();
    setVs("idle");
    setVTranscript("");
  }

  function startListening(currentMsgs, currentTone, currentSid, currentUserData) {
    if (!voiceActiveRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Microphone is not supported in this browser.");
      setVs("idle");
      return;
    }

    let stopped = false;
    let silenceTimer = null;
    let recorder = null;
    let stream = null;
    let audioCtx = null;
    const chunks = [];

    // Watchdog: if mic setup itself silently hangs, recover instead of
    // staying stuck on "Listening..." forever.
    const watchdog = setTimeout(() => {
      if (!stopped && voiceActiveRef.current && vsRef.current === "listen") {
        finish(true);
      }
    }, 12000);

    function cleanupAudioGraph() {
      try { audioCtx?.close(); } catch {}
      try { stream?.getTracks().forEach(t => t.stop()); } catch {}
      if (silenceTimer) clearTimeout(silenceTimer);
    }

    async function finish(forceEmpty) {
      if (stopped) return;
      stopped = true;
      clearTimeout(watchdog);
      try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch {}
      // recorder.onstop (below) handles the rest; if forceEmpty, just bail.
      if (forceEmpty) {
        cleanupAudioGraph();
        if (voiceActiveRef.current && vsRef.current === "listen") {
          startListening(currentMsgs, currentTone, currentSid, currentUserData);
        }
      }
    }

    // Lets endVoice()/handleOrb() interrupt an in-progress recording —
    // mirrors the .stop()/.abort() shape the old SpeechRecognition object had.
    voiceRef.current = {
      stop: () => { stopped = true; clearTimeout(watchdog); cleanupAudioGraph(); try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch {} },
      abort: () => { stopped = true; clearTimeout(watchdog); cleanupAudioGraph(); try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch {} }
    };

    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
    }).then(s => {
      if (!voiceActiveRef.current) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s;
      const mimeType = ["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus","audio/ogg",""].find(t => !t || MediaRecorder.isTypeSupported(t));
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = async () => {
        clearTimeout(watchdog);
        cleanupAudioGraph();
        const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
        if (blob.size < 1200 || !voiceActiveRef.current) {
          // Too short / silence — just listen again.
          if (voiceActiveRef.current && vsRef.current === "listen") {
            startListening(currentMsgs, currentTone, currentSid, currentUserData);
          }
          return;
        }
        try {
          const transcript = await transcribeWithWhisper(blob, mimeType);
          if (voiceActiveRef.current) processUtterance(transcript || "");
        } catch (err) {
          if (voiceActiveRef.current) {
            setTimeout(() => { setVs("listen"); startListening(currentMsgs, currentTone, currentSid, currentUserData); }, 1000);
          }
        }
      };

      // Silence detection via Web Audio API: auto-stop recording ~1.1s
      // after the user stops talking, so the call feels conversational
      // instead of needing a manual stop button each turn.
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let speechStarted = false;
      let lastLoudAt = Date.now();

      function checkSilence() {
        if (stopped) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        const now = Date.now();
        if (rms > 0.02) { lastLoudAt = now; speechStarted = true; }
        if (speechStarted && now - lastLoudAt > 650) {
          finish(false);
          return;
        }
        if (!speechStarted && now - lastLoudAt > 9000) {
          // Nobody spoke at all — give up this round and restart cleanly.
          finish(true);
          return;
        }
        requestAnimationFrame(checkSilence);
      }

      recorder.start();
      requestAnimationFrame(checkSilence);
    }).catch(err => {
      clearTimeout(watchdog);
      if (err?.name === "NotAllowedError") {
        voiceActiveRef.current = false;
        setVs("idle");
        setShowVoiceCall(false);
        alert("Microphone permission required.\n\nSteps:\n1. Tap the lock icon in the address bar\n2. Set Microphone → Allow\n3. Reload the page\n4. Try voice call again");
      } else if (voiceActiveRef.current) {
        setTimeout(() => startListening(currentMsgs, currentTone, currentSid, currentUserData), 1000);
      }
    });

    async function processUtterance(rawTranscript) {
      let transcript = rawTranscript.trim();
      const lower = transcript.toLowerCase();
      const isQuestion = /^(kya|kaun|kab|kahan|kyu|kyun|kaise|why|what|when|where|who|how|which|kitna|kitne)\b/.test(lower) || lower.includes("?");
      transcript = transcript.charAt(0).toUpperCase() + transcript.slice(1);
      if (!/[.?!]$/.test(transcript)) transcript += isQuestion ? "?" : ".";

      if (!transcript.trim() || transcript.trim() === ".") {
        if (voiceActiveRef.current) { setVs("listen"); setTimeout(() => startListening(currentMsgs, currentTone, currentSid, currentUserData), 300); }
        return;
      }

      const det = detectTone(transcript);
      if (det) { setSessionTone(det); currentTone = det; }
      const tone = currentTone || "female";

      setVTranscript(transcript); // briefly show what was heard before "thinking"
      setVs("think");
      setTimeout(() => setVTranscript(""), 50); // clear shortly after, like before

      // Fetch fresh userData to avoid stale closure
      let ud = currentUserData;
      if (!ud) {
        try {
          const freshDoc = await getDoc(doc(db, "users", user.uid));
          if (freshDoc.exists()) ud = freshDoc.data();
        } catch {}
      }
      ud = ud || {};

      if (!ud?.premium && (ud?.usageCount || 0) >= FREE_LIMIT) {
        setShowLimit(true); voiceActiveRef.current = false; setVs("idle"); return;
      }

      const uRef = await addDoc(collection(db, "messages"), {
        sessionId: currentSid, userId: user.uid, role: "user", text: transcript, createdAt: serverTimestamp()
      });
      const newMsgs = [...currentMsgs, { id: uRef.id, role: "user", text: transcript, time: new Date() }];
      setMsgs(newMsgs);

      const isFirst = currentMsgs.length === 0;
      let titleUpdate = {};
      if (isFirst) {
        const t = await genTitle(transcript);
        titleUpdate = { title: t || transcript.slice(0, 38), createdAt: serverTimestamp() };
      }
      await setDoc(doc(db, "chats", currentSid), { userId: user.uid, ...titleUpdate, updatedAt: serverTimestamp() }, { merge: true });

      const nc = (ud?.usageCount || 0) + 1;
      await setDoc(doc(db, "users", user.uid), { usageCount: nc }, { merge: true });
      setUserData(p => ({ ...p, usageCount: nc }));
      if (memoryEnabled) maybeSaveMemory(transcript).catch(() => {});

      try {
        // Voice mode: shorter responses, no markdown
        const voiceMsgs = [...newMsgs];
        const lastMsg = voiceMsgs[voiceMsgs.length - 1];
        const voiceSystemNote = "\n\nIMPORTANT: This is a VOICE conversation. Reply in maximum 2-3 short sentences. No bullet points, no markdown, no code blocks. Speak naturally and conversationally.";
        const aiText = await callAI(voiceMsgs, null, tone, memoryEnabled ? memories : null, language, voiceSystemNote);
        const tid = "v_" + Date.now();
        const updatedMsgs = [...newMsgs, { id: tid, role: "ai", text: aiText, time: new Date() }];
        setMsgs(updatedMsgs);
        setVLast(aiText);
        await addDoc(collection(db, "messages"), {
          sessionId: currentSid, userId: user.uid, role: "ai", text: aiText, createdAt: serverTimestamp()
        });

        setVs("speak");
        speakText(aiText, tone, 0.95, () => {
          if (voiceActiveRef.current) {
            setVs("listen");
            setTimeout(() => startListening(updatedMsgs, tone, currentSid, { ...currentUserData, usageCount: nc }), 400);
          } else {
            setVs("idle");
          }
        });
      } catch (err) {
        setMsgs(p => [...p, { id: Date.now(), role: "ai", text: "❌ " + err.message, time: new Date() }]);
        if (voiceActiveRef.current) {
          setVs("listen");
          setTimeout(() => startListening(newMsgs, tone, currentSid, { ...currentUserData, usageCount: nc }), 500);
        } else {
          setVs("idle");
        }
      }
    }
  }

  async function handleOrb() {
    if (vs === "listen") {
      voiceActiveRef.current = false;
      voiceRef.current?.stop?.();
      setVs("idle");
      setVTranscript("");
      return;
    }
    if (vs === "speak") {
      voiceActiveRef.current = false;
      stopAllSpeech();
      setVs("idle");
      setVTranscript("");
      return;
    }
    if (vs === "think") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Microphone is not supported in this browser for Voice Call.");
      return;
    }

    voiceActiveRef.current = true;
    setVs("listen");
    setVTranscript("");
    setVLast("");
    startListening(msgs, sessionTone || "female", sid, userData);
  }

  async function openVoiceCall() {
    // Request mic permission upfront so the user sees the prompt immediately
    // when opening the call, instead of mid-conversation.
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Microphone is not supported in this browser for Voice Call.");
      return;
    }
    try {
      const probeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      probeStream.getTracks().forEach(t => t.stop());
    } catch (e) {
      alert("Microphone permission required.\n\nSteps:\n1. Tap the lock icon in the address bar\n2. Set Microphone → Allow\n3. Reload the page\n4. Try voice call again");
      return;
    }
    setShowVoiceCall(true);
    setVTranscript("");
    setVLast("");

    voiceActiveRef.current = true;
    const tone = sessionTone || "female";
    const isFirstEver = (msgs?.length || 0) === 0;
    const greeting = "Hey! I am Saraswati.";

    setVs("speak");
    setVLast(greeting);
    setTimeout(() => {
      speakText(greeting, tone, 1.0, () => {
        if (voiceActiveRef.current) {
          setVs("listen");
          startListening(msgs, tone, sid, userData);
        } else {
          setVs("idle");
        }
      });
    }, 200);
  }


  function closeVoiceCall() {
    endVoice();
    setShowVoiceCall(false);
    setVTranscript("");
  }

  // ── Image Generation flow (Gemini via secure backend, Pollinations fallback) ──
  async function generateAndAppendImage(prompt) {
    const tid = "img_" + Date.now();
    // Show an inline loading bubble inside the chat while the image generates
    setMsgs(p => [...p, { id: tid, role: "ai", text: "", image: null, imageGenerating: true, imagePrompt: prompt, time: new Date() }]);
    setLoading(false);
    try {
      const url = await generateImageGemini(prompt);
      const aiText = '🎨 Here is your image — "' + prompt + '"';
      setMsgs(p => p.map(m => m.id === tid ? { ...m, text: aiText, image: url, imageGenerating: false, imageFailed: false } : m));
      await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "ai", text: aiText, image: url, createdAt: serverTimestamp() });
    } catch (e) {
      // Gemini failed — automatically fall back to Pollinations so the user
      // still gets an image rather than a hard error.
      try {
        const fallbackUrl = getImgUrl(prompt);
        const aiText = '🎨 Here is your image — "' + prompt + '"';
        setMsgs(p => p.map(m => m.id === tid ? { ...m, text: aiText, image: fallbackUrl, imageGenerating: false, imageFailed: false } : m));
        await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "ai", text: aiText, image: fallbackUrl, createdAt: serverTimestamp() });
      } catch {
        setMsgs(p => p.map(m => m.id === tid ? { ...m, text: "❌ Image generation failed. Please try again.", image: null, imageGenerating: false, imageFailed: true, imagePrompt: prompt } : m));
      }
    }
  }

  async function runAIAndAppend(newMsgs, b64, tone) {
    // ── MEDIA LINK CARD ──────────────────────────────────────────
    if (!b64 && needsMediaLink(newMsgs[newMsgs.length - 1]?.text || "")) {
      const msgText = newMsgs[newMsgs.length - 1].text;
      setLoading(true);
      await new Promise(r => setTimeout(r, 400));
      const links = getMediaLinks(msgText);
      const cleanQuery = msgText.replace(/link do|link dedo|dikhao|dikha do|chahiye|please|plz|send karo/gi, "").trim();
      const tid = "media_" + Date.now();
      const aiText = `🔗 "${cleanQuery}" ke liye yahan se dekho:`;
      setLoading(false);
      setMsgs(p => [...p, { id: tid, role: "ai", text: aiText, mediaLinks: links, mediaQuery: cleanQuery, time: new Date() }]);
      try { await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "ai", text: aiText + " [media links]", createdAt: serverTimestamp() }); } catch {}
      return;
    }
    if (!b64 && needsImageGen(newMsgs[newMsgs.length - 1]?.text || "")) {
      const msgText = newMsgs[newMsgs.length - 1].text;
      const prompt = extractPrompt(msgText);
      await generateAndAppendImage(prompt);
      return;
    }
    const lastUserMsg = [...newMsgs].reverse().find(m => m.role === "user");
    if (lastUserMsg && needsSearch(lastUserMsg.text)) { setSearching(true); setLoadingStep("Searching web..."); }
    else setLoadingStep("Thinking...");
    setLoading(true);
    try {
      const aiText = await callAI(newMsgs, b64, tone, memoryEnabled ? memories : null, language, activeAgent);
      setSearching(false); setLoadingStep("Writing response...");
      const tid = "ai_" + Date.now();
      setLoading(false); setLoadingStep("");
      setMsgs(p => [...p, { id: tid, role: "ai", text: "", time: new Date() }]);
      let shown = "", sc = 0;
      for (let i = 0; i < aiText.length; i++) {
        shown += aiText[i];
        const s = shown;
        setMsgs(p => p.map(m => m.id === tid ? { ...m, text: s } : m));
        sc++; if (sc % 10 === 0) playTypingSound();
        await new Promise(r => setTimeout(r, 7));
      }
      await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "ai", text: aiText, createdAt: serverTimestamp() });
    } catch (e) { setSearching(false); setLoading(false); setLoadingStep(""); setMsgs(p => [...p, { id: Date.now(), role: "ai", text: "❌ Error: " + e.message, time: new Date() }]); }
  }

  async function sendMsg(text) {
    const txt = (text !== undefined && text !== null) ? String(text).trim() : input.trim();
    if ((!txt && !imgB64 && !imgPrev && !attachments.length) || loading) return;
    const ud = userData || {};
    if (!ud?.premium && (ud?.usageCount || 0) >= FREE_LIMIT) { setShowLimit(true); return; }
    const msgText = txt || (attachments.length ? "Please read and explain this file." : "What is in this image?");
    setInput("");
    const b64 = imgB64, prev = imgPrev;
    const files = attachments.map(a => ({ name: a.name, ext: a.ext, error: a.error || null }));
    let fileContext = "";
    if (attachments.length) {
      let combined = "";
      for (const a of attachments) {
        if (a.error) { combined += `\n\n[Attached file: ${a.name} — could not be read: ${a.error}]`; continue; }
        combined += `\n\n[Attached file: ${a.name}]\n${a.text}`;
      }
      if (combined.length > ATTACH_TOTAL_LIMIT) combined = combined.slice(0, ATTACH_TOTAL_LIMIT) + "\n...[truncated]";
      fileContext = combined;
    }
    setImgB64(null); setImgPrev(null); setAttachments([]);
    playSendSound();
    const det = detectTone(msgText);
    if (det) setSessionTone(det);
    const tone = det || sessionTone || "female";
    // NOTE: Full base64 image is NOT stored in Firestore (exceeds 1MB doc limit).
    // We only store hasImage:true as a flag. The image is kept in local state (prev)
    // for display in the current session, and passed to AI as b64.
    let uRef;
    try {
      uRef = await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "user", text: msgText, hasImage: prev ? true : null, files: files.length ? files : null, fileContext: fileContext || null, createdAt: serverTimestamp() });
    } catch (err) {
      console.error("Firestore addDoc failed:", err);
      uRef = { id: "local_" + Date.now() };
    }
    const newMsgs = [...msgs, { id: uRef.id, role: "user", text: msgText, image: prev, files: files.length ? files : null, fileContext: fileContext || null, time: new Date() }];
    setMsgs(newMsgs);
    const isFirst = msgs.length === 0;
    let titleUpdate = {};
    if (isFirst) {
      const t = await genTitle(msgText);
      titleUpdate = { title: t || msgText.slice(0, 38), createdAt: serverTimestamp() };
    }
    // Build searchIndex from last messages for content search
    const existingIndex = (msgs.slice(-4).map(m => m.text || "").join(" ") + " " + msgText).slice(0, 500).toLowerCase();
    await setDoc(doc(db, "chats", sid), { userId: user.uid, ...titleUpdate, updatedAt: serverTimestamp(), searchIndex: existingIndex }, { merge: true });
    const nc = (ud?.usageCount || 0) + 1;
    await setDoc(doc(db, "users", user.uid), { usageCount: nc }, { merge: true });
    setUserData(p => ({ ...p, usageCount: nc }));
    // Track per-agent chat count
    if (activeAgent?.id) {
      const agId = activeAgent.id;
      setAgentChatCounts(p => ({ ...p, [agId]: (p[agId] || 0) + 1 }));
      try { await updateDoc(doc(db, "agents", agId), { totalChats: (activeAgent.totalChats||0) + 1 }); } catch {}
    }
    // Fire memory save in background — intentionally not awaited so AI response isn't blocked
    // Explicit "remember" commands still work because maybeSaveMemory handles them first
    if (memoryEnabled) maybeSaveMemory(msgText).catch(() => {});
    await runAIAndAppend(newMsgs, b64, tone);
  }

  async function editMessage(id, newText) {
    if (!newText.trim() || loading) return;
    const idx = msgs.findIndex(m => m.id === id);
    if (idx === -1) return;
    const target = msgs[idx];
    try { await updateDoc(doc(db, "messages", id), { text: newText.trim(), edited: true }); } catch {}
    const toRemove = msgs.slice(idx + 1).filter(m => typeof m.id === "string" && !m.id.startsWith("ai_") && !m.id.startsWith("img_") && !m.id.startsWith("v_"));
    for (const m of toRemove) { try { await deleteDoc(doc(db, "messages", m.id)); } catch {} }
    const trimmed = msgs.slice(0, idx);
    const updatedMsg = { ...target, text: newText.trim(), edited: true };
    const newMsgs = [...trimmed, updatedMsg];
    setMsgs(newMsgs);
    const tone = sessionTone || "female";
    await runAIAndAppend(newMsgs, null, tone);
  }

  async function deleteMessage(id) {
    askConfirm({
      title: "Delete Message?",
      message: "This message will be permanently removed.",
      onConfirm: async () => {
        try { await deleteDoc(doc(db, "messages", id)); } catch {}
        setMsgs(p => p.filter(m => m.id !== id));
      }
    });
  }

  async function regenerateMessage(id) {
    if (loading) return;
    const idx = msgs.findIndex(m => m.id === id);
    if (idx === -1) return;
    const toRemove = msgs.slice(idx).filter(m => typeof m.id === "string" && !m.id.startsWith("ai_") && !m.id.startsWith("img_") && !m.id.startsWith("v_"));
    for (const m of toRemove) { try { await deleteDoc(doc(db, "messages", m.id)); } catch {} }
    const newMsgs = msgs.slice(0, idx);
    setMsgs(newMsgs);
    const tone = sessionTone || "female";
    await runAIAndAppend(newMsgs, null, tone);
  }

  async function loadSession(s) {
    try {
      setPage("chat"); setSid(s.id); setMsgs([]); setShowSb(false);
      const q = query(collection(db, "messages"), where("sessionId", "==", s.id));
      const snap = await getDocs(q);
      setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data(), time: d.data().createdAt })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));
    } catch (e) { alert("Error: " + e.message); }
  }

  async function delSession(id, e) {
    e.stopPropagation();
    askConfirm({
      title: "Delete Chat?",
      message: "This chat and its messages will be permanently removed.",
      onConfirm: async () => {
        await deleteDoc(doc(db, "chats", id));
        setHists(p => p.filter(h => h.id !== id));
      }
    });
  }

  async function renameSession(id, newTitle) {
    if (!newTitle.trim()) { setRenamingId(null); return; }
    await updateDoc(doc(db, "chats", id), { title: newTitle.trim() });
    setHists(p => p.map(h => h.id === id ? { ...h, title: newTitle.trim() } : h));
    setRenamingId(null);
  }

  async function togglePin(id, e) {
    e?.stopPropagation();
    const cur = hists.find(h => h.id === id);
    const next = !cur?.pinned;
    await setDoc(doc(db, "chats", id), { pinned: next }, { merge: true });
    setHists(p => p.map(h => h.id === id ? { ...h, pinned: next } : h));
  }
  async function toggleStar(id, e) {
    e?.stopPropagation();
    const cur = hists.find(h => h.id === id);
    const next = !cur?.starred;
    await setDoc(doc(db, "chats", id), { starred: next }, { merge: true });
    setHists(p => p.map(h => h.id === id ? { ...h, starred: next } : h));
  }
  async function toggleArchive(id, e) {
    e?.stopPropagation();
    const cur = hists.find(h => h.id === id);
    const next = !cur?.archived;
    await setDoc(doc(db, "chats", id), { archived: next }, { merge: true });
    setHists(p => p.map(h => h.id === id ? { ...h, archived: next } : h));
  }

  // ── AGENT FUNCTIONS ──────────────────────────────────────────
  async function loadAgents(uid) {
    try {
      const q = query(collection(db, "agents"), where("userId", "==", uid), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { setAgents([]); }
  }

  async function saveAgent() {
    if (!agentForm.name.trim()) return;
    try {
      if (editingAgent) {
        await updateDoc(doc(db, "agents", editingAgent.id), { ...agentForm, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "agents"), { ...agentForm, userId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      await loadAgents(user.uid);
      setShowAgentBuilder(false);
      setEditingAgent(null);
      setAgentForm({ name: "", emoji: "🤖", instructions: "", tone: "friendly", lang: "english" });
    } catch (e) { alert("Save failed: " + e.message); }
  }

  async function deleteAgent(id) {
    try { await deleteDoc(doc(db, "agents", id)); await loadAgents(user.uid); } catch {}
  }

  function startAgent(agent) {
    setActiveAgent(agent);
    setSid(Date.now().toString());
    // Show welcome message
    setMsgs(agent.welcomeMessage ? [{ role:"assistant", content: agent.welcomeMessage, id: Date.now() }] : []);
    setPage("chat"); setShowSb(false); setImgB64(null); setImgPrev(null); setReactions({});
  }

  function stopAgent() { setActiveAgent(null); }

  // ═══════════════════════════════════════════════════════════════
  // ALL MARKETPLACE + AGENTS + CREATOR + ADMIN FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  const PLATFORM_UPI  = "8126630980";
  const PUBLISH_FEE   = 9;
  const PLATFORM_CUT  = 0.20;
  const CREATOR_SHARE = 0.80;

  const ALL_CATEGORIES = [
    "Farming & Agriculture","UPSC Preparation","NEET Preparation","JEE Preparation",
    "Coding & Programming","Finance & Banking","Business & Startup","Marketing & SEO",
    "Healthcare & Medicine","Legal & Law","Fitness & Exercise","Education & Tutoring",
    "Travel & Tourism","Cooking & Recipes","Spiritual & Meditation","Real Estate",
    "YouTube & Content","Instagram & Social Media","AI & Machine Learning","Technology",
    "Photography","Video Editing","Freelancing","Mental Health & Therapy","Nutrition & Diet",
    "Yoga & Wellness","Veterinary & Animal Care","Weather & Environment","Mathematics",
    "Science & Research","History & Culture","Language Learning","Literature & Writing",
    "Music & Arts","Tax & Accounting","Insurance","Web Development","Mobile Apps",
    "Cybersecurity","Customer Support","HR & Recruitment","Business Strategy","E-commerce",
    "Journalism & News","Interior Design","Architecture","Automobile & Vehicles",
    "Electronics & Gadgets","Home Improvement","Gardening","Sustainability","Sports & Cricket",
    "Football & Sports","Chess & Games","Astrology & Horoscope","Parenting & Child Care",
    "Relationships","Senior Care","Women Empowerment","Government Schemes","RTI & Rights",
    "Railway & Travel","Job Search","Entrepreneurship","Graphic Design","Data Analysis",
    "Research Assistant","Translation","Event Planning","Wedding Planning","Stock Market",
    "Cryptocurrency","Import & Export","Supply Chain","Pharmacy","Dental Care","Eye Care",
    "Skin & Beauty","Hair & Grooming","Police & Safety","NGO & Social Work","Religious & Faith",
    "Mythology","Palmistry","Numerology","Pet Care","Bird Watching","Hiking & Trekking",
    "Space & Astronomy","Geography","Economics","Psychology","Philosophy","Motivational Coach",
    "Life Coach","Career Counseling","Study Planner","Exam Preparation","Hindi Literature",
    "Urdu Poetry","Sanskrit","Sign Language","Digital Literacy","Tribal Culture",
    "Rural Development","Urban Planning","Smart Cities","School Education","College Education",
    "Teacher Assistant","Doctor AI","Lawyer AI","CA & Tax Expert","Immigration Consultant"
  ];

  // ── FIX: Image Avatar ─────────────────────────────────────────
  function handleAgentAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setAgentAvatarPreview(ev.target.result); setAgentAvatarFile(ev.target.result); };
    reader.readAsDataURL(file);
  }

  // ── FIX: PDF Knowledge Base ───────────────────────────────────
  async function handleAgentPdf(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAgentPdfName(file.name);
    try {
      const text = await file.text();
      setAgentPdfText(text.slice(0, 8000));
    } catch {
      const reader = new FileReader();
      reader.onload = ev => {
        const arr = new Uint8Array(ev.target.result);
        let txt = "";
        for (let i = 0; i < Math.min(arr.length, 50000); i++) {
          if (arr[i] >= 32 && arr[i] < 127) txt += String.fromCharCode(arr[i]);
          else if (arr[i] === 10 || arr[i] === 13) txt += String.fromCharCode(10);
        }
        setAgentPdfText(txt.replace(/\s+/g," ").trim().slice(0,8000));
      };
      reader.readAsArrayBuffer(file);
    }
  }

  // ── AI Agent Data Generator ───────────────────────────────────
  // ── Category-specific expert knowledge base ─────────────────────
  const CATEGORY_EXPERTISE = {
    "Farming & Agriculture": {
      topics: "Crops, Seeds, Fertilizers, Irrigation, Soil Health, Pest Control, Weather, Government Schemes, Organic Farming, Mandi Rates, Kisan Credit Card, PM-KISAN, MSP",
      style: "Simple Hindi/Hinglish mein samjhao. Practical advice do. Local knowledge use karo.",
      tone: "Dost jaisa, samajhdaar, patient",
      lang: "Hinglish"
    },
    "Coding & Programming": {
      topics: "React, JavaScript, Python, TypeScript, APIs, Debugging, Web Development, App Development, Data Structures, Algorithms, System Design, Git, Docker, SQL, MongoDB",
      style: "Code examples de. Step-by-step explain karo. Error messages ko diagnose karo.",
      tone: "Technical, precise, helpful",
      lang: "English/Hinglish"
    },
    "Business & Startup": {
      topics: "Marketing, Sales, Finance, Branding, Startup Strategy, Funding, GTM, Product-Market Fit, Revenue Models, Team Building, Operations, Growth Hacking",
      style: "Data-driven insights do. Real examples use karo. Actionable advice.",
      tone: "Professional, strategic, motivating",
      lang: "English/Hinglish"
    },
    "Healthcare & Medicine": {
      topics: "Symptoms, Diagnosis, Medicines, Diet, Nutrition, Preventive Care, Mental Health, First Aid, Medical Tests, Specialist Referrals, Health Insurance",
      style: "Clear medical info do. Always professional. Serious cases mein doctor refer karo.",
      tone: "Empathetic, calm, professional",
      lang: "Hindi/Hinglish"
    },
    "Finance & Banking": {
      topics: "Investment, Mutual Funds, SIP, Stocks, FD, Insurance, Tax, ITR Filing, Loans, Credit Score, UPI, Banking, Cryptocurrency, Financial Planning",
      style: "Numbers aur calculations ke saath explain karo. Risk clearly batao.",
      tone: "Trustworthy, analytical, clear",
      lang: "Hindi/Hinglish"
    },
    "Legal & Law": {
      topics: "RTI, Consumer Rights, Property Law, Family Law, Criminal Law, Contract, Labour Law, Court Procedure, FIR, Police, Tenancy, Divorce",
      style: "Simple language mein legal terms explain karo. Court process guide karo.",
      tone: "Authoritative, clear, helpful",
      lang: "Hindi/Hinglish"
    },
    "Education & Tutoring": {
      topics: "Curriculum, Study Plans, Concept Explanation, Practice Problems, Exam Tips, Notes Making, Time Management, Learning Strategies",
      style: "Patient approach. Multiple examples do. Student ki level pe explain karo.",
      tone: "Encouraging, patient, clear",
      lang: "Hindi/English"
    },
    "UPSC Preparation": {
      topics: "Prelims, Mains, GS Papers, CSAT, Current Affairs, History, Geography, Polity, Economy, Science & Technology, Ethics, Optional Subject, Answer Writing",
      style: "Structured answers likhna sikhao. Previous year questions use karo.",
      tone: "Disciplined, focused, motivating",
      lang: "Hindi/English"
    },
    "NEET Preparation": {
      topics: "Physics, Chemistry, Biology, NCERT, Previous Papers, MCQs, Revision, Mock Tests, Human Body, Genetics, Ecology",
      style: "Diagram-based explanation. MCQ tricks batao. Weak topics identify karo.",
      tone: "Focused, detailed, encouraging",
      lang: "Hindi/English"
    },
    "JEE Preparation": {
      topics: "Mathematics, Physics, Chemistry, Calculus, Mechanics, Organic Chemistry, Problem Solving, Mock Tests, JEE Mains & Advanced",
      style: "Problem-solving approach. Shortcuts aur tricks. Concept clarity pe focus.",
      tone: "Analytical, precise, motivating",
      lang: "Hindi/English"
    },
    "Marketing & SEO": {
      topics: "SEO, SEM, Social Media, Content Marketing, Email Marketing, Analytics, ROI, Brand Building, Digital Ads, Google Ads, Meta Ads",
      style: "Case studies use karo. Metrics pe focus karo. Practical campaigns batao.",
      tone: "Creative, data-driven, strategic",
      lang: "English/Hinglish"
    },
    "Fitness & Exercise": {
      topics: "Workout Plans, Weight Loss, Muscle Building, Nutrition, Supplements, Yoga, Running, Recovery, BMI, Calorie Counting, Home Workouts",
      style: "Safe techniques batao. Personalized plans do. Progress track karo.",
      tone: "Motivating, energetic, supportive",
      lang: "Hindi/Hinglish"
    },
    "Mental Health & Therapy": {
      topics: "Anxiety, Depression, Stress, CBT, Mindfulness, Self-care, Relationships, Trauma, Sleep, Emotional Intelligence",
      style: "Empathetic listening. Non-judgmental. Professional help refer karo when needed.",
      tone: "Warm, compassionate, gentle",
      lang: "Hindi/Hinglish"
    },
    "Travel & Tourism": {
      topics: "Destinations, Itinerary, Budget Travel, Visa, Hotels, Local Food, Transport, Hidden Gems, Travel Insurance, Packing, Safety",
      style: "Personal recommendations do. Budget breakdown karo. Practical tips share karo.",
      tone: "Enthusiastic, knowledgeable, friendly",
      lang: "Hindi/Hinglish"
    },
    "Cooking & Recipes": {
      topics: "Indian Recipes, International Cuisine, Nutrition, Meal Planning, Kitchen Tips, Substitutions, Dietary Requirements, Baking",
      style: "Step-by-step recipes. Measurements exact do. Tips aur variations batao.",
      tone: "Warm, encouraging, passionate",
      lang: "Hindi/Hinglish"
    },
    "Real Estate": {
      topics: "Property Buying, Selling, Renting, RERA, Home Loans, Vastu, Legal Documents, Registration, Stamp Duty, Investment",
      style: "Legal process guide karo. Calculations karo. Red flags batao.",
      tone: "Professional, trustworthy, detailed",
      lang: "Hindi/Hinglish"
    },
    "YouTube & Content": {
      topics: "Channel Growth, SEO, Thumbnails, Scripts, Monetization, Analytics, Collaboration, Niche Selection, Equipment, Editing",
      style: "Practical growth tips do. Algorithm explain karo. Content calendar banao.",
      tone: "Creative, energetic, strategic",
      lang: "Hindi/Hinglish"
    },
    "AI & Machine Learning": {
      topics: "Machine Learning, Deep Learning, NLP, Computer Vision, Python, TensorFlow, PyTorch, Data Science, Neural Networks, LLMs, Prompt Engineering",
      style: "Code examples de. Mathematical concepts explain karo. Real applications batao.",
      tone: "Technical, curious, innovative",
      lang: "English/Hinglish"
    },
  };

  async function generateAgentData(name, category) {
    if (!name.trim() || !category.trim()) return null;
    try {
      // Get category-specific expertise if available
      const catExpert = CATEGORY_EXPERTISE[category] || {
        topics: `Everything related to ${category} — professional advice, guidance, and expertise`,
        style: "Clear, helpful, professional. Examples de. Step-by-step guide karo.",
        tone: "Professional, knowledgeable, friendly",
        lang: "Hindi/English/Hinglish"
      };

      const expertPrompt = `You are an expert AI Agent designer. Create a REAL expert AI agent configuration.

Agent Name: "${name}"
Category: "${category}"
Expert Topics: ${catExpert.topics}
Communication Style: ${catExpert.style}
Tone: ${catExpert.tone}
Language: ${catExpert.lang}

IMPORTANT RULES:
- This agent must behave like a REAL ${category} expert
- Instructions must be SPECIFIC to ${category} — not generic
- Skills must be actual ${category} skills — not generic AI skills
- Welcome message must show domain expertise immediately
- System prompt must make the agent deeply knowledgeable about: ${catExpert.topics}
- The systemPrompt field MUST include this rule at the end: "Always give accurate answers, never invent false information, and if unsure clearly say so while still giving the best possible guidance."

Return ONLY valid JSON (no backticks, no markdown, no explanation):
{
  "description": "2-3 lines describing this expert agent's specific capabilities in ${category}",
  "instructions": "You are ${name}, a highly experienced ${category} expert. [5-6 sentences with SPECIFIC knowledge areas: ${catExpert.topics}. Include how to handle queries, when to give detailed answers, how to use examples specific to ${category}. Mention that you use simple language and practical advice.]",
  "systemPrompt": "You are ${name}. You have 15+ years of expertise in ${category}. Your core knowledge areas are: ${catExpert.topics}. ${catExpert.style} Always provide accurate, actionable, category-specific advice. Never give generic answers.",
  "welcomeMessage": "A warm, expert-sounding welcome that mentions 2-3 specific topics from ${category} you can help with",
  "personality": "${catExpert.tone}",
  "language": "${catExpert.lang}",
  "expertise": "Top 3 specific expertise areas from ${catExpert.topics}",
  "conversationStyle": "${catExpert.style.split('.')[0]}",
  "suggestedAvatar": "single most relevant emoji for ${category}",
  "skills": ["specific_skill_1", "specific_skill_2", "specific_skill_3", "specific_skill_4", "specific_skill_5"]
}`;

      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ },
        body: JSON.stringify({
          model: CHAT_MODEL,
          max_tokens: 900,
          temperature: 0.6,
          messages: [{ role: "user", content: expertPrompt }]
        })
      });
      const d = await r.json();
      let raw = (d.choices?.[0]?.message?.content || "").trim()
        .replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return null;
      return JSON.parse(m[0]);
    } catch { return null; }
  }

  // ── Save New Agent (always saves as Draft first) ─────────────────
  async function saveNewAgent(name, category, genData) {
    if (!name.trim() || !category.trim()) return;
    setAgentSaving(true);
    try {
      const agentData = {
        name: name.trim(), category: category.trim(),
        emoji: agentAvatarFile ? "" : (genData?.suggestedAvatar||"🤖"),
        avatarImg: agentAvatarFile || null,
        pdfKnowledge: agentPdfText || null,
        pdfName: agentPdfName || null,
        description: genData?.description||"",
        instructions: genData?.instructions||"",
        systemPrompt: genData?.systemPrompt||"",
        welcomeMessage: genData?.welcomeMessage||"",
        personality: genData?.personality||"Friendly",
        language: genData?.language||"Hinglish",
        expertise: genData?.expertise||"",
        conversationStyle: genData?.conversationStyle||"",
        skills: genData?.skills||[],
        status:"draft",       // ← always draft on create
        published:false,      // ← never auto-publish
        publishingFeePaid: false,
        userId: user.uid,
        creatorName: userData?.name||user?.displayName||"Creator",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        tone:"friendly", lang:"hindi",
        totalChats:0, totalUsers:0, avgRating:0, reviewCount:0,
      };
      if (agentEditId) {
        // On edit: don't reset publishingFeePaid or published status
        const { status, published, publishingFeePaid, createdAt, ...editData } = agentData;
        await updateDoc(doc(db,"agents",agentEditId), {...editData, updatedAt:serverTimestamp()});
        setAgentEditId(null);
      } else {
        await addDoc(collection(db,"agents"), agentData);
      }
      await loadAgents(user.uid);
      setAgentTab("my");
      setAgentCreateForm({name:"",category:""});
      setAgentGenData(null); setAgentCatSearch("");
      setAgentAvatarFile(null); setAgentAvatarPreview(null);
      setAgentPdfFile(null); setAgentPdfName(""); setAgentPdfText("");
      setAgentPrice("0");
    } catch(e){ alert("Save failed: "+e.message); }
    setAgentSaving(false);
  }

  // ── Publish Fee Flow (Razorpay ₹9) ───────────────────────────────
  function initiatePublishFee(agent, customPrice) {
    setPublishFeeAgent({...agent, customPrice: parseFloat(customPrice)||0});
    setPublishFeeDone(false); setPublishPayStatus(null); setPublishedSuccess(false); setShowPublishFee(true);
  }

  // Open Razorpay checkout for ₹9 publishing fee
  async function openRazorpayPublish() {
    if (!publishFeeAgent) return;
    // Load Razorpay script dynamically if not already loaded
    if (!window.Razorpay) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_yourkeyhere",
      amount: PUBLISH_FEE * 100, // paise
      currency: "INR",
      name: "Saraswati AI",
      description: `Publish Fee — ${publishFeeAgent.name}`,
      image: "/icon.png",
      prefill: {
        email: user?.email || "",
        name: userData?.name || "",
      },
      theme: { color: "#f97316" },
      handler: async function(response) {
        // Payment successful — Razorpay calls this with payment_id
        setPublishPayStatus("success");
        setPublishFeeDone(true);
      },
      modal: {
        ondismiss: function() {
          // User closed without paying — show fail state
          setPublishPayStatus("fail");
        }
      }
    };
    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", () => setPublishPayStatus("fail"));
    rzp.open();
  }

  async function confirmPublish() {
    if (!publishFeeAgent) return;
    setPublishFeeLoading(true);
    try {
      await updateDoc(doc(db,"agents",publishFeeAgent.id), {
        published:true,
        status:"published",
        price: parseFloat(publishFeeAgent.customPrice)||0,
        publishedAt:serverTimestamp(),
        creatorName: userData?.name||user?.displayName||"Creator",
        creatorId: user.uid, featured:false,
        publishingFeePaid:true,
      });
      await addDoc(collection(db,"platformEarnings"), {
        type:"publish_fee", amount:PUBLISH_FEE,
        userId:user.uid, agentId:publishFeeAgent.id,
        agentName:publishFeeAgent.name, createdAt:serverTimestamp()
      });
      // Notify creator
      await addDoc(collection(db,"notifications"),{
        userId:user.uid,title:"🚀 Agent Published!",
        body:`"${publishFeeAgent.name}" is now live on the Marketplace.`,
        read:false,createdAt:serverTimestamp(),type:"admin"
      });
      await loadAgents(user.uid);
      setPublishFeeDone(false);
      setPublishedSuccess(true);
    } catch(e){ alert("Publish failed: "+e.message); }
    setPublishFeeLoading(false);
  }

  async function toggleAgentPublish(id, cur) {
    if (cur) {
      // Unpublish
      try {
        await updateDoc(doc(db,"agents",id),{published:false,status:"draft",updatedAt:serverTimestamp()});
        await loadAgents(user.uid);
      } catch {}
      return;
    }
    // Publish — check if fee already paid to prevent duplicate charges
    const ag = agents.find(a=>a.id===id);
    if (!ag) return;
    if (ag.publishingFeePaid) {
      // Fee already paid — publish directly, no payment needed
      setPublishFeeLoading(true);
      try {
        await updateDoc(doc(db,"agents",id),{
          published:true, status:"published",
          publishedAt:serverTimestamp(), updatedAt:serverTimestamp()
        });
        await loadAgents(user.uid);
        // Show brief success notification
        await addDoc(collection(db,"notifications"),{
          userId:user.uid,title:"🚀 Agent Re-published!",
          body:`"${ag.name}" is live on the Marketplace again.`,
          read:false,createdAt:serverTimestamp(),type:"admin"
        });
      } catch {}
      setPublishFeeLoading(false);
      return;
    }
    // Fee not paid — open publish fee modal with Razorpay
    initiatePublishFee(ag, ag.price||0);
  }

  // ── Marketplace Functions ─────────────────────────────────────
  async function loadMarketplace() {
    setMkLoading(true);
    try {
      const q = query(collection(db,"agents"), where("published","==",true));
      const snap = await getDocs(q);
      setMkAgents(snap.docs.map(d=>({id:d.id,...d.data()})));
      if (user) {
        try {
          const os = await getDocs(query(collection(db,"agentUsage"),where("userId","==",user.uid)));
          setMkOwnedIds(os.docs.map(d=>d.data().agentId));
        } catch {}
      }
    } catch { setMkAgents([]); }
    setMkLoading(false);
  }

  async function loadAgentReviews(agentId) {
    try {
      const q = query(collection(db,"agentReviews"),where("agentId","==",agentId),orderBy("createdAt","desc"),limit(20));
      setMkReviews((await getDocs(q)).docs.map(d=>({id:d.id,...d.data()})));
    } catch {
      try {
        const s = await getDocs(query(collection(db,"agentReviews"),where("agentId","==",agentId)));
        setMkReviews(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
      } catch { setMkReviews([]); }
    }
  }

  async function submitReview(agentId) {
    if (!mkReviewText.trim()) return;
    setMkReviewLoading(true);
    try {
      await addDoc(collection(db,"agentReviews"),{agentId,userId:user.uid,userName:userData?.name||"User",rating:mkReviewRating,text:mkReviewText.trim(),createdAt:serverTimestamp()});
      const allR=[...mkReviews,{rating:mkReviewRating}];
      const avg=allR.reduce((s,r)=>s+(r.rating||5),0)/allR.length;
      await updateDoc(doc(db,"agents",agentId),{avgRating:parseFloat(avg.toFixed(1)),reviewCount:allR.length});
      setMkReviewText(""); setMkReviewRating(5);
      await loadAgentReviews(agentId);
      setMkAgents(p=>p.map(a=>a.id===agentId?{...a,avgRating:parseFloat(avg.toFixed(1)),reviewCount:allR.length}:a));
    } catch(e){alert("Review failed: "+e.message);}
    setMkReviewLoading(false);
  }

  async function useMarketplaceAgent(agent) {
    try {
      const ex=await getDocs(query(collection(db,"agentUsage"),where("userId","==",user.uid),where("agentId","==",agent.id)));
      if(ex.empty){
        await addDoc(collection(db,"agentUsage"),{userId:user.uid,agentId:agent.id,createdAt:serverTimestamp()});
        await updateDoc(doc(db,"agents",agent.id),{totalUsers:(agent.totalUsers||0)+1});
        setMkOwnedIds(p=>[...p,agent.id]);
      }
    } catch {}
    setActiveAgent({...agent}); setMkDetail(null);
    // Show welcome message when agent starts
    setSid(Date.now().toString());
    setMsgs(agent.welcomeMessage ? [{ role:"assistant", content: agent.welcomeMessage, id: Date.now() }] : []);
    setPage("chat"); setShowSb(false); setImgB64(null); setImgPrev(null);
  }

  async function buyMarketplaceAgent(agent) {
    if (!agent.price||agent.price===0){ await useMarketplaceAgent(agent); return; }
    setBuyModalAgent(agent); setBuyPayDone(false); setShowBuyModal(true); setMkDetail(null);
  }

  async function recordAgentSale(agent) {
    if (!agent.price||agent.price===0) return;
    const total=agent.price, plat=Math.round(total*PLATFORM_CUT), creator=Math.round(total*CREATOR_SHARE);
    try {
      await addDoc(collection(db,"agentSales"),{agentId:agent.id,agentName:agent.name,buyerId:user.uid,buyerName:userData?.name||"User",creatorId:agent.userId||"",totalAmount:total,platformEarning:plat,creatorEarning:creator,createdAt:serverTimestamp(),status:"paid"});
      if(agent.userId){
        const cd=await getDoc(doc(db,"creators",agent.userId));
        const cur=cd.exists()?(cd.data().walletBalance||0):0;
        await setDoc(doc(db,"creators",agent.userId),{walletBalance:cur+creator,updatedAt:serverTimestamp()},{merge:true});
        // Notify creator: wallet credited
        await addDoc(collection(db,"notifications"),{userId:agent.userId,title:"💰 Wallet Credited",body:`₹${creator} credited for sale of "${agent.name}"`,read:false,createdAt:serverTimestamp(),type:"wallet"});
        // Notify creator: agent purchased
        await addDoc(collection(db,"notifications"),{userId:agent.userId,title:"🛒 Agent Purchased",body:`Someone bought "${agent.name}" for ₹${total}`,read:false,createdAt:serverTimestamp(),type:"sale"});
      }
      // Notify buyer: payment success
      await addDoc(collection(db,"notifications"),{userId:user.uid,title:"✅ Payment Successful",body:`You now have access to "${agent.name}"`,read:false,createdAt:serverTimestamp(),type:"payment"});
      await updateDoc(doc(db,"agents",agent.id),{totalUsers:(agent.totalUsers||0)+1});
    } catch(e){console.error(e);}
  }

  function shareAgent(agent) {
    const url = window.location.origin + "?agent=" + agent.id;
    if (navigator.share) {
      navigator.share({ title: agent.name, text: agent.description||"", url });
    } else {
      navigator.clipboard?.writeText(url);
      alert("Link copied: " + url);
    }
  }

  function getMkFiltered() {
    let list = mkAgents.length>0 ? [...mkAgents] : [...DEMO_AGENTS];
    if(mkSearch.trim()){const q=mkSearch.toLowerCase();list=list.filter(a=>(a.name||"").toLowerCase().includes(q)||(a.category||"").toLowerCase().includes(q)||(a.description||"").toLowerCase().includes(q));}
    if(mkCatFilter!=="All") list=list.filter(a=>(a.category||"")===mkCatFilter);
    if(mkRatingFilter>0) list=list.filter(a=>(a.avgRating||0)>=mkRatingFilter);
    if(mkPriceFilter==="free") list=list.filter(a=>!a.price||a.price===0);
    if(mkPriceFilter==="paid") list=list.filter(a=>a.price&&a.price>0);
    const sorted = [...list];
    if(mkTab==="trending") sorted.sort((a,b)=>((b.totalUsers||0)+(b.avgRating||0)*10)-((a.totalUsers||0)+(a.avgRating||0)*10));
    else if(mkTab==="new"||mkTab==="recent") sorted.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    else if(mkTab==="toprated") sorted.sort((a,b)=>(b.avgRating||0)-(a.avgRating||0));
    else if(mkTab==="mostused") sorted.sort((a,b)=>(b.totalUsers||0)-(a.totalUsers||0));
    else if(mkTab==="free") return sorted.filter(a=>!a.price||a.price===0);
    else if(mkTab==="paid") return sorted.filter(a=>a.price&&a.price>0);
    else if(mkTab==="recommended") sorted.sort((a,b)=>(b.avgRating||0)-(a.avgRating||0));
    if(mkTab==="trending") return [sorted.find(a=>a.featured),...sorted.filter(a=>!a.featured)].filter(Boolean);
    return sorted;
  }

  const DEMO_AGENTS = [
    {id:"d1",name:"Doctor AI",emoji:"👨‍⚕️",category:"Healthcare & Medicine",description:"Health questions, symptom analysis, and medical guidance in English.",avgRating:4.8,reviewCount:234,totalUsers:1250,price:0,creatorName:"Kunal S",published:true,featured:true,skills:["Symptom Analysis","Medicine Info","Diet Advice","Health Tips","First Aid"]},
    {id:"d2",name:"Kisan Mitra",emoji:"👨‍🌾",category:"Farming & Agriculture",description:"Expert advice on crops, farming, weather, and agricultural best practices.",avgRating:4.9,reviewCount:567,totalUsers:3400,price:0,creatorName:"AgriTech India",published:true,featured:true,skills:["Crop Planning","Weather Tips","Pest Control","Market Rates","Soil Health"]},
    {id:"d3",name:"Legal Eagle",emoji:"⚖️",category:"Legal & Law",description:"Indian law, RTI, consumer rights — explained in simple language.",avgRating:4.6,reviewCount:189,totalUsers:890,price:49,creatorName:"LegalTech Pro",published:true,skills:["RTI Filing","Consumer Rights","Property Law","Contract Review","Court Procedure"]},
    {id:"d4",name:"Finance Guru",emoji:"💰",category:"Finance & Banking",description:"Investment, SIP, tax saving — grow your money the smart way.",avgRating:4.7,reviewCount:312,totalUsers:2100,price:0,creatorName:"MoneyWise AI",published:true,skills:["SIP Planning","Tax Saving","Stock Tips","Budget","Loan Advice"]},
    {id:"d5",name:"Code Master",emoji:"🧑‍💻",category:"Coding & Programming",description:"Learn to write and debug Python, JS, React, and SQL code.",avgRating:4.9,reviewCount:890,totalUsers:6700,price:99,creatorName:"DevBot Pro",published:true,featured:true,skills:["Code Review","Bug Fix","Python","JavaScript","System Design"]},
    {id:"d6",name:"Study Planner",emoji:"📖",category:"UPSC Preparation",description:"UPSC, JEE, NEET — exam strategy and personalized study schedules.",avgRating:4.8,reviewCount:567,totalUsers:7800,price:0,creatorName:"StudyAI",published:true,skills:["Study Schedule","Mock Tests","Revision Tips","Exam Strategy","Subject Help"]},
    {id:"d7",name:"Chef AI",emoji:"🧑‍🍳",category:"Cooking & Recipes",description:"Indian and international recipes, nutrition tips, and meal planning.",avgRating:4.8,reviewCount:678,totalUsers:4200,price:0,creatorName:"FoodieBot",published:true,skills:["Recipes","Nutrition","Meal Planning","Cooking Tips","Diet Plans"]},
    {id:"d8",name:"Fitness Pro",emoji:"💪",category:"Fitness & Exercise",description:"Workout plans, diet tips, and weight loss guidance.",avgRating:4.6,reviewCount:345,totalUsers:2800,price:29,creatorName:"FitLife AI",published:true,skills:["Workout Plans","Diet Planning","Weight Loss","Muscle Building","Yoga"]},
    {id:"d9",name:"Astro Guide",emoji:"🔮",category:"Astrology & Horoscope",description:"Kundali, horoscope, vastu — insights from Vedic astrology.",avgRating:4.4,reviewCount:234,totalUsers:1800,price:0,creatorName:"Jyotish AI",published:true,skills:["Kundali Reading","Daily Horoscope","Vastu Tips","Gemstone Advice","Career"]},
    {id:"d10",name:"Travel Buddy",emoji:"✈️",category:"Travel & Tourism",description:"Tours across India and the world, with budget travel tips.",avgRating:4.5,reviewCount:212,totalUsers:1560,price:0,creatorName:"TravelBot",published:true,skills:["Itinerary Planning","Budget Tips","Visa Help","Hotel Booking","Local Food"]},
    {id:"d11",name:"Mental Coach",emoji:"🧠",category:"Mental Health & Therapy",description:"Stress, anxiety — emotional support and practical coping strategies.",avgRating:4.7,reviewCount:156,totalUsers:930,price:0,creatorName:"MindCare AI",published:true,skills:["Stress Relief","Anxiety Help","Meditation","CBT Techniques","Sleep Tips"]},
    {id:"d12",name:"Business Advisor",emoji:"🏢",category:"Business & Startup",description:"Startup ideas, business planning, and marketing strategies.",avgRating:4.6,reviewCount:289,totalUsers:1670,price:79,creatorName:"BizAI Pro",published:true,skills:["Business Plan","Marketing","Funding","Team Building","Growth Hacks"]},
  ];

  // ── Creator Dashboard ─────────────────────────────────────────
  async function loadCreatorData() {
    if (!user) return;
    setCreatorLoading(true);
    try {
      const cDoc = await getDoc(doc(db,"creators",user.uid));
      const cd = cDoc.exists()?cDoc.data():{};
      let myAg=[];
      try { const as=await getDocs(query(collection(db,"agents"),where("userId","==",user.uid))); myAg=as.docs.map(d=>({id:d.id,...d.data()})); } catch {}
      let sales=[];
      try {
        try {
          const sq=query(collection(db,"agentSales"),where("creatorId","==",user.uid),orderBy("createdAt","desc"),limit(50));
          sales=(await getDocs(sq)).docs.map(d=>({id:d.id,...d.data()}));
        } catch {
          const s2=await getDocs(query(collection(db,"agentSales"),where("creatorId","==",user.uid)));
          sales=s2.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
        }
      } catch {}
      setCreatorSales(sales);
      let wds=[];
      try {
        try {
          const wq=query(collection(db,"withdrawals"),where("userId","==",user.uid),orderBy("createdAt","desc"),limit(20));
          wds=(await getDocs(wq)).docs.map(d=>({id:d.id,...d.data()}));
        } catch {
          const w2=await getDocs(query(collection(db,"withdrawals"),where("userId","==",user.uid)));
          wds=w2.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
        }
      } catch {}
      setCreatorWithdrawals(wds);
      const totalRevenue=sales.reduce((s,p)=>s+(p.creatorEarning||0),0);
      const commission=sales.reduce((s,p)=>s+(p.platformEarning||0),0);
      const withdrawn=wds.filter(w=>w.status==="paid").reduce((s,w)=>s+(w.amount||0),0);
      const pendingBal=wds.filter(w=>w.status==="pending").reduce((s,w)=>s+(w.amount||0),0);
      setCreatorData({
        totalAgents:myAg.length, publishedAgents:myAg.filter(a=>a.published).length,
        totalSales:sales.length, totalRevenue, commission,
        walletBalance:cd.walletBalance!==undefined?cd.walletBalance:Math.max(0,totalRevenue-withdrawn),
        pendingBalance:pendingBal,
        upiId:cd.upiId||"",
        agentsData:myAg,
      });
      // Load per-agent chat counts into state
      const chatCountMap = {};
      myAg.forEach(a => { chatCountMap[a.id] = a.totalChats || 0; });
      setAgentChatCounts(prev => ({ ...prev, ...chatCountMap }));
      setCreatorUpiVal(cd.upiId||"");
    } catch(e){console.error(e);}
    setCreatorLoading(false);
  }

  async function saveCreatorUpi(upiId) {
    if (!upiId.trim()) return;
    try {
      await setDoc(doc(db,"creators",user.uid),{upiId:upiId.trim(),updatedAt:serverTimestamp()},{merge:true});
      setCreatorData(p=>({...p,upiId:upiId.trim()}));
      setCreatorUpiEdit(false);
    } catch(e){alert("UPI save failed: "+e.message);}
  }

  async function requestWithdraw() {
    const amt=parseFloat(withdrawAmount);
    if(!amt||amt<50){alert("Minimum ₹50!");return;}
    if(!withdrawUpi.trim()){alert("UPI ID daalo!");return;}
    if(creatorData&&amt>creatorData.walletBalance){alert("Insufficient balance!");return;}
    setWithdrawLoading(true);
    try {
      await addDoc(collection(db,"withdrawals"),{userId:user.uid,userName:userData?.name||"",amount:amt,upiId:withdrawUpi.trim(),status:"pending",createdAt:serverTimestamp()});
      await setDoc(doc(db,"creators",user.uid),{walletBalance:Math.max(0,(creatorData?.walletBalance||0)-amt),updatedAt:serverTimestamp()},{merge:true});
      setCreatorData(p=>({...p,walletBalance:Math.max(0,(p?.walletBalance||0)-amt)}));
      setWithdrawAmount("");
      alert("✅ Withdrawal request submit! 24-48 hours in process hogi.");
      await loadCreatorData();
    } catch(e){alert("Withdraw failed: "+e.message);}
    setWithdrawLoading(false);
  }

  // ── Admin Functions ───────────────────────────────────────────
  async function loadAdminFull() {
    setAdminLoading(true);
    try {
      try { const s=await getDocs(collection(db,"agents")); setAdminAllAgents(s.docs.map(d=>({id:d.id,...d.data()}))); } catch {}
      try { const s=await getDocs(collection(db,"agentSales")); setAdminPurchases(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))); } catch {}
      try { const s=await getDocs(collection(db,"withdrawals")); setAdminWithdraws(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))); } catch {}
      try { const s=await getDocs(collection(db,"platformEarnings")); setAdminTransactions(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))); } catch {}
      try {
        const cDoc=await getDoc(doc(db,"adminConfig","categories"));
        if(cDoc.exists()) setAdminCategories(cDoc.data().list||[]);
        const cfg=await getDoc(doc(db,"adminConfig","settings"));
        if(cfg.exists()){setAdminCommission(cfg.data().commissionPct||20);setAdminCommissionVal(String(cfg.data().commissionPct||20));}
        const feat=await getDoc(doc(db,"adminConfig","featured"));
        if(feat.exists()) setAdminFeaturedIds(feat.data().ids||[]);
      } catch {}
    } catch(e){console.error(e);}
    setAdminLoading(false);
  }

  async function adminApproveAgent(id){
    await updateDoc(doc(db,"agents",id),{status:"approved",published:true,approvedAt:serverTimestamp()});
    setAdminAllAgents(p=>p.map(a=>a.id===id?{...a,status:"approved",published:true}:a));
    const ag=adminAllAgents.find(a=>a.id===id);
    if(ag?.userId) await addDoc(collection(db,"notifications"),{userId:ag.userId,title:"✅ Agent Approved",body:`"${ag.name}" is now live!`,read:false,createdAt:serverTimestamp(),type:"admin"});
  }
  async function adminRejectAgent(id){
    await updateDoc(doc(db,"agents",id),{status:"rejected",published:false});
    setAdminAllAgents(p=>p.map(a=>a.id===id?{...a,status:"rejected",published:false}:a));
    const ag=adminAllAgents.find(a=>a.id===id);
    if(ag?.userId) await addDoc(collection(db,"notifications"),{userId:ag.userId,title:"❌ Agent Rejected",body:`"${ag.name}" was not approved. Please review and resubmit.`,read:false,createdAt:serverTimestamp(),type:"admin"});
  }
  async function adminSuspendAgent(id){
    await updateDoc(doc(db,"agents",id),{status:"suspended",published:false});
    setAdminAllAgents(p=>p.map(a=>a.id===id?{...a,status:"suspended",published:false}:a));
  }
  async function adminRemoveAgent(id){
    askConfirm({title:"Remove Agent?",message:"Permanently delete this agent.",danger:true,onConfirm:async()=>{
      await deleteDoc(doc(db,"agents",id));
      setAdminAllAgents(p=>p.filter(a=>a.id!==id));
    }});
  }
  async function adminUpdatePrice(id,price){
    await updateDoc(doc(db,"agents",id),{price:parseFloat(price)||0});
    setAdminAllAgents(p=>p.map(a=>a.id===id?{...a,price:parseFloat(price)||0}:a));
    setAdminEditPriceId(null);
  }
  async function adminToggleFeature(id){
    const isFeat=adminFeaturedIds.includes(id);
    const newIds=isFeat?adminFeaturedIds.filter(x=>x!==id):[...adminFeaturedIds,id];
    setAdminFeaturedIds(newIds);
    await setDoc(doc(db,"adminConfig","featured"),{ids:newIds,updatedAt:serverTimestamp()},{merge:true});
    await updateDoc(doc(db,"agents",id),{featured:!isFeat});
    setAdminAllAgents(p=>p.map(a=>a.id===id?{...a,featured:!isFeat}:a));
  }
  async function adminSaveCommission(pct){
    const val=Math.min(100,Math.max(0,parseFloat(pct)||20));
    await setDoc(doc(db,"adminConfig","settings"),{commissionPct:val,updatedAt:serverTimestamp()},{merge:true});
    setAdminCommission(val); setAdminEditCommission(false);
  }
  async function adminApproveWithdraw(id){
    await updateDoc(doc(db,"withdrawals",id),{status:"paid",paidAt:serverTimestamp()});
    setAdminWithdraws(p=>p.map(w=>w.id===id?{...w,status:"paid"}:w));
    const wd=adminWithdraws.find(w=>w.id===id);
    if(wd?.userId) await addDoc(collection(db,"notifications"),{userId:wd.userId,title:"💸 Withdrawal Approved",body:`₹${wd.amount} sent to ${wd.upiId}`,read:false,createdAt:serverTimestamp(),type:"admin"});
  }
  async function adminRejectWithdraw(id){
    const wd=adminWithdraws.find(w=>w.id===id);
    await updateDoc(doc(db,"withdrawals",id),{status:"rejected",rejectedAt:serverTimestamp()});
    setAdminWithdraws(p=>p.map(w=>w.id===id?{...w,status:"rejected"}:w));
    if(wd?.userId&&wd?.amount){
      const cd=await getDoc(doc(db,"creators",wd.userId));
      const cur=cd.exists()?(cd.data().walletBalance||0):0;
      await setDoc(doc(db,"creators",wd.userId),{walletBalance:cur+wd.amount,updatedAt:serverTimestamp()},{merge:true});
    }
  }
  async function adminAddCategory(name){
    if(!name.trim())return;
    const updated=[...adminCategories,name.trim()];
    await setDoc(doc(db,"adminConfig","categories"),{list:updated,updatedAt:serverTimestamp()},{merge:true});
    setAdminCategories(updated); setAdminNewCat("");
  }
  async function adminSaveEditCat(oldName,newName){
    if(!newName.trim())return;
    const updated=adminCategories.map(c=>c===oldName?newName.trim():c);
    await setDoc(doc(db,"adminConfig","categories"),{list:updated,updatedAt:serverTimestamp()},{merge:true});
    setAdminCategories(updated); setAdminCatEditId(null); setAdminCatEditVal("");
  }
  async function adminRemoveCategory(name){
    const updated=adminCategories.filter(c=>c!==name);
    await setDoc(doc(db,"adminConfig","categories"),{list:updated,updatedAt:serverTimestamp()},{merge:true});
    setAdminCategories(updated);
  }
  async function sendNotification(){
    if(!notifTitle.trim()||!notifBody.trim())return;
    setNotifLoading(true);
    try {
      const us=await getDocs(collection(db,"users"));
      const batch = us.docs.slice(0,200);
      for(const ud of batch)
        await addDoc(collection(db,"notifications"),{
          userId:  ud.id,
          title:   notifTitle.trim(),   // required
          body:    notifBody.trim(),    // required
          users:   "all",
          type:    "broadcast",
          read:    false,
          sentBy:  user?.uid||"admin",
          createdAt: serverTimestamp()
        });
      // Log broadcast in notifications collection (admin record)
      await addDoc(collection(db,"notificationLogs"),{
        title:      notifTitle.trim(),
        body:       notifBody.trim(),
        users:      "all",
        sentCount:  batch.length,
        sentBy:     user?.uid||"admin",
        createdAt:  serverTimestamp()
      });
      setNotifTitle("");setNotifBody("");
      alert("✅ Notification sent to "+batch.length+" users!");
    } catch(e){alert("Failed: "+e.message);}
    setNotifLoading(false);
  }
  async function sendEmailBroadcast(){
    if(!broadcastSubject.trim()||!broadcastBody.trim())return;
    setBroadcastLoading(true);
    try {
      await addDoc(collection(db,"emailBroadcasts"),{
        subject:broadcastSubject.trim(),body:broadcastBody.trim(),
        target:broadcastTarget, sentBy:user.uid,
        createdAt:serverTimestamp(),status:"queued",recipientCount:adminUsers.length
      });
      setBroadcastSent(true); setBroadcastSubject("");setBroadcastBody("");
      setTimeout(()=>setBroadcastSent(false),4000);
    } catch(e){alert("Failed: "+e.message);}
    setBroadcastLoading(false);
  }

  async function loadProjects() {
    setProjLoad(true);
    try {
      const q = query(collection(db, "projects"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      try {
        const q2 = query(collection(db, "projects"), where("userId", "==", user.uid));
        const s2 = await getDocs(q2);
        setProjects(s2.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      } catch (e) { console.error(e); }
    }
    setProjLoad(false);
  }

  async function createProject() {
    const name = newProjName.trim();
    if (!name) return;
    const ref = await addDoc(collection(db, "projects"), { userId: user.uid, title: name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    setProjects(p => [{ id: ref.id, userId: user.uid, title: name, createdAt: { seconds: Date.now() / 1000 } }, ...p]);
    setNewProjName(""); setShowNewProj(false);
  }

  async function renameProject(id, name) {
    if (!name.trim()) { setRenamingProjId(null); return; }
    await updateDoc(doc(db, "projects", id), { title: name.trim() });
    setProjects(p => p.map(pr => pr.id === id ? { ...pr, title: name.trim() } : pr));
    setRenamingProjId(null);
  }

  async function deleteProject(id) {
    askConfirm({
      title: "Delete Project?",
      message: "This project will be permanently removed.",
      onConfirm: async () => {
        await deleteDoc(doc(db, "projects", id));
        setProjects(p => p.filter(pr => pr.id !== id));
      }
    });
  }

  async function adminToggle(uid, cur) {
    await updateDoc(doc(db, "users", uid), { premium: !cur, premiumPending: false });
    setAdminUsers(p => p.map(u => u.id === uid ? { ...u, premium: !cur } : u));
  }
  async function adminDelUser(uid) {
    askConfirm({
      title: "Delete User?",
      message: "This will permanently delete this user's account. This cannot be undone.",
      onConfirm: async () => {
        await deleteDoc(doc(db, "users", uid));
        setAdminUsers(p => p.filter(u => u.id !== uid));
      }
    });
  }
  async function adminDelChat(msgId) {
    await deleteDoc(doc(db, "messages", msgId));
    setAChat(p => ({ ...p, msgs: p.msgs.filter(m => m.id !== msgId) }));
  }

  // ════════════════════════════════════════════════════════════════
  // PART 5 — AI COMMAND CENTER FUNCTIONS
  // ════════════════════════════════════════════════════════════════

  // ── Gather live platform data snapshot for AI context ───────────
  async function gatherPlatformSnapshot() {
    const snap = {};
    try {
      const uSnap = await getDocs(collection(db, "users"));
      const users = uSnap.docs.map(d => d.data());
      snap.totalUsers    = users.length;
      snap.premiumUsers  = users.filter(u => u.premium).length;
      snap.totalMsgs     = users.reduce((s, u) => s + (u.usageCount || 0), 0);
    } catch { snap.totalUsers = 0; snap.premiumUsers = 0; snap.totalMsgs = 0; }

    try {
      const aSnap = await getDocs(collection(db, "agents"));
      const agents = aSnap.docs.map(d => d.data());
      snap.totalAgents     = agents.length;
      snap.publishedAgents = agents.filter(a => a.published).length;
      snap.topAgents       = [...agents].sort((a, b) => (b.totalUsers||0)-(a.totalUsers||0)).slice(0, 5).map(a => ({ name: a.name, users: a.totalUsers||0, revenue: 0, rating: a.avgRating||0 }));
    } catch { snap.totalAgents = 0; snap.publishedAgents = 0; snap.topAgents = []; }

    try {
      const pSnap = await getDocs(collection(db, "agentSales"));
      const sales = pSnap.docs.map(d => d.data());
      snap.totalSales      = sales.length;
      snap.totalRevenue    = sales.reduce((s, p) => s + (p.totalAmount||0), 0);
      snap.totalCommission = sales.reduce((s, p) => s + (p.platformEarning||0), 0);
      snap.totalCreatorPay = sales.reduce((s, p) => s + (p.creatorEarning||0), 0);
      // Today's revenue
      const today = new Date(); today.setHours(0,0,0,0);
      const todaySales = sales.filter(s => s.createdAt?.seconds && s.createdAt.seconds * 1000 >= today.getTime());
      snap.todayRevenue = todaySales.reduce((s, p) => s + (p.totalAmount||0), 0);
      snap.todaySales   = todaySales.length;
      // Top selling agents by revenue
      const agentRevMap = {};
      sales.forEach(s => { agentRevMap[s.agentName] = (agentRevMap[s.agentName]||0) + (s.totalAmount||0); });
      snap.topSellingAgents = Object.entries(agentRevMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,rev])=>({name,revenue:rev}));
    } catch { snap.totalSales=0; snap.totalRevenue=0; snap.totalCommission=0; snap.todayRevenue=0; snap.todaySales=0; snap.topSellingAgents=[]; }

    try {
      const wSnap = await getDocs(query(collection(db, "withdrawals"), where("status","==","pending")));
      snap.pendingWithdrawals = wSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      snap.pendingWithdrawCount = snap.pendingWithdrawals.length;
      snap.pendingWithdrawTotal = snap.pendingWithdrawals.reduce((s, w) => s + (w.amount||0), 0);
    } catch { snap.pendingWithdrawals=[]; snap.pendingWithdrawCount=0; snap.pendingWithdrawTotal=0; }

    try {
      const tSnap = await getDocs(collection(db, "platformEarnings"));
      snap.publishFeesCollected = tSnap.docs.filter(d => d.data().type==="publish_fee").length * 9;
    } catch { snap.publishFeesCollected = 0; }

    snap.generatedAt = new Date().toLocaleString("en-IN", { timeZone:"Asia/Kolkata" });
    return snap;
  }

  // ── Parse AI command response to extract intent + action ────────
  function parseCommandIntent(text) {
    const t = text.toLowerCase();
    if (t.includes("approve") && t.includes("withdraw")) return "approve_withdraw";
    if (t.includes("reject") && t.includes("withdraw"))  return "reject_withdraw";
    if (t.includes("send email") || t.includes("broadcast email")) return "send_email";
    if (t.includes("send notification") || t.includes("notify all")) return "send_notification";
    if (t.includes("suspend") && t.includes("agent"))    return "suspend_agent";
    if (t.includes("approve") && t.includes("agent"))    return "approve_agent";
    if (t.includes("generate") && t.includes("report"))  return "generate_report";
    return null;
  }

  // ── Execute a confirmed action ───────────────────────────────────
  async function executeCmdAction(action, params = {}) {
    setCmdLoading(true);
    let resultMsg = "";
    try {
      switch (action) {
        case "approve_withdraw": {
          if (!params.withdrawId) { resultMsg = "❌ Withdrawal ID not found. Please specify which withdrawal to approve."; break; }
          await updateDoc(doc(db, "withdrawals", params.withdrawId), { status:"paid", paidAt: serverTimestamp() });
          const wd = params.withdrawData;
          if (wd?.userId) await addDoc(collection(db, "notifications"), { userId: wd.userId, title:"💸 Withdrawal Approved", body:`Your withdrawal of ₹${wd.amount} has been approved.`, read:false, createdAt: serverTimestamp(), type:"admin" });
          resultMsg = `✅ Withdrawal of ₹${params.amount || ""} approved and marked as paid!`;
          break;
        }
        case "reject_withdraw": {
          if (!params.withdrawId) { resultMsg = "❌ Withdrawal ID not found."; break; }
          await updateDoc(doc(db, "withdrawals", params.withdrawId), { status:"rejected", rejectedAt: serverTimestamp() });
          resultMsg = `❌ Withdrawal rejected and amount refunded to creator wallet.`;
          break;
        }
        case "send_email": {
          if (!params.subject || !params.body) { resultMsg = "❌ Email subject and body required."; break; }
          const uSnap = await getDocs(collection(db, "users"));
          await addDoc(collection(db, "emailBroadcasts"), { subject: params.subject, body: params.body, sentBy: user?.uid, createdAt: serverTimestamp(), status:"queued", recipientCount: uSnap.size });
          resultMsg = `✅ Email broadcast queued for ${uSnap.size} users! Subject: "${params.subject}"`;
          break;
        }
        case "send_notification": {
          // Validate required fields: users, title, body
          if (!params.title || !params.body) {
            resultMsg = "❌ Title aur body dono zaroori hain notification ke liye.";
            break;
          }
          const notifUsers = params.users || "all";
          const notifType  = params.type  || "announcement";

          const uSnap2 = await getDocs(collection(db, "users"));
          let targetUsers = uSnap2.docs;

          // Filter by target audience
          if (notifUsers === "premium") {
            targetUsers = targetUsers.filter(d => d.data().premium === true);
          } else if (notifUsers === "creators") {
            // creators = users who have at least one agent
            const crSnap = await getDocs(collection(db, "agents"));
            const creatorIds = new Set(crSnap.docs.map(d => d.data().userId).filter(Boolean));
            targetUsers = targetUsers.filter(d => creatorIds.has(d.id));
          }
          // else "all" = send to everyone (max 200)

          const batch = targetUsers.slice(0, 200);
          for (const ud of batch) {
            await addDoc(collection(db, "notifications"), {
              userId:    ud.id,
              title:     params.title,           // required
              body:      params.body,            // required
              users:     notifUsers,             // "all" | "premium" | "creators"
              type:      notifType,              // "announcement" | "update" | "alert" etc.
              read:      false,
              sentBy:    user?.uid || "admin",
              createdAt: serverTimestamp(),
            });
          }
          resultMsg = `✅ Notification sent!
📢 Title: ${params.title}
👥 Sent to: ${batch.length} ${notifUsers} users`;
          break;
        }
        case "suspend_agent": {
          if (!params.agentId) { resultMsg = "❌ Agent ID required."; break; }
          await updateDoc(doc(db, "agents", params.agentId), { status:"suspended", published:false });
          resultMsg = `⚠️ Agent suspended successfully.`;
          break;
        }
        case "approve_agent": {
          if (!params.agentId) { resultMsg = "❌ Agent ID required."; break; }
          await updateDoc(doc(db, "agents", params.agentId), { status:"approved", published:true, approvedAt: serverTimestamp() });
          resultMsg = `✅ Agent approved and published to Marketplace!`;
          break;
        }
        default:
          resultMsg = "✅ Action executed successfully.";
      }
    } catch (e) { resultMsg = "❌ Error: " + e.message; }
    setCmdHistory(h => [...h, { role:"system", text: resultMsg, ts: Date.now() }]);
    setCmdPending(null);
    setCmdLoading(false);
  }

  // ── Main AI Command processor ────────────────────────────────────
  async function processCommand(inputText) {
    if (!inputText.trim() || cmdLoading) return;
    const userMsg = inputText.trim();
    setCmdInput("");
    setCmdHistory(h => [...h, { role:"user", text: userMsg, ts: Date.now() }]);
    setCmdLoading(true);

    try {
      // Detect email search command
      const emailMatch = userMsg.match(/search\s+user\s+(?:by\s+email\s+)?([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i)
        || userMsg.match(/find\s+user\s+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i)
        || userMsg.match(/user\s+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);

      // Gather live data
      const snap = await gatherPlatformSnapshot();

      // If email search, attach found user to snap
      if (emailMatch) {
        const foundUser = await searchUserByEmail(emailMatch[1]);
        snap.foundUser = foundUser || null;
        if (!foundUser) {
          setCmdHistory(h => [...h, { role:"ai", text:`❌ User not found with email: ${emailMatch[1]}`, ts: Date.now() }]);
          setCmdLoading(false);
          return;
        }
      }

      // Build context for AI
      const systemPrompt = `You are Saraswati AI's Admin Command Center AI. You have LIVE access to the platform data below.

PLATFORM SNAPSHOT (as of ${snap.generatedAt}):
- Total Users: ${snap.totalUsers} (Premium: ${snap.premiumUsers})
- Total Messages Sent: ${snap.totalMsgs}
- Total Agents: ${snap.totalAgents} (Published: ${snap.publishedAgents})
- Total Sales: ${snap.totalSales}
- Total Revenue: ₹${snap.totalRevenue} (Today: ₹${snap.todayRevenue})
- Platform Commission Earned: ₹${snap.totalCommission}
- Creator Payouts: ₹${snap.totalCreatorPay}
- Publish Fees Collected: ₹${snap.publishFeesCollected}
- Pending Withdrawals: ${snap.pendingWithdrawCount} (Total: ₹${snap.pendingWithdrawTotal})
- Top Selling Agents: ${JSON.stringify(snap.topSellingAgents)}
- Top Agents by Users: ${JSON.stringify(snap.topAgents)}

PENDING WITHDRAWALS:
${snap.pendingWithdrawals.map(w => `ID:${w.id} | ${w.userName||"Creator"} | ₹${w.amount} | UPI:${w.upiId}`).join("\n") || "None"}

${snap.foundUser ? `USER SEARCH RESULT:\nName: ${snap.foundUser.name} | Email: ${snap.foundUser.email} | Premium: ${snap.foundUser.premium?"Yes":"No"} | Messages: ${snap.foundUser.usageCount||0} | Joined: ${snap.foundUser.createdAt?.seconds?new Date(snap.foundUser.createdAt.seconds*1000).toLocaleDateString("en-IN"):"N/A"}` : ""}

You can answer questions about platform data OR help admin take actions.

For ACTIONS (approve withdraw, send email, etc.), format your response with:
ACTION: <action_type>
PARAMS: <json params>
CONFIRM: <user-friendly confirmation message>

Action types: approve_withdraw, reject_withdraw, send_email, send_notification, suspend_agent, approve_agent

NOTIFICATION FORMAT (critical — always use this exact structure for send_notification):
ACTION: send_notification
PARAMS: {"users":"all","title":"emoji + short title here","body":"detailed message body here","type":"announcement"}

Example — if user says "notify users about marketplace":
ACTION: send_notification
PARAMS: {"users":"all","title":"🛍 Marketplace is Live!","body":"Browse, buy and use AI Agents on Saraswati AI Marketplace. Check it out now!","type":"announcement"}

Always auto-generate a relevant title AND body based on the notification topic.
Never send just a "message" field — always use "title" + "body" separately.

For INFO queries, just answer clearly with the data.
Keep responses concise, professional, and in English.`;

      const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "Authorization":"Bearer " + GROQ },
        body: JSON.stringify({
          model: CHAT_MODEL,
          messages:[
            { role:"system", content: systemPrompt },
            ...cmdHistory.filter(h=>h.role!=="system").slice(-6).map(h=>({ role:h.role==="ai"?"assistant":"user", content:h.text })),
            { role:"user", content: userMsg }
          ],
          max_tokens:600, temperature:0.3
        })
      });
      const data = await aiRes.json();
      const aiText = data.choices?.[0]?.message?.content || "Sorry, kuch error aaya.";

      // Parse if action required
      const actionMatch = aiText.match(/ACTION:\s*(\w+)/i);
      const paramsMatch = aiText.match(/PARAMS:\s*(\{[\s\S]*?\})/i);
      const confirmMatch = aiText.match(/CONFIRM:\s*(.+?)(?:\n|$)/i);

      if (actionMatch) {
        const action = actionMatch[1];
        let params = {};
        try { params = JSON.parse(paramsMatch?.[1] || "{}"); } catch {}
        const confirmMsg = confirmMatch?.[1] || "Please confirm this action.";
        const cleanText = aiText.replace(/ACTION:[\s\S]*?(?=\n\n|\n[A-Z]|$)/i,"").replace(/PARAMS:[\s\S]*?(?=\n\n|\n[A-Z]|$)/i,"").replace(/CONFIRM:.*$/im,"").trim();
        setCmdHistory(h => [...h, { role:"ai", text: cleanText || aiText, ts: Date.now(), hasAction:true }]);
        setCmdPending({ action, params, confirmMsg });
      } else {
        setCmdHistory(h => [...h, { role:"ai", text: aiText, data: snap, ts: Date.now() }]);
      }
    } catch (e) {
      setCmdHistory(h => [...h, { role:"ai", text:"❌ Command failed: " + e.message, ts: Date.now() }]);
    }
    setCmdLoading(false);
  }

  // ── Daily Business Report generator ─────────────────────────────
  async function generateDailyReport() {
    setCmdReportLoading(true);
    try {
      const snap = await gatherPlatformSnapshot();
      const today = new Date().toLocaleDateString("en-IN", { weekday:"long", year:"numeric", month:"long", day:"numeric", timeZone:"Asia/Kolkata" });

      const prompt = `Generate a professional Daily Business Report for Saraswati AI platform.

DATE: ${today}
LIVE DATA:
- Users: ${snap.totalUsers} total, ${snap.premiumUsers} premium
- Agents: ${snap.totalAgents} total, ${snap.publishedAgents} published
- Revenue Today: ₹${snap.todayRevenue} (${snap.todaySales} sales)
- Total Revenue All Time: ₹${snap.totalRevenue}
- Platform Commission: ₹${snap.totalCommission}
- Pending Withdrawals: ${snap.pendingWithdrawCount} (₹${snap.pendingWithdrawTotal})
- Top Agents: ${snap.topSellingAgents.map(a=>a.name+"(₹"+a.revenue+")").join(", ")||"None yet"}

Format the report with these sections:
1. Executive Summary (2-3 lines)
2. Key Metrics (bullet points with numbers)  
3. Revenue Breakdown
4. Action Items (what admin should do today)
5. Growth Insights (short recommendation)

Keep it professional, data-driven, and actionable. Use Indian Rupee ₹ symbol. Max 400 words.`;

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "Authorization":"Bearer " + GROQ },
        body: JSON.stringify({ model: CHAT_MODEL, messages:[{ role:"user", content: prompt }], max_tokens:600, temperature:0.4 })
      });
      const d = await res.json();
      const report = d.choices?.[0]?.message?.content || "Could not generate report.";

      // Save report to Firestore
      const dateKey = new Date().toISOString().split("T")[0];
      await setDoc(doc(db, "adminReports", dateKey), { report, snapshot: snap, generatedAt: serverTimestamp(), date: dateKey }, { merge:true });

      setCmdReport({ text: report, snap, date: today });
      setCmdReportDate(dateKey);
    } catch (e) { console.error("Report error:", e); }
    setCmdReportLoading(false);
  }

  function newChat() { setSid(Date.now().toString()); setMsgs([]); setPage("chat"); setShowSb(false); setImgB64(null); setImgPrev(null); endVoice(); setReactions({}); setSessionTone(null); }

  // ── Notifications ────────────────────────────────────────────────
  async function loadNotifications() {
    if (!user) return;
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.seconds || 0;
          const tb = b.createdAt?.seconds || 0;
          return tb - ta; // latest first
        });
      setNotifications(list);
      setNotifsLoaded(true);
    } catch {}
  }

  async function markAllRead() {
    if (!user) return;
    const unread = notifications.filter(n => !n.read);
    setNotifications(p => p.map(n => ({ ...n, read: true })));
    for (const n of unread) {
      try { await updateDoc(doc(db, "notifications", n.id), { read: true }); } catch {}
    }
  }

  async function markOneRead(id) {
    setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n));
    try { await updateDoc(doc(db, "notifications", id), { read: true }); } catch {}
  }

  // ── Search User by Email ─────────────────────────────────────────
  async function searchUserByEmail(email) {
    if (!email.trim()) return null;
    try {
      const q = query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() };
    } catch { return null; }
  }

  // Long-press (mobile) / right-click-free long-press (desktop) on a sidebar
  // chat item opens the same Rename / Pin / Delete context menu used on the
  // History page, like Claude's app does for its recent chats list.
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);
  function bindLongPress(histId) {
    const start = (e) => {
      longPressFired.current = false;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      longPressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        if (navigator.vibrate) navigator.vibrate(15);
        setChatContextMenu({ histId, x, y });
      }, 500);
    };
    const cancel = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };
    return {
      onTouchStart: start,
      onTouchEnd: cancel,
      onTouchMove: cancel,
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel,
    };
  }

  const isAdmin = user?.email === ADMIN;
  const chatsLeft = userData?.premium ? null : Math.max(0, FREE_LIMIT - (userData?.usageCount || 0));
  const displayName = userData?.name || user?.displayName || "User";
  const filtHists = hists.filter(h => {
    const q = hSearch.toLowerCase().trim();
    if (!q) {
      if (hFilter === "pinned") return !!h.pinned;
      if (hFilter === "starred") return !!h.starred;
      if (hFilter === "archived") return !!h.archived;
      return !h.archived;
    }
    // Search in title AND message content (searchIndex)
    const inTitle = (h.title || "").toLowerCase().includes(q);
    const inContent = (h.searchIndex || "").toLowerCase().includes(q);
    if (!inTitle && !inContent) return false;
    if (hFilter === "pinned") return !!h.pinned;
    if (hFilter === "starred") return !!h.starred;
    if (hFilter === "archived") return !!h.archived;
    return !h.archived;
  });
  const pinnedHists = hists.filter(h => h.pinned && !h.archived);
  const filtAdminU = adminUsers.filter(u => (u.name || "").toLowerCase().includes(aSearch.toLowerCase()) || (u.email || "").toLowerCase().includes(aSearch.toLowerCase()));
  const adminGraph = Array.from({ length: 7 }, (_, i) => {
    const val = adminUsers.filter(u => { if (!u.createdAt?.seconds) return false; return Math.floor((Date.now() - u.createdAt.seconds * 1000) / 86400000) === (6 - i); }).length;
    return { l: ["M", "T", "W", "T", "F", "S", "S"][i], v: val };
  });
  const maxG = Math.max(...adminGraph.map(d => d.v), 1);
  // vOrbIcon handled inline
  const vStatusTxt = { idle: "Tap to Talk", listen: "Listening... (tap to stop)", think: "Thinking...", speak: "Speaking..." }[vs];
  const accentColor = ACCENTS[accentKey]?.primary || "#f97316";

  if (!authReady) return null;

  if (!user) return (
    <div className="app">
      <style>{buildStyles(themeKey, accentKey, fontSize)}</style>
      <div className="auth">
        <div className="auth-logo" style={{display:"flex",justifyContent:"center"}}><SaraswatiLogo size={56} animate={true} state="idle" /></div>
        <div className="auth-title">Saraswati AI</div>
        <div className="auth-sub">India's AI Assistant</div>
        <div className="card">
          {forgot ? (
            <>
              <div className="card-head">Reset Password</div>
              <div className="iw"><div className="ilbl">Email</div><input className="inp" type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="iw"><div className="ilbl">New Password</div><input className="inp" type="password" placeholder="Min 8 characters" value={form.newPass} onChange={e => setForm(f => ({ ...f, newPass: e.target.value }))} /></div>
              <div className="iw"><div className="ilbl">Confirm Password</div><input className="inp" type="password" placeholder="Re-enter password" value={form.confirmPass} onChange={e => setForm(f => ({ ...f, confirmPass: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAuth()} /></div>
              {ferr && <div className="err">{ferr}</div>}
              {fok && <div className="ok">{fok}</div>}
              <button className="btn btn-p" onClick={handleAuth} disabled={fload}>{fload ? "Sending..." : "Reset Password"}</button>
              <div className="lnk"><span onClick={() => { setForgot(false); setFerr(""); setFok(""); }}>← Back to Login</span></div>
            </>
          ) : (
            <>
              <div className="card-head">{mlStep === "sent" ? "Check Your Email 📧" : mlStep === "verifying" ? "Verifying..." : "Welcome 👋"}</div>
              {/* Google Sign-In Button */}
              <button
                onClick={handleGoogleAuth}
                disabled={fload}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  width: "100%", padding: "12px 16px", borderRadius: 10,
                  border: "1.5px solid var(--bd)", background: "var(--sf2)",
                  color: "var(--tx)", fontSize: 15, fontWeight: 600, cursor: "pointer",
                  marginBottom: 4, transition: "all 0.2s"
                }}
                onMouseOver={e => e.currentTarget.style.background = "var(--bd)"}
                onMouseOut={e => e.currentTarget.style.background = "var(--sf2)"}
              >
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </button>
              {/* OR divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
                <div style={{ flex: 1, height: 1, background: "var(--bd)" }} />
                <span style={{ color: "var(--mt)", fontSize: 12, fontWeight: 500 }}>OR</span>
                <div style={{ flex: 1, height: 1, background: "var(--bd)" }} />
              </div>

              {/* ── EMAIL MAGIC LINK LOGIN ── */}
              {mlStep === "verifying" ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <SaraswatiLogo size={32} animate={true} state="thinking" />
                  <div style={{ fontSize: 14, color: "var(--tx)", marginTop: 12, fontWeight: 600 }}>Verifying your link...</div>
                  <div style={{ fontSize: 12, color: "var(--mt)", marginTop: 4 }}>Please wait</div>
                  {ferr && <div className="err" style={{ marginTop: 12 }}>{ferr}</div>}
                </div>
              ) : mlStep === "sent" ? (
                <>
                  <div style={{ textAlign: "center", padding: "8px 0" }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>📧</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>Verification link sent!</div>
                    <div style={{ fontSize: 12, color: "var(--mt)", lineHeight: 1.8 }}>
                      We sent a login link to<br/>
                      <strong style={{ color: "var(--tx)" }}>{mlEmail}</strong>
                    </div>
                  </div>
                  <div style={{ background: "var(--sf2)", border: "1px solid var(--bd)", borderRadius: 14, padding: "12px 14px", margin: "4px 0" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>📋 Steps:</div>
                    <div style={{ fontSize: 12, color: "var(--mt)", lineHeight: 2 }}>
                      1. Open your Gmail app<br/>
                      2. Find email from Saraswati AI<br/>
                      3. Click <strong style={{ color: "var(--accent)" }}>"Sign in to Saraswati AI"</strong><br/>
                      4. You'll be logged in automatically ✅
                    </div>
                  </div>
                  {ferr && <div className="err">{ferr}</div>}
                  {fok && <div className="ok">{fok}</div>}
                  <button className="btn btn-s" onClick={() => sendMagicLink(mlEmail)} disabled={fload} style={{ width: "100%" }}>
                    {fload ? "Sending..." : "🔄 Resend Link"}
                  </button>
                  <button className="btn btn-s" onClick={resetMagicLink} style={{ width: "100%", marginTop: 4 }}>← Change Email</button>
                </>
              ) : (
                <>
                  <div className="iw">
                    <div className="ilbl">Email</div>
                    <input className="inp" type="email" placeholder="your@email.com" value={mlEmail}
                      onChange={e => setMlEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && sendMagicLink(mlEmail)} />
                  </div>
                  {ferr && <div className="err">{ferr}</div>}
                  {fok && <div className="ok">{fok}</div>}
                  <button className="btn btn-p" onClick={() => sendMagicLink(mlEmail)} disabled={fload}>
                    {fload ? "Sending link..." : "Send Verification Link →"}
                  </button>
                  <div style={{ textAlign: "center", fontSize: 11, color: "var(--mt)", marginTop: 6 }}>
                    🔒 No password needed — secure login via email link
                  </div>
                </>
              )}
            </>
          )}
        </div>
        {!forgot && mlStep === "email" && <div className="lnk" style={{ color: "var(--mt)", fontSize: 12 }}>New email = account created automatically · Existing email = instant login</div>}
        {/* Terms / Privacy / Usage Policy */}
        <div style={{ textAlign: "center", fontSize: 11, color: "var(--mt)", marginTop: 16, lineHeight: 1.8, padding: "0 8px" }}>
          By continuing, you agree to Saraswati AI{"'"}s{" "}
          <span onClick={() => setLegalModal("terms")}
            style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 500, cursor: "pointer" }}>Consumer Terms</span>
          {" "}and{" "}
          <span onClick={() => setLegalModal("usage")}
            style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 500, cursor: "pointer" }}>Usage Policy</span>
          , and acknowledge our{" "}
          <span onClick={() => setLegalModal("privacy")}
            style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 500, cursor: "pointer" }}>Privacy Policy</span>.
        </div>
      </div>

      {/* Legal Modals - shown on auth page too */}
      {legalModal && (
        <div className="mbg" onClick={() => setLegalModal(null)} style={{ zIndex: 999, position: "fixed", inset: 0, background: "#0009", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ background: "var(--sf, #141414)", borderRadius: "24px 24px 16px 16px", padding: "26px 22px", width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 13, maxHeight: "88vh", overflowY: "auto" }}>
            {legalModal === "terms" && (<>
              <div style={{ fontSize: 28, textAlign: "center" }}>📜</div>
              <h3 style={{ textAlign: "center", color: "var(--tx, #f0f0f0)" }}>Consumer Terms</h3>
              <p style={{ color: "var(--mt, #5a5a5a)", fontSize: 13, lineHeight: 1.7 }}><strong style={{ color: "var(--tx, #f0f0f0)" }}>1. Service</strong><br/>Saraswati AI provides AI-powered chat services. By using our service, you agree to these terms.</p>
              <p style={{ color: "var(--mt, #5a5a5a)", fontSize: 13, lineHeight: 1.7 }}><strong style={{ color: "var(--tx, #f0f0f0)" }}>2. Account</strong><br/>You are responsible for maintaining the security of your account and password.</p>
              <p style={{ color: "var(--mt, #5a5a5a)", fontSize: 13, lineHeight: 1.7 }}><strong style={{ color: "var(--tx, #f0f0f0)" }}>3. Free & Premium</strong><br/>Free users get {FREE_LIMIT} messages. Premium users get unlimited access.</p>
              <p style={{ color: "var(--mt, #5a5a5a)", fontSize: 13, lineHeight: 1.7 }}><strong style={{ color: "var(--tx, #f0f0f0)" }}>4. Content</strong><br/>Do not use Saraswati AI for illegal, harmful, or abusive purposes.</p>
            </>)}
            {legalModal === "privacy" && (<>
              <div style={{ fontSize: 28, textAlign: "center" }}>🔒</div>
              <h3 style={{ textAlign: "center", color: "var(--tx, #f0f0f0)" }}>Privacy Policy</h3>
              <p style={{ color: "var(--mt, #5a5a5a)", fontSize: 13, lineHeight: 1.7 }}><strong style={{ color: "var(--tx, #f0f0f0)" }}>1. Data We Collect</strong><br/>We collect your name, email, and chat messages to provide our service.</p>
              <p style={{ color: "var(--mt, #5a5a5a)", fontSize: 13, lineHeight: 1.7 }}><strong style={{ color: "var(--tx, #f0f0f0)" }}>2. How We Use It</strong><br/>Your data is used only to provide and improve Saraswati AI services.</p>
              <p style={{ color: "var(--mt, #5a5a5a)", fontSize: 13, lineHeight: 1.7 }}><strong style={{ color: "var(--tx, #f0f0f0)" }}>3. Data Security</strong><br/>We use Firebase by Google for secure data storage and authentication.</p>
              <p style={{ color: "var(--mt, #5a5a5a)", fontSize: 13, lineHeight: 1.7 }}><strong style={{ color: "var(--tx, #f0f0f0)" }}>4. AI Processing</strong><br/>Messages are sent to Groq AI for processing. We do not store images in our database.</p>
            </>)}
            {legalModal === "usage" && (<>
              <div style={{ fontSize: 28, textAlign: "center" }}>📋</div>
              <h3 style={{ textAlign: "center", color: "var(--tx, #f0f0f0)" }}>Usage Policy</h3>
              <p style={{ color: "var(--mt, #5a5a5a)", fontSize: 13, lineHeight: 1.7 }}><strong style={{ color: "var(--tx, #f0f0f0)" }}>1. Allowed Use</strong><br/>Saraswati AI is for personal, educational, and professional assistance.</p>
              <p style={{ color: "var(--mt, #5a5a5a)", fontSize: 13, lineHeight: 1.7 }}><strong style={{ color: "var(--tx, #f0f0f0)" }}>2. Prohibited Use</strong><br/>Do not use for generating harmful, illegal, or misleading content.</p>
              <p style={{ color: "var(--mt, #5a5a5a)", fontSize: 13, lineHeight: 1.7 }}><strong style={{ color: "var(--tx, #f0f0f0)" }}>3. Fair Use</strong><br/>Free tier is limited to {FREE_LIMIT} messages. Misuse may result in account suspension.</p>
            </>)}
            <button className="btn btn-p" onClick={() => setLegalModal(null)} style={{ marginTop: 8 }}>Got It ✓</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="app" onClick={() => { setShowRx(null); setShowPlusMenu(false); setChatContextMenu(null); }}>
      <style>{buildStyles(themeKey, accentKey, fontSize)}</style>

      {/* Chat context menu */}
      {chatContextMenu && (() => {
        const h = hists.find(x => x.id === chatContextMenu.histId) || { id: sid, title: msgs[0]?.text?.slice(0, 30) || "Current Chat", pinned: false };
        // Position below header (top right)
        const menuTop = Math.min(chatContextMenu.y + 8, window.innerHeight - 300);
        const menuLeft = Math.min(chatContextMenu.x - 200, window.innerWidth - 220);
        return (
          <div className="chat-ctx" style={{ top: menuTop, left: Math.max(8, menuLeft) }}
            onClick={e => e.stopPropagation()}>
            {/* Chat title */}
            <div className="chat-ctx-title">{h.title?.slice(0, 24) || "Chat"}</div>
            <div className="chat-ctx-sep" />

            {/* Share */}
            <button className="chat-ctx-item" onClick={() => { shareChat(h.id); setChatContextMenu(null); }}>
              <span>Share</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><polyline points="16 8 12 4 8 8"/><line x1="12" y1="4" x2="12" y2="16"/></svg>
            </button>

            {/* Rename */}
            <button className="chat-ctx-item" onClick={() => {
              const newTitle = prompt("Chat ka naya naam:", h.title || "Chat");
              if (newTitle?.trim()) {
                setDoc(doc(db, "chats", h.id), { title: newTitle.trim() }, { merge: true }).catch(() => {});
                setHists(p => p.map(x => x.id === h.id ? { ...x, title: newTitle.trim() } : x));
              }
              setChatContextMenu(null);
            }}>
              <span>Rename</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>

            {/* Star/Pin */}
            <button className="chat-ctx-item" onClick={() => { togglePin(h.id, { stopPropagation: () => {} }); setChatContextMenu(null); }}>
              <span>{h.pinned ? "Unpin" : "Pin"}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={h.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>

            <div className="chat-ctx-sep" />

            {/* Delete */}
            <button className="chat-ctx-item red" onClick={() => {
              setChatContextMenu(null);
              askConfirm({
                title: "Delete Chat?",
                message: "This chat and its messages will be permanently removed.",
                onConfirm: () => {
                  deleteDoc(doc(db, "chats", h.id)).catch(() => {});
                  setHists(p => p.filter(x => x.id !== h.id));
                  if (h.id === sid) newChat();
                }
              });
            }}>
              <span>Delete</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        );
      })()}
      <style>{buildStyles(themeKey, accentKey, fontSize)}</style>

      {/* Memory saved toast */}
      {memSaved && (
        <div className="toast">
          {memSaved === "updated" ? "🔄 Memory updated" : "🧠 Memory saved"}
        </div>
      )}

      {/* Image fullscreen viewer */}
      {viewerSrc && (
        <div className="imgviewer" onClick={() => setViewerSrc(null)}>
          <img src={viewerSrc} alt="full" onClick={e => e.stopPropagation()} />
          <button className="imgviewer-x" onClick={() => setViewerSrc(null)}>✕</button>
        </div>
      )}

      {/* PWA Install Banner */}
      {showPwa && pwaEvt && (
        <div className="pwa">
          <SaraswatiLogo size={28} animate={false} state="idle" />
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>Install App</div><div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Add to home screen</div></div>
          <button className="pwa-btn" onClick={async () => { pwaEvt.prompt(); await pwaEvt.userChoice; setShowPwa(false); }}>Install</button>
          <button className="pwa-x" onClick={() => setShowPwa(false)}>✕</button>
        </div>
      )}

      {/* ── SIDEBAR ── */}
      {showSb && (
        <>
          <div className="sb-overlay" onClick={() => setShowSb(false)} />
          <div className="sidebar">
            <div className="sb-head">
              <SaraswatiLogo size={30} animate={true} state="idle" />
              <span className="sb-title">Saraswati AI</span>
              <button className="sb-close" onClick={() => setShowSb(false)}>✕</button>
            </div>
            <div className="sb-user">
              {pPhotoUrl
                ? <img src={pPhotoUrl} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: `2px solid ${accentColor}`, flexShrink: 0 }} />
                : <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg,${accentColor},#ea580c)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 16, flexShrink: 0 }}>{displayName[0]?.toUpperCase()}</div>
              }
              <div className="sb-uinfo">
                <div className="sb-uname">{displayName}</div>
                <div className="sb-email">{user.email}</div>
              </div>
              {userData?.premium && <div className="badge" style={{ fontSize: 9 }}>PRO</div>}
            </div>
            <div className="sb-nav">
              <div className="sb-section">Menu</div>
              {/* Chat */}
              <div className={"sb-item" + (page === "chat" ? " active" : "")} onClick={() => { setPage("chat"); setShowSb(false); }}>
                <Ico.Chat /><span>Chat</span>
              </div>

              {/* Agents — collapsible: click toggles expand/collapse */}
              <div className={"sb-item" + (page === "agents" ? " active" : "")} onClick={() => setSbAgentsExpanded(v => !v)} style={{ justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="7" r="3"/><path d="M8 11v-1a4 4 0 0 1 8 0v1"/></svg>
                  <span>Agents</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: sbAgentsExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {/* Sub-items under Agents — only visible when expanded */}
              {sbAgentsExpanded && (
                <div style={{ marginLeft: 28, borderLeft: "2px solid var(--accent)", marginBottom: 4, borderRadius: "0 0 0 8px", overflow: "hidden" }}>
                  <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: page==="agents" && agentTab==="create" ? "var(--accent)" : "var(--mt)", fontWeight: page==="agents" && agentTab==="create" ? 700 : 500, fontSize: 13, transition: "all .15s" }}
                    onClick={() => { setPage("agents"); setShowSb(false); setAgentTab("create"); setAgentCreateForm({name:"",category:""}); setAgentGenData(null); setAgentEditId(null); setAgentAvatarFile(null); setAgentAvatarPreview(null); setAgentPdfFile(null); setAgentPdfName(""); setAgentPdfText(""); }}
                    onMouseEnter={e => e.currentTarget.style.color="var(--accent)"}
                    onMouseLeave={e => e.currentTarget.style.color = page==="agents" && agentTab==="create" ? "var(--accent)" : "var(--mt)"}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    Create Agent
                  </div>
                  <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: page==="agents" && agentTab==="my" ? "var(--accent)" : "var(--mt)", fontWeight: page==="agents" && agentTab==="my" ? 700 : 500, fontSize: 13, transition: "all .15s" }}
                    onClick={() => { setPage("agents"); setShowSb(false); setAgentTab("my"); }}
                    onMouseEnter={e => e.currentTarget.style.color="var(--accent)"}
                    onMouseLeave={e => e.currentTarget.style.color = page==="agents" && agentTab==="my" ? "var(--accent)" : "var(--mt)"}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                    My Agents
                  </div>
                </div>
              )}

              {/* Marketplace */}
              <div className={"sb-item" + (page === "marketplace" ? " active" : "")} onClick={() => { setPage("marketplace"); setShowSb(false); loadMarketplace(); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                <span>Marketplace</span>
              </div>

              {/* Creator Dashboard */}
              <div className="sb-item" onClick={() => { setShowCreatorDash(true); loadCreatorData(); setShowSb(false); }}>
                <span style={{ fontSize:18, lineHeight:1, display:"inline-flex", width:18, justifyContent:"center" }}>🚀</span>
                <span>Creator Dashboard</span>
              </div>

              {/* Rest of menu */}
              {[
                { id: "history", icon: <Ico.History />, label: "History" },
                { id: "projects", icon: <Ico.Project />, label: "Projects" },
                { id: "settings", icon: <Ico.Settings />, label: "Settings" },
              ].map(item => (
                <div key={item.id} className={"sb-item" + (page === item.id ? " active" : "")} onClick={() => { setPage(item.id); setShowSb(false); }}>
                  {item.icon}<span>{item.label}</span>
                </div>
              ))}
              {isAdmin && (
                <>
                <div className={"sb-item" + (page === "admin" ? " active" : "")} onClick={() => { setPage("admin"); setShowSb(false); }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Admin</span>
                </div>
                <div className={"sb-item" + (page === "cmdcenter" ? " active" : "")} onClick={() => { setPage("cmdcenter"); setShowSb(false); setCmdHistory([]); setCmdPending(null); setCmdReport(null); }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><polyline points="6 8 10 12 6 16"/><line x1="14" y1="12" x2="18" y2="12"/></svg>
                  <span>AI Command</span>
                </div>
                </>
              )}
              {/* Active Agent Banner */}
              {activeAgent && (
                <div style={{ margin:"8px 14px", padding:"8px 12px", background:"var(--glow)", border:"1px solid var(--accent)", borderRadius:12, display:"flex", alignItems:"center", gap:8, justifyContent:"space-between" }}>
                  <span style={{ fontSize:13, fontWeight:600, color:"var(--accent)" }}>
                    {activeAgent.avatarImg ? <img src={activeAgent.avatarImg} style={{width:20,height:20,borderRadius:"50%",objectFit:"cover"}} alt="" /> : activeAgent.emoji||"🤖"} {activeAgent.name}
                  </span>
                  <span onClick={stopAgent} style={{ fontSize:11, color:"#ef4444", cursor:"pointer" }}>✕ Stop</span>
                </div>
              )}
              {pinnedHists.length > 0 && (
                <>
                  <div className="sb-section">📌 Pinned</div>
                  <div className="sb-recent">
                    {pinnedHists.map(h => (
                      <div key={h.id} className="sb-ritem" onClick={() => { if (!longPressFired.current) loadSession(h); }} {...bindLongPress(h.id)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        <span className="sb-rtxt">{h.title || "Chat"}</span>
                        <span className="sb-rdate">{fmtDate(h.updatedAt)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {hists.filter(h => !h.archived).length > 0 && (
                <>
                  <div className="sb-section">Recent</div>
                  <div className="sb-recent">
                    {hists.filter(h => !h.archived).slice(0, 10).map(h => (
                      <div key={h.id} className="sb-ritem" onClick={() => { if (!longPressFired.current) loadSession(h); }} {...bindLongPress(h.id)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <span className="sb-rtxt">{h.title || "Chat"}</span>
                        <span className="sb-rdate">{fmtDate(h.updatedAt)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="sb-bottom">
              <div className="sb-logout" onClick={() => signOut(auth)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                <span>Logout</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── CUSTOM CONFIRM MODAL (replaces native window.confirm) ── */}
      {confirmState && (
        <div className="mbg" onClick={() => setConfirmState(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mi">{confirmState.danger === false ? "❓" : "⚠️"}</div>
            <h3>{confirmState.title}</h3>
            <p>{confirmState.message}</p>
            <button
              className={"btn " + (confirmState.danger === false ? "btn-p" : "btn-danger")}
              onClick={() => { const fn = confirmState.onConfirm; setConfirmState(null); fn?.(); }}
            >
              {confirmState.danger === false ? "Confirm" : "Delete"}
            </button>
            <button className="btn btn-s" onClick={() => setConfirmState(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── FREE LIMIT MODAL ── */}
      {showLimit && (
        <div className="mbg" onClick={() => setShowLimit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mi"></div>
            <h3>Free Limit Reached</h3>
            <p>You've used all {FREE_LIMIT} free messages. Upgrade to Premium for unlimited access!</p>
            <button className="btn btn-p" onClick={() => { setShowLimit(false); setShowUpgrade(true); }}>Upgrade Now</button>
            <button className="btn btn-s" onClick={() => setShowLimit(false)}>Maybe Later</button>
          </div>
        </div>
      )}

      {/* ── AGENT BUILDER MODAL ── */}
      {showAgentBuilder && (
        <div className="mbg" onClick={() => setShowAgentBuilder(false)} style={{ zIndex: 999 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "85vh", overflowY: "auto", textAlign: "left", maxWidth: 460 }}>
            <div className="mi">{agentForm.emoji}</div>
            <h3 style={{ textAlign: "center", marginBottom: 16 }}>{editingAgent ? "Edit Agent" : "Create New Agent"}</h3>

            {/* Emoji picker */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "var(--mt)", marginBottom: 6, fontWeight: 600 }}>EMOJI CHOOSE KARO</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["🤖","👨‍⚕️","👩‍⚕️","👨‍🌾","👩‍🌾","👨‍🏫","👩‍🏫","👨‍💼","👩‍💼","🧑‍🍳","🧑‍💻","😄","🦁","🐯","🦊","⭐","🔥","💎","🎯","🌟"].map(em => (
                  <span key={em} onClick={() => setAgentForm(f => ({...f, emoji: em}))}
                    style={{ fontSize: 24, cursor: "pointer", padding: 4, borderRadius: 8, background: agentForm.emoji === em ? "var(--accent)" : "var(--sf2)", border: agentForm.emoji === em ? "2px solid var(--accent)" : "2px solid transparent" }}>{em}</span>
                ))}
              </div>
            </div>

            {/* Name */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "var(--mt)", marginBottom: 4, fontWeight: 600 }}>AGENT KA NAAM *</div>
              <input className="inp" placeholder="Jaise: Doctor AI, Kisan AI, Teacher AI..." value={agentForm.name}
                onChange={e => setAgentForm(f => ({...f, name: e.target.value}))} style={{ width: "100%" }} />
            </div>

            {/* Instructions */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "var(--mt)", marginBottom: 4, fontWeight: 600 }}>INSTRUCTIONS (YE AGENT KYA KAREGA?)</div>
              <textarea className="inp iarea" rows={4} placeholder="e.g. You are a doctor. Only answer health-related questions. Give clear medical advice in English."
                value={agentForm.instructions} onChange={e => setAgentForm(f => ({...f, instructions: e.target.value}))}
                style={{ width: "100%", resize: "none" }} />
            </div>

            {/* Tone */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "var(--mt)", marginBottom: 6, fontWeight: 600 }}>TONE / STYLE</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[{v:"friendly",l:"😊 Friendly"},{v:"professional",l:"💼 Professional"},{v:"funny",l:"😄 Funny"},{v:"strict",l:"📚 Strict"}].map(t => (
                  <button key={t.v} onClick={() => setAgentForm(f => ({...f, tone: t.v}))}
                    style={{ padding: "6px 14px", borderRadius: 20, border: "1.5px solid " + (agentForm.tone === t.v ? "var(--accent)" : "var(--bd)"),
                      background: agentForm.tone === t.v ? "var(--accent)" : "var(--sf2)", color: agentForm.tone === t.v ? "#fff" : "var(--tx)",
                      fontSize: 13, cursor: "pointer", fontWeight: agentForm.tone === t.v ? 600 : 400 }}>{t.l}</button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "var(--mt)", marginBottom: 6, fontWeight: 600 }}>LANGUAGE</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[{v:"hindi",l:"🇮🇳 Hindi"},{v:"english",l:"🌐 English"},{v:"hinglish",l:"🤝 Hinglish"}].map(l => (
                  <button key={l.v} onClick={() => setAgentForm(f => ({...f, lang: l.v}))}
                    style={{ padding: "6px 14px", borderRadius: 20, border: "1.5px solid " + (agentForm.lang === l.v ? "var(--accent)" : "var(--bd)"),
                      background: agentForm.lang === l.v ? "var(--accent)" : "var(--sf2)", color: agentForm.lang === l.v ? "#fff" : "var(--tx)",
                      fontSize: 13, cursor: "pointer", fontWeight: agentForm.lang === l.v ? 600 : 400 }}>{l.l}</button>
                ))}
              </div>
            </div>

            <button className="btn btn-p" onClick={saveAgent} style={{ width: "100%", marginBottom: 8 }}>
              {editingAgent ? "✅ Update Agent" : "💾 Save as Draft"}
            </button>
            <button className="btn" onClick={() => setShowAgentBuilder(false)} style={{ width: "100%" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── LEGAL MODAL (Terms / Privacy / Usage) ── */}
      {legalModal && (
        <div className="mbg" onClick={() => setLegalModal(null)} style={{ zIndex: 999 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "80vh", overflowY: "auto", textAlign: "left", maxWidth: 480 }}>
            {legalModal === "terms" && (<>
              <div className="mi">📋</div>
              <h3 style={{ textAlign: "center" }}>Consumer Terms</h3>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--mt)", marginTop: 12 }}>
                <p><strong style={{ color: "var(--tx)" }}>1. Service Use</strong><br/>Saraswati AI is provided for personal, educational, and informational use only. You must be 13+ years old to use this service.</p>
                <p><strong style={{ color: "var(--tx)" }}>2. Account</strong><br/>You are responsible for maintaining the confidentiality of your account credentials. One account per person.</p>
                <p><strong style={{ color: "var(--tx)" }}>3. Free & Premium</strong><br/>Free users get {FREE_LIMIT} messages. Premium users get unlimited access. Payments are non-refundable once activated.</p>
                <p><strong style={{ color: "var(--tx)" }}>4. Content</strong><br/>Do not use Saraswati AI for illegal, harmful, or abusive purposes. We reserve the right to suspend accounts that violate these terms.</p>
                <p><strong style={{ color: "var(--tx)" }}>5. AI Accuracy</strong><br/>Saraswati AI responses are AI-generated and may not always be accurate. Do not rely solely on AI for medical, legal, or financial decisions.</p>
                <p><strong style={{ color: "var(--tx)" }}>6. Contact</strong><br/>For queries, contact: kunalsaraswat691@gmail.com</p>
              </div>
            </>)}
            {legalModal === "privacy" && (<>
              <div className="mi">🔒</div>
              <h3 style={{ textAlign: "center" }}>Privacy Policy</h3>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--mt)", marginTop: 12 }}>
                <p><strong style={{ color: "var(--tx)" }}>1. Data We Collect</strong><br/>We collect your name, email address, and chat messages to provide the service. No sensitive personal data is collected without consent.</p>
                <p><strong style={{ color: "var(--tx)" }}>2. How We Use It</strong><br/>Your data is used to provide AI responses, save chat history, and improve the service. We do not sell your data to third parties.</p>
                <p><strong style={{ color: "var(--tx)" }}>3. Storage</strong><br/>Your data is stored securely on Firebase (Google Cloud). Chat history can be deleted by you at any time from the app.</p>
                <p><strong style={{ color: "var(--tx)" }}>4. AI Processing</strong><br/>Messages are sent to Groq AI for processing. Groq may retain data per their own privacy policy. We do not store images in our database.</p>
                <p><strong style={{ color: "var(--tx)" }}>5. Cookies</strong><br/>We use Firebase Authentication which uses session cookies for login. No advertising cookies are used.</p>
                <p><strong style={{ color: "var(--tx)" }}>6. Your Rights</strong><br/>You can request deletion of your account and all data by contacting kunalsaraswat691@gmail.com</p>
              </div>
            </>)}
            {legalModal === "usage" && (<>
              <div className="mi">⚠️</div>
              <h3 style={{ textAlign: "center" }}>Usage Policy</h3>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--mt)", marginTop: 12 }}>
                <p><strong style={{ color: "var(--tx)" }}>✅ Allowed Uses</strong><br/>Education, farming advice, general knowledge, coding help, creative writing, language translation, weather, mandi rates, and general Q&A.</p>
                <p><strong style={{ color: "var(--tx)" }}>❌ Prohibited Uses</strong><br/>Do not use Saraswati AI to generate harmful, illegal, or abusive content. Do not attempt to hack, scrape, or misuse the platform.</p>
                <p><strong style={{ color: "var(--tx)" }}>🌾 Farming Info</strong><br/>Agricultural advice is informational only. Always consult local agriculture department for official guidance on subsidies and schemes.</p>
                <p><strong style={{ color: "var(--tx)" }}>🤖 AI Limitations</strong><br/>Saraswati AI can make mistakes. For important decisions, verify information from official sources.</p>
                <p><strong style={{ color: "var(--tx)" }}>📵 Misuse</strong><br/>Accounts found misusing the platform will be permanently suspended without refund.</p>
              </div>
            </>)}
            <button className="btn btn-p" onClick={() => setLegalModal(null)} style={{ marginTop: 16 }}>Got It ✓</button>
          </div>
        </div>
      )}

      {/* ── UPGRADE MODAL ── */}
      {showUpgrade && (
        <div className="mbg" onClick={() => { setShowUpgrade(false); setPayDone(false); setPayStatus(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {payStatus === "success" ? (
              <>
                <div className="mi">✅</div>
                <h3 style={{ color: "#22c55e" }}>Payment Successful!</h3>
                <p>Payment done! Send the screenshot on WhatsApp — Premium will be activated within 30 minutes.</p>
                <div style={{ background: "#22c55e15", border: "1px solid #22c55e40", borderRadius: 14, padding: "14px 16px", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, color: "#22c55e", fontWeight: 700, marginBottom: 6 }}>✅ Next Steps:</div>
                  <div style={{ fontSize: 12, color: "var(--mt)", lineHeight: 1.8 }}>
                    1. Payment screenshot lo<br/>
                    2. Send it on WhatsApp<br/>
                    3. Premium will be activated within 30 minutes
                  </div>
                </div>
                <button className="btn btn-p" onClick={() => window.open("https://wa.me/91" + UPI + "?text=Maine%20Saraswati%20AI%20Premium%20ke%20liye%20payment%20kiya%20hai.%20Screenshot%20attach%20kar%20raha%20hoon.", "_blank")}>📲 Send Screenshot on WhatsApp</button>
                <button className="btn btn-s" onClick={() => { setShowUpgrade(false); setPayDone(false); setPayStatus(null); }}>Close</button>
              </>
            ) : payStatus === "fail" ? (
              <>
                <div className="mi">❌</div>
                <h3 style={{ color: "#ef4444" }}>Payment Failed</h3>
                <p>Payment did not go through. No worries — try again or use a different UPI app.</p>
                <div style={{ background: "#ef444415", border: "1px solid #ef444440", borderRadius: 14, padding: "14px 16px", marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 700, marginBottom: 6 }}>⚠️ Possible reasons:</div>
                  <div style={{ fontSize: 12, color: "var(--mt)", lineHeight: 1.8 }}>
                    • Insufficient UPI balance<br/>
                    • Internet issue tha<br/>
                    • Transaction timeout hua
                  </div>
                </div>
                <button className="btn btn-p" onClick={() => {
                  setPayStatus(null);
                  window.open("upi://pay?pa=" + UPI + "@upi&pn=SaraswatiAI&am=" + (upgradePlan === "monthly" ? "99" : "29") + "&cu=INR", "_blank");
                  setTimeout(() => setPayStatus("success"), 3000);
                }}>🔄 Try Again</button>
                <button className="btn btn-s" onClick={() => { setPayStatus(null); }}>Back</button>
              </>
            ) : payDone ? (
              <>
                <div className="mi">✅</div>
                <h3>Payment Sent!</h3>
                <p>Send the screenshot on WhatsApp — will be activated within 30 minutes!</p>
                <button className="btn btn-p" onClick={() => window.open("https://wa.me/91" + UPI + "?text=Maine%20Saraswati%20AI%20Premium%20ke%20liye%20payment%20kiya%20hai", "_blank")}>📲 WhatsApp Us</button>
                <button className="btn btn-s" onClick={() => { setShowUpgrade(false); setPayDone(false); setPayStatus(null); }}>Close</button>
              </>
            ) : (
              <>
                <div className="mi">⭐</div>
                <h3>Saraswati AI {upgradePlan === "monthly" ? "Monthly" : "Weekly"} Premium</h3>
                <p>Unlimited chats · Voice Call · Faster AI · Ad-free</p>
                <div className="pbox">
                  <div className="pnum">{upgradePlan === "monthly" ? "₹99 / month" : "₹29 / week"}</div>
                  <div className="pstep"><span style={{fontWeight:700,color:"var(--accent)"}}>1.</span><span>Pay via UPI: <strong>{UPI}@upi</strong></span></div>
                  <div className="pstep"><span style={{fontWeight:700,color:"var(--accent)"}}>2.</span><span>Screenshot lo</span></div>
                  <div className="pstep"><span style={{fontWeight:700,color:"var(--accent)"}}>3.</span><span>Send screenshot on WhatsApp for confirmation</span></div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 2 }}>
                  <button className="btn btn-p" style={{ flex: 1 }} onClick={() => {
                    window.open("upi://pay?pa=" + UPI + "@upi&pn=SaraswatiAI&am=" + (upgradePlan === "monthly" ? "99" : "29") + "&cu=INR", "_blank");
                    // After 4s, show did payment go through prompt
                    setTimeout(() => setPayStatus("success"), 4000);
                  }}>💳 Pay Now</button>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  <button className="btn btn-s" style={{ flex: 1, fontSize: 12 }} onClick={() => setPayStatus("fail")}>❌ Payment Failed?</button>
                  <button className="btn btn-s" style={{ flex: 1, fontSize: 12 }} onClick={() => setPayStatus("success")}>✅ Payment Done?</button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className={"btn btn-s"} style={{ flex: 1, opacity: upgradePlan === "monthly" ? 1 : 0.6 }} onClick={() => setUpgradePlan("monthly")}>Monthly ₹99</button>
                  <button className="btn btn-s" style={{ flex: 1, opacity: upgradePlan === "weekly" ? 1 : 0.6 }} onClick={() => setUpgradePlan("weekly")}>Weekly ₹29</button>
                </div>
                <button className="btn btn-s" onClick={() => setShowUpgrade(false)}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PROFILE MODAL ── */}
      {showProfile && (
        <div className="mbg" onClick={() => setShowProfile(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Profile</h3>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div className="pav">
                {(pPhoto || pPhotoUrl)
                  ? <img className="pavimg" src={pPhoto || pPhotoUrl} alt="" />
                  : <div className="pavph">{(pName || displayName)[0]?.toUpperCase()}</div>
                }
                <div className="paved" onClick={() => pPhotoRef.current?.click()}></div>
                <input ref={pPhotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePPhoto} />
              </div>
            </div>
            <div className="iw"><div className="ilbl">Name</div><input className="inp" value={pName} onChange={e => setPName(e.target.value)} placeholder="Your name" /></div>
            <div style={{ fontSize: 13, color: "var(--mt)", textAlign: "center" }}>{user.email}</div>
            <button className="btn btn-p" onClick={saveProfile} disabled={pSaving}>{pSaving ? "Saving..." : "Save Changes"}</button>
            <button className="btn btn-s" onClick={() => setShowProfile(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── CHANGE PASSWORD MODAL ── */}
      {showChangePw && (
        <div className="mbg" onClick={() => setShowChangePw(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🔐 Change Password</h3>
            <div className="iw"><div className="ilbl">Current Password</div><input className="inp" type="password" placeholder="Current password" value={cpForm.current} onChange={e => setCpForm(f => ({ ...f, current: e.target.value }))} /></div>
            <div className="iw"><div className="ilbl">New Password</div><input className="inp" type="password" placeholder="Min 8 characters" value={cpForm.newP} onChange={e => setCpForm(f => ({ ...f, newP: e.target.value }))} /></div>
            <div className="iw"><div className="ilbl">Confirm New Password</div><input className="inp" type="password" placeholder="Repeat new password" value={cpForm.confirm} onChange={e => setCpForm(f => ({ ...f, confirm: e.target.value }))} /></div>
            {cpErr && <div className="err">{cpErr}</div>}
            {cpOk && <div className="ok">{cpOk}</div>}
            <button className="btn btn-p" onClick={handleChangePw} disabled={cpLoad}>{cpLoad ? "Changing..." : "Change Password"}</button>
            <button className="btn btn-s" onClick={() => setShowChangePw(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── DELETE ACCOUNT MODAL ── */}
      {showDeleteAcc && (
        <div className="mbg" onClick={() => setShowDeleteAcc(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mi"></div>
            <h3>Delete Account</h3>
            <p>This action is permanent. All your data will be deleted. Type <strong>DELETE</strong> to confirm.</p>
            <input className="inp" placeholder='Type "DELETE" to confirm' value={delConfirmText} onChange={e => setDelConfirmText(e.target.value)} />
            <button className="btn" style={{ background: "#ef4444", color: "#fff" }} onClick={deleteAccount} disabled={delLoading || delConfirmText.trim().toUpperCase() !== "DELETE"}>{delLoading ? "Deleting..." : "Delete My Account"}</button>
            <button className="btn btn-s" onClick={() => setShowDeleteAcc(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── ADD MEMORY MODAL ── */}
      {showAddMem && (
        <div className="mbg" onClick={() => setShowAddMem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🧠 Add Memory</h3>
            <div className="iw">
              <div className="ilbl">What to remember?</div>
              <textarea className="inp" rows={3}
                placeholder="e.g. User is a software engineer who loves Python"
                value={newMemText} onChange={e => setNewMemText(e.target.value)} style={{ resize: "none" }} />
            </div>
            <div className="iw">
              <div className="ilbl">Category</div>
              <div className="opt-row">
                {MEM_CATEGORIES.map(c => (
                  <button key={c} className={"opt-pill" + (newMemCat === c ? " sel" : "")} onClick={() => setNewMemCat(c)}>
                    {MEM_CATEGORY_LABELS[c]?.split(" ")[0]} {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="iw">
              <div className="ilbl">Importance: {newMemImportance || 5}/10</div>
              <input type="range" min={1} max={10} value={newMemImportance || 5}
                onChange={e => setNewMemImportance(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "var(--accent)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--mt)", marginTop: 2 }}>
                <span>Low</span><span>Medium</span><span>Critical</span>
              </div>
            </div>
            <button className="btn btn-p" onClick={async () => {
              if (!newMemText.trim()) return;
              await addMemory(newMemText, newMemCat, newMemImportance || 5);
              setNewMemText(""); setNewMemCat("personal"); setNewMemImportance(5); setShowAddMem(false);
            }}>Save Memory</button>
            <button className="btn btn-s" onClick={() => setShowAddMem(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── ADMIN USER CHAT MODAL ── */}
      {aChat && (
        <div className="mbg" onClick={() => setAChat(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>💬 {aChat.user.name || aChat.user.email}</h3>
            {aChatLoad ? <div className="ld">Loading...</div> : (
              <div className="achat">
                {aChat.msgs.length === 0 && <div className="ld">No messages</div>}
                {aChat.msgs.map(m => (
                  <div key={m.id} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, fontSize: 12, padding: "7px 10px", background: m.role === "user" ? "var(--glow)" : "var(--sf2)", borderRadius: 10, color: "var(--tx)" }}><strong style={{ fontSize: 10, color: "var(--mt)" }}>{m.role === "user" ? "User" : "AI"}</strong><br />{m.text?.slice(0, 200)}{m.text?.length > 200 ? "..." : ""}</div>
                    <button onClick={() => adminDelChat(m.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: "4px", flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-s" onClick={() => setAChat(null)}>Close</button>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="hdr">
        <button className="dots hide-desktop" onClick={() => { setShowSb(true); if (user) loadHists(); }}>
          <Ico.Menu />
        </button>
        <div className="hdr-name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SaraswatiLogo size={26} animate={false} state="idle" />
          {page === "chat" ? (activeAgent ? `${activeAgent.emoji} ${activeAgent.name}` : "Saraswati AI") : page === "history" ? "History" : page === "settings" ? "Settings" : page === "admin" ? "Admin" : page === "projects" ? "Projects" : page === "memory" ? "Memory" : page === "cmdcenter" ? "⚡ AI Command" : page === "agents" ? "🤖 Agents" : page === "marketplace" ? "🛍 Marketplace" : "Saraswati AI"}
        </div>
        {page === "chat" && (
          <>
            {chatsLeft !== null && chatsLeft <= 10 && (
              <div style={{
                fontSize: 11,
                color: "#fff",
                fontWeight: 700,
                background: chatsLeft <= 3 ? "#ef4444" : "var(--accent)",
                borderRadius: 20,
                padding: "2px 9px",
                minWidth: 28,
                textAlign: "center",
                letterSpacing: 0.2,
                boxShadow: chatsLeft <= 3 ? "0 0 8px #ef444460" : "0 0 8px var(--glow)",
              }}>{chatsLeft}</div>
            )}
            <button className="nbtn" onClick={newChat}>+ New</button>
          </>
        )}
        {/* ── Notification Bell ── */}
        <button className="dots" onClick={() => { setShowNotifCenter(true); loadNotifications(); }} style={{ position: "relative" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {notifications.filter(n => !n.read).length > 0 && (
            <div style={{ position:"absolute", top:-3, right:-3, background:"#ef4444", color:"#fff", fontSize:9, fontWeight:800, borderRadius:"50%", minWidth:16, height:16, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 3px", border:"2px solid var(--bg)", lineHeight:1 }}>
              {notifications.filter(n => !n.read).length > 99 ? "99+" : notifications.filter(n => !n.read).length}
            </div>
          )}
        </button>
        <button className="dots" onClick={() => setShowProfile(true)}>
          {pPhotoUrl
            ? <img src={pPhotoUrl} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: `2px solid ${accentColor}` }} />
            : <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${accentColor},#ea580c)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 12 }}>{displayName[0]?.toUpperCase()}</div>
          }
        </button>
      </div>

      {/* ── NOTIFICATION CENTER ── */}
      {showNotifCenter && (
        <div className="mbg" onClick={() => setShowNotifCenter(false)} style={{ zIndex: 200 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight:"85vh", padding:0, borderRadius:24, overflow:"hidden", display:"flex", flexDirection:"column" }}>
            {/* Header */}
            <div style={{ background:"var(--grad)", padding:"16px 18px 12px", flexShrink:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:"#fff" }}>🔔 Notifications</div>
                  <div style={{ fontSize:11, color:"#ffffff80", marginTop:1 }}>
                    {notifications.filter(n=>!n.read).length > 0
                      ? `${notifications.filter(n=>!n.read).length} unread`
                      : "All caught up!"}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  {notifications.filter(n=>!n.read).length > 0 && (
                    <button onClick={markAllRead}
                      style={{ padding:"6px 12px", borderRadius:20, border:"1px solid #ffffff50", background:"#ffffff20", color:"#fff", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotifCenter(false)}
                    style={{ width:28, height:28, borderRadius:"50%", background:"#ffffff20", border:"none", color:"#fff", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* List */}
            <div style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
              {!notifsLoaded ? (
                <div style={{ textAlign:"center", padding:"30px", color:"var(--mt)" }}>
                  <SaraswatiLogo size={24} animate={true} state="thinking" />
                  <div style={{ fontSize:13, marginTop:10 }}>Loading...</div>
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px 20px" }}>
                  <div style={{ fontSize:40, marginBottom:10 }}>🔕</div>
                  <div style={{ fontSize:14, fontWeight:600, color:"var(--tx)" }}>No notifications yet</div>
                  <div style={{ fontSize:12, color:"var(--mt)", marginTop:4 }}>We'll notify you of important updates</div>
                </div>
              ) : notifications.map(n => {
                const ICONS = {
                  admin:"⚙️", wallet:"💰", sale:"🛒", payment:"✅",
                  premium:"⭐", broadcast:"📢", review:"⭐", default:"🔔"
                };
                const icon = ICONS[n.type] || ICONS.default;
                const ts = n.createdAt?.seconds
                  ? (() => {
                      const d = new Date(n.createdAt.seconds * 1000);
                      const diff = Date.now() - d.getTime();
                      if (diff < 60000) return "Just now";
                      if (diff < 3600000) return Math.floor(diff/60000) + "m ago";
                      if (diff < 86400000) return Math.floor(diff/3600000) + "h ago";
                      return d.toLocaleDateString("en-IN", { day:"numeric", month:"short" });
                    })()
                  : "";
                return (
                  <div key={n.id} onClick={() => markOneRead(n.id)}
                    style={{ display:"flex", gap:12, padding:"12px 16px", cursor:"pointer", borderBottom:"1px solid var(--bd)", background: n.read ? "transparent" : "var(--glow)", transition:"background .15s", position:"relative" }}>
                    {/* Unread dot */}
                    {!n.read && (
                      <div style={{ position:"absolute", left:6, top:"50%", transform:"translateY(-50%)", width:6, height:6, borderRadius:"50%", background:"var(--accent)" }} />
                    )}
                    <div style={{ width:38, height:38, borderRadius:12, background:"var(--sf2)", border:"1px solid var(--bd)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                      {icon}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                        <div style={{ fontSize:13, fontWeight: n.read ? 500 : 700, color:"var(--tx)", lineHeight:1.3 }}>{n.title}</div>
                        <div style={{ fontSize:10, color:"var(--mt)", flexShrink:0, marginTop:1 }}>{ts}</div>
                      </div>
                      <div style={{ fontSize:12, color:"var(--mt)", marginTop:3, lineHeight:1.5 }}>{n.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {showVoiceCall && (
        <div className="vpage">
          {/* Top: live transcript area */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
            {vTranscript ? (
              <div className="vtranscript">
                <span className={vs === "listen" ? "vtranscript-interim" : ""}>{vTranscript}</span>
              </div>
            ) : vLast ? (
              <div className="vtranscript" style={{ color: "#e5e7eb" }}>
                {vLast.slice(0, 200)}{vLast.length > 200 ? "..." : ""}
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>👋</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: 0.3 }}>Hey, I am Saraswati</div>
              </div>
            )}
          </div>

          {/* Center: animated orb */}
          <div className="vorb-wrap">
            <div className="vring vr1" />
            <div className="vring vr2" />
            <div className={"vorb" + (vs !== "idle" ? " " + vs : "")} onClick={handleOrb}>
              {vs === "speak"
                ? <SaraswatiLogo size={56} animate={true} state="speaking" />
                : vs === "think"
                  ? <SaraswatiLogo size={56} animate={true} state="thinking" />
                  : vs === "listen"
                    ? <SaraswatiLogo size={56} animate={true} state="idle" />
                    : <SaraswatiLogo size={56} animate={true} state="idle" />
              }
            </div>
          </div>

          {/* Status text */}
          <div className="vstatus" style={{ marginTop: 20 }}>
            {vs === "idle" ? "Tap to Talk" : vs === "listen" ? "Listening..." : vs === "think" ? "Thinking..." : "Speaking..."}
          </div>

          {/* Bottom buttons */}
          <div className="vbottom" style={{ marginTop: 32 }}>
            <button className="vbtn vbtn-mute" onClick={() => {
              setMicMuted(v => {
                const next = !v;
                if (next) { voiceRef.current?.stop?.(); }
                else { if (voiceActiveRef.current && vs === "listen") startListening(msgs, sessionTone || "female", sid, userData); }
                return next;
              });
            }} style={micMuted ? { background: "#374151", color: "#ef4444" } : {}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="9" y="2" width="6" height="12" rx="3"/>
                <path d="M5 10a7 7 0 0 0 14 0"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                {micMuted && <line x1="4" y1="4" x2="20" y2="20" stroke="#ef4444" strokeWidth="2.5"/>}
              </svg>
            </button>
            <button className="vbtn vbtn-end" onClick={closeVoiceCall}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── HISTORY PAGE ── */}
      {page === "history" && (
        <div className="page">
          <div className="page-inner">
            <div className="sbar">
              <Ico.Search />
              <input
                placeholder="Search chats & messages..."
                value={hSearch}
                onChange={e => setHSearch(e.target.value)}
              />
              {hSearch && <button onClick={() => setHSearch("")} style={{ background: "none", border: "none", color: "var(--mt)", cursor: "pointer", fontSize: 16 }}>✕</button>}
            </div>
            {hSearch && (
              <div style={{ fontSize: 11, color: "var(--mt)", marginBottom: 8, paddingLeft: 4 }}>
                {filtHists.length} result{filtHists.length !== 1 ? "s" : ""} — searching in titles and messages
              </div>
            )}
            <div className="opt-row" style={{ marginBottom: 12 }}>
              {["all","pinned","starred","archived"].map(f => (
                <button key={f} className={"opt-pill" + (hFilter === f ? " sel" : "")} onClick={() => setHFilter(f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
              ))}
            </div>
            {histLoad ? <div className="ld">Loading...</div> : filtHists.length === 0 ? <div className="ld">No chats found</div> : filtHists.map(h => (
              <div key={h.id} className="hcard" onClick={() => loadSession(h)}>
                <div style={{ color: "var(--mt)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
                <div className="hi">
                  {renamingId === h.id ? (
                    <input className="inp" style={{ fontSize: 13, padding: "5px 9px" }} value={renameVal} onChange={e => setRenameVal(e.target.value)}
                      onBlur={() => renameSession(h.id, renameVal)}
                      onKeyDown={e => { if (e.key === "Enter") renameSession(h.id, renameVal); if (e.key === "Escape") setRenamingId(null); }}
                      autoFocus onClick={e => e.stopPropagation()} />
                  ) : (
                    <div className="ht">{h.pinned ? "📌 " : ""}{h.title || "Chat"}</div>
                  )}
                  {hSearch && h.searchIndex?.toLowerCase().includes(hSearch.toLowerCase()) && !(h.title || "").toLowerCase().includes(hSearch.toLowerCase()) && (
                    <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
                      Message in milا: "...{(() => {
                        const idx = h.searchIndex.toLowerCase().indexOf(hSearch.toLowerCase());
                        return h.searchIndex.slice(Math.max(0, idx - 20), idx + 40);
                      })()}..."
                    </div>
                  )}
                  <div className="hm">{fmtDate(h.updatedAt)}</div>
                </div>
                <button className="hact" title="More" onClick={e => { e.stopPropagation(); setChatContextMenu(chatContextMenu?.histId === h.id ? null : { histId: h.id, x: e.clientX, y: e.clientY }); }}>
                  <Ico.More />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PROJECTS PAGE ── */}
      {page === "projects" && (
        <div className="page">
          <div className="page-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="ptitle" style={{ marginBottom: 0 }}>Projects</div>
              <button className="nbtn" onClick={() => setShowNewProj(true)}>+ New</button>
            </div>
            {showNewProj && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input className="inp" placeholder="Project name..." value={newProjName} onChange={e => setNewProjName(e.target.value)} onKeyDown={e => e.key === "Enter" && createProject()} autoFocus />
                <button className="btn btn-p" style={{ width: "auto", padding: "0 16px" }} onClick={createProject}>Create</button>
                <button className="btn btn-s" style={{ width: "auto", padding: "0 12px" }} onClick={() => setShowNewProj(false)}>✕</button>
              </div>
            )}
            {projLoad ? <div className="ld">Loading...</div> : projects.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--mt)" }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg></div>
                <div>No projects yet. Create one!</div>
              </div>
            ) : projects.map(pr => (
              <div key={pr.id} className="hcard">
                <div style={{ color: "var(--mt)" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg></div>
                <div className="hi">
                  {renamingProjId === pr.id ? (
                    <input className="inp" style={{ fontSize: 13, padding: "5px 9px" }} value={renameProjVal} onChange={e => setRenameProjVal(e.target.value)}
                      onBlur={() => renameProject(pr.id, renameProjVal)}
                      onKeyDown={e => { if (e.key === "Enter") renameProject(pr.id, renameProjVal); if (e.key === "Escape") setRenamingProjId(null); }}
                      autoFocus />
                  ) : (
                    <div className="ht">{pr.title}</div>
                  )}
                  <div className="hm">{fmtDate(pr.createdAt)}</div>
                </div>
                <div className="hactions">
                  <button className="hact" onClick={() => { setRenamingProjId(pr.id); setRenameProjVal(pr.title); }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                  <button className="hact del" onClick={() => deleteProject(pr.id)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MEMORY PAGE ── */}
      {page === "memory" && (
        <div className="page">
          <div className="page-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div className="ptitle" style={{ marginBottom: 0 }}>🧠 Memory</div>
              <button className="nbtn" onClick={() => setShowAddMem(true)}>+ Add</button>
            </div>
            <div style={{ fontSize: 12, color: "var(--mt)", marginBottom: 12, lineHeight: 1.6 }}>
              Conversations se automatically seekhti hoon. "Remember that I am a developer" bol kar bhi save kar sakte ho.
            </div>

            {/* Auto Memory toggle */}
            <div className="scard" style={{ marginBottom: 12 }}>
              <div className="srow">
                <div className="sicon">🧠</div>
                <div className="stxt"><div className="slbl">Auto Memory</div><div className="sdesc">Conversations se automatically seekho</div></div>
                <div className="sright">
                  <div className={"tgl" + (memoryEnabled ? " on" : "")} onClick={() => savePref("memoryEnabled", !memoryEnabled)}><div className="tk" /></div>
                </div>
              </div>
            </div>

            {/* Stats bar */}
            {memories.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <div style={{ background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 10, padding: "7px 12px", fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: "var(--accent)" }}>{memories.length}</span> <span style={{ color: "var(--mt)" }}>total</span>
                </div>
                {MEM_CATEGORIES.map(cat => {
                  const n = memories.filter(m => m.category === cat).length;
                  if (!n) return null;
                  return (
                    <div key={cat} style={{ background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 10, padding: "7px 12px", fontSize: 11 }}>
                      <span style={{ fontWeight: 700, color: "var(--accent)" }}>{n}</span> <span style={{ color: "var(--mt)" }}>{cat}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {memLoad ? (
              <div className="ld">Loading memories...</div>
            ) : memories.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--mt)" }}>
                <div style={{ opacity: 0.3, marginBottom: 12 }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2z"/></svg></div>
                <div style={{ fontSize: 14, marginBottom: 8 }}>No memories saved yet</div>
                <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                  Start chatting, or type<br />
                  <span style={{ color: "var(--accent)" }}>"Remember that I am a developer"</span><br />
                  
                </div>
              </div>
            ) : (
              <>
                {MEM_CATEGORIES.map(cat => {
                  const catMems = memories
                    .filter(m => (m.category || "personal") === cat)
                    .sort((a, b) => (b.importance_score || 5) - (a.importance_score || 5));
                  if (!catMems.length) return null;
                  return (
                    <div key={cat}>
                      <div className="sec">{MEM_CATEGORY_LABELS[cat] || cat}</div>
                      {catMems.map(m => {
                        const content = m.memory_content || m.text || "";
                        const score = m.importance_score || 5;
                        const isEditing = editingMemId === m.id;
                        return (
                          <div key={m.id} style={{
                            background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 14,
                            padding: "12px 14px", marginBottom: 7, display: "flex", gap: 11, alignItems: "flex-start"
                          }}>
                            {/* Importance indicator */}
                            <div style={{
                              width: 6, borderRadius: 3, flexShrink: 0, alignSelf: "stretch", minHeight: 36,
                              background: score >= 8 ? "#22c55e" : score >= 5 ? "var(--accent)" : "var(--bd)"
                            }} title={`Importance: ${score}/10`} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {isEditing ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <textarea
                                    className="inp"
                                    rows={2}
                                    style={{ fontSize: 13, padding: "7px 10px", resize: "none", borderRadius: 10 }}
                                    value={editMemVal}
                                    onChange={e => setEditMemVal(e.target.value)}
                                    autoFocus
                                  />
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button className="btn btn-p" style={{ padding: "6px 14px", fontSize: 12, width: "auto" }}
                                      onClick={() => editMemory(m.id, editMemVal)}>Save</button>
                                    <button className="btn btn-s" style={{ padding: "6px 14px", fontSize: 12, width: "auto" }}
                                      onClick={() => setEditingMemId(null)}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--tx)", lineHeight: 1.5 }}>{content}</div>
                                  <div style={{ display: "flex", gap: 8, marginTop: 5, alignItems: "center" }}>
                                    <span style={{ fontSize: 10, color: "var(--mt)" }}>
                                      {m.updatedAt ? fmtDate(m.updatedAt) : fmtDate(m.createdAt)}
                                    </span>
                                    <span style={{ fontSize: 10, color: "var(--mt)" }}>·</span>
                                    <span style={{ fontSize: 10, color: score >= 8 ? "#22c55e" : score >= 5 ? "var(--accent)" : "var(--mt)", fontWeight: 600 }}>
                                      ★ {score}/10
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                            {!isEditing && (
                              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                <button className="hact" onClick={() => { setEditingMemId(m.id); setEditMemVal(content); }} title="Edit">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button className="hact del" onClick={() => deleteMemory(m.id)} title="Delete">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                <button className="btn btn-s" style={{ marginTop: 8, color: "#ef4444", borderColor: "#ef444430" }} onClick={clearAllMemories}>
                  Clear All Memories
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SETTINGS PAGE ── */}
      {page === "settings" && (
        <div className="page">
          <div className="page-inner">
            <div className="ptitle">Settings</div>

            {/* Profile card at top like Claude */}
            <div className="scard" style={{ marginBottom: 16 }}>
              <div className="srow" style={{ cursor: "pointer" }} onClick={() => setShowProfile(true)}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--grad)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 16, flexShrink: 0 }}>
                  {pPhotoUrl ? <img src={pPhotoUrl} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} alt="" /> : displayName[0]?.toUpperCase()}
                </div>
                <div className="stxt">
                  <div className="slbl">{displayName}</div>
                  <div className="sdesc">{user?.email}</div>
                </div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
              {!userData?.premium && (
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--bd)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--mt)" }}>Free plan · {chatsLeft} messages left</span>
                  <button className="nbtn" onClick={() => setShowUpgrade(true)} style={{ background: "var(--grad)", color: "#fff", border: "none" }}>Upgrade</button>
                </div>
              )}
            </div>

            {/* Appearance */}
            <div className="scard">
              <ExpandRow icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>} label="Color mode" desc={themeKey === "dark" ? "Dark" : "Light"}>
                <div className="opt-row">
                  <button className={"opt-pill" + (themeKey === "dark" ? " sel" : "")} onClick={() => savePref("theme", "dark")}>Dark</button>
                  <button className={"opt-pill" + (themeKey === "light" ? " sel" : "")} onClick={() => savePref("theme", "light")}>Light</button>
                </div>
              </ExpandRow>
              <ExpandRow icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>} label="Font size" desc={fontSize <= 13 ? "Low" : fontSize <= 14 ? "Normal" : "High"}>
                <div className="opt-row">
                  <button className={"opt-pill" + (fontSize <= 13 ? " sel" : "")} onClick={() => savePref("fontSize", 12)}>Low</button>
                  <button className={"opt-pill" + (fontSize === 14 ? " sel" : "")} onClick={() => savePref("fontSize", 14)}>Normal</button>
                  <button className={"opt-pill" + (fontSize >= 16 ? " sel" : "")} onClick={() => savePref("fontSize", 16)}>High</button>
                </div>
              </ExpandRow>
            </div>

            <div className="sec" style={{ marginTop: 8 }}>Capabilities</div>
            <div className="scard">
              <ExpandRow icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>} label="Language" desc={language === "auto" ? "Auto Detect" : language === "hindi" ? "Hindi" : "English"}>
                <div className="opt-row">
                  {[["auto","Auto Detect"],["hindi","Hindi"],["english","English"]].map(([val, lbl]) => (
                    <button key={val} className={"opt-pill" + (language === val ? " sel" : "")} onClick={() => savePref("language", val)}>{lbl}</button>
                  ))}
                </div>
              </ExpandRow>
              <div className="srow">
                <div className="sicon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg></div>
                <div className="stxt"><div className="slbl">Voice</div><div className="sdesc">Hindi + English</div></div>
                <div className="sright"><span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>Enabled</span></div>
              </div>
            </div>

            {/* ── MEMORY — All in one, collapsed under a single row ── */}
            <div className="sec" style={{ marginTop: 8 }}>Memory</div>
            <div className="scard" style={{ marginBottom: 8 }}>
              <ExpandRow
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2z"/></svg>}
                label="Memory"
                desc={memoryEnabled ? `On · ${memories.length} ${memories.length === 1 ? "memory" : "memories"} saved` : "Off"}
              >
                {/* ON/OFF toggle */}
                <div className="srow" style={{ borderBottom: "1px solid var(--bd)" }}>
                  <div className="stxt">
                    <div className="slbl">Save & recall memories</div>
                    <div className="sdesc">Remember information across conversations</div>
                  </div>
                  <div className="sright">
                    <div className={"tgl" + (memoryEnabled ? " on" : "")} onClick={() => savePref("memoryEnabled", !memoryEnabled)}><div className="tk" /></div>
                  </div>
                </div>

                {/* Add Memory */}
                <div className="srow" style={{ cursor: "pointer", borderBottom: "1px solid var(--bd)" }} onClick={() => setShowAddMem(true)}>
                  <div className="stxt"><div className="slbl">Add Memory</div><div className="sdesc">Manually save a fact about yourself</div></div>
                  <div className="sright"><Ico.ChevRight /></div>
                </div>

                {/* Clear All */}
                <div className="srow" style={{ cursor: "pointer" }} onClick={clearAllMemories}>
                  <div className="stxt"><div className="slbl">Clear All Memories</div><div className="sdesc">{memories.length} {memories.length === 1 ? "memory" : "memories"} saved</div></div>
                  <div className="sright"><Ico.ChevRight /></div>
                </div>
              </ExpandRow>
            </div>

            {/* Saved memories list */}
            {memories.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {memories.slice(0, 20).map(m => {
                  const content = m.memory_content || m.text || "";
                  return (
                    <div key={m.id} style={{ background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: 12, padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        {editingMemId === m.id ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <input className="inp" style={{ fontSize: 12, padding: "5px 9px", flex: 1 }} value={editMemVal}
                              onChange={e => setEditMemVal(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") editMemory(m.id, editMemVal); if (e.key === "Escape") setEditingMemId(null); }}
                              autoFocus />
                            <button className="btn btn-p" style={{ width: "auto", padding: "5px 10px", fontSize: 11 }} onClick={() => editMemory(m.id, editMemVal)}>Save</button>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: 13, color: "var(--tx)", lineHeight: 1.5 }}>{content}</div>
                            <div style={{ fontSize: 10, color: "var(--mt)", marginTop: 3 }}>{m.category} · Importance: {m.importance_score || 5}/10</div>
                          </>
                        )}
                      </div>
                      {editingMemId !== m.id && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="hact" onClick={() => { setEditingMemId(m.id); setEditMemVal(content); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="hact del" onClick={() => deleteMemory(m.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="sec" style={{ marginTop: 8 }}>Creator</div>
            <div className="scard" style={{ marginBottom: 8 }}>
              <div className="srow" style={{ cursor:"pointer" }} onClick={()=>{ setPage("marketplace"); setShowSb(false); loadMarketplace(); }}>
                <div className="sicon">🛍</div>
                <div className="stxt"><div className="slbl">Marketplace</div><div className="sdesc">Browse and buy agents</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
              <div className="srow" style={{ cursor:"pointer" }} onClick={()=>{ setPage("agents"); setShowSb(false); }}>
                <div className="sicon">🤖</div>
                <div className="stxt"><div className="slbl">My Agents</div><div className="sdesc">Create and manage agents</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
            </div>

            <div className="sec" style={{ marginTop: 8 }}>Account</div>
            <div className="scard">
              <div className="srow" style={{ cursor: "pointer" }} onClick={() => setShowChangePw(true)}>
                <div className="sicon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                <div className="stxt"><div className="slbl">Change Password</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
              <div className="srow" style={{ cursor: "pointer" }} onClick={exportAllData}>
                <div className="sicon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
                <div className="stxt"><div className="slbl">{exporting ? "Exporting..." : "Export All Data"}</div><div className="sdesc">Download JSON</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
              <div className="srow" style={{ cursor: "pointer" }} onClick={clearAllChatHistory}>
                <div className="sicon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></div>
                <div className="stxt"><div className="slbl">Clear Chat History</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
            </div>

            <div className="sec" style={{ marginTop: 8 }}>About</div>
            <div className="scard">
              <div className="srow">
                <div className="sicon"><SaraswatiLogo size={20} /></div>
                <div className="stxt"><div className="slbl">Saraswati AI</div><div className="sdesc">India's AI Platform</div></div>
              </div>
              <div className="srow">
                <div className="sicon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
                <div className="stxt"><div className="slbl">Usage</div><div className="sdesc">{userData?.usageCount || 0} messages · {userData?.premium ? "Premium ✓" : `${chatsLeft} free left`}</div></div>
              </div>
            </div>

            {/* Danger zone */}
            <div className="scard" style={{ marginTop: 16 }}>
              <div className="srow" style={{ cursor: "pointer" }} onClick={() => setShowDeleteAcc(true)}>
                <div className="sicon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
                <div className="stxt"><div className="slbl" style={{ color: "#ef4444" }}>Delete Account</div><div className="sdesc">Permanent, cannot be undone</div></div>
                <div className="sright"><Ico.ChevRight /></div>
              </div>
            </div>

            {/* Logout */}
            <div style={{ padding: "16px 0 8px" }}>
              <button onClick={() => signOut(auth)} style={{ width: "100%", background: "none", border: "1.5px solid #ef444440", borderRadius: 14, color: "#ef4444", cursor: "pointer", fontSize: 15, fontWeight: 600, padding: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "Inter,sans-serif" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           AGENTS PAGE
      ══════════════════════════════════════════════════════════ */}
      {page === "agents" && (
        <div className="page">
          <div className="page-inner">
            {/* Tab switcher */}
            <div style={{ display:"flex", gap:8, marginBottom:18 }}>
              {[{id:"my",label:"🤖 My Agents"},{id:"create",label:"✨ Create Agent"}].map(t=>(
                <button key={t.id} onClick={()=>{setAgentTab(t.id);if(t.id==="create"){setAgentCreateForm({name:"",category:""});setAgentGenData(null);setAgentEditId(null);setAgentAvatarFile(null);setAgentAvatarPreview(null);setAgentPdfFile(null);setAgentPdfName("");setAgentPdfText("");}}}
                  style={{flex:1,padding:"11px",borderRadius:16,border:"none",fontWeight:700,fontSize:14,fontFamily:"Inter,sans-serif",cursor:"pointer",
                    background:agentTab===t.id?"var(--grad)":"var(--sf2)",color:agentTab===t.id?"#fff":"var(--mt)",
                    boxShadow:agentTab===t.id?"0 4px 16px var(--glow)":"none",transition:"all .2s"}}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── MY AGENTS TAB ── */}
            {agentTab==="my" && (
              <>
                {agents.length===0?(
                  <div style={{textAlign:"center",padding:"40px 20px",color:"var(--mt)"}}>
                    <div style={{fontSize:56,marginBottom:16}}>🤖</div>
                    <div style={{fontSize:16,fontWeight:600,color:"var(--tx)",marginBottom:8}}>No Agents Yet</div>
                    <div style={{fontSize:13,lineHeight:1.7,marginBottom:20}}>
                      Go to the Create Agent tab to build your first AI agent!<br/>
                      <span style={{color:"var(--accent)"}}>Just name and category — AI does the rest ✨</span>
                    </div>
                    <button onClick={()=>setAgentTab("create")}
                      style={{background:"var(--grad)",color:"#fff",border:"none",borderRadius:14,padding:"12px 24px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                      + Create First Agent
                    </button>
                  </div>
                ):(
                  agents.map(agent=>(
                    <div key={agent.id} style={{background:"var(--sf)",border:"1px solid var(--bd)",borderRadius:18,padding:"16px",marginBottom:12,position:"relative"}}>
                      {/* Top row */}
                      <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:10}}>
                        {/* Avatar */}
                        <div style={{width:58,height:58,borderRadius:18,background:"var(--grad)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0,boxShadow:"0 4px 14px var(--glow)",overflow:"hidden"}}>
                          {agent.avatarImg ? <img src={agent.avatarImg} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" /> : (agent.emoji||"🤖")}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:16,fontWeight:700,color:"var(--tx)",marginBottom:2}}>{agent.name}</div>
                          <div style={{fontSize:11,color:"var(--accent)",fontWeight:600,marginBottom:2}}>{agent.category}</div>
                          {/* FIX: Created Date */}
                          <div style={{fontSize:10,color:"var(--mt)",marginBottom:4}}>
                            Created: {agent.createdAt?.seconds ? new Date(agent.createdAt.seconds*1000).toLocaleDateString("en-IN") : "Today"}
                          </div>
                          {agent.description&&<div style={{fontSize:12,color:"var(--mt)",lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{agent.description}</div>}
                        </div>
                        {/* Status badge */}
                        <div style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,
                          background:agent.published?"#22c55e20":agent.status==="draft"?"#f59e0b15":"var(--sf2)",
                          color:agent.published?"#22c55e":agent.status==="draft"?"#f59e0b":"var(--mt)",
                          border:"1px solid "+(agent.published?"#22c55e50":agent.status==="draft"?"#f59e0b40":"var(--bd)"),whiteSpace:"nowrap"}}>
                          {agent.published ? "🌐 Live" : "📝 Draft"}
                        </div>
                      </div>

                      {/* Skills */}
                      {agent.skills&&agent.skills.length>0&&(
                        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
                          {agent.skills.slice(0,4).map((sk,si)=>(
                            <span key={si} style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:600,background:"var(--sf2)",border:"1px solid var(--bd)",color:"var(--mt)"}}>{sk}</span>
                          ))}
                        </div>
                      )}

                      {/* Extra fields */}
                      {(agent.expertise||agent.conversationStyle)&&(
                        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                          {agent.expertise&&<span style={{fontSize:10,color:"var(--mt)",background:"var(--sf2)",padding:"2px 8px",borderRadius:10}}>🎯 {agent.expertise}</span>}
                          {agent.conversationStyle&&<span style={{fontSize:10,color:"var(--mt)",background:"var(--sf2)",padding:"2px 8px",borderRadius:10}}>💬 {agent.conversationStyle}</span>}
                        </div>
                      )}

                      {/* PDF badge */}
                      {agent.pdfName&&(
                        <div style={{fontSize:10,color:"#3b82f6",marginBottom:8}}>📄 PDF: {agent.pdfName}</div>
                      )}

                      {/* Action buttons */}
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        <button onClick={()=>{
                          setActiveAgent(agent);
                          setSid(Date.now().toString());
                          setMsgs(agent.welcomeMessage ? [{ role:"assistant", content: agent.welcomeMessage, id: Date.now() }] : []);
                          setPage("chat"); setShowSb(false); setImgB64(null); setImgPrev(null); setReactions({});
                        }}
                          style={{flex:1,padding:"8px",borderRadius:10,border:"none",background:"var(--grad)",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",minWidth:70}}>
                          ▶ Open
                        </button>
                        <button onClick={()=>{
                          setAgentEditId(agent.id);
                          setAgentCreateForm({name:agent.name,category:agent.category||""});
                          setAgentGenData({description:agent.description,instructions:agent.instructions,systemPrompt:agent.systemPrompt,welcomeMessage:agent.welcomeMessage,personality:agent.personality,language:agent.language,expertise:agent.expertise,conversationStyle:agent.conversationStyle,suggestedAvatar:agent.emoji,skills:agent.skills||[]});
                          setAgentAvatarPreview(agent.avatarImg||null);
                          setAgentTab("create");
                        }}
                          style={{padding:"8px 12px",borderRadius:10,border:"1px solid var(--bd)",background:"var(--sf2)",color:"var(--tx)",fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                          ✏️ Edit
                        </button>
                        <button onClick={()=>toggleAgentPublish(agent.id,agent.published)}
                          style={{padding:"8px 12px",borderRadius:10,border:"1px solid "+(agent.published?"#22c55e50":"var(--accent)"),background:agent.published?"#22c55e15":"var(--glow)",color:agent.published?"#22c55e":"var(--accent)",fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600}}>
                          {agent.published ? "📤 Unpublish" : agent.publishingFeePaid ? "🚀 Re-publish" : "🌐 Publish ₹9"}
                        </button>
                        <button onClick={()=>askConfirm({title:"Delete Agent?",message:`"${agent.name}" will be permanently deleted.`,onConfirm:()=>deleteAgent(agent.id)})}
                          style={{padding:"8px 10px",borderRadius:10,border:"1px solid #ef444430",background:"none",color:"#ef4444",fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                          🗑
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* ── CREATE AGENT TAB ── */}
            {agentTab==="create" && (
              <div>
                <div style={{fontSize:13,color:"var(--mt)",marginBottom:16,lineHeight:1.6}}>
                  {agentEditId?"Edit your agent 👇":"Just name and category — AI generates everything else! ✨"}
                </div>

                {/* Agent Name */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--mt)",marginBottom:6,letterSpacing:".05em",textTransform:"uppercase"}}>Agent Name *</div>
                  <input className="inp" placeholder="e.g. Doctor AI, Legal Expert, Study Planner..."
                    value={agentCreateForm.name} onChange={e=>setAgentCreateForm(f=>({...f,name:e.target.value}))} style={{width:"100%"}} />
                </div>

                {/* Category */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--mt)",marginBottom:6,letterSpacing:".05em",textTransform:"uppercase"}}>Category *</div>
                  {agentCreateForm.category&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:12,background:"var(--glow)",border:"1.5px solid var(--accent)",marginBottom:8}}>
                      <span style={{fontSize:13,fontWeight:600,color:"var(--accent)",flex:1}}>✓ {agentCreateForm.category}</span>
                      <button onClick={()=>setAgentCreateForm(f=>({...f,category:""}))} style={{background:"none",border:"none",color:"var(--mt)",cursor:"pointer",fontSize:14,padding:2}}>✕</button>
                    </div>
                  )}
                  <div style={{position:"relative",marginBottom:8}}>
                    <svg style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mt)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input placeholder="Search category... (100+ options)"
                      value={agentCatSearch} onChange={e=>setAgentCatSearch(e.target.value)}
                      style={{width:"100%",padding:"9px 12px 9px 34px",borderRadius:12,border:"1.5px solid var(--bd)",background:"var(--sf2)",color:"var(--tx)",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"}} />
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,maxHeight:160,overflowY:"auto",padding:"4px 0"}}>
                    {ALL_CATEGORIES.filter(cat=>cat.toLowerCase().includes(agentCatSearch.toLowerCase())).map(cat=>(
                      <button key={cat} onClick={()=>{setAgentCreateForm(f=>({...f,category:cat}));setAgentCatSearch("");}}
                        style={{padding:"5px 12px",borderRadius:20,border:"1.5px solid "+(agentCreateForm.category===cat?"var(--accent)":"var(--bd)"),
                          background:agentCreateForm.category===cat?"var(--glow)":"var(--sf2)",
                          color:agentCreateForm.category===cat?"var(--accent)":"var(--mt)",
                          fontSize:11,fontWeight:agentCreateForm.category===cat?700:400,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* FIX: Avatar Upload */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--mt)",marginBottom:6,letterSpacing:".05em",textTransform:"uppercase"}}>Avatar (Optional)</div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:56,height:56,borderRadius:16,background:"var(--grad)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,overflow:"hidden",flexShrink:0}}>
                      {agentAvatarPreview?<img src={agentAvatarPreview} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" />:(agentGenData?.suggestedAvatar||"🤖")}
                    </div>
                    <div style={{flex:1}}>
                      <label style={{display:"inline-block",padding:"8px 16px",borderRadius:10,border:"1.5px solid var(--bd)",background:"var(--sf2)",color:"var(--mt)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                        📸 Upload Photo
                        <input type="file" accept="image/*" onChange={handleAgentAvatar} style={{display:"none"}} />
                      </label>
                      {agentAvatarPreview&&<button onClick={()=>{setAgentAvatarFile(null);setAgentAvatarPreview(null);}} style={{marginLeft:8,background:"none",border:"none",color:"#ef4444",fontSize:12,cursor:"pointer"}}>Remove</button>}
                      <div style={{fontSize:10,color:"var(--mt)",marginTop:4}}>Or an emoji avatar will be auto-generated by AI</div>
                    </div>
                  </div>
                </div>

                {/* FIX: PDF Knowledge Base */}
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--mt)",marginBottom:6,letterSpacing:".05em",textTransform:"uppercase"}}>PDF Knowledge Base (Optional)</div>
                  <label style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:12,border:"1.5px dashed var(--bd)",background:"var(--sf2)",cursor:"pointer"}}>
                    <span style={{fontSize:24}}>📄</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--tx)"}}>{agentPdfName||"Upload PDF file"}</div>
                      <div style={{fontSize:11,color:"var(--mt)"}}>Agent is PDF se knowledge lega</div>
                    </div>
                    <input type="file" accept=".pdf,.txt,.doc" onChange={handleAgentPdf} style={{display:"none"}} />
                  </label>
                  {agentPdfName&&<div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:11,color:"#22c55e"}}>✓ {agentPdfName} loaded</span>
                    <button onClick={()=>{setAgentPdfFile(null);setAgentPdfName("");setAgentPdfText("");}} style={{background:"none",border:"none",color:"#ef4444",fontSize:11,cursor:"pointer"}}>Remove</button>
                  </div>}
                </div>

                {/* Generate Button */}
                {!agentGenData&&(
                  <button onClick={async()=>{
                    if(!agentCreateForm.name.trim()){alert("Agent ka naam daalo!");return;}
                    if(!agentCreateForm.category.trim()){alert("Please select a category!");return;}
                    setAgentGenLoading(true);
                    const data=await generateAgentData(agentCreateForm.name,agentCreateForm.category);
                    setAgentGenData(data);
                    setAgentGenLoading(false);
                  }} disabled={agentGenLoading||!agentCreateForm.name.trim()||!agentCreateForm.category.trim()}
                    style={{width:"100%",padding:"13px",borderRadius:14,border:"none",
                      background:(!agentCreateForm.name.trim()||!agentCreateForm.category.trim())?"var(--sf2)":"var(--grad)",
                      color:(!agentCreateForm.name.trim()||!agentCreateForm.category.trim())?"var(--mt)":"#fff",
                      fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",
                      boxShadow:(!agentCreateForm.name.trim()||!agentCreateForm.category.trim())?"none":"0 4px 20px var(--glow)",
                      marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                    {agentGenLoading?(<><SaraswatiLogo size={18} animate={true} state="thinking" /> AI Generate kar raha hai...</>):<>✨ Generate with AI</>}
                  </button>
                )}

                {/* Generated Preview */}
                {agentGenData&&(
                  <div style={{background:"var(--sf2)",borderRadius:16,padding:16,marginBottom:16,border:"1px solid var(--bd)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,paddingBottom:12,borderBottom:"1px solid var(--bd)"}}>
                      <div style={{width:52,height:52,borderRadius:14,background:"var(--grad)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0,overflow:"hidden"}}>
                        {agentAvatarPreview?<img src={agentAvatarPreview} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" />:(agentGenData.suggestedAvatar||"🤖")}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:15,fontWeight:700,color:"var(--tx)"}}>{agentCreateForm.name}</div>
                        <div style={{fontSize:11,color:"var(--accent)",fontWeight:600}}>{agentCreateForm.category}</div>
                      </div>
                      <div style={{padding:"3px 10px",borderRadius:20,background:"#22c55e20",color:"#22c55e",fontSize:10,fontWeight:700,border:"1px solid #22c55e40"}}>AI Generated ✓</div>
                    </div>

                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {[
                        {label:"Description",val:agentGenData.description},
                        {label:"Instructions",val:agentGenData.instructions,mono:true},
                        {label:"System Prompt",val:agentGenData.systemPrompt,mono:true},
                        {label:"Welcome Message",val:agentGenData.welcomeMessage,italic:true},
                        {label:"Expertise",val:agentGenData.expertise},
                        {label:"Conversation Style",val:agentGenData.conversationStyle},
                      ].filter(x=>x.val).map((item,i)=>(
                        <div key={i}>
                          <div style={{fontSize:10,fontWeight:700,color:"var(--mt)",marginBottom:3,textTransform:"uppercase",letterSpacing:".06em"}}>{item.label}</div>
                          <div style={{fontSize:12,color:"var(--tx)",lineHeight:1.6,background:item.mono?"var(--sf)":"none",borderRadius:item.mono?8:0,padding:item.mono?"8px 10px":0,border:item.mono?"1px solid var(--bd)":"none",fontFamily:item.mono?"monospace":"inherit",fontStyle:item.italic?"italic":"normal"}}>{item.val}</div>
                        </div>
                      ))}
                      <div style={{display:"flex",gap:10}}>
                        <div style={{flex:1}}><div style={{fontSize:10,fontWeight:700,color:"var(--mt)",marginBottom:3,textTransform:"uppercase",letterSpacing:".06em"}}>Personality</div><div style={{fontSize:12,color:"var(--tx)"}}>{agentGenData.personality}</div></div>
                        <div style={{flex:1}}><div style={{fontSize:10,fontWeight:700,color:"var(--mt)",marginBottom:3,textTransform:"uppercase",letterSpacing:".06em"}}>Language</div><div style={{fontSize:12,color:"var(--tx)"}}>{agentGenData.language}</div></div>
                      </div>
                      {agentGenData.skills&&agentGenData.skills.length>0&&(
                        <div>
                          <div style={{fontSize:10,fontWeight:700,color:"var(--mt)",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Skills</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                            {agentGenData.skills.map((sk,si)=>(
                              <span key={si} style={{padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:600,background:"var(--glow)",border:"1px solid var(--accent)",color:"var(--accent)"}}>{sk}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button onClick={async()=>{setAgentGenData(null);setAgentGenLoading(true);const d=await generateAgentData(agentCreateForm.name,agentCreateForm.category);setAgentGenData(d);setAgentGenLoading(false);}}
                      style={{marginTop:12,width:"100%",padding:"8px",borderRadius:10,border:"1px solid var(--bd)",background:"none",color:"var(--mt)",fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                      🔄 Regenerate
                    </button>
                  </div>
                )}

                {/* Save + Cancel */}
                {agentGenData&&(
                  <>
                    <button onClick={()=>saveNewAgent(agentCreateForm.name,agentCreateForm.category,agentGenData)} disabled={agentSaving}
                      style={{width:"100%",padding:"14px",borderRadius:14,border:"none",background:"var(--grad)",color:"#fff",fontSize:15,fontWeight:700,cursor:agentSaving?"not-allowed":"pointer",fontFamily:"Inter,sans-serif",boxShadow:"0 4px 20px var(--glow)",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                      {agentSaving?(<><SaraswatiLogo size={18} animate={true} state="thinking" /> Saving...</>):(agentEditId?"✅ Update Agent":"💾 Save as Draft")}
                    </button>
                    {!agentEditId && (
                      <div style={{textAlign:"center",fontSize:11,color:"var(--mt)",marginBottom:8,lineHeight:1.6}}>
                        📝 Agent saves as <strong>Draft</strong> — go to My Agents → tap <strong>Publish ₹9</strong> to go live on Marketplace
                      </div>
                    )}
                    <button onClick={()=>{setAgentGenData(null);setAgentCreateForm({name:"",category:""});setAgentEditId(null);setAgentCatSearch("");setAgentAvatarFile(null);setAgentAvatarPreview(null);setAgentPdfFile(null);setAgentPdfName("");setAgentPdfText("");}}
                      style={{width:"100%",padding:"11px",borderRadius:14,border:"1px solid var(--bd)",background:"none",color:"var(--mt)",fontSize:14,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           MARKETPLACE PAGE
      ══════════════════════════════════════════════════════════ */}
      {page === "marketplace" && (() => {
        const MK_TABS = [
          {id:"trending",label:"🔥 Trending"},{id:"new",label:"✨ New"},
          {id:"toprated",label:"⭐ Top Rated"},{id:"mostused",label:"👥 Most Used"},
          {id:"free",label:"🆓 Free"},{id:"paid",label:"💎 Paid"},
          {id:"recent",label:"🕐 Recent"},{id:"recommended",label:"💡 For You"},
        ];
        const displayAgents = getMkFiltered();
        const allCats = ["All",...Array.from(new Set([...DEMO_AGENTS,...mkAgents].map(a=>a.category).filter(Boolean)))];
        return (
          <div className="page">
            <div className="page-inner" style={{paddingTop:8}}>
              {/* Search */}
              <div style={{position:"relative",marginBottom:12}}>
                <svg style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mt)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input placeholder="Search agents, categories..." value={mkSearch} onChange={e=>setMkSearch(e.target.value)}
                  style={{width:"100%",padding:"11px 14px 11px 42px",borderRadius:16,border:"1.5px solid var(--bd)",background:"var(--sf)",color:"var(--tx)",fontSize:14,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"}}
                  onFocus={e=>e.target.style.borderColor="var(--accent)"} onBlur={e=>e.target.style.borderColor="var(--bd)"} />
                {mkSearch&&<button onClick={()=>setMkSearch("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--mt)",cursor:"pointer",fontSize:16,padding:4}}>✕</button>}
              </div>

              {/* Filters */}
              <div style={{display:"flex",gap:8,marginBottom:10,overflowX:"auto",paddingBottom:4}}>
                <select value={mkRatingFilter} onChange={e=>setMkRatingFilter(Number(e.target.value))}
                  style={{padding:"7px 12px",borderRadius:20,border:"1.5px solid var(--bd)",background:"var(--sf2)",color:"var(--tx)",fontSize:12,fontFamily:"Inter,sans-serif",cursor:"pointer",outline:"none",flexShrink:0}}>
                  <option value={0}>⭐ All Ratings</option>
                  <option value={4}>⭐ 4+</option>
                  <option value={4.5}>⭐ 4.5+</option>
                  <option value={4.8}>⭐ 4.8+</option>
                </select>
                {["all","free","paid"].map(p=>(
                  <button key={p} onClick={()=>setMkPriceFilter(p)}
                    style={{flexShrink:0,padding:"7px 14px",borderRadius:20,border:"1.5px solid "+(mkPriceFilter===p?"var(--accent)":"var(--bd)"),
                      background:mkPriceFilter===p?"var(--glow)":"var(--sf2)",color:mkPriceFilter===p?"var(--accent)":"var(--mt)",
                      fontSize:12,fontWeight:mkPriceFilter===p?700:400,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                    {p==="all"?"🔘 All":p==="free"?"🆓 Free":"💎 Paid"}
                  </button>
                ))}
              </div>

              {/* Category pills */}
              <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:10}}>
                {allCats.slice(0,15).map(cat=>(
                  <button key={cat} onClick={()=>setMkCatFilter(cat)}
                    style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:"1.5px solid "+(mkCatFilter===cat?"var(--accent)":"var(--bd)"),
                      background:mkCatFilter===cat?"var(--glow)":"none",color:mkCatFilter===cat?"var(--accent)":"var(--mt)",
                      fontSize:11,fontWeight:mkCatFilter===cat?700:400,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Tabs */}
              <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:14}}>
                {MK_TABS.map(tab=>(
                  <button key={tab.id} onClick={()=>setMkTab(tab.id)}
                    style={{flexShrink:0,padding:"8px 14px",borderRadius:20,
                      background:mkTab===tab.id?"var(--grad)":"var(--sf2)",border:"none",
                      color:mkTab===tab.id?"#fff":"var(--mt)",fontSize:12,fontWeight:mkTab===tab.id?700:400,
                      cursor:"pointer",fontFamily:"Inter,sans-serif",
                      boxShadow:mkTab===tab.id?"0 4px 14px var(--glow)":"none",transition:"all .2s"}}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Agent Cards */}
              {mkLoading?(
                <div style={{textAlign:"center",padding:40,color:"var(--mt)"}}>
                  <SaraswatiLogo size={40} animate={true} state="thinking" />
                  <div style={{marginTop:12,fontSize:14}}>Loading marketplace...</div>
                </div>
              ):displayAgents.length===0?(
                <div style={{textAlign:"center",padding:40,color:"var(--mt)"}}>
                  <div style={{fontSize:48,marginBottom:12}}>🔍</div>
                  <div style={{fontSize:15,fontWeight:600,color:"var(--tx)",marginBottom:8}}>No agents found</div>
                  <div style={{fontSize:13}}>Try a different search or filter</div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {displayAgents.map(agent=>(
                    <div key={agent.id}
                      style={{background:"var(--sf)",border:"1px solid "+(agent.featured?"var(--accent)":"var(--bd)"),borderRadius:20,padding:16,cursor:"pointer",transition:"border-color .2s,transform .15s",position:"relative"}}
                      onClick={()=>{setMkDetail(agent);loadAgentReviews(agent.id);setMkReviewText("");setMkReviewRating(5);}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.transform="translateY(-1px)";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=agent.featured?"var(--accent)":"var(--bd)";e.currentTarget.style.transform="translateY(0)";}}>
                      {/* Featured badge */}
                      {agent.featured&&<div style={{position:"absolute",top:10,left:10,padding:"2px 8px",borderRadius:20,background:"var(--grad)",color:"#fff",fontSize:9,fontWeight:700}}>⭐ FEATURED</div>}
                      {/* Price badge */}
                      <div style={{position:"absolute",top:14,right:14,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                        background:(!agent.price||agent.price===0)?"#22c55e20":"var(--glow)",
                        color:(!agent.price||agent.price===0)?"#22c55e":"var(--accent)",
                        border:"1px solid "+((!agent.price||agent.price===0)?"#22c55e40":"var(--accent)")}}>
                        {(!agent.price||agent.price===0)?"FREE":"₹"+agent.price}
                      </div>

                      <div style={{display:"flex",gap:14,alignItems:"flex-start",marginTop:agent.featured?10:0}}>
                        <div style={{width:58,height:58,borderRadius:18,background:"var(--grad)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,flexShrink:0,boxShadow:"0 4px 16px var(--glow)",overflow:"hidden"}}>
                          {agent.avatarImg?<img src={agent.avatarImg} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" />:(agent.emoji||"🤖")}
                        </div>
                        <div style={{flex:1,minWidth:0,paddingRight:60}}>
                          <div style={{fontSize:16,fontWeight:700,color:"var(--tx)",marginBottom:2}}>{agent.name}</div>
                          <div style={{fontSize:11,color:"var(--accent)",fontWeight:600,marginBottom:4}}>{agent.category}</div>
                          <div style={{fontSize:12,color:"var(--mt)",lineHeight:1.5,marginBottom:8,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{agent.description}</div>
                          <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <span style={{color:"#f59e0b",fontSize:13}}>★</span>
                              <span style={{fontSize:12,fontWeight:700,color:"var(--tx)"}}>{(agent.avgRating||4.5).toFixed(1)}</span>
                              <span style={{fontSize:11,color:"var(--mt)"}}>({agent.reviewCount||0})</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--mt)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                              <span style={{fontSize:11,color:"var(--mt)"}}>{(agent.totalUsers||0).toLocaleString()} users</span>
                            </div>
                            <span style={{fontSize:11,color:"var(--mt)"}}>by {agent.creatorName||"Creator"}</span>
                          </div>
                        </div>
                      </div>

                      {agent.skills&&agent.skills.length>0&&(
                        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:10}}>
                          {agent.skills.slice(0,4).map((sk,si)=>(
                            <span key={si} style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:600,background:"var(--sf2)",border:"1px solid var(--bd)",color:"var(--mt)"}}>{sk}</span>
                          ))}
                        </div>
                      )}

                      <div style={{display:"flex",gap:6,marginTop:12}}>
                        <button onClick={e=>{e.stopPropagation();setMkDetail(agent);loadAgentReviews(agent.id);setMkReviewText("");setMkReviewRating(5);}}
                          style={{flex:1,padding:"8px",borderRadius:10,border:"1px solid var(--bd)",background:"var(--sf2)",color:"var(--tx)",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                          👁 Details
                        </button>
                        {(!agent.price||agent.price===0)?(
                          <button onClick={e=>{e.stopPropagation();useMarketplaceAgent(agent);}}
                            style={{flex:1,padding:"8px",borderRadius:10,border:"none",background:"var(--grad)",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",boxShadow:"0 3px 12px var(--glow)"}}>
                            ▶ Use Free
                          </button>
                        ):(
                          <button onClick={e=>{e.stopPropagation();buyMarketplaceAgent(agent);}}
                            style={{flex:1,padding:"8px",borderRadius:10,border:"none",background:"var(--grad)",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",boxShadow:"0 3px 12px var(--glow)"}}>
                            🛒 Buy ₹{agent.price}
                          </button>
                        )}
                        <button onClick={e=>{e.stopPropagation();shareAgent(agent);}}
                          style={{padding:"8px 10px",borderRadius:10,border:"1px solid var(--bd)",background:"var(--sf2)",color:"var(--mt)",fontSize:14,cursor:"pointer"}}>
                          🔗
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* MARKETPLACE DETAIL MODAL */}
      {mkDetail&&(
        <div className="mbg" onClick={()=>setMkDetail(null)} style={{zIndex:999}}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"90vh",overflowY:"auto",textAlign:"left",maxWidth:480,padding:0,borderRadius:24,overflow:"hidden"}}>
            <div style={{background:"var(--grad)",padding:"24px 20px 20px",textAlign:"center",position:"relative"}}>
              <button onClick={()=>setMkDetail(null)} style={{position:"absolute",top:14,right:14,background:"#ffffff30",border:"none",borderRadius:"50%",width:32,height:32,color:"#fff",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              <div style={{width:72,height:72,borderRadius:22,background:"#ffffff30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,margin:"0 auto 10px",overflow:"hidden"}}>
                {mkDetail.avatarImg?<img src={mkDetail.avatarImg} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" />:(mkDetail.emoji||"🤖")}
              </div>
              <div style={{fontSize:20,fontWeight:800,color:"#fff",marginBottom:2}}>{mkDetail.name}</div>
              <div style={{fontSize:12,color:"#ffffff80",marginBottom:12}}>{mkDetail.category} · by {mkDetail.creatorName||"Creator"}</div>
              <div style={{display:"flex",gap:16,justifyContent:"center"}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:"#fff"}}><span style={{color:"#fcd34d"}}>★</span> {(mkDetail.avgRating||4.5).toFixed(1)}</div><div style={{fontSize:10,color:"#ffffff70"}}>{mkDetail.reviewCount||0} reviews</div></div>
                <div style={{width:1,height:30,background:"#ffffff30"}}/>
                <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:"#fff"}}>{(mkDetail.totalUsers||0).toLocaleString()}</div><div style={{fontSize:10,color:"#ffffff70"}}>users</div></div>
                <div style={{width:1,height:30,background:"#ffffff30"}}/>
                <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:"#fff"}}>{(!mkDetail.price||mkDetail.price===0)?"FREE":"₹"+mkDetail.price}</div><div style={{fontSize:10,color:"#ffffff70"}}>price</div></div>
              </div>
            </div>
            <div style={{padding:"18px"}}>
              <div style={{fontSize:14,color:"var(--tx)",lineHeight:1.7,marginBottom:16}}>{mkDetail.description}</div>
              {mkDetail.expertise&&<div style={{marginBottom:12}}><div style={{fontSize:10,fontWeight:700,color:"var(--mt)",marginBottom:4,textTransform:"uppercase",letterSpacing:".06em"}}>Expertise</div><div style={{fontSize:13,color:"var(--tx)"}}>{mkDetail.expertise}</div></div>}
              {mkDetail.conversationStyle&&<div style={{marginBottom:12}}><div style={{fontSize:10,fontWeight:700,color:"var(--mt)",marginBottom:4,textTransform:"uppercase",letterSpacing:".06em"}}>Conversation Style</div><div style={{fontSize:13,color:"var(--tx)"}}>{mkDetail.conversationStyle}</div></div>}
              {mkDetail.skills&&mkDetail.skills.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--mt)",marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>Skills</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {mkDetail.skills.map((sk,si)=><span key={si} style={{padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:600,background:"var(--glow)",border:"1px solid var(--accent)",color:"var(--accent)"}}>{sk}</span>)}
                  </div>
                </div>
              )}
              {mkDetail.welcomeMessage&&(
                <div style={{background:"var(--sf2)",borderRadius:14,padding:"12px 16px",marginBottom:16,border:"1px solid var(--bd)"}}>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--mt)",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Welcome Message</div>
                  <div style={{fontSize:13,color:"var(--tx)",fontStyle:"italic",lineHeight:1.6}}>"{mkDetail.welcomeMessage}"</div>
                </div>
              )}
              {/* Creator Profile */}
              <div style={{background:"var(--sf2)",borderRadius:14,padding:"12px 16px",marginBottom:16,border:"1px solid var(--bd)"}}>
                <div style={{fontSize:10,fontWeight:700,color:"var(--mt)",marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>Creator Profile</div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:40,height:40,borderRadius:"50%",background:"var(--grad)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:16,flexShrink:0}}>
                    {(mkDetail.creatorName||"C")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--tx)"}}>{mkDetail.creatorName||"Creator"}</div>
                    <div style={{fontSize:11,color:"var(--mt)"}}>⭐ {(mkDetail.avgRating||4.5).toFixed(1)} avg · {mkDetail.reviewCount||0} reviews · {mkDetail.totalUsers||0} users</div>
                  </div>
                </div>
              </div>

              <div style={{display:"flex",gap:10,marginBottom:20}}>
                {(!mkDetail.price||mkDetail.price===0)?(
                  <button onClick={()=>useMarketplaceAgent(mkDetail)} style={{flex:1,padding:"14px",borderRadius:16,border:"none",background:"var(--grad)",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",boxShadow:"0 4px 20px var(--glow)"}}>▶ Use Free</button>
                ):(
                  <button onClick={()=>buyMarketplaceAgent(mkDetail)} style={{flex:1,padding:"14px",borderRadius:16,border:"none",background:"var(--grad)",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",boxShadow:"0 4px 20px var(--glow)"}}>🛒 Buy ₹{mkDetail.price}</button>
                )}
                <button onClick={()=>shareAgent(mkDetail)} style={{padding:"14px 16px",borderRadius:16,border:"1px solid var(--bd)",background:"var(--sf2)",color:"var(--mt)",fontSize:18,cursor:"pointer"}}>🔗</button>
              </div>

              {/* Reviews */}
              <div style={{borderTop:"1px solid var(--bd)",paddingTop:16}}>
                <div style={{fontSize:14,fontWeight:700,color:"var(--tx)",marginBottom:12}}>Reviews & Ratings</div>
                <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16,background:"var(--sf2)",borderRadius:14,padding:"12px 14px"}}>
                  <div style={{textAlign:"center",minWidth:56}}>
                    <div style={{fontSize:34,fontWeight:800,color:"var(--tx)"}}>{(mkDetail.avgRating||4.5).toFixed(1)}</div>
                    <div style={{display:"flex",gap:2,justifyContent:"center",marginTop:3}}>
                      {[1,2,3,4,5].map(s=><span key={s} style={{color:s<=Math.round(mkDetail.avgRating||4.5)?"#f59e0b":"var(--bd)",fontSize:13}}>★</span>)}
                    </div>
                    <div style={{fontSize:10,color:"var(--mt)",marginTop:3}}>{mkDetail.reviewCount||0} reviews</div>
                  </div>
                  <div style={{flex:1}}>
                    {[5,4,3,2,1].map(star=>{
                      const pct=mkReviews.length>0?(mkReviews.filter(r=>Math.round(r.rating||5)===star).length/mkReviews.length)*100:star*18;
                      return(<div key={star} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                        <span style={{fontSize:11,color:"var(--mt)",width:12}}>{star}</span>
                        <div style={{flex:1,height:5,background:"var(--bd)",borderRadius:3,overflow:"hidden"}}>
                          <div style={{width:pct+"%",height:"100%",background:"var(--grad)",borderRadius:3}}/>
                        </div>
                      </div>);
                    })}
                  </div>
                </div>
                {user&&(
                  <div style={{background:"var(--sf2)",borderRadius:14,padding:14,marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--mt)",marginBottom:8,textTransform:"uppercase",letterSpacing:".05em"}}>Write a Review</div>
                    <div style={{display:"flex",gap:5,marginBottom:10,alignItems:"center"}}>
                      <span style={{fontSize:12,color:"var(--mt)"}}>Rating:</span>
                      {[1,2,3,4,5].map(s=><span key={s} onClick={()=>setMkReviewRating(s)} style={{fontSize:24,cursor:"pointer",color:s<=mkReviewRating?"#f59e0b":"var(--bd)",transition:"color .15s"}}>★</span>)}
                      <span style={{fontSize:12,color:"var(--accent)",fontWeight:700}}>{mkReviewRating}/5</span>
                    </div>
                    <textarea className="inp iarea" rows={3} placeholder="Share your experience..." value={mkReviewText} onChange={e=>setMkReviewText(e.target.value)} style={{width:"100%",resize:"none",marginBottom:8,fontSize:13}}/>
                    <button onClick={()=>submitReview(mkDetail.id)} disabled={mkReviewLoading||!mkReviewText.trim()}
                      style={{padding:"9px 20px",borderRadius:10,border:"none",background:"var(--grad)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",opacity:(!mkReviewText.trim()||mkReviewLoading)?0.5:1}}>
                      {mkReviewLoading?"Submitting...":"Submit Review"}
                    </button>
                  </div>
                )}
                {mkReviews.length===0?<div style={{textAlign:"center",padding:"16px 0",color:"var(--mt)",fontSize:13}}>No reviews yet ✍️</div>:
                  mkReviews.map(rev=>(
                    <div key={rev.id} style={{background:"var(--sf)",border:"1px solid var(--bd)",borderRadius:12,padding:"10px 12px",marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <div><div style={{fontSize:13,fontWeight:700,color:"var(--tx)"}}>{rev.userName||"User"}</div>
                        <div style={{display:"flex",gap:2,marginTop:2}}>{[1,2,3,4,5].map(s=><span key={s} style={{color:s<=(rev.rating||5)?"#f59e0b":"var(--bd)",fontSize:11}}>★</span>)}</div></div>
                        <div style={{fontSize:10,color:"var(--mt)"}}>{fmtDate(rev.createdAt)}</div>
                      </div>
                      <div style={{fontSize:13,color:"var(--mt)",lineHeight:1.6}}>{rev.text}</div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PUBLISH FEE MODAL */}
      {showPublishFee&&(
        <div className="mbg" onClick={()=>{ if(!publishFeeLoading){ setShowPublishFee(false);setPublishFeeDone(false);setPublishPayStatus(null);setPublishedSuccess(false);} }} style={{zIndex:1000}}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>

            {/* ── STEP 4: AGENT PUBLISHED — FINAL SUCCESS SCREEN ── */}
            {publishedSuccess ? (
              <>
                <div className="mi">🎉</div>
                <h3 style={{color:"#22c55e"}}>Agent Published!</h3>
                <p style={{fontSize:13,color:"var(--mt)",lineHeight:1.7}}>
                  <strong style={{color:"var(--tx)"}}>{publishFeeAgent?.name}</strong> is now live on the Marketplace!
                </p>
                <div style={{background:"#22c55e15",border:"1px solid #22c55e40",borderRadius:14,padding:"14px 16px",marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#22c55e",marginBottom:8}}>✅ Your agent can now be:</div>
                  <div style={{fontSize:12,color:"var(--mt)",lineHeight:1.9}}>
                    👁️ Viewed by anyone on the Marketplace<br/>
                    🛒 Bought {parseFloat(publishFeeAgent?.customPrice||0)>0 ? `for ₹${publishFeeAgent?.customPrice}` : "for free"}<br/>
                    💬 Used in chat instantly
                  </div>
                </div>
                {parseFloat(publishFeeAgent?.customPrice||0)>0 && (
                  <div style={{display:"flex",gap:8,marginBottom:16}}>
                    <div style={{flex:1,background:"var(--sf2)",border:"1px solid var(--bd)",borderRadius:12,padding:"10px",textAlign:"center"}}>
                      <div style={{fontSize:10,color:"var(--mt)"}}>You Earn</div>
                      <div style={{fontSize:16,fontWeight:800,color:"#22c55e"}}>80%</div>
                    </div>
                    <div style={{flex:1,background:"var(--sf2)",border:"1px solid var(--bd)",borderRadius:12,padding:"10px",textAlign:"center"}}>
                      <div style={{fontSize:10,color:"var(--mt)"}}>Saraswati AI</div>
                      <div style={{fontSize:16,fontWeight:800,color:"#f97316"}}>20%</div>
                    </div>
                  </div>
                )}
                <button className="btn btn-p" onClick={()=>{ setShowPublishFee(false); setPublishFeeAgent(null); setPublishedSuccess(false); setPage("marketplace"); loadMarketplace(); }} style={{width:"100%",marginBottom:8}}>
                  🛍 View in Marketplace
                </button>
                <button className="btn btn-s" onClick={()=>{ setShowPublishFee(false); setPublishFeeAgent(null); setPublishedSuccess(false); }} style={{width:"100%"}}>Close</button>
              </>

            /* ── STEP 3: PAYMENT RESULT — SUCCESS / FAIL ── */
            ) : publishPayStatus === "success" ? (
              <>
                <div className="mi">✅</div>
                <h3 style={{color:"#22c55e"}}>Payment Successful!</h3>
                <p style={{fontSize:13,color:"var(--mt)",lineHeight:1.7}}>₹{PUBLISH_FEE} publishing fee received. Confirm below to publish your agent.</p>
                <div style={{background:"var(--sf2)",borderRadius:14,padding:"12px 16px",marginBottom:16,border:"1px solid var(--bd)"}}>
                  <div style={{fontSize:12,color:"var(--mt)",marginBottom:4}}>Publishing Fee Paid</div>
                  <div style={{fontSize:20,fontWeight:800,color:"#22c55e"}}>₹{PUBLISH_FEE} ✓</div>
                  <div style={{fontSize:11,color:"var(--mt)",marginTop:4}}>Agent: {publishFeeAgent?.name}</div>
                  {parseFloat(publishFeeAgent?.customPrice||0)>0&&<div style={{fontSize:11,color:"#22c55e",marginTop:2}}>Selling Price: ₹{publishFeeAgent?.customPrice}</div>}
                </div>
                <button className="btn btn-p" onClick={confirmPublish} disabled={publishFeeLoading} style={{width:"100%",marginBottom:8}}>
                  {publishFeeLoading?"Publishing...":"🚀 Confirm & Publish"}
                </button>
                <button className="btn btn-s" onClick={()=>{setShowPublishFee(false);setPublishPayStatus(null);}} style={{width:"100%"}}>Cancel</button>
              </>
            ) : publishPayStatus === "fail" ? (
              <>
                <div className="mi">❌</div>
                <h3 style={{color:"#ef4444"}}>Payment Failed</h3>
                <p style={{fontSize:13,color:"var(--mt)",lineHeight:1.7}}>The ₹{PUBLISH_FEE} payment did not go through. No worries — try again.</p>
                <div style={{background:"#ef444415",border:"1px solid #ef444440",borderRadius:14,padding:"14px 16px",marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#ef4444",marginBottom:6}}>⚠️ Possible reasons:</div>
                  <div style={{fontSize:12,color:"var(--mt)",lineHeight:1.8}}>
                    • Insufficient UPI balance<br/>
                    • Internet issue during payment<br/>
                    • Transaction timed out
                  </div>
                </div>
                <button className="btn btn-p" onClick={()=>{
                  setPublishPayStatus(null);
                  openRazorpayPublish();
                }} style={{width:"100%",marginBottom:8}}>🔄 Try Again</button>
                <button className="btn btn-s" onClick={()=>setPublishPayStatus(null)} style={{width:"100%"}}>Back</button>
              </>

            /* ── LEGACY MANUAL CONFIRM (kept as fallback path) ── */
            ) : publishFeeDone?(
              <>
                <div className="mi">✅</div>
                <h3>Confirm Payment</h3>
                <p style={{fontSize:13,color:"var(--mt)",lineHeight:1.7}}>Payment done? Click "Confirm & Publish".</p>
                <div style={{background:"var(--sf2)",borderRadius:14,padding:"12px 16px",marginBottom:16,border:"1px solid var(--bd)"}}>
                  <div style={{fontSize:12,color:"var(--mt)",marginBottom:4}}>Publishing Fee</div>
                  <div style={{fontSize:20,fontWeight:800,color:"var(--accent)"}}>₹{PUBLISH_FEE}</div>
                  <div style={{fontSize:11,color:"var(--mt)",marginTop:4}}>Agent: {publishFeeAgent?.name}</div>
                  {parseFloat(publishFeeAgent?.customPrice||0)>0&&<div style={{fontSize:11,color:"#22c55e",marginTop:2}}>Selling Price: ₹{publishFeeAgent?.customPrice}</div>}
                </div>
                <div style={{display:"flex",gap:6,marginBottom:8}}>
                  <button className="btn btn-s" style={{flex:1,fontSize:12}} onClick={()=>setPublishPayStatus("fail")}>❌ Payment Failed?</button>
                  <button className="btn btn-s" style={{flex:1,fontSize:12}} onClick={()=>setPublishPayStatus("success")}>✅ Payment Done?</button>
                </div>
                <button className="btn btn-p" onClick={confirmPublish} disabled={publishFeeLoading} style={{width:"100%",marginBottom:8}}>
                  {publishFeeLoading?"Publishing...":"✅ Confirm & Publish"}
                </button>
                <button className="btn btn-s" onClick={()=>{setShowPublishFee(false);setPublishFeeDone(false);}} style={{width:"100%"}}>Cancel</button>
              </>

            /* ── STEP 1+2: SET PRICE + PAY ₹9 ── */
            ):(
              <>
                <div className="mi">🚀</div>
                <h3>Publish to Marketplace</h3>
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--mt)",marginBottom:6,textTransform:"uppercase",letterSpacing:".05em"}}>Set Selling Price</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:18,fontWeight:700,color:"var(--tx)"}}>₹</span>
                    <input className="inp" type="number" min="0" placeholder="0 = FREE" value={agentPrice} onChange={e=>setAgentPrice(e.target.value)} style={{flex:1,fontSize:20,fontWeight:700,textAlign:"center"}}/>
                  </div>
                  {/* Quick price presets */}
                  <div style={{display:"flex",gap:6,marginTop:8}}>
                    {[49,99,199,499].map(p=>(
                      <button key={p} onClick={()=>setAgentPrice(String(p))}
                        style={{flex:1,padding:"7px",borderRadius:10,border:"1.5px solid "+(String(agentPrice)===String(p)?"var(--accent)":"var(--bd)"),background:String(agentPrice)===String(p)?"var(--glow)":"var(--sf2)",color:String(agentPrice)===String(p)?"var(--accent)":"var(--mt)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                        ₹{p}
                      </button>
                    ))}
                  </div>
                  {parseFloat(agentPrice)>0&&(
                    <div style={{marginTop:8,padding:"8px 12px",background:"var(--glow)",borderRadius:10,border:"1px solid var(--accent)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:12,color:"var(--mt)"}}>You Earn (80%)</span>
                        <span style={{fontSize:13,fontWeight:700,color:"#22c55e"}}>₹{Math.round(parseFloat(agentPrice)*0.80)}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <span style={{fontSize:12,color:"var(--mt)"}}>Commission Tax (20%)</span>
                        <span style={{fontSize:12,color:"var(--mt)"}}>₹{Math.round(parseFloat(agentPrice)*0.20)}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{background:"var(--sf2)",borderRadius:14,padding:"14px 16px",marginBottom:16,border:"1px solid var(--bd)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:13,fontWeight:600,color:"var(--tx)"}}>Publishing Fee</span>
                    <span style={{fontSize:20,fontWeight:800,color:"var(--accent)"}}>₹{PUBLISH_FEE}</span>
                  </div>
                  <div style={{padding:"10px 12px",background:"#22c55e10",borderRadius:10,border:"1px solid #22c55e30"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#22c55e",marginBottom:4}}>Pay via UPI:</div>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--tx)"}}>{PLATFORM_UPI}@upi</div>
                    <div style={{fontSize:11,color:"var(--mt)",marginTop:2}}>Amount: ₹{PUBLISH_FEE} · Note: Agent Publish Fee</div>
                  </div>
                </div>
                <button className="btn btn-p" onClick={openRazorpayPublish}
                  style={{width:"100%",marginBottom:8}}>
                  💳 Pay ₹{PUBLISH_FEE} via Razorpay →
                </button>
                <div style={{fontSize:11,color:"var(--mt)",textAlign:"center",marginBottom:4}}>
                  Secured by Razorpay · UPI / Card / Net Banking
                </div>
                <button className="btn btn-s" onClick={()=>setShowPublishFee(false)} style={{width:"100%"}}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* BUY AGENT MODAL */}
      {showBuyModal&&buyModalAgent&&(
        <div className="mbg" onClick={()=>{setShowBuyModal(false);setBuyPayDone(false);}} style={{zIndex:1000}}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>
            {buyPayDone?(
              <>
                <div className="mi">🎉</div>
                <h3>Payment Done!</h3>
                <button className="btn btn-p" onClick={async()=>{await recordAgentSale(buyModalAgent);setShowBuyModal(false);setBuyPayDone(false);useMarketplaceAgent(buyModalAgent);}} style={{width:"100%",marginBottom:8}}>
                  ✅ Confirm & Use Agent
                </button>
                <button className="btn btn-s" onClick={()=>{setShowBuyModal(false);setBuyPayDone(false);}} style={{width:"100%"}}>Cancel</button>
              </>
            ):(
              <>
                <div style={{textAlign:"center",marginBottom:14}}>
                  <div style={{fontSize:48,marginBottom:6}}>{buyModalAgent.avatarImg?<img src={buyModalAgent.avatarImg} style={{width:56,height:56,borderRadius:16,objectFit:"cover"}} alt=""/>:(buyModalAgent.emoji||"🤖")}</div>
                  <div style={{fontSize:17,fontWeight:700,color:"var(--tx)"}}>{buyModalAgent.name}</div>
                  <div style={{fontSize:12,color:"var(--mt)"}}>{buyModalAgent.category}</div>
                </div>
                <div style={{background:"var(--sf2)",borderRadius:14,padding:"14px",marginBottom:14,border:"1px solid var(--bd)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                    <span style={{fontSize:14,fontWeight:600,color:"var(--tx)"}}>Price</span>
                    <span style={{fontSize:24,fontWeight:800,color:"var(--accent)"}}>₹{buyModalAgent.price}</span>
                  </div>
                  <div style={{padding:"10px 12px",background:"#3b82f610",borderRadius:10,border:"1px solid #3b82f630"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#3b82f6",marginBottom:3}}>Pay via UPI:</div>
                    <div style={{fontSize:15,fontWeight:700,color:"var(--tx)"}}>{PLATFORM_UPI}@upi</div>
                    <div style={{fontSize:11,color:"var(--mt)",marginTop:2}}>Amount: ₹{buyModalAgent.price} · Note: {buyModalAgent.name}</div>
                  </div>
                  <div style={{fontSize:11,color:"var(--mt)",marginTop:8}}>Creator earns ₹{Math.round(buyModalAgent.price*0.80)} · Commission Tax: ₹{Math.round(buyModalAgent.price*0.20)} (20%)</div>
                </div>
                <button className="btn btn-p" onClick={()=>{window.open("upi://pay?pa="+PLATFORM_UPI+"@upi&pn=SaraswatiAI&am="+buyModalAgent.price+"&cu=INR&tn="+encodeURIComponent(buyModalAgent.name),"_blank");setTimeout(()=>setBuyPayDone(true),1500);}} style={{width:"100%",marginBottom:8}}>
                  Pay ₹{buyModalAgent.price} via UPI →
                </button>
                <button className="btn btn-s" onClick={()=>setShowBuyModal(false)} style={{width:"100%"}}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* CREATOR DASHBOARD MODAL */}
      {showCreatorDash&&(
        <div className="mbg" onClick={()=>setShowCreatorDash(false)} style={{zIndex:1000}}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"90vh",overflowY:"auto",textAlign:"left",maxWidth:480,padding:0,borderRadius:24,overflow:"hidden"}}>
            <div style={{background:"var(--grad)",padding:"20px 20px 14px",position:"relative"}}>
              <button onClick={()=>setShowCreatorDash(false)} style={{position:"absolute",top:14,right:14,background:"#ffffff30",border:"none",borderRadius:"50%",width:30,height:30,color:"#fff",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              <div style={{fontSize:12,color:"#ffffff80",marginBottom:2}}>Creator Dashboard</div>
              <div style={{fontSize:20,fontWeight:800,color:"#fff"}}>{userData?.name||"Creator"}</div>
            </div>
            <div style={{display:"flex",gap:0,borderBottom:"1px solid var(--bd)",background:"var(--sf)",overflowX:"auto"}}>
              {[{id:"overview",label:"📊 Overview"},{id:"wallet",label:"💰 Wallet"},{id:"analytics",label:"📈 Analytics"},{id:"withdraw",label:"🏦 Withdraw"}].map(t=>(
                <button key={t.id} onClick={()=>setCreatorTab(t.id)}
                  style={{flex:1,padding:"11px 6px",border:"none",borderBottom:creatorTab===t.id?"2.5px solid var(--accent)":"2.5px solid transparent",background:"none",
                    color:creatorTab===t.id?"var(--accent)":"var(--mt)",fontSize:10,fontWeight:creatorTab===t.id?700:400,
                    cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{padding:"16px"}}>
              {creatorLoading?(<div style={{textAlign:"center",padding:30}}><SaraswatiLogo size={32} animate={true} state="thinking"/><div style={{marginTop:8,color:"var(--mt)",fontSize:13}}>Loading...</div></div>):(
                <>
                  {creatorTab==="overview"&&(
                    <>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                        {[
                          {label:"Total Agents",value:creatorData?.totalAgents||0,icon:"🤖",color:"#3b82f6"},
                          {label:"Published",value:creatorData?.publishedAgents||0,icon:"🌐",color:"#22c55e"},
                          {label:"Total Sales",value:creatorData?.totalSales||0,icon:"🛒",color:"#f59e0b"},
                          {label:"Total Revenue",value:"₹"+(creatorData?.totalRevenue||0),icon:"💰",color:"#8b5cf6"},
                          {label:"Commission Tax",value:"₹"+(creatorData?.commission||0),icon:"🏛️",color:"#ef4444"},
                          {label:"Pending Balance",value:"₹"+(creatorData?.pendingBalance||0),icon:"⏳",color:"#f97316"},
                        ].map((s,i)=>(
                          <div key={i} style={{background:"var(--sf2)",borderRadius:14,padding:"12px",border:"1px solid var(--bd)"}}>
                            <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
                            <div style={{fontSize:18,fontWeight:800,color:s.color}}>{s.value}</div>
                            <div style={{fontSize:10,color:"var(--mt)",marginTop:2}}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{background:"var(--grad)",borderRadius:16,padding:"16px 18px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div><div style={{fontSize:11,color:"#ffffff80"}}>Available Balance</div><div style={{fontSize:28,fontWeight:900,color:"#fff"}}>₹{(creatorData?.walletBalance||0).toFixed(2)}</div></div>
                        <button onClick={()=>setCreatorTab("withdraw")} style={{padding:"8px 16px",borderRadius:12,background:"#ffffff25",border:"1px solid #ffffff50",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Withdraw →</button>
                      </div>
                      <div style={{background:"var(--sf2)",borderRadius:14,padding:"12px 14px",marginBottom:14,border:"1px solid var(--bd)"}}>
                        <div style={{fontSize:10,fontWeight:700,color:"var(--mt)",marginBottom:6,textTransform:"uppercase",letterSpacing:".05em"}}>Your UPI ID</div>
                        {creatorUpiEdit?(
                          <div style={{display:"flex",gap:6}}>
                            <input className="inp" value={creatorUpiVal} onChange={e=>setCreatorUpiVal(e.target.value)} placeholder="yourname@upi" style={{flex:1,fontSize:13}}/>
                            <button className="btn btn-p" style={{width:"auto",padding:"0 12px",fontSize:12}} onClick={()=>saveCreatorUpi(creatorUpiVal)}>Save</button>
                            <button className="btn btn-s" style={{width:"auto",padding:"0 10px",fontSize:12}} onClick={()=>setCreatorUpiEdit(false)}>✕</button>
                          </div>
                        ):(
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <span style={{fontSize:14,fontWeight:600,color:creatorData?.upiId?"var(--tx)":"var(--mt)"}}>{creatorData?.upiId||"UPI ID not added"}</span>
                            <button onClick={()=>{setCreatorUpiEdit(true);setCreatorUpiVal(creatorData?.upiId||"");}} style={{background:"none",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:12,fontWeight:600}}>{creatorData?.upiId?"Edit":"+ Add"}</button>
                          </div>
                        )}
                      </div>
                      {creatorSales.slice(0,4).map(s=>(
                        <div key={s.id} style={{background:"var(--sf)",border:"1px solid var(--bd)",borderRadius:10,padding:"9px 12px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div><div style={{fontSize:12,fontWeight:600,color:"var(--tx)"}}>{s.agentName}</div><div style={{fontSize:10,color:"var(--mt)"}}>{fmtDate(s.createdAt)}</div></div>
                          <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:"#22c55e"}}>+₹{s.creatorEarning}</div><div style={{fontSize:9,color:"var(--mt)"}}>of ₹{s.totalAmount}</div></div>
                        </div>
                      ))}
                    </>
                  )}
                  {creatorTab==="analytics"&&(
                    <>
                      <div style={{fontSize:13,color:"var(--mt)",marginBottom:12}}>Agent performance:</div>
                      {creatorData?.agentsData?.filter(a=>a.published).map(agent=>{
                        const agSales=creatorSales.filter(s=>s.agentId===agent.id);
                        const agRev=agSales.reduce((s,x)=>s+(x.creatorEarning||0),0);
                        return(
                          <div key={agent.id} style={{background:"var(--sf2)",borderRadius:14,padding:"12px",marginBottom:8,border:"1px solid var(--bd)"}}>
                            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                              <div style={{width:36,height:36,borderRadius:10,background:"var(--grad)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,overflow:"hidden"}}>
                                {agent.avatarImg?<img src={agent.avatarImg} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:(agent.emoji||"🤖")}
                              </div>
                              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"var(--tx)"}}>{agent.name}</div><div style={{fontSize:10,color:"var(--accent)"}}>{agent.category}</div></div>
                            </div>
                            <div style={{display:"flex",gap:10}}>
                              {[{label:"Sales",val:agSales.length,color:"#f59e0b"},{label:"Revenue",val:"₹"+agRev,color:"#22c55e"},{label:"Users",val:agent.totalUsers||0,color:"#3b82f6"},{label:"Chats",val:(agentChatCounts[agent.id]||agent.totalChats||0),color:"#8b5cf6"}].map((m,i)=>(
                                <div key={i} style={{textAlign:"center",flex:1}}>
                                  <div style={{fontSize:15,fontWeight:800,color:m.color}}>{m.val}</div>
                                  <div style={{fontSize:9,color:"var(--mt)"}}>{m.label}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {(!creatorData?.agentsData?.filter(a=>a.published).length)&&<div style={{textAlign:"center",padding:"20px 0",color:"var(--mt)",fontSize:13}}>No published agents yet</div>}
                    </>
                  )}
                  {creatorTab==="wallet"&&(
                    <>
                      <div style={{background:"var(--grad)",borderRadius:18,padding:"18px",marginBottom:10,textAlign:"center"}}>
                        <div style={{fontSize:11,color:"#ffffff80",marginBottom:4}}>Available Balance</div>
                        <div style={{fontSize:36,fontWeight:900,color:"#fff"}}>₹{(creatorData?.walletBalance||0).toFixed(2)}</div>
                        {(creatorData?.walletBalance||0) >= 500 && (
                          <div style={{marginTop:8,background:"#22c55e30",border:"1px solid #22c55e60",borderRadius:20,padding:"4px 12px",display:"inline-block"}}>
                            <span style={{fontSize:11,color:"#22c55e",fontWeight:700}}>🚀 Auto Payout Ready — Min ₹500 reached!</span>
                          </div>
                        )}
                      </div>
                      {/* Pending Balance Card */}
                      {(creatorData?.pendingBalance||0) > 0 && (
                        <div style={{background:"#f59e0b15",border:"1px solid #f59e0b40",borderRadius:14,padding:"12px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:22}}>⏳</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Pending Balance</div>
                            <div style={{fontSize:11,color:"var(--mt)"}}>Withdrawal request processing...</div>
                          </div>
                          <div style={{fontSize:18,fontWeight:800,color:"#f59e0b"}}>₹{(creatorData?.pendingBalance||0).toFixed(2)}</div>
                        </div>
                      )}
                      {/* Commission Tax Info */}
                      {(creatorData?.commission||0) > 0 && (
                        <div style={{background:"var(--sf2)",border:"1px solid var(--bd)",borderRadius:14,padding:"12px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:22}}>🏛️</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:700,color:"var(--tx)"}}>Commission Tax (Platform)</div>
                            <div style={{fontSize:11,color:"var(--mt)"}}>20% platform fee deducted from sales</div>
                          </div>
                          <div style={{fontSize:16,fontWeight:800,color:"#ef4444"}}>-₹{(creatorData?.commission||0).toFixed(2)}</div>
                        </div>
                      )}
                      <div style={{fontSize:11,fontWeight:700,color:"var(--mt)",marginBottom:8,textTransform:"uppercase",letterSpacing:".05em"}}>Withdrawal History</div>
                      {creatorWithdrawals.length===0?<div style={{textAlign:"center",padding:"14px 0",color:"var(--mt)",fontSize:13}}>No history yet</div>:
                        creatorWithdrawals.map(w=>(
                          <div key={w.id} style={{background:"var(--sf)",border:"1px solid var(--bd)",borderRadius:10,padding:"9px 12px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div><div style={{fontSize:13,fontWeight:600,color:"var(--tx)"}}>₹{w.amount}</div><div style={{fontSize:10,color:"var(--mt)"}}>{w.upiId} · {fmtDate(w.createdAt)}</div></div>
                            <div style={{padding:"2px 8px",borderRadius:20,fontSize:9,fontWeight:700,
                              background:w.status==="paid"?"#22c55e20":w.status==="pending"?"#f59e0b20":"#ef444420",
                              color:w.status==="paid"?"#22c55e":w.status==="pending"?"#f59e0b":"#ef4444",
                              border:"1px solid "+(w.status==="paid"?"#22c55e40":w.status==="pending"?"#f59e0b40":"#ef444440")}}>
                              {w.status==="paid"?"✅ Paid":w.status==="pending"?"⏳ Pending":"❌ Rejected"}
                            </div>
                          </div>
                        ))
                      }
                    </>
                  )}
                  {creatorTab==="withdraw"&&(
                    <>
                      {(creatorData?.walletBalance||0) >= 500 && (
                        <div style={{background:"#22c55e15",border:"1px solid #22c55e40",borderRadius:14,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:20}}>🚀</span>
                          <div>
                            <div style={{fontSize:12,fontWeight:700,color:"#22c55e"}}>Auto Payout Ready!</div>
                            <div style={{fontSize:11,color:"var(--mt)"}}>Balance reached ₹500+ — ready to withdraw</div>
                          </div>
                        </div>
                      )}
                      <div style={{background:"var(--grad)",borderRadius:16,padding:"14px 18px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div><div style={{fontSize:10,color:"#ffffff80"}}>Available</div><div style={{fontSize:26,fontWeight:900,color:"#fff"}}>₹{(creatorData?.walletBalance||0).toFixed(2)}</div></div>
                        <div style={{fontSize:28}}>💰</div>
                      </div>
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:11,fontWeight:700,color:"var(--mt)",marginBottom:5,textTransform:"uppercase",letterSpacing:".05em"}}>Amount</div>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{fontSize:16,fontWeight:700,color:"var(--tx)"}}>₹</span>
                          <input className="inp" type="number" min="50" placeholder="Min ₹50" value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)} style={{flex:1,fontSize:16,fontWeight:700}}/>
                        </div>
                        <div style={{display:"flex",gap:6,marginTop:7}}>
                          {[100,250,500].map(amt=>(
                            <button key={amt} onClick={()=>setWithdrawAmount(String(Math.min(amt,creatorData?.walletBalance||0)))}
                              style={{flex:1,padding:"6px",borderRadius:9,border:"1px solid var(--bd)",background:"var(--sf2)",color:"var(--mt)",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>₹{amt}</button>
                          ))}
                          <button onClick={()=>setWithdrawAmount(String(creatorData?.walletBalance||0))}
                            style={{flex:1,padding:"6px",borderRadius:9,border:"1px solid var(--accent)",background:"var(--glow)",color:"var(--accent)",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:700}}>All</button>
                        </div>
                      </div>
                      <div style={{marginBottom:16}}>
                        <div style={{fontSize:11,fontWeight:700,color:"var(--mt)",marginBottom:5,textTransform:"uppercase",letterSpacing:".05em"}}>UPI ID</div>
                        <input className="inp" placeholder="yourname@upi" value={withdrawUpi} onChange={e=>setWithdrawUpi(e.target.value)} style={{width:"100%"}}/>
                        {creatorData?.upiId&&withdrawUpi!==creatorData.upiId&&<button onClick={()=>setWithdrawUpi(creatorData.upiId)} style={{marginTop:5,background:"none",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:12,padding:0}}>Use saved: {creatorData.upiId}</button>}
                      </div>
                      <button className="btn btn-p" onClick={requestWithdraw} disabled={withdrawLoading||!withdrawAmount||parseFloat(withdrawAmount)<50}
                        style={{width:"100%",opacity:(!withdrawAmount||parseFloat(withdrawAmount)<50)?0.5:1}}>
                        {withdrawLoading?"Processing...":"🏦 Request Withdrawal"}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN PAGE ── */}
      {page === "admin" && isAdmin && (
        <div className="page">
          <div className="page-inner">
            <div className="ptitle">Admin Panel</div>
            <div className="sgrid">
              <div className="sct"><div className="sv">{adminUsers.length}</div><div className="sl">Total Users</div></div>
              <div className="sct"><div className="sv">{adminUsers.filter(u => u.premium).length}</div><div className="sl">Premium</div></div>
              <div className="sct"><div className="sv">{adminUsers.filter(u => u.premiumPending).length}</div><div className="sl">Pending</div></div>
              <div className="sct"><div className="sv">{adminUsers.reduce((a, u) => a + (u.usageCount || 0), 0)}</div><div className="sl">Total Msgs</div></div>
            </div>
            <div className="sec">New Users (7d)</div>
            <div className="scard" style={{ padding: "14px 16px" }}>
              <div className="gbar">
                {adminGraph.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                      <div style={{ width: "100%", height: Math.max(4, (d.v / maxG) * 56) + "px", background: "var(--grad)", borderRadius: "4px 4px 0 0", transition: "height .3s" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--mt)" }}>{d.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="sec">Users</div>
            <div className="sbar"><Ico.Search /><input placeholder="Search users..." value={aSearch} onChange={e => setASearch(e.target.value)} /></div>
            {filtAdminU.map(u => (
              <div key={u.id} className="ucard">
                <div className="uav">{(u.name || u.email || "?")[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name || "No name"}</div>
                  <div style={{ fontSize: 11, color: "var(--mt)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                  <div style={{ fontSize: 11, color: "var(--mt)", marginTop: 2 }}>{u.usageCount || 0} msgs · {fmtDate(u.createdAt)}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  {u.premium && <span className="badge">PRO</span>}
                  {u.premiumPending && <span className="badge-y">Pending</span>}
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => viewUserChat(u)} style={{ background: "none", border: "1px solid var(--bd)", borderRadius: 8, color: "var(--mt)", cursor: "pointer", fontSize: 11, padding: "3px 7px" }}>Chat</button>
                    <button onClick={() => adminToggle(u.id, u.premium)} style={{ background: "var(--grad)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 11, padding: "3px 7px" }}>{u.premium ? "Revoke" : "Grant"}</button>
                    <button onClick={() => adminDelUser(u.id)} style={{ background: "none", border: "1px solid #ef4444", borderRadius: 8, color: "#ef4444", cursor: "pointer", fontSize: 11, padding: "3px 7px" }}>Del</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AI COMMAND CENTER PAGE (PART 5) ── */}
      {page === "cmdcenter" && isAdmin && (() => {
        const QUICK_CMDS = [
          { label: "💰 Today Revenue", cmd: "Show today's revenue" },
          { label: "👥 Total Users", cmd: "Show total users" },
          { label: "⏳ Pending W/D", cmd: "Show pending withdrawals" },
          { label: "🏆 Top Agents", cmd: "Show top selling agents" },
          { label: "📊 Platform Stats", cmd: "Show complete platform statistics" },
          { label: "✅ Approve All W/D", cmd: "Approve all pending withdrawals" },
          { label: "🔔 Notify Users", cmd: "Send notification to all users" },
        ];
        return (
          <div className="page" style={{ display:"flex", flexDirection:"column", height:"100%" }}>

            {/* ── TOP HEADER ── */}
            <div style={{ padding:"10px 14px 0", flexShrink:0 }}>
              <div style={{ background:"var(--grad)", borderRadius:18, padding:"14px 16px", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:"#fff" }}>⚡ AI Command Center</div>
                  <div style={{ fontSize:11, color:"#ffffff80", marginTop:2 }}>Type commands — AI executes with your confirmation</div>
                </div>
                <button onClick={async () => { await generateDailyReport(); setShowReportModal(true); }} disabled={cmdReportLoading}
                  style={{ padding:"8px 14px", borderRadius:12, background:"#ffffff25", border:"1px solid #ffffff50", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Inter,sans-serif", flexShrink:0 }}>
                  {cmdReportLoading ? "⏳ Loading..." : "📊 Full Report"}
                </button>
              </div>

              {/* ── Email Search Box ── */}
              <div style={{ background:"var(--sf)", border:"1.5px solid var(--bd)", borderRadius:14, padding:"10px 14px", marginBottom:10, display:"flex", gap:8, alignItems:"center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mt)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  placeholder="Search user by email... (e.g. user@gmail.com)"
                  style={{ flex:1, background:"none", border:"none", outline:"none", color:"var(--tx)", fontSize:13, fontFamily:"Inter,sans-serif" }}
                  onKeyDown={async e => {
                    if (e.key === "Enter" && e.target.value.includes("@")) {
                      const email = e.target.value.trim();
                      setCmdLoading(true);
                      const found = await searchUserByEmail(email);
                      setCmdLoading(false);
                      if (found) {
                        setUserSearchResult(found);
                        setCmdHistory(h => [...h, { role:"user", text:`Search user: ${email}`, ts: Date.now() }, {
                          role:"ai",
                          text:`👤 User Found!\n\nName: ${found.name||"—"}\nEmail: ${found.email}\nPremium: ${found.premium?"✅ Yes":"❌ No"}\nMessages Used: ${found.usageCount||0}\nJoined: ${found.createdAt?.seconds?new Date(found.createdAt.seconds*1000).toLocaleDateString("en-IN"):"N/A"}\nUID: ${found.id}`,
                          ts: Date.now()
                        }]);
                        e.target.value = "";
                      } else {
                        setCmdHistory(h => [...h, { role:"user", text:`Search user: ${email}`, ts: Date.now() }, { role:"ai", text:`❌ No user found with email: ${email}`, ts: Date.now() }]);
                        e.target.value = "";
                      }
                    }
                  }}
                />
                <span style={{ fontSize:10, color:"var(--mt)" }}>↵ Enter</span>
              </div>

              {/* ── Scheduled Report Toggle ── */}
              <div style={{ background:"var(--sf)", border:"1px solid var(--bd)", borderRadius:14, padding:"10px 14px", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:16 }}>🗓</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--tx)" }}>Scheduled Daily Report</div>
                    <div style={{ fontSize:10, color:"var(--mt)" }}>{scheduledReportEnabled ? "Auto-generates every day at 9 AM IST" : "Enable to auto-generate daily reports"}</div>
                  </div>
                </div>
                <div className={"tgl" + (scheduledReportEnabled ? " on" : "")} onClick={async () => {
                  const next = !scheduledReportEnabled;
                  setScheduledReportEnabled(next);
                  try { await setDoc(doc(db, "adminConfig", "settings"), { scheduledReport: next, updatedAt: serverTimestamp() }, { merge: true }); } catch {}
                  if (next) {
                    setCmdHistory(h => [...h, { role:"system", text:"✅ Scheduled Report enabled! Daily report will auto-generate at 9 AM IST.", ts: Date.now() }]);
                  }
                }}><div className="tk" /></div>
              </div>

              {/* ── Quick Command Pills — Click to RUN ── */}
              <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:8, marginBottom:4 }}>
                {QUICK_CMDS.map((item, i) => (
                  <button key={i} onClick={() => processCommand(item.cmd)}
                    style={{ flexShrink:0, padding:"7px 14px", borderRadius:20, border:"1.5px solid var(--bd)", background:"var(--sf2)", color:"var(--mt)", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"Inter,sans-serif", whiteSpace:"nowrap", transition:"all .15s" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";e.currentTarget.style.background="var(--glow)";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--bd)";e.currentTarget.style.color="var(--mt)";e.currentTarget.style.background="var(--sf2)";}}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── MIDDLE: Chat History ── */}
            <div style={{ flex:1, overflowY:"auto", padding:"0 14px", display:"flex", flexDirection:"column", gap:10 }}>
              {cmdHistory.length === 0 && !cmdReportLoading && (
                <div style={{ textAlign:"center", padding:"30px 20px", color:"var(--mt)" }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>⚡</div>
                  <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:6 }}>AI Command Center</div>
                  <div style={{ fontSize:13, lineHeight:1.7, marginBottom:16 }}>
                    Full platform data is available to the AI.<br/>
                    Tap any quick pill or type a command below.
                  </div>
                  <div style={{ fontSize:12, color:"var(--accent)", fontWeight:600 }}>
                    ☝️ Tap any pill above — get instant answers!
                  </div>
                </div>
              )}

              {cmdHistory.map((msg, i) => (
                <div key={i} style={{ display:"flex", flexDirection:"column", alignItems: msg.role==="user" ? "flex-end" : "flex-start" }}>
                  <div style={{ fontSize:10, color:"var(--mt)", marginBottom:3, paddingLeft:4, paddingRight:4 }}>
                    {msg.role==="user" ? "You" : msg.role==="system" ? "⚙️ System" : "⚡ AI"}
                    <span style={{ marginLeft:6, opacity:.6 }}>{new Date(msg.ts).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                  <div style={{
                    maxWidth:"88%", padding:"10px 14px", borderRadius:16, fontSize:13, lineHeight:1.7,
                    background: msg.role==="user" ? "var(--grad)" : msg.role==="system" ? (msg.text.startsWith("✅")?"#22c55e15":"#ef444415") : "var(--sf)",
                    color: msg.role==="user" ? "#fff" : msg.role==="system" ? (msg.text.startsWith("✅")?"#22c55e":"#ef4444") : "var(--tx)",
                    border: msg.role==="system" ? "1px solid "+(msg.text.startsWith("✅")?"#22c55e40":"#ef444440") : msg.role==="ai" ? "1px solid var(--bd)" : "none",
                    whiteSpace:"pre-wrap", wordBreak:"break-word"
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Pending Action Confirm Card */}
              {cmdPending && (
                <div style={{ background:"var(--sf)", border:"2px solid var(--accent)", borderRadius:18, padding:"16px", marginTop:4 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--accent)", marginBottom:6, textTransform:"uppercase", letterSpacing:".05em" }}>⚡ Action Confirmation Required</div>
                  <div style={{ fontSize:13, color:"var(--tx)", marginBottom:14, lineHeight:1.6 }}>{cmdPending.confirmMsg}</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => executeCmdAction(cmdPending.action, cmdPending.params)}
                      style={{ flex:1, padding:"10px", borderRadius:12, border:"none", background:"var(--grad)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Inter,sans-serif", boxShadow:"0 3px 12px var(--glow)" }}>
                      ✅ Confirm & Execute
                    </button>
                    <button onClick={() => { setCmdPending(null); setCmdHistory(h=>[...h,{role:"system",text:"⚠️ Action cancelled.",ts:Date.now()}]); }}
                      style={{ padding:"10px 16px", borderRadius:12, border:"1px solid var(--bd)", background:"none", color:"var(--mt)", fontSize:13, cursor:"pointer", fontFamily:"Inter,sans-serif" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {cmdLoading && (
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px" }}>
                  <SaraswatiLogo size={20} animate={true} state="thinking" />
                  <div style={{ fontSize:13, color:"var(--mt)" }}>Processing command...</div>
                </div>
              )}
            </div>

            {/* ── BOTTOM: Input Bar ── */}
            <div style={{ padding:"10px 14px 14px", flexShrink:0, borderTop:"1px solid var(--bd)", background:"var(--bg)" }}>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input
                  value={cmdInput}
                  onChange={e => setCmdInput(e.target.value)}
                  onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); processCommand(cmdInput); }}}
                  placeholder="Type a command or search user by email..."
                  style={{ flex:1, padding:"11px 16px", borderRadius:24, border:"1.5px solid var(--bd)", background:"var(--sf)", color:"var(--tx)", fontSize:14, fontFamily:"Inter,sans-serif", outline:"none", transition:"border-color .2s" }}
                  onFocus={e=>e.target.style.borderColor="var(--accent)"}
                  onBlur={e=>e.target.style.borderColor="var(--bd)"}
                />
                <button onClick={() => processCommand(cmdInput)} disabled={cmdLoading || !cmdInput.trim()}
                  style={{ width:44, height:44, borderRadius:"50%", background:"var(--grad)", border:"none", color:"#fff", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px var(--glow)", flexShrink:0, opacity: (!cmdInput.trim()||cmdLoading)?0.5:1, transition:"opacity .2s" }}>
                  ⚡
                </button>
              </div>
            </div>

          </div>
        );
      })()}

      {/* ── FULL REPORT MODAL ── */}
      {showReportModal && cmdReport && (
        <div className="mbg" onClick={() => setShowReportModal(false)} style={{ zIndex: 300 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight:"90vh", overflowY:"auto", textAlign:"left", padding:0, borderRadius:24, overflow:"hidden" }}>
            {/* Header */}
            <div style={{ background:"var(--grad)", padding:"18px 20px 14px", position:"sticky", top:0, zIndex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:"#fff" }}>📊 Daily Business Report</div>
                  <div style={{ fontSize:11, color:"#ffffff80", marginTop:2 }}>{cmdReport.date}</div>
                </div>
                <button onClick={() => setShowReportModal(false)} style={{ background:"#ffffff25", border:"none", borderRadius:"50%", width:32, height:32, color:"#fff", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
              </div>
            </div>
            {/* Metrics Grid */}
            <div style={{ padding:"16px 16px 8px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                {[
                  { label:"Today Revenue", value:"₹"+cmdReport.snap.todayRevenue, color:"#22c55e", icon:"💰" },
                  { label:"Today Sales", value:cmdReport.snap.todaySales, color:"#3b82f6", icon:"🛒" },
                  { label:"Total Users", value:cmdReport.snap.totalUsers, color:"#8b5cf6", icon:"👥" },
                  { label:"Premium Users", value:cmdReport.snap.premiumUsers, color:"#f59e0b", icon:"⭐" },
                  { label:"Total Revenue", value:"₹"+cmdReport.snap.totalRevenue, color:"#22c55e", icon:"📈" },
                  { label:"Platform Commission", value:"₹"+cmdReport.snap.totalCommission, color:"#ef4444", icon:"🏛️" },
                  { label:"Published Agents", value:cmdReport.snap.publishedAgents, color:"#3b82f6", icon:"🤖" },
                  { label:"Pending W/D", value:cmdReport.snap.pendingWithdrawCount, color:"#f97316", icon:"⏳" },
                ].map((m,i) => (
                  <div key={i} style={{ background:"var(--sf2)", border:"1px solid var(--bd)", borderRadius:14, padding:"12px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontSize:16 }}>{m.icon}</span>
                    </div>
                    <div style={{ fontSize:20, fontWeight:800, color:m.color }}>{m.value}</div>
                    <div style={{ fontSize:10, color:"var(--mt)", marginTop:2 }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Top Agents */}
              {cmdReport.snap.topSellingAgents?.length > 0 && (
                <>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--mt)", marginBottom:8, textTransform:"uppercase", letterSpacing:".05em" }}>🏆 Top Selling Agents</div>
                  {cmdReport.snap.topSellingAgents.map((a,i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"var(--sf)", border:"1px solid var(--bd)", borderRadius:10, padding:"9px 12px", marginBottom:6 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:"var(--tx)" }}>{i+1}. {a.name}</span>
                      <span style={{ fontSize:13, fontWeight:800, color:"#22c55e" }}>₹{a.revenue}</span>
                    </div>
                  ))}
                </>
              )}

              {/* Pending Withdrawals */}
              {cmdReport.snap.pendingWithdrawals?.length > 0 && (
                <>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--mt)", margin:"14px 0 8px", textTransform:"uppercase", letterSpacing:".05em" }}>⏳ Pending Withdrawals</div>
                  {cmdReport.snap.pendingWithdrawals.map((w,i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#f59e0b15", border:"1px solid #f59e0b40", borderRadius:10, padding:"9px 12px", marginBottom:6 }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:"var(--tx)" }}>{w.userName||"Creator"}</div>
                        <div style={{ fontSize:10, color:"var(--mt)" }}>{w.upiId}</div>
                      </div>
                      <span style={{ fontSize:15, fontWeight:800, color:"#f59e0b" }}>₹{w.amount}</span>
                    </div>
                  ))}
                </>
              )}

              {/* AI Report Text */}
              <div style={{ fontSize:11, fontWeight:700, color:"var(--mt)", margin:"14px 0 8px", textTransform:"uppercase", letterSpacing:".05em" }}>📝 AI Analysis</div>
              <div style={{ fontSize:13, color:"var(--tx)", lineHeight:1.8, whiteSpace:"pre-wrap", background:"var(--sf2)", border:"1px solid var(--bd)", borderRadius:14, padding:"14px", marginBottom:16 }}>
                {cmdReport.text}
              </div>

              <button className="btn btn-p" onClick={() => setShowReportModal(false)} style={{ width:"100%", marginBottom:8 }}>Close Report</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHAT PAGE ── */}
      {page === "chat" && (
        <>
          <div className="chat" onClick={() => setShowPlusMenu(false)}>
            {msgs.length === 0 && (() => {
              const hr = new Date().getHours();
              const greeting = hr < 12 ? "Good Morning" : hr < 17 ? "Good Afternoon" : hr < 21 ? "Good Evening" : "Good Night";
              const firstName = (userData?.name || user?.displayName || "").split(" ")[0] || "";
              return (
                <div className="welcome">
                  <SaraswatiLogo size={80} animate={true} state="idle" />
                  <h2 style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>
                    {greeting}{firstName ? `, ${firstName}` : ""}
                  </h2>
                  <div className="wsub">What can I help you with today?</div>
                </div>
              );
            })()}

            {msgs.map((m, idx) => (
              <div key={m.id} className="mwrap">
                <div className={"mrow" + (m.role === "user" ? " user" : "")}>
                  {m.role === "ai" && <div className="aiav"><SaraswatiLogo size={18} animate={speakId === m.id} state={speakId === m.id ? "speaking" : "idle"} /></div>}

                  <div className="bwrap" style={{ position: "relative" }}>
                    {m.image && m.role === "user" && (
                      <img src={m.image} alt="sent" className="mimg" onClick={() => setViewerSrc(m.image)} />
                    )}
                    {m.files && m.files.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 5 }}>
                        {m.files.map((f, fi) => (
                          <div key={fi} style={{ background: "var(--sf2)", border: "1px solid var(--bd)", borderRadius: 8, padding: "4px 9px", fontSize: 11, color: "var(--mt)", display: "flex", alignItems: "center", gap: 4 }}>
                            <span>{f.error ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>}</span><span>{f.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={"bub " + m.role}>
                      {m.role === "ai" ? <AIText text={m.text} /> : <span>{m.text}</span>}
                      {m.imageGenerating && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 4px", marginTop: m.text ? 8 : 0 }}>
                          <SaraswatiLogo size={18} animate={true} state="thinking" />
                          <div>
                            <div style={{ fontSize: 13, color: "var(--tx)", fontWeight: 600 }}>Generating image...</div>
                            <div style={{ fontSize: 11, color: "var(--mt)", marginTop: 1 }}>"{m.imagePrompt}"</div>
                          </div>
                        </div>
                      )}
                      {m.image && m.role === "ai" && (
                        <img src={m.image} alt="gen" className="mimg gen" onClick={() => setViewerSrc(m.image)} onError={e => { e.target.src = ""; e.target.style.display = "none"; }} />
                      )}
                      {m.imageFailed && (
                        <div style={{ marginTop: 8 }}>
                          <button
                            onClick={() => { setMsgs(p => p.filter(x => x.id !== m.id)); generateAndAppendImage(m.imagePrompt); }}
                            style={{ padding: "8px 16px", borderRadius: 12, border: "1.5px solid var(--accent)", background: "var(--glow)", color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter,sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                            🔄 Retry Image Generation
                          </button>
                        </div>
                      )}
                      {m.mediaLinks && m.mediaLinks.length > 0 && (
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                          {m.mediaLinks.map((lnk, li) => (
                            <a key={li} href={lnk.url} target="_blank" rel="noopener noreferrer"
                              style={{
                                display: "flex", alignItems: "center", gap: 12,
                                background: "var(--sf2)", border: "1px solid var(--bd)",
                                borderRadius: 14, padding: "10px 14px",
                                textDecoration: "none", color: "var(--tx)",
                                transition: "all .18s", cursor: "pointer"
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = lnk.color; e.currentTarget.style.background = lnk.color + "15"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bd)"; e.currentTarget.style.background = "var(--sf2)"; }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                background: lnk.color, display: "flex", alignItems: "center",
                                justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff"
                              }}>{lnk.icon}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{lnk.platform}</div>
                                <div style={{ fontSize: 11, color: "var(--mt)", marginTop: 1 }}>{lnk.label}</div>
                              </div>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mt)" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="acts">
                      {m.role === "ai" && (
                        <>
                          <button className={"abtn" + (speakId === m.id ? " on" : "")} onClick={() => toggleSpeak(m.id, m.text)} title="Speak">
                            {speakId === m.id ? <Ico.Stop s={13} /> : <Ico.Speak s={13} />}
                          </button>
                          <button className={"abtn" + (copied === m.id ? " on" : "")} onClick={() => copyMsg(m.text, m.id)} title="Copy">
                            {copied === m.id ? <Ico.Check s={13} /> : <Ico.Copy s={13} />}
                          </button>
                          <button className="abtn" onClick={() => regenerateMessage(m.id)} title="Regenerate"><Ico.Regen /></button>
                          <button className="abtn" onClick={() => deleteMessage(m.id)} title="Delete"><Ico.Delete /></button>
                        </>
                      )}
                      {m.role === "user" && (
                        <button className="abtn" onClick={() => deleteMessage(m.id)} title="Delete"><Ico.Delete /></button>
                      )}
                    </div>
                    <div className={"mtime" + (m.role === "user" ? " user" : "")}>{fmtTime(m.time || m.createdAt)}</div>
                  </div>
                </div>
              </div>
            ))}

            {(loading || searching) && (
              <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
                <div className="aiav"><SaraswatiLogo size={18} animate={true} state="thinking" /></div>
                <div className="tbub" style={{ alignItems: "center" }}>
                  <SaraswatiLogo size={16} animate={true} state="thinking" />
                  <span className="think-step">{loadingStep || "Thinking..."}</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Claude-style Input Bar */}
          <div className="ibar" style={{ position: "relative" }}>
            <input ref={galleryRef} id="gallery-input" type="file" accept="image/*" style={{ display: "none" }} onChange={handleGallery} />
            <input ref={fileRef} id="file-input" type="file" accept=".pdf,.docx,.txt,.csv,.md,.json,.log,.xlsx,.xls,.pptx" multiple style={{ display: "none" }} onChange={handleFiles} />

            {/* Upgrade banner - free users only */}
            {!userData?.premium && (
              <div className="ibar-upgrade">
                <span className="ibar-upgrade-txt">Upgrade to Premium for unlimited chats</span>
                <button className="ibar-upgrade-btn" onClick={() => setShowUpgrade(true)}>Upgrade →</button>
              </div>
            )}

            <div className="ibar-box">
              {/* Attachment previews */}
              {(imgPrev || attachments.length > 0) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {imgPrev && (
                    <div className="imgprev">
                      <img src={imgPrev} alt="preview" />
                      <button className="imgprev-x" onClick={() => { setImgB64(null); setImgPrev(null); }}>✕</button>
                    </div>
                  )}
                  {attachments.map((a, i) => (
                    <div key={i} style={{ background: "var(--sf2)", border: "1px solid var(--bd)", borderRadius: 10, padding: "5px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                      <span>{a.error ? "" : "📎"}</span>
                      <span style={{ color: "var(--tx)" }}>{a.name.slice(0, 18)}</span>
                      <button onClick={() => removeAttachment(i)} style={{ background: "#ef4444", border: "none", borderRadius: "50%", color: "#fff", cursor: "pointer", fontSize: 10, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>
                  ))}
                  {attachLoading && <div style={{ fontSize: 12, color: "var(--accent)", alignSelf: "center" }}>Reading file...</div>}
                </div>
              )}

              {/* Textarea */}
              <textarea
                className="tinp"
                placeholder={micActive ? "Listening... (tap mic to stop)" : micBusy ? "Transcribing..." : "Message..."}
                value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 130) + "px"; }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!micActive && !micBusy) sendMsg(); } }}
                rows={1}
                readOnly={micActive || micBusy}
                style={(micActive || micBusy) ? { color: "var(--accent)" } : {}}
              />

              {/* Bottom row */}
              <div className="ibar-bottom" style={{ position: "relative" }}>
                <div className="ibar-left" style={{ position: "relative" }}>
                  {/* Plus menu popup — positioned above + button */}
                  {showPlusMenu && (
                    <>
                      {/* Backdrop */}
                      <div onClick={(e) => { e.stopPropagation(); setShowPlusMenu(false); }}
                        style={{ position: "fixed", inset: 0, zIndex: 98 }} />
                      {/* iOS-style 2-grid card menu */}
                      <div style={{
                        position: "absolute", bottom: "calc(100% + 12px)", left: 0,
                        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
                        zIndex: 99, animation: "fadeUp .18s cubic-bezier(.34,1.56,.64,1)"
                      }} onClick={e => e.stopPropagation()}>
                        {/* Photos Card */}
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); setShowPlusMenu(false); setTimeout(() => galleryRef.current?.click(), 50); }}
                          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            gap: 10, width: 130, height: 120, borderRadius: 22,
                            background: "#1c1c1e", border: "none", cursor: "pointer",
                            boxShadow: "0 8px 32px #0009", padding: 0 }}>
                          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#2c2c2e",
                            display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="#fff" stroke="none"/><path d="m21 15-5-5L5 21"/></svg>
                          </div>
                          <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", fontFamily: "'Inter',sans-serif" }}>Photos</span>
                        </button>
                        {/* Files Card */}
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); setShowPlusMenu(false); setTimeout(() => fileRef.current?.click(), 50); }}
                          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            gap: 10, width: 130, height: 120, borderRadius: 22,
                            background: "#1c1c1e", border: "none", cursor: "pointer",
                            boxShadow: "0 8px 32px #0009", padding: 0 }}>
                          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#2c2c2e",
                            display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="13" x2="12" y2="17"/><line x1="10" y1="15" x2="14" y2="15"/></svg>
                          </div>
                          <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", fontFamily: "'Inter',sans-serif" }}>Files</span>
                        </button>
                      </div>
                    </>
                  )}
                  <button className="ibtn" onClick={(e) => { e.stopPropagation(); setShowPlusMenu(v => !v); }} title="Attach"
                    style={showPlusMenu ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                  <div className="model-pill">Saraswati AI</div>
                </div>
                <div className="ibar-right">
                  {/* STT mic */}
                  <button className={"ibtn" + (micActive ? " rec" : "")} onClick={toggleMic} disabled={micBusy} title={micBusy ? "Transcribing..." : "Voice input"}
                    style={micActive ? { borderColor: "#ef4444", color: "#ef4444", background: "#ef444418" } : micBusy ? { opacity: 0.6 } : {}}>
                    {micBusy ? <SaraswatiLogo size={18} animate={true} state="thinking" /> : <Ico.Mic on={micActive} />}
                  </button>
                  {/* Voice Call — Animated Saffron Lotus */}
                  <button className="ibtn" onClick={openVoiceCall} title="Voice Call"
                    style={{ borderColor: "#ff993340", background: "#ff772210" }}>
                    <SaraswatiLogo size={24} animate={true} state="idle" />
                  </button>
                  {/* Send */}
                  <button className="sbtn"
                    onClick={() => sendMsg()}
                    disabled={loading || micActive || micBusy || (!input.trim() && !imgB64 && !imgPrev && !attachments.length)}>
                    {loading ? <SaraswatiLogo size={18} animate={true} state="thinking" /> : "➤"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
  }
