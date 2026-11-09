#!/usr/bin/env node
/* Daily feed updater for DIA news.
   1. Reads RSS feeds (Russian + international) about diabetes.
   2. Keeps only new, relevant stories.
   3. With ANTHROPIC_API_KEY (or OPENAI_API_KEY) set: an AI model picks the
      most newsworthy stories, assigns a section and translates the headline and
      a short summary into ru/en/kk/de/es. Without a key: stories are published
      in their original language with keyword-based sections.
   4. Finds a photo for each story on Unsplash (UNSPLASH_ACCESS_KEY; or Pexels,
      PEXELS_API_KEY) by an AI-written search phrase, or by the story's section.
      Also keeps a pool of good photos per section that the site uses as a fallback.
   5. For each story the AI reads the source article (web fetch/search tools)
      and writes a full retelling in 5 languages (the "Read more" text).
   6. Merges them with the stories already in data/news.js and rewrites it.
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
const CATS = ["cure", "research", "approval", "devices", "drugs", "access", "market", "events", "community"];
const STAGES = ["phase1", "phase12", "phase2", "phase3", "early", "approved", "cleared", "launch", "results", "report", "survey", "policy", "conference", "campaign", "community"];

const gn = (q, hl, gl) => `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:3d")}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl.split("-")[0]}`;
const FEEDS = [
  { name: "Google News RU", url: gn("диабет", "ru", "RU"), lang: "ru" },
  { name: "Google News KZ", url: gn("диабет", "ru", "KZ"), lang: "ru" },
  { name: "Google News EN", url: gn("diabetes (insulin OR CGM OR FDA OR trial OR study)", "en-US", "US"), lang: "en" },
  { name: "Google News cure EN", url: gn("(islet transplant OR \"stem cell\" islets OR tegoprubart OR zimislecel OR hypoimmune OR \"beta cell\") type 1 diabetes", "en-US", "US"), lang: "en" },
  { name: "Google News cure RU", url: gn("(островковых клеток OR стволовые клетки OR бета-клетки OR излечение) диабет 1 типа", "ru", "RU"), lang: "ru" },
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/health_medicine/diabetes.xml", lang: "en" },
  { name: "Medical Xpress", url: "https://medicalxpress.com/rss-feed/diabetes-news/", lang: "en" },
  { name: "FDA", url: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml", lang: "en", mustMatch: true },
  { name: "Breakthrough T1D", url: "https://www.breakthrought1d.org/feed/", lang: "en" },
];

/* Pexels search phrases per section: used for the fallback pool and when the AI gave no phrase */
const CAT_QUERIES = {
  cure: ["pancreatic islet cells microscope", "laboratory test tubes", "cell culture petri dish"],
  devices: ["continuous glucose monitor sensor", "insulin pump device", "blood glucose meter"],
  drugs: ["insulin pen", "medicine pills", "pharmacy shelves medicine"],
  research: ["laboratory microscope", "lab pipette test tubes", "scientific laboratory equipment"],
  approval: ["medical documents stethoscope", "pharmaceutical packaging", "medicine vials"],
  access: ["pharmacy shelves", "hospital corridor", "prescription medicine box"],
  market: ["medical technology device", "pharmaceutical production line", "medicine packaging"],
  events: ["conference hall seats", "auditorium stage", "medical conference badge"],
  community: ["healthy breakfast vegetables", "running shoes park", "glucose meter test strips"],
};
// photos with people are skipped for local stories (a stranger of another look would contradict the place), and for the fallback pool
const PEOPLE = /\b(person|people|man|men|woman|women|girl|boy|child|children|kid|hand|hands|finger|doctor|nurse|patient|guy|lady|someone|family|couple|crowd|face|portrait|arm)s?\b/i;
const LOCAL_TLD = /\.(ru|kz|by|uz|kg|tj|az|am|ge|md|ua|su|xn--p1ai)$/i;
function isLocal(it) {
  if (it.local) return true;
  try { return LOCAL_TLD.test(new URL(it.url).hostname); } catch (e) { return false; }
}
const POOL_SIZE = 6;       // fallback photos per section
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
  if (/islet|островк|stem.cell|стволов|hypoimmune|tegoprubart|zimislecel|beta.cell|бета-клет|излечен|cure/.test(t)) return "cure";
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

