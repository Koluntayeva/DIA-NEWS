#!/usr/bin/env node
/* Daily feed updater for DIA news.
   1. Reads RSS feeds (Russian + international) about diabetes.
   2. Keeps only new, relevant stories.
   3. With ANTHROPIC_API_KEY (or OPENAI_API_KEY) set: an AI model picks the
      most newsworthy stories, assigns a section and translates the headline and
      a short summary into ru/en/kk/de/es. Without a key: stories are published
      in their original language with keyword-based sections.
   4. Finds a photo for each story on Pexels (PEXELS_API_KEY): by an AI-written
      search phrase, or by the story's section. Also keeps a pool of good
      Pexels photos per section that the site uses as a fallback.
   5. Merges them with the stories already in data/news.js and rewrites it.
   No npm dependencies: Node 20+ only. */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEWS_FILE = path.join(ROOT, "data", "news.js");

const KEEP_DAYS = 30;      // drop stories older than this
const MAX_ITEMS = 40;      // stories kept in the feed
const MAX_NEW = 12;        // new stories added per run
const MAX_CANDIDATES = 40; // candidates sent to the AI per run
const LANGS = ["ru", "en", "kk", "de", "es"];
const CATS = ["research", "approval", "devices", "drugs", "access", "market", "events", "community"];
const STAGES = ["phase1", "phase12", "phase2", "phase3", "early", "approved", "cleared", "launch", "results", "report", "survey", "policy", "conference", "campaign", "community"];

const gn = (q, hl, gl) => `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:3d")}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl.split("-")[0]}`;
const FEEDS = [
  { name: "Google News RU", url: gn("диабет", "ru", "RU"), lang: "ru" },
  { name: "Google News KZ", url: gn("диабет", "ru", "KZ"), lang: "ru" },
  { name: "Google News EN", url: gn("diabetes (insulin OR CGM OR FDA OR trial OR study)", "en-US", "US"), lang: "en" },
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/health_medicine/diabetes.xml", lang: "en" },
  { name: "Medical Xpress", url: "https://medicalxpress.com/rss-feed/diabetes-news/", lang: "en" },
  { name: "FDA", url: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml", lang: "en", mustMatch: true },
  { name: "Breakthrough T1D", url: "https://www.breakthrought1d.org/feed/", lang: "en" },
];

/* Pexels search phrases per section: used for the fallback pool and when the AI gave no phrase */
const CAT_QUERIES = {
  devices: ["continuous glucose monitor arm", "insulin pump", "blood glucose meter"],
  drugs: ["insulin pen", "medicine pills hand", "pharmacist medication"],
  research: ["scientist laboratory", "microscope research", "lab pipette"],
  approval: ["doctor patient consultation", "medical documents doctor", "hospital doctor tablet"],
  access: ["pharmacy shelves", "clinic reception patient", "doctor elderly patient"],
  market: ["medical technology", "pharmaceutical production", "healthcare business meeting"],
  events: ["medical conference audience", "conference speaker stage", "doctors meeting"],
  community: ["family healthy lifestyle", "people walking park", "blood sugar test finger"],
};
const POOL_SIZE = 8;       // fallback photos per section
const POOL_DAYS = 30;      // refresh the fallback pool this often

const RELEVANT = /диабет|инсулин|глюкоз|сахарн\w* (диабет|кров)|гликем|diabet|insulin|glucose|glycem|HbA1c|CGM|GLP-1|semaglutide|tirzepatide|islet|T1D|T2D/i;

/* ---------- helpers ---------- */
const log = (...a) => console.log("[news]", ...a);
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const decode = (s) => String(s || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const stripTags = (s) => decode(decode(s)).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i")); return m ? m[1] : ""; };
const cut = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s);

function parseFeed(xml, feed) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    let title = stripTags(tag(b, "title"));
    let link = stripTags(tag(b, "link"));
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? decode(m[1]) : ""; }
    const desc = stripTags(tag(b, "description") || tag(b, "summary") || tag(b, "content"));
    const when = stripTags(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date"));
    let src = stripTags(tag(b, "source")) || feed.name;
    // Google News titles end with " - Outlet"
    if (feed.url.includes("news.google.com")) {
      const m = title.match(/^(.*)\s+[-–—]\s+([^-–—]+)$/);
      if (m) { title = m[1].trim(); src = m[2].trim(); }
    }
    const d = new Date(when);
    const date = isNaN(d) ? today() : d.toISOString().slice(0, 10);
    let text = desc;
    if (norm(text).startsWith(norm(title))) text = ""; // Google News repeats the title
    return { title, url: link, text: cut(text, 400), date, src, lang: feed.lang, feed: feed.name, mustMatch: feed.mustMatch };
  }).filter((x) => x.title && /^https?:\/\//.test(x.url));
}

