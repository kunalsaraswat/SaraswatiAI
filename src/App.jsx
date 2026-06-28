import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult
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
function needsImageGen(t) { return ["image banao","photo banao","tasveer banao","picture banao","draw","generate image","sketch","wallpaper","logo banao","poster"].some(k => t.toLowerCase().includes(k)); }
function extractPrompt(t) { let p = t.toLowerCase(); ["image banao","photo banao","tasveer banao","picture banao","generate image of","generate image","draw a","draw","sketch","wallpaper","logo banao","poster","ki","ka","of"].forEach(k => { p = p.split(k).join(" "); }); return p.trim() || t; }
function getImgUrl(p) { return `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=768&height=768&seed=${Math.floor(Math.random() * 99999)}&nologo=true`; }
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
    label: "YouTube pe search karo"
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
      return `${commodity} ke rates abhi available nahi hain${state ? ` ${state} mein` : ""}. Kripya Agmarknet.gov.in ya apni local mandi check karein.`;
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
      .replace(/weather|mausam|temperature|temp|kitna|degree|bata|hai|kya|ka|ki|ke|mein|mere|gaon|village|sheher|city/gi, " ")
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
  const toneMap = { friendly: "Warm aur friendly raho.", professional: "Professional aur formal raho.", funny: "Funny raho, jokes bhi karo.", strict: "Strict raho, sirf topic pe raho." };
  const agentSys = agent ? `You are ${agent.emoji} ${agent.name}.
${agent.instructions || "Be helpful."}
Tone: ${toneMap[agent.tone] || "Friendly raho."}
${langInstruction}
Never break character. Stay focused on your role.${memCtx}${ctx}` : null;

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
For media/video/cartoon/movie/song requests: give direct YouTube/platform links always.${memCtx}${ctx}${extraNote}`;

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
  return /^(remember (that|this|:)?|save (this|that|to memory)|note (that|this)|yaad rakho|yaad kar|memory mein daal|store (this|that))/.test(t);
}

// Extract the fact from "remember that I am a developer" → "User is a developer"
function extractExplicitFact(text) {
  return text
    .replace(/^(remember (that|this|:)?|save (this|that|to memory)|note (that|this)|yaad rakho|yaad kar|memory mein daal|store (this|that))\s*/i, "")
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
.desktop-sb{display:none;}

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

/* Desktop - full layout */
@media (min-width: 900px) {
  body { display: flex; min-height: 100vh; overflow: hidden; }
  .app { max-width: 100%; width: 100%; flex-direction: row; }
  .app-main { flex: 1; display: flex; flex-direction: column; height: 100vh; overflow: hidden; min-width: 0; }
  .desktop-sidebar { position: relative; width: 260px; min-width: 260px; max-width: 260px; height: 100vh; border-right: 1px solid var(--bd); display: flex; flex-direction: column; background: var(--navBg, #0e0e0e); overflow-y: auto; flex-shrink: 0; }
  .desktop-sb { position: relative !important; width: 260px !important; min-width: 260px !important; max-width: 260px !important; height: 100vh !important; border-right: 1px solid var(--bd) !important; flex-direction: column !important; animation: none !important; z-index: 1 !important; flex-shrink: 0 !important; overflow-y: auto !important; }
  .sb-overlay { display: none !important; }
  .hide-desktop { display: none !important; } .desktop-sb { display: flex !important; }
  .hdr { padding-left: 20px; padding-right: 20px; }
  .chat { padding: 20px 8%; max-width: 860px; margin: 0 auto; width: 100%; }
  .ibar { padding-left: 8%; padding-right: 8%; max-width: 860px; margin: 0 auto; width: 100%; }
  .welcome { padding: 60px 20%; }
  .wsub { max-width: 360px; }
  .auth { padding: 40px; }
  .card { max-width: 440px; width: 100%; }
  .mbg { align-items: center; }
  .modal { max-width: 580px; border-radius: 20px; }
  .page { padding: 24px 6%; max-width: 900px; }
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
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [forgot, setForgot] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", pass: "", newPass: "", confirmPass: "" });
  const [ferr, setFerr] = useState(""); const [fok, setFok] = useState(""); const [fload, setFload] = useState(false);
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
  const [activeAgent, setActiveAgent] = useState(null); // {id, name, emoji, instructions, tone, lang}
  const [showAgentBuilder, setShowAgentBuilder] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentForm, setAgentForm] = useState({ name: "", emoji: "🤖", instructions: "", tone: "friendly", lang: "hindi" });
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
      alert("Is browser mein microphone support nahi hai.");
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
          alert("Voice transcribe nahi ho paya: " + (err?.message || "try again"));
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
        alert("Microphone permission required.\n\nSteps:\n1. Chrome address bar mein lock icon tap karo\n2. Microphone → Allow karo\n3. Page reload karo\n4. Phir mic try karo");
      } else {
        alert("Mic start nahi ho saka: " + (err?.message || "unknown error"));
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
      alert("Is browser mein microphone support nahi hai.");
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
        alert("Microphone permission required.\n\nSteps:\n1. Chrome address bar mein lock icon tap karo\n2. Microphone → Allow karo\n3. Page reload karo\n4. Phir voice call karo");
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
      alert("Voice Call ke liye is browser mein microphone support nahi hai.");
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
      alert("Voice Call ke liye is browser mein microphone support nahi hai.");
      return;
    }
    try {
      const probeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      probeStream.getTracks().forEach(t => t.stop());
    } catch (e) {
      alert("Microphone permission required.\n\nSteps:\n1. Chrome address bar mein lock icon tap karo\n2. Microphone → Allow karo\n3. Page reload karo\n4. Phir voice call karo");
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
      setLoading(true);
      const prompt = extractPrompt(msgText);
      const url = getImgUrl(prompt);
      await new Promise(r => setTimeout(r, 500));
      const tid = "img_" + Date.now();
      const aiText = '🎨 Here is your image — "' + prompt + '"';
      setLoading(false);
      setMsgs(p => [...p, { id: tid, role: "ai", text: aiText, image: url, time: new Date() }]);
      await addDoc(collection(db, "messages"), { sessionId: sid, userId: user.uid, role: "ai", text: aiText, image: url, createdAt: serverTimestamp() });
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
    const msgText = txt || (attachments.length ? "Is file ko padho aur samjhao." : "What is in this image?");
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
      setAgentForm({ name: "", emoji: "🤖", instructions: "", tone: "friendly", lang: "hindi" });
    } catch (e) { alert("Save failed: " + e.message); }
  }

  async function deleteAgent(id) {
    try { await deleteDoc(doc(db, "agents", id)); await loadAgents(user.uid); } catch {}
  }

  function startAgent(agent) {
    setActiveAgent(agent);
    newChat();
    setShowSb(false);
  }

  function stopAgent() { setActiveAgent(null); }

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
          if (!params.title || !params.body) { resultMsg = "❌ Notification title and body required."; break; }
          const uSnap2 = await getDocs(collection(db, "users"));
          for (const ud of uSnap2.docs.slice(0, 100)) {
            await addDoc(collection(db, "notifications"), { userId: ud.id, title: params.title, body: params.body, read:false, createdAt: serverTimestamp(), type:"broadcast" });
          }
          resultMsg = `✅ Notification sent to ${Math.min(uSnap2.size,100)} users!`;
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
      // Gather live data
      const snap = await gatherPlatformSnapshot();

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

You can answer questions about platform data OR help admin take actions.

For ACTIONS (approve withdraw, send email, etc.), format your response with:
ACTION: <action_type>
PARAMS: <json params>
CONFIRM: <user-friendly confirmation message>

Action types: approve_withdraw, reject_withdraw, send_email, send_notification, suspend_agent, approve_agent

For INFO queries, just answer clearly with the data.
Keep responses concise, professional, in Hinglish or English based on user's language.`;

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
        const confirmMsg = confirmMatch?.[1] || "Is action ko execute karna chahte ho?";
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
      const report = d.choices?.[0]?.message?.content || "Report generate nahi ho saki.";

      // Save report to Firestore
      const dateKey = new Date().toISOString().split("T")[0];
      await setDoc(doc(db, "adminReports", dateKey), { report, snapshot: snap, generatedAt: serverTimestamp(), date: dateKey }, { merge:true });

      setCmdReport({ text: report, snap, date: today });
      setCmdReportDate(dateKey);
    } catch (e) { console.error("Report error:", e); }
    setCmdReportLoading(false);
  }

  function newChat() { setSid(Date.now().toString()); setMsgs([]); setPage("chat"); setShowSb(false); setImgB64(null); setImgPrev(null); endVoice(); setReactions({}); setSessionTone(null); }

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
              <div className="card-head">{authMode === "login" ? "Welcome Back 👋" : "Create Account ✨"}</div>
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
              {authMode === "signup" && <div className="iw"><div className="ilbl">Name</div><input className="inp" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>}
              <div className="iw"><div className="ilbl">Email</div><input className="inp" type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="iw"><div className="ilbl">Password</div><input className="inp" type="password" placeholder="Min 8 characters" value={form.pass} onChange={e => setForm(f => ({ ...f, pass: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAuth()} /></div>
              {ferr && <div className="err">{ferr}</div>}
              <button className="btn btn-p" onClick={handleAuth} disabled={fload}>{fload ? "Please wait..." : authMode === "login" ? "Login →" : "Create Account →"}</button>
              {authMode === "login" && <div className="lnk" style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }} onClick={() => { setForgot(true); setFerr(""); setFok(""); }}>Forgot password?</div>}
            </>
          )}
        </div>
        {!forgot && <div className="lnk">{authMode === "login" ? <><span style={{ color: "var(--mt)" }}>No account? </span><span onClick={() => { setAuthMode("signup"); setFerr(""); }}>Sign up</span></> : <><span style={{ color: "var(--mt)" }}>Have account? </span><span onClick={() => { setAuthMode("login"); setFerr(""); }}>Login</span></>}</div>}
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
          <div className="sidebar hide-desktop">
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
              {[
                { id: "chat", icon: <Ico.Chat />, label: "Chat" },
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
              {/* ── MY AGENTS SECTION ── */}
              <div className="sb-section" style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>🤖 My Agents</span>
                <span onClick={() => { setEditingAgent(null); setAgentForm({ name: "", emoji: "🤖", instructions: "", tone: "friendly", lang: "hindi" }); setShowAgentBuilder(true); }}
                  style={{ fontSize: 18, cursor: "pointer", color: "var(--accent)", fontWeight: 700, lineHeight: 1 }}>+</span>
              </div>
              {agents.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--mt)", padding: "6px 14px" }}>Koi agent nahi — + se banao</div>
              )}
              {agents.map(agent => (
                <div key={agent.id} className={"sb-item" + (activeAgent?.id === agent.id ? " active" : "")}
                  style={{ justifyContent: "space-between" }}>
                  <span onClick={() => startAgent(agent)} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <span style={{ fontSize: 18 }}>{agent.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{agent.name}</span>
                  </span>
                  <span style={{ display: "flex", gap: 4 }}>
                    <span onClick={() => { setEditingAgent(agent); setAgentForm({ name: agent.name, emoji: agent.emoji, instructions: agent.instructions, tone: agent.tone, lang: agent.lang }); setShowAgentBuilder(true); }}
                      style={{ fontSize: 12, color: "var(--mt)", cursor: "pointer", padding: "2px 5px" }}>✏️</span>
                    <span onClick={() => deleteAgent(agent.id)}
                      style={{ fontSize: 12, color: "#ef4444", cursor: "pointer", padding: "2px 5px" }}>🗑</span>
                  </span>
                </div>
              ))}
              {activeAgent && (
                <div onClick={stopAgent} style={{ fontSize: 12, color: "#ef4444", padding: "4px 14px", cursor: "pointer" }}>
                  ✕ {activeAgent.emoji} {activeAgent.name} band karo
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
            <h3 style={{ textAlign: "center", marginBottom: 16 }}>{editingAgent ? "Agent Edit Karo" : "Naya Agent Banao"}</h3>

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
              <textarea className="inp iarea" rows={4} placeholder="Jaise: Tum ek doctor ho. Sirf health se related sawaalon ka jawab do. Hindi mein baat karo. Medical advice clearly do."
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
              {editingAgent ? "✅ Update Agent" : "🚀 Agent Banao"}
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
            <button className="btn btn-p" onClick={() => setLegalModal(null)} style={{ marginTop: 16 }}>Samajh Gaya ✓</button>
          </div>
        </div>
      )}

      {/* ── UPGRADE MODAL ── */}
      {showUpgrade && (
        <div className="mbg" onClick={() => { setShowUpgrade(false); setPayDone(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {payDone ? (
              <>
                <div className="mi">✅</div>
                <h3>Payment Sent!</h3>
                <p>Screenshot bhejo WhatsApp pe — 30 min mein activate ho jayega!</p>
                <button className="btn btn-p" onClick={() => window.open("https://wa.me/91" + UPI + "?text=Maine%20Saraswati%20AI%20Premium%20ke%20liye%20payment%20kiya%20hai", "_blank")}>📲 WhatsApp karo</button>
                <button className="btn btn-s" onClick={() => { setShowUpgrade(false); setPayDone(false); }}>Close</button>
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
                <button className="btn btn-p" onClick={() => { window.open("upi://pay?pa=" + UPI + "@upi&pn=SaraswatiAI&am=" + (upgradePlan === "monthly" ? "99" : "29") + "&cu=INR", "_blank"); setPayDone(true); }}>💳 Pay Now</button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className={"btn btn-s" + (upgradePlan === "monthly" ? " " : "")} style={{ flex: 1, opacity: upgradePlan === "monthly" ? 1 : 0.6 }} onClick={() => setUpgradePlan("monthly")}>Monthly ₹99</button>
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
            <p>Ye action permanent hai. Saara data delete ho jayega. Type <strong>DELETE</strong> to confirm.</p>
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

      {/* ── DESKTOP SIDEBAR (always visible) ── */}
      <div className="sidebar desktop-sb" id="desktopSidebar">
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
              {[
                { id: "chat", icon: <Ico.Chat />, label: "Chat" },
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
              {/* ── MY AGENTS SECTION ── */}
              <div className="sb-section" style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>🤖 My Agents</span>
                <span onClick={() => { setEditingAgent(null); setAgentForm({ name: "", emoji: "🤖", instructions: "", tone: "friendly", lang: "hindi" }); setShowAgentBuilder(true); }}
                  style={{ fontSize: 18, cursor: "pointer", color: "var(--accent)", fontWeight: 700, lineHeight: 1 }}>+</span>
              </div>
              {agents.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--mt)", padding: "6px 14px" }}>Koi agent nahi — + se banao</div>
              )}
              {agents.map(agent => (
                <div key={agent.id} className={"sb-item" + (activeAgent?.id === agent.id ? " active" : "")}
                  style={{ justifyContent: "space-between" }}>
                  <span onClick={() => startAgent(agent)} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <span style={{ fontSize: 18 }}>{agent.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{agent.name}</span>
                  </span>
                  <span style={{ display: "flex", gap: 4 }}>
                    <span onClick={() => { setEditingAgent(agent); setAgentForm({ name: agent.name, emoji: agent.emoji, instructions: agent.instructions, tone: agent.tone, lang: agent.lang }); setShowAgentBuilder(true); }}
                      style={{ fontSize: 12, color: "var(--mt)", cursor: "pointer", padding: "2px 5px" }}>✏️</span>
                    <span onClick={() => deleteAgent(agent.id)}
                      style={{ fontSize: 12, color: "#ef4444", cursor: "pointer", padding: "2px 5px" }}>🗑</span>
                  </span>
                </div>
              ))}
              {activeAgent && (
                <div onClick={stopAgent} style={{ fontSize: 12, color: "#ef4444", padding: "4px 14px", cursor: "pointer" }}>
                  ✕ {activeAgent.emoji} {activeAgent.name} band karo
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
      {/* ── HEADER ── */}
      <div className="hdr">
        <button className="dots hide-desktop" onClick={() => { setShowSb(true); if (user) loadHists(); }}>
          <Ico.Menu />
        </button>
        <div className="hdr-name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SaraswatiLogo size={26} animate={false} state="idle" />
          {page === "chat" ? (activeAgent ? `${activeAgent.emoji} ${activeAgent.name}` : "Saraswati AI") : page === "history" ? "History" : page === "settings" ? "Settings" : page === "admin" ? "Admin" : page === "projects" ? "Projects" : page === "memory" ? "Memory" : page === "cmdcenter" ? "⚡ AI Command Center" : "Saraswati AI"}
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
        <button className="dots" onClick={() => setShowProfile(true)}>
          {pPhotoUrl
            ? <img src={pPhotoUrl} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: `2px solid ${accentColor}` }} />
            : <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${accentColor},#ea580c)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 12 }}>{displayName[0]?.toUpperCase()}</div>
          }
        </button>
      </div>

      {/* ── VOICE PAGE ── */}
      {/* ── VOICE CALL FULLSCREEN OVERLAY ── */}
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
                {filtHists.length} result{filtHists.length !== 1 ? "s" : ""} — title aur messages dono mein search ho raha hai
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
                      Message mein milا: "...{(() => {
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
                <div style={{ fontSize: 14, marginBottom: 8 }}>Koi memory nahi hai abhi</div>
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
                <div className="stxt"><div className="slbl">Saraswati AI</div><div className="sdesc">Made with ❤️ by Kunal Saraswat</div></div>
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
          "Show today's revenue",
          "Show total users",
          "Show pending withdrawals",
          "Show top selling agents",
          "Approve all pending withdrawals",
          "Send notification to all users",
          "Generate daily report",
        ];
        return (
          <div className="page" style={{ display:"flex", flexDirection:"column", height:"100%" }}>

            {/* ── TOP: Daily Report Button ── */}
            <div style={{ padding:"10px 14px 0", flexShrink:0 }}>
              <div style={{ background:"var(--grad)", borderRadius:18, padding:"14px 16px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:"#fff" }}>⚡ AI Command Center</div>
                  <div style={{ fontSize:11, color:"#ffffff80", marginTop:2 }}>Type commands — AI executes with your confirmation</div>
                </div>
                <button onClick={generateDailyReport} disabled={cmdReportLoading}
                  style={{ padding:"8px 14px", borderRadius:12, background:"#ffffff25", border:"1px solid #ffffff50", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Inter,sans-serif", flexShrink:0 }}>
                  {cmdReportLoading ? "..." : "📊 Report"}
                </button>
              </div>

              {/* Daily Report Card */}
              {cmdReport && (
                <div style={{ background:"var(--sf)", border:"1px solid var(--bd)", borderRadius:18, padding:"16px", marginBottom:12, maxHeight:260, overflowY:"auto" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"var(--tx)" }}>📊 Daily Report</div>
                    <div style={{ fontSize:10, color:"var(--mt)" }}>{cmdReport.date}</div>
                  </div>
                  {/* Snap metrics row */}
                  <div style={{ display:"flex", gap:8, overflowX:"auto", marginBottom:12 }}>
                    {[
                      { label:"Today Revenue", value:"₹"+cmdReport.snap.todayRevenue, color:"#22c55e" },
                      { label:"Today Sales", value:cmdReport.snap.todaySales, color:"#3b82f6" },
                      { label:"Total Users", value:cmdReport.snap.totalUsers, color:"#8b5cf6" },
                      { label:"Pending W/D", value:cmdReport.snap.pendingWithdrawCount, color:"#f59e0b" },
                    ].map((m,i) => (
                      <div key={i} style={{ flexShrink:0, background:"var(--sf2)", border:"1px solid var(--bd)", borderRadius:12, padding:"8px 12px", textAlign:"center" }}>
                        <div style={{ fontSize:16, fontWeight:800, color:m.color }}>{m.value}</div>
                        <div style={{ fontSize:9, color:"var(--mt)", marginTop:2, whiteSpace:"nowrap" }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Report text */}
                  <div style={{ fontSize:12, color:"var(--tx)", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{cmdReport.text}</div>
                </div>
              )}

              {/* Quick Command Pills */}
              <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:8, marginBottom:8 }}>
                {QUICK_CMDS.map((cmd, i) => (
                  <button key={i} onClick={() => { setCmdInput(cmd); }}
                    style={{ flexShrink:0, padding:"6px 12px", borderRadius:20, border:"1.5px solid var(--bd)", background:"var(--sf2)", color:"var(--mt)", fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"Inter,sans-serif", whiteSpace:"nowrap", transition:"all .15s" }}
                    onMouseEnter={e=>{e.target.style.borderColor="var(--accent)";e.target.style.color="var(--accent)";}}
                    onMouseLeave={e=>{e.target.style.borderColor="var(--bd)";e.target.style.color="var(--mt)";}}>
                    {cmd}
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
                    Platform ka poora data AI ke paas hai.<br/>
                    Koi bhi command type karo — AI execute karega.
                  </div>
                  <div style={{ fontSize:12, color:"var(--accent)", fontWeight:600 }}>
                    💡 Quick pills se try karo ↑
                  </div>
                </div>
              )}

              {cmdHistory.map((msg, i) => (
                <div key={i} style={{ display:"flex", flexDirection:"column", alignItems: msg.role==="user" ? "flex-end" : "flex-start" }}>
                  {/* Role label */}
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

              {/* Loading indicator */}
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
                  placeholder="Type a command... (e.g. 'Show today revenue')"
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

            {/* ── AGENT ARCHITECTURE REGISTRY ── */}
            <div style={{ padding:"0 14px 20px", flexShrink:0 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--mt)", marginBottom:8, textTransform:"uppercase", letterSpacing:".05em" }}>🏗 Agent Architecture — Scalable Modules</div>
              <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
                {Object.entries(AGENT_REGISTRY).map(([key, ag]) => (
                  <div key={key}
                    style={{ flexShrink:0, background:"var(--sf)", border:"1px solid "+(ag.status==="ready"?"var(--accent)":"var(--bd)"), borderRadius:14, padding:"10px 12px", minWidth:130, cursor:"default" }}>
                    <div style={{ fontSize:22, marginBottom:5 }}>{ag.icon}</div>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--tx)" }}>{ag.label}</div>
                    <div style={{ fontSize:9, color: ag.status==="ready"?"var(--accent)":"var(--mt)", fontWeight:700, marginTop:2, marginBottom:4 }}>
                      {ag.status==="ready" ? "✓ READY" : "◷ PLANNED"}
                    </div>
                    <div style={{ fontSize:9, color:"var(--mt)", lineHeight:1.5 }}>{ag.desc}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        );
      })()}

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
                      {m.image && m.role === "ai" && (
                        <img src={m.image} alt="gen" className="mimg gen" onClick={() => setViewerSrc(m.image)} onError={e => { e.target.src = ""; e.target.style.display = "none"; }} />
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