The section "cure" is the site's priority: research that can give people with type 1 diabetes a real chance to live without insulin (islet transplantation, stem-cell-derived islets, hypoimmune/gene-edited cells, immune tolerance, beta-cell regeneration, companies like Vertex, Eledon/tegoprubart, Sana, CRISPR, Sernova). Always pick such stories when they are substantive, and put them in "cure".

For each pick return:
- "i": the candidate number
- "cat": one of ${JSON.stringify(CATS)}
- "stage": one of ${JSON.stringify(STAGES)} or "" if none fits
- "title": headline in 5 languages {"ru","en","kk","de","es"} (kk = Kazakh in Cyrillic), faithful to the original, no clickbait
- "text": 1–2 sentence summary in the same 5 languages
- "photo": 2–4 English words to search a stock photo library for a realistic, high-quality illustrative photo of the story's subject (if the story is about a specific patient or person, or about a specific city, region or country, describe objects or a setting with NO people, so the photo never contradicts who or where the story is about)
- "local": true if the story is about a specific city, region or country (local news), else false (e.g. "insulin pen close-up", "scientist microscope", "child glucose sensor", "pharmacy shelves"). Concrete objects or scenes only: no brand names, no real people's names, no text, no abstract ideas

Already published on the site (do NOT pick another story about the same event or announcement, even from a different outlet or with different wording):
${old.slice(0, 40).map((x) => "- " + (x.title.ru || x.title.en)).join("\n") || "- (none)"}

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