async function fetchFeed(feed) {
  try {
    const r = await fetch(feed.url, { headers: { "user-agent": "Mozilla/5.0 (compatible; DIA-news-bot/1.0)", accept: "application/rss+xml, application/xml, text/xml, */*" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const items = parseFeed(await r.text(), feed);
    log(`${feed.name}: ${items.length}`);
    return items;
  } catch (e) {
    log(`${feed.name}: failed (${e.message})`);
    return [];
  }
}

function loadCurrent() {
  try {
    const ctx = {};
    vm.runInNewContext(fs.readFileSync(NEWS_FILE, "utf8") + "\nthis.out=DIA_NEWS;", ctx);
    return ctx.out;
  } catch (e) {
    log("could not read data/news.js:", e.message);
    return { demo: true, items: [], stats: null, posts: [], events: [] };
  }
}

/* ---------- classification without AI ---------- */
function guessCat(s) {
  const t = s.toLowerCase();
  if (/fda|одобр|approv|clearance|регистрац|разрешен/.test(t)) return "approval";
  if (/конгресс|конференц|congress|conference|symposium|ada \d|easd|форум/.test(t)) return "events";
  if (/цен|компенсац|льгот|бесплатн|обеспечен|price|cost|access|reimburs|insurance|medicare/.test(t)) return "access";
  if (/cgm|датчик|сенсор|помп|sensor|pump|monitor|device|устройств|libre|dexcom|omnipod/.test(t)) return "devices";
  if (/рын|акци|выручк|market|shares|revenue|sales|acqui/.test(t)) return "market";
  if (/исследова|учён|ученые|study|trial|research|scientist|researchers/.test(t)) return "research";
  if (/препарат|инсулин|таблет|semaglutide|tirzepatide|ozempic|mounjaro|drug|insulin|glp-1|metformin/.test(t)) return "drugs";
  return "community";
}
function guessStage(s, cat) {
  const t = s.toLowerCase();
  if (/phase 3|фаз\w* 3|phase iii/.test(t)) return "phase3";
  if (/phase 2|фаз\w* 2|phase ii/.test(t)) return "phase2";
  if (/phase 1|фаз\w* 1/.test(t)) return "phase1";
  if (cat === "approval") return /fda clear|разрешен/.test(t) ? "cleared" : "approved";
  if (cat === "events") return "conference";
  if (cat === "access") return "policy";
  if (cat === "research") return "results";
  if (cat === "community") return "community";
  return "";
}

/* ---------- AI selection + translation ---------- */
const PROMPT = (cands) => `You edit DIA news, a multilingual news site about diabetes (type 1 and type 2) for patients and families.
Below are candidate stories from RSS feeds (title, snippet, source, date). Pick up to ${MAX_NEW} that are genuinely about diabetes and newsworthy: research, regulatory approvals, drugs, devices, access and prices, market, conferences, community. Skip ads, horoscopes, vague lifestyle listicles, folk remedies, miracle cures, and duplicates (keep only one story per event). Prefer variety of sections and sources.

For each pick return:
- "i": the candidate number
- "cat": one of ${JSON.stringify(CATS)}
- "stage": one of ${JSON.stringify(STAGES)} or "" if none fits
- "title": headline in 5 languages {"ru","en","kk","de","es"} (kk = Kazakh in Cyrillic), faithful to the original, no clickbait
- "text": 1–2 sentence summary in the same 5 languages
- "photo": 2–4 English words to search a stock photo library for a realistic, high-quality illustrative photo of the story's subject (e.g. "insulin pen close-up", "scientist microscope", "child glucose sensor", "pharmacy shelves"). Concrete objects or scenes only: no brand names, no real people's names, no text, no abstract ideas

Use ONLY facts present in the candidate's title and snippet. Do not invent numbers, names, phases or dates. If the snippet is thin, keep the summary short and general. Translate drug and device names correctly; keep brand names as is.

Reply with JSON only: {"picks":[...]}.

Candidates:
${cands.map((c, i) => `#${i} [${c.date}] (${c.src}) ${c.title}${c.text ? "\n   " + c.text : ""}`).join("\n")}`;

async function callAI(prompt) {
  if (process.env.ANTHROPIC_API_KEY) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5", max_tokens: 16000, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(180000),
    });
    if (!r.ok) throw new Error("Anthropic HTTP " + r.status + ": " + (await r.text()).slice(0, 300));
    const j = await r.json();
    return j.content.filter((c) => c.type === "text").map((c) => c.text).join("");
  }
  if (process.env.OPENAI_API_KEY) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + process.env.OPENAI_API_KEY },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(180000),
    });
    if (!r.ok) throw new Error("OpenAI HTTP " + r.status + ": " + (await r.text()).slice(0, 300));
    const j = await r.json();
    return j.choices[0].message.content;
  }
  return null;
}