/* ---------- Google News links -> the original article address ---------- */
async function resolveGoogleNews(url) {
  if (!/news\.google\.com\/(rss\/)?articles\//.test(url)) return url;
  const id = url.split("/articles/")[1].split("?")[0];
  // old-style ids carry the address inside the base64 payload
  try {
    const raw = Buffer.from(id.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("latin1");
    const m = raw.match(/https?:\/\/[\x21-\x7e]+/);
    if (m && !raw.includes("AU_yqL")) return m[0];
  } catch (e) {}
  // new-style ids: ask Google News for the address (the same call its own redirect page makes)
  try {
    const ua = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36" };
    const page = await (await fetch(`https://news.google.com/articles/${id}`, { headers: ua, signal: AbortSignal.timeout(15000) })).text();
    const sg = (page.match(/data-n-a-sg="([^"]+)"/) || [])[1], ts = (page.match(/data-n-a-ts="([^"]+)"/) || [])[1];
    if (!sg || !ts) return url;
    const req = [[["Fbv4je", `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`, null, "generic"]]];
    const r = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST", headers: { ...ua, "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: "f.req=" + encodeURIComponent(JSON.stringify(req)), signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    // reply: )]}'  then lines of JSON; the "Fbv4je" entry holds a JSON string ["garturlres","<address>",...]
    for (const line of text.split("\n")) {
      if (!line.includes("garturlres")) continue;
      try {
        for (const row of JSON.parse(line)) if (row[1] === "Fbv4je" && row[2]) { const inner = JSON.parse(row[2]); if (/^https?:\/\//.test(inner[1])) return inner[1]; }
      } catch (e) {}
    }
  } catch (e) { log("Google News link:", e.message); }
  return url;
}
async function resolveAll(items) {
  let n = 0;
  for (const it of items) {
    if (!it.url.includes("news.google.")) continue;
    const real = await resolveGoogleNews(it.url);
    if (real !== it.url) { it.url = real; n++; if (it.bodyTried && !it.body) { delete it.bodyTried; } }
  }
  log(`Google News links resolved: ${n}`);
}

/* ---------- full text: the AI reads the source article and retells it ---------- */
const MAX_BODIES = Number(process.env.MAX_BODIES || 14); // articles read per run (cost control)
async function writeBody(it) {
  const t = it.title.ru || it.title.en || Object.values(it.title)[0];
  const prompt = `You write for DIA news, a multilingual news site about diabetes for patients and families.
Story: "${t}" (outlet: ${it.src}, date: ${it.date})
Link: ${it.url}

1. Read the original article. Fetch the link; if it is a Google News link or does not open, search the web for the headline and outlet and fetch the original article page.
2. Retell it IN YOUR OWN WORDS (never copy sentences, no quotes longer than a few words): 180–320 words in 3–5 short paragraphs separated by a blank line. Neutral news style: what happened and when, who, the key details and numbers, caveats or limitations, what happens next. Use ONLY facts from the article; give numbers, doses, phases and dates exactly as in the article. No medical advice.
3. Give the same text in 5 languages: ru, en, kk (Kazakh, Cyrillic), de, es.
4. Optionally 1–3 key figures from the article as facts: [{"k":{"ru","en","kk","de","es"},"v":{"ru","en","kk","de","es"}}].
5. If you found the original article at a different address than the link, put it in "url".

If you cannot open the article or it is not about this story, reply only <none/>.
Otherwise reply at the very end in exactly this format (plain text inside the tags, no JSON, no markdown):
<url>original article address</url>
<ru>текст</ru>
<en>text</en>
<kk>мәтін</kk>
<de>Text</de>
<es>texto</es>
<facts>[{"k":{"ru":"...","en":"...","kk":"...","de":"...","es":"..."},"v":{"ru":"...","en":"...","kk":"...","de":"...","es":"..."}}]</facts>`;
  let messages = [{ role: "user", content: prompt }];
  for (let turn = 0; turn < 4; turn++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5", max_tokens: 16000, messages,
        tools: [
          { type: "web_fetch_20250910", name: "web_fetch", max_uses: 3, max_content_tokens: 8000 },
          { type: "web_search_20250305", name: "web_search", max_uses: 2 },
        ],
      }),
      signal: AbortSignal.timeout(240000),
    });
    if (!r.ok) throw new Error("Anthropic HTTP " + r.status + ": " + (await r.text()).slice(0, 300));
    const j = await r.json();
    if (j.stop_reason === "pause_turn") { messages = [...messages, { role: "assistant", content: j.content }]; continue; }
    const text = j.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    if (j.stop_reason === "max_tokens") throw new Error("reply too long");
    const tag = (n) => { const all = [...text.matchAll(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`, "g"))]; return all.length ? all[all.length - 1][1].trim() : ""; };
    const body = {};
    for (const l of LANGS) { const v = tag(l); if (v) body[l] = v; }
    if (!body.ru && !body.en) { if (/<none\s*\/>/.test(text)) return { body: null }; throw new Error("no text in reply"); }
    let facts = [];
    try { facts = JSON.parse(tag("facts") || "[]"); } catch (e) {}
    return { body, facts, url: tag("url") };
  }
  throw new Error("too many turns");
}
async function addBodies(items) {
  if (!process.env.ANTHROPIC_API_KEY) return 0;
  const order = [...items].sort((a, b) => String(b.added || "").localeCompare(String(a.added || "")))
    .filter((it) => !it.body && !it.bodyTried && (it.bodyTries || 0) < 2).slice(0, MAX_BODIES);
  let done = 0, next = 0;
  async function worker() {
    while (next < order.length) {
      const it = order[next++];
      try {
        const res = await writeBody(it);
        if (res && res.body && (res.body.ru || res.body.en)) {
          it.body = langObj(res.body, { lang: "en", value: res.body.en || res.body.ru });
          if (Array.isArray(res.facts) && res.facts.length) it.facts = res.facts.slice(0, 3).filter((f) => f && f.k && f.v);
          if (typeof res.url === "string" && /^https?:\/\//.test(res.url) && !res.url.includes("news.google.")) it.url = res.url;
          delete it.bodyTries; done++;
        } else it.bodyTried = true;
      } catch (e) { log(`full text "${(it.title.ru || it.title.en || "").slice(0, 40)}": ${e.message}`); it.bodyTries = (it.bodyTries || 0) + 1; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, order.length) }, worker)); // 4 articles at a time
  log(`full texts written: ${done} of ${order.length}`);
  return done;
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
        local: p.local === true,
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
const old = (cur.items || []).filter((x) => !/^d\d+$/.test(x.id) && (x.pin || x.date >= daysAgo(KEEP_DAYS))); // drop demo items; pinned stories stay
const seenUrl = new Set(old.map((x) => x.url));
const seenTitle = new Set(old.flatMap((x) => Object.values(x.title || {}).map(norm)));
// stories shown before (incl. removed duplicates) never come back
for (const k of cur.seen || []) { seenUrl.add(k); seenTitle.add(k); }

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

/* ---------- photos: Unsplash (UNSPLASH_ACCESS_KEY) or Pexels (PEXELS_API_KEY) ---------- */
const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS = process.env.PEXELS_API_KEY;
const PHOTO_ON = !!(UNSPLASH || PEXELS);
// Unsplash demo apps get 50 API calls per hour: stay under it; what is left is done on the next run
let budget = UNSPLASH ? Number(process.env.UNSPLASH_BUDGET || 45) : 1000;
let rateLimited = false;
const UTM = "utm_source=dia_news&utm_medium=referral";

async function searchPhotos(query, n = 20) {
  if (!query || budget <= 0 || rateLimited) return [];
  budget--;
  try {
    if (UNSPLASH) {
      const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high&per_page=${n}`, { headers: { authorization: "Client-ID " + UNSPLASH, "accept-version": "v1" }, signal: AbortSignal.timeout(20000) });
      if (r.status === 403 || r.status === 429) { rateLimited = true; throw new Error(`HTTP ${r.status}, remaining ${r.headers.get("x-ratelimit-remaining")}/${r.headers.get("x-ratelimit-limit")}: ${(await r.text()).slice(0, 120)}`); }
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      return (j.results || []).filter((ph) => !ph.premium && !ph.plus && ph.width >= 2000 && ph.width > ph.height).map((ph) => ({
        id: "u_" + ph.id,
        url: ph.urls.raw + (ph.urls.raw.includes("?") ? "&" : "?") + "w=1200&q=80&fm=jpg&fit=max",
        credit: ph.user.name,
        license: "Unsplash",
        link: ph.links.html + "?" + UTM,
        alt: ph.alt_description || "",
        _track: ph.links.download_location,
      }));
    }
    const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&size=large&per_page=${n}`, { headers: { authorization: PEXELS }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    return (j.photos || []).filter((ph) => ph.width >= 1600 && ph.width > ph.height).map((ph) => ({
      id: ph.id,
      url: `https://images.pexels.com/photos/${ph.id}/pexels-photo-${ph.id}.jpeg?auto=compress&cs=tinysrgb&w=1200`,
      credit: ph.photographer, license: "Pexels", link: ph.url, alt: ph.alt || "",
    }));
  } catch (e) { log(`photo search "${query}": ${e.message}`); return []; }
}
// prefer the result whose description shares the most words with the query (the first hit is often off-topic)
const STOP = new Set(["a", "an", "the", "of", "on", "in", "with", "and", "for", "to", "up", "close"]);
const stem = (w) => w.toLowerCase().replace(/s$/, "");
function bestMatch(list, query, used) {
  const qw = norm(query).split(" ").filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
  let best = null, bestScore = -1;
  list.forEach((ph, i) => {
    if (used.has(ph.id)) return;
    const aw = new Set(norm(ph.alt).split(" ").map(stem));
    const score = qw.filter((w) => aw.has(w)).length * 10 - i; // matches first, then search rank
    if (score > bestScore) { best = ph; bestScore = score; }
  });
  return best;
}
// Unsplash asks apps to report each photo they use (API guidelines)
async function usePhoto(ph) {
  const { _track, ...clean } = ph;
  if (_track && budget > 0 && !rateLimited) {
    budget--;
    try { await fetch(_track, { headers: { authorization: "Client-ID " + UNSPLASH }, signal: AbortSignal.timeout(15000) }); } catch (e) {}
  }
  return clean;
}