function langObj(o, fallback) {
  const out = {};
  for (const l of LANGS) if (o && typeof o[l] === "string" && o[l].trim()) out[l] = o[l].trim();
  if (!out.ru && !out.en) out[fallback.lang === "ru" ? "ru" : "en"] = fallback.value;
  return out;
}

async function aiPick(cands) {
  let raw;
  try { raw = await callAI(PROMPT(cands)); } catch (e) { log("AI failed:", e.message); return null; }
  if (raw == null) return null;
  try {
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return (json.picks || []).filter((p) => cands[p.i]).slice(0, MAX_NEW).map((p) => {
      const c = cands[p.i];
      return {
        ...c,
        cat: CATS.includes(p.cat) ? p.cat : guessCat(c.title + " " + c.text),
        stage: STAGES.includes(p.stage) ? p.stage : "",
        title: langObj(p.title, { lang: c.lang, value: c.title }),
        text: langObj(p.text, { lang: c.lang, value: c.text }),
        photoQuery: typeof p.photo === "string" ? p.photo.trim().slice(0, 60) : "",
      };
    });
  } catch (e) {
    log("AI reply was not valid JSON:", e.message);
    return null;
  }
}

function plainPick(cands) {
  const perSrc = {};
  return cands.filter((c) => { perSrc[c.src] = (perSrc[c.src] || 0) + 1; return perSrc[c.src] <= 3; }).slice(0, MAX_NEW).map((c) => {
    const cat = guessCat(c.title + " " + c.text);
    const L = c.lang === "ru" ? "ru" : "en";
    return { ...c, cat, stage: guessStage(c.title + " " + c.text, cat), title: { [L]: c.title }, text: c.text ? { [L]: c.text } : { [L]: "" } };
  });
}

/* ---------- main ---------- */
const cur = loadCurrent();
const old = (cur.items || []).filter((x) => !/^d\d+$/.test(x.id) && x.date >= daysAgo(KEEP_DAYS)); // drop demo items
const seenUrl = new Set(old.map((x) => x.url));
const seenTitle = new Set(old.flatMap((x) => Object.values(x.title || {}).map(norm)));

const fetched = (await Promise.all(FEEDS.map(fetchFeed))).flat();
const cands = [];
for (const c of fetched.sort((a, b) => b.date.localeCompare(a.date))) {
  if (c.date < daysAgo(3) || c.date > daysAgo(-1)) continue;
  if (!RELEVANT.test(c.title + " " + c.text)) continue;
  const k = norm(c.title);
  if (seenUrl.has(c.url) || seenTitle.has(k)) continue;
  seenUrl.add(c.url); seenTitle.add(k);
  cands.push(c);
}
log(`fetched ${fetched.length}, new candidates ${cands.length}`);

let picks = cands.length ? await aiPick(cands.slice(0, MAX_CANDIDATES)) : [];
if (picks == null) { log("no AI key or AI error: publishing originals without translation"); picks = plainPick(cands); }

/* ---------- photos (Pexels) ---------- */
const PEXELS = process.env.PEXELS_API_KEY;
async function pexels(query, n = 15) {
  if (!PEXELS || !query) return [];
  try {
    const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&size=large&per_page=${n}`, { headers: { authorization: PEXELS }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    return (j.photos || []).filter((ph) => ph.width >= 1600 && ph.width > ph.height);
  } catch (e) { log(`Pexels "${query}": ${e.message}`); return []; }
}
const toPhoto = (ph) => ({
  id: ph.id,
  url: `https://images.pexels.com/photos/${ph.id}/pexels-photo-${ph.id}.jpeg?auto=compress&cs=tinysrgb&w=1200`,
  credit: ph.photographer,
  license: "Pexels",
  link: ph.url,
  alt: ph.alt || "",
});