const stamp = new Date().toISOString();
const fresh = picks.map((p) => {
  const id = "n" + Buffer.from(p.url).toString("base64url").slice(-10);
  const it = { id, cat: p.cat, stage: p.stage || undefined, date: p.date, added: stamp, title: p.title, text: p.text, url: p.url, src: p.src, photoQuery: p.photoQuery || "", local: p.local || undefined };
  if (!it.stage) delete it.stage;
  return it;
});

const byNew = (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.added || "").localeCompare(String(a.added || ""));
const pinned = old.filter((x) => x.pin);
let items = [...pinned, ...[...fresh, ...old.filter((x) => !x.pin)].sort(byNew).slice(0, Math.max(0, MAX_ITEMS - pinned.length))].sort(byNew);

// 1) a photo for every story that has none yet (new ones first, then older ones)
let photosAdded = 0;
let photoPool = cur.photoPool || null;
if (PHOTO_ON) {
  const used = new Set(items.filter((x) => x.photo && x.photo.id).map((x) => x.photo.id));
  for (const c of CATS) for (const ph of (photoPool && photoPool[c]) || []) used.add(ph.id);
  // older stories have no AI search phrase yet: ask for all of them in one call
  const need = items.filter((x) => !x.photo && !x.photoTried && !x.photoQuery);
  if (need.length) {
    try {
      const raw = await callAI(`For each news headline about diabetes, give 2–4 English words to search a stock photo library for a realistic, high-quality illustrative photo (concrete objects or settings only, with NO people: no brand names, no text). Reply with JSON only: {"q":["...", ...]} in the same order.\n\n${need.map((x, i) => `${i}. ${x.title.en || x.title.ru}`).join("\n")}`);
      if (raw) { const q = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)).q || []; need.forEach((x, i) => { if (typeof q[i] === "string") x.photoQuery = q[i].trim().slice(0, 60); }); }
    } catch (e) { log("AI photo phrases failed:", e.message); }
  }
  const order = [...items].sort((a, b) => String(b.added || "").localeCompare(String(a.added || "")));
  for (const it of order) {
    if (it.photo || it.photoTried) continue;
    if (budget < 2 || rateLimited) break;            // the rest waits for the next run
    const queries = [it.photoQuery, CAT_QUERIES[it.cat]?.[0]].filter(Boolean);
    let got = null, searched = 0;
    for (const q of queries) {
      if (budget < 2) break;
      searched++;
      const local = isLocal(it);
      const qq = local && PEOPLE.test(q) ? CAT_QUERIES[it.cat]?.[0] || q : q;
      const ph = bestMatch((await searchPhotos(qq)).filter((x) => !local || !PEOPLE.test(x.alt)), qq, used);
      if (ph) { got = await usePhoto(ph); break; }
    }
    if (got) { used.add(got.id); it.photo = got; photosAdded++; }
    else if (searched === queries.length && !rateLimited) it.photoTried = true;
  }
  log(`photos added: ${photosAdded}`);

  // 2) fallback pool per section, filled bit by bit with whatever budget is left
  const stale = !photoPool || !(photoPool.date >= daysAgo(POOL_DAYS));
  const pool = stale ? { date: today() } : { ...photoPool };
  const prev = stale ? (photoPool || {}) : {};
  for (const c of CATS) {
    pool[c] = stale ? [] : [...(pool[c] || [])];
    if (pool[c].length >= POOL_SIZE || budget < 3 || rateLimited) { if (stale && !pool[c].length) pool[c] = prev[c] || []; continue; }
    const q = CAT_QUERIES[c][pool[c].length % CAT_QUERIES[c].length];
    for (const ph of (await searchPhotos(q, 30)).filter((x) => !PEOPLE.test(x.alt))) {
      if (pool[c].length >= POOL_SIZE || budget < 1) break;
      if (used.has(ph.id)) continue;
      used.add(ph.id); pool[c].push(await usePhoto(ph));
    }
    if (stale && pool[c].length < 3 && (prev[c] || []).length) pool[c] = prev[c]; // keep the old pool until the new one is usable
    log(`photo pool ${c}: ${pool[c].length}`);
  }
  photoPool = pool;
  log(`photo API calls left this hour: ${budget}${rateLimited ? " (rate limited)" : ""}`);
} else log("no UNSPLASH_ACCESS_KEY / PEXELS_API_KEY: stories use the site's built-in photos");

await resolveAll(items);
const bodiesAdded = await addBodies(items);
const dupIds = new Set();
// the same article reached via two feeds: keep the newer copy (with a photo/full text if only one has it)
{
  const byUrl = new Map();
  for (const it of items) {
    const prev = byUrl.get(it.url);
    if (!prev) { byUrl.set(it.url, it); continue; }
    const keep = (prev.body ? 2 : 0) + (prev.photo ? 1 : 0) >= (it.body ? 2 : 0) + (it.photo ? 1 : 0) ? prev : it;
    byUrl.set(it.url, keep);
  }
  const before = items.length;
  for (const it of items) if (byUrl.get(it.url) !== it) dupIds.add(it.id);
  items = items.filter((it) => byUrl.get(it.url) === it);
  if (items.length < before) log(`duplicates removed: ${before - items.length}`);
}

/* ---------- archive: stories leaving the main feed are kept forever, one JSON file per month ---------- */
const ARCHIVE_DIR = path.join(ROOT, "data", "archive");
function archiveStories(list) {
  if (!list.length) return 0;
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const byMonth = {};
  for (const x of list) (byMonth[String(x.date || today()).slice(0, 7)] ||= []).push(x);
  for (const [m, add] of Object.entries(byMonth)) {
    const f = path.join(ARCHIVE_DIR, m + ".json");
    let have = [];
    try { have = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) {}
    const map = new Map(have.map((x) => [x.id, x]));
    for (const x of add) map.set(x.id, x);
    fs.writeFileSync(f, JSON.stringify([...map.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)))));
  }
  const months = fs.readdirSync(ARCHIVE_DIR).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort().reverse()
    .map((f) => ({ month: f.slice(0, 7), count: JSON.parse(fs.readFileSync(path.join(ARCHIVE_DIR, f), "utf8")).length }));
  fs.writeFileSync(path.join(ARCHIVE_DIR, "index.json"), JSON.stringify({ updated: new Date().toISOString(), months }, null, 1));
  return list.length;
}
let archivedCount = 0;
{
  const keep = new Set(items.map((x) => x.id));
  const leaving = [...(cur.items || []), ...fresh].filter((x) => x && x.id && !/^d\d+$/.test(x.id) && !keep.has(x.id) && !dupIds.has(x.id));
  archivedCount = archiveStories(leaving);
  if (archivedCount) log(`archived: ${archivedCount}`);
}