// fallback pool per section
let photoPool = cur.photoPool || null;
const poolFresh = photoPool && photoPool.date >= daysAgo(POOL_DAYS) && CATS.every((c) => (photoPool[c] || []).length >= 3);
if (PEXELS && !poolFresh) {
  const pool = { date: today() }, taken = new Set();
  for (const c of CATS) {
    pool[c] = [];
    for (const q of CAT_QUERIES[c]) {
      for (const ph of await pexels(q, 12)) {
        if (pool[c].length >= POOL_SIZE) break;
        if (taken.has(ph.id) || pool[c].filter((x) => x.q === q).length >= Math.ceil(POOL_SIZE / CAT_QUERIES[c].length)) continue;
        taken.add(ph.id); pool[c].push({ ...toPhoto(ph), q });
      }
    }
    pool[c] = pool[c].map(({ q, ...ph }) => ph);
    log(`photo pool ${c}: ${pool[c].length}`);
  }
  if (CATS.some((c) => pool[c].length)) photoPool = pool;
}

const stamp = new Date().toISOString();
const fresh = picks.map((p) => {
  const id = "n" + Buffer.from(p.url).toString("base64url").slice(-10);
  const it = { id, cat: p.cat, stage: p.stage || undefined, date: p.date, added: stamp, title: p.title, text: p.text, url: p.url, src: p.src, photoQuery: p.photoQuery || "" };
  if (!it.stage) delete it.stage;
  return it;
});

let items = [...fresh, ...old].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.added || "").localeCompare(String(a.added || ""))).slice(0, MAX_ITEMS);

// a photo for every story that has none yet (new ones, and older ones from before photos existed)
let photosAdded = 0;
if (PEXELS) {
  const used = new Set(items.filter((x) => x.photo && x.photo.id).map((x) => x.photo.id));
  // older stories have no AI search phrase yet: ask for all of them in one call
  const need = items.filter((x) => !x.photo && !x.photoTried && !x.photoQuery);
  if (need.length) {
    try {
      const raw = await callAI(`For each news headline about diabetes, give 2–4 English words to search a stock photo library for a realistic, high-quality illustrative photo (concrete objects or scenes only: no brand names, no real people's names, no text). Reply with JSON only: {"q":["...", ...]} in the same order.\n\n${need.map((x, i) => `${i}. ${x.title.en || x.title.ru}`).join("\n")}`);
      if (raw) { const q = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)).q || []; need.forEach((x, i) => { if (typeof q[i] === "string") x.photoQuery = q[i].trim().slice(0, 60); }); }
    } catch (e) { log("AI photo phrases failed:", e.message); }
  }
  for (const it of items) {
    if (it.photo || it.photoTried) continue;
    const queries = [it.photoQuery, ...CAT_QUERIES[it.cat] || []].filter(Boolean);
    let got = null;
    for (const q of queries) {
      const ph = (await pexels(q)).find((x) => !used.has(x.id));
      if (ph) { got = toPhoto(ph); break; }
    }
    if (got) { used.add(got.id); it.photo = got; photosAdded++; } else it.photoTried = true;
  }
  log(`photos added: ${photosAdded}`);
} else log("no PEXELS_API_KEY: stories use the site's built-in photos");

const poolChanged = JSON.stringify(photoPool) !== JSON.stringify(cur.photoPool || null);
if (!items.length) { log("nothing to publish; data/news.js left unchanged"); process.exit(0); }
if (!fresh.length && !photosAdded && !poolChanged) { log("no new stories or photos today; data/news.js left unchanged"); process.exit(0); }

const out = { demo: false, updated: stamp, items, stats: cur.stats || null, posts: cur.posts || [], events: cur.events || [], photoPool };
const file = `/* The feed. Generated by scripts/update-news.mjs (GitHub Actions, daily). Manual edits to items may be overwritten.
   items[]: {id, cat, stage, date:"YYYY-MM-DD", added?, title, text, facts?:[{k,v}], body?, url?, src?, photo?:{url,credit,license,link}}
            cat is one of CATS in js/i18n.js; title/text/body/k/v are {ru,en,kk,de,es} objects (missing languages fall back to en, then ru).
            photo: set by the script from Pexels; to use your own photo, set photo.url to "assets/photos/<file>" (the script never replaces an existing photo).
   photoPool: {date, <cat>: [photo...]}: Pexels photos per section, used when a story has no photo of its own.
   posts[]: {date, ru, kk}: the Telegram post box in the rail. Empty hides it.
   events[]: {name, start, end?, place?, url?}: the conference calendar. Empty hides it. */
const DIA_NEWS=${JSON.stringify(out, null, 1)};
`;
fs.writeFileSync(NEWS_FILE, file);
log(`wrote ${items.length} stories (${fresh.length} new, ${photosAdded} photos)`);