const poolChanged = JSON.stringify(photoPool) !== JSON.stringify(cur.photoPool || null);
if (!items.length) { log("nothing to publish; data/news.js left unchanged"); process.exit(0); }
if (!fresh.length && !photosAdded && !poolChanged && !bodiesAdded && !archivedCount) { log("no new stories or photos today; data/news.js left unchanged"); process.exit(0); }

const seen = [...new Set([...items.flatMap((x) => [x.url, norm(x.title.ru || ""), norm(x.title.en || "")]), ...(cur.seen || [])])].filter(Boolean).slice(0, 1500);
const out = { demo: false, updated: stamp, items, seen, stats: cur.stats || null, posts: cur.posts || [], events: cur.events || [], photoPool };
const file = `/* The feed. Generated by scripts/update-news.mjs (GitHub Actions, daily). Manual edits to items may be overwritten.
   items[]: {id, cat, stage, date:"YYYY-MM-DD", added?, title, text, facts?:[{k,v}], body?, url?, src?, photo?:{url,credit,license,link}}
            cat is one of CATS in js/i18n.js; title/text/body/k/v are {ru,en,kk,de,es} objects (missing languages fall back to en, then ru).
            photo: set by the script from Unsplash (or Pexels); to use your own photo, set photo.url to "assets/photos/<file>" (the script never replaces an existing photo).
   photoPool: {date, <cat>: [photo...]}: Unsplash/Pexels photos per section, used when a story has no photo of its own.
   posts[]: {date, ru, kk}: the Telegram post box in the rail. Empty hides it.
   events[]: {name, start, end?, place?, url?}: the conference calendar. Empty hides it. */
const DIA_NEWS=${JSON.stringify(out, null, 1)};
`;
fs.writeFileSync(NEWS_FILE, file);
log(`wrote ${items.length} stories (${fresh.length} new, ${photosAdded} photos, ${bodiesAdded} full texts)`);
