let rotI=0,rotT=null;
function heroRot(){const H=HERO[lang];const s=$("h-rot")?.firstElementChild;if(!s)return;
  const clr=()=>s.getAnimations().forEach(x=>x.cancel());const ez="cubic-bezier(.7,0,.2,1)";
  clr();s.animate([{transform:"none",opacity:1},{transform:"translateY(-100%)",opacity:0}],{duration:400,easing:ez,fill:"forwards"});
  setTimeout(()=>{clr();s.textContent=H.rot[rotI%H.rot.length];s.animate([{transform:"translateY(100%)",opacity:0},{transform:"none",opacity:1}],{duration:450,easing:ez});setTimeout(clr,500)},420);}
function startRot(){clearInterval(rotT);const box=$("h-rot");box.replaceChildren(el("span",null,HERO[lang].rot[0]));rotI=0;
  if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  rotT=setInterval(()=>{rotI++;heroRot()},2600)}
let heroLang=null;

/* ---------- state ---------- */
let lang="ru",cat="all",items=[],state="loading";
const open=new Set();
try{const s=localStorage.getItem("dw-lang");if(s&&UI[s])lang=s}catch(e){}
const $=id=>document.getElementById(id);
const pick=o=>o&&typeof o==="object"&&!Array.isArray(o)?(o[lang]||o.en||o.ru||""):(o||"");
function fmtDate(d){try{return new Date(d+"T12:00:00").toLocaleDateString(LOCALE[lang],{day:"2-digit",month:"long",year:"numeric"})}catch(e){return d}}
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
const cvar=c=>`var(--c-${CATS.includes(c)?c:"devices"})`;
const safeUrl=u=>/^https?:\/\//i.test(u||"")?u:"";

function renderChrome(){
  const u=UI[lang];document.documentElement.lang=lang;
  const H=HERO[lang];$("h-eye").textContent=H.eye;$("h-mid").textContent=H.mid;$("h-live").textContent=H.live;$("h-l1").textContent=H.l1;$("h-l1b").textContent=H.l1b;$("h-l1b").hidden=!H.l1b;$("h-pl").textContent=H.pl;$("h-dek").textContent=H.d;$("h-now-k").textContent=H.now;$("h-scroll-t").textContent=H.scroll;
  const l2=$("h-l2");l2.replaceChildren();const ti=H.l2.length>4?H.l2.length-3:-1;[...H.l2].forEach((c,i)=>i===ti?l2.append(el("span","hl-l",c)):l2.append(c));
  $("h-title").setAttribute("aria-label",H.l1+" "+H.l1b+" "+H.l2+": "+H.rot.join(" "));
  if(heroLang!==lang){heroLang=lang;startRot()}
  const toFeed=()=>{const t=$("feed");window.scrollTo({top:t.getBoundingClientRect().top+scrollY-60,behavior:"smooth"})};
  $("h-pill").onclick=toFeed;$("h-scroll").onclick=toFeed;
  if(!$("h-pill").style.backgroundImage)$("h-pill").style.backgroundImage="url('"+SRC(STOCK.up_patch2)+"')";
  const hst=$("h-stats");hst.replaceChildren();const st=stats||{};
  if(st.adults)hst.append(el("span",null,Math.round(st.adults/1e6)+" "+X[lang].mln+" "+H.s[0]));
  if(st.t1d)hst.append(el("span",null,mlnFmt(st.t1d)+" "+X[lang].mln+" "+H.s[1]));
  if(items.length)hst.append(el("span",null,items.length+" "+H.s[2]));
  const top=items[0];$("h-now").hidden=!top;
  if(top){const ph=SRC(ownPhoto(top)||stockFor(top)||STOCK.up_patch1);
    $("h-now-img").style.backgroundImage="url('"+ph+"')";$("h-now-t").textContent=pick(top.title);$("h-now-d").textContent=fmtDate(top.date);
    $("h-now").onclick=()=>{if(!pick(top.body)&&safeUrl(top.url)){window.open(safeUrl(top.url),"_blank","noopener");return}cat="all";toggle(top,true)}}
  $("t-sub").textContent=u.sub;$("t-note").textContent=u.note;$("t-break").textContent=X[lang].breaking;
  try{$("t-today").textContent=new Date().toLocaleDateString(LOCALE[lang],{weekday:"long",day:"numeric",month:"long",year:"numeric"})}catch(e){}
  const L=$("langs");L.replaceChildren();
  for(const[code,lab]of LANGS){const b=el("button",null,lab);b.type="button";b.setAttribute("aria-pressed",code===lang);b.onclick=()=>{lang=code;try{localStorage.setItem("dw-lang",code)}catch(e){}render()};L.append(b)}
  const F=$("filters");F.replaceChildren();
  const present=new Set(items.map(i=>i.cat));
  for(const key of ["all",...CATS.filter(k=>present.has(k))]){
    const b=el("button",null,key==="all"?u.all:u.cats[key]);b.type="button";b.style.setProperty("--c",key==="all"?"var(--navy)":cvar(key));
    b.setAttribute("aria-pressed",key===cat);b.onclick=()=>setCat(key);F.append(b)}
}
function setCat(k){cat=k;render();window.scrollTo({top:0,behavior:"smooth"})}

const ownPhoto=it=>it.photo&&typeof it.photo==="object"&&it.photo.url?it.photo:null;
function media(it){
  const u=UI[lang];const box=el("div","art-box");const shown=ownPhoto(it)||stockFor(it);
  if(!shown){box.insertAdjacentHTML("afterbegin",svgFor(it));box.append(el("span","tag",u.cats[it.cat]||it.cat));return box}
  const img=new Image();img.src=SRC(shown);img.alt=pick(it.title);img.loading="lazy";img.onerror=()=>{img.remove();box.querySelector(".credit")?.remove();box.insertAdjacentHTML("afterbegin",svgFor(it))};box.append(img);
  box.append(el("span","tag",u.cats[it.cat]||it.cat));
  const cap=el("div","credit");cap.append(document.createTextNode(`${u.photo}: ${shown.credit||""}${shown.license?" · "+shown.license:""} `));
  const href=safeUrl(shown.link);if(href){const a=el("a",null,"↗");a.href=href;a.target="_blank";a.rel="noopener";cap.append(a)}box.append(cap);
  return box;
}

function toggle(it,forceOpen){
  const was=open.has(it._id);
  if(forceOpen)open.add(it._id);else if(was)open.delete(it._id);else open.add(it._id);
  render();
  if(forceOpen||!was){const n=$("n-"+it._id);if(n)n.scrollIntoView({block:"start",behavior:"smooth"})}
}

/* variant: lead | duo | row */
function story(it,variant){
  const u=UI[lang];const isOpen=open.has(it._id);const body=pick(it.body);
  const a=el("article",(variant==="row"?"rowstory story":variant==="lead"?"lead story":"story")+(isOpen?" open":""));
  a.id="n-"+it._id;a.style.setProperty("--c",cvar(it.cat));
  const pic=el("div");pic.style.minWidth="0";pic.append(media(it));
  const txt=el("div","txt");txt.style.display="flex";txt.style.flexDirection="column";txt.style.gap=variant==="lead"?"12px":"8px";txt.style.minWidth="0";

  const k=el("div","kicker");k.append(el("span","sec",u.cats[it.cat]||it.cat));
  if(it.stage)k.append(el("span","stamp",u.stages[it.stage]||it.stage));
  k.append(el("span","date",fmtDate(it.date)));

  const h=el(variant==="lead"?"h2":"h3","hl");
  const srcHref=safeUrl(it.url);
  if(body){const hb=el("button",null,pick(it.title));hb.type="button";hb.onclick=()=>toggle(it);h.append(hb)}
  else if(srcHref){const ha=el("a",null,pick(it.title));ha.href=srcHref;ha.target="_blank";ha.rel="noopener";h.append(ha)}
  else h.textContent=pick(it.title);

  const facts=Array.isArray(it.facts)?it.facts:[];
  const showBullets=facts.length&&(variant==="lead"||isOpen);
  let ul=null;if(showBullets){ul=el("ul","bullets");for(const f of facts){const li=el("li");li.append(document.createTextNode(pick(f.k)+": "),el("b",null,pick(f.v)));ul.append(li)}}

  const foot=el("div","foot");
  if(body){const m=el("button","more",isOpen?u.less:u.more);m.type="button";m.setAttribute("aria-expanded",isOpen);m.onclick=()=>toggle(it);foot.append(m)}
  else if(srcHref){const m=el("a","more",u.more+" ↗");m.href=srcHref;m.target="_blank";m.rel="noopener";foot.append(m)}
  const href=safeUrl(it.url);if(href){const s=el("div","src",u.source+": ");const l=el("a",null,it.src||href);l.href=href;l.target="_blank";l.rel="noopener";s.append(l);foot.append(s)}

  if(variant==="lead"){
    /* tabloid order: kicker, giant headline, bullets, picture, standfirst */
    txt.append(k,h);if(ul)txt.append(ul);
    a.append(txt,pic);
    const rest=el("div");rest.style.display="flex";rest.style.flexDirection="column";rest.style.gap="12px";
    rest.append(el("p","dek",pick(it.text)));
    if(isOpen&&body)rest.append(fullText(body));
    rest.append(foot);a.append(rest);
  }else{
    txt.append(k,h,el("p","dek",pick(it.text)));
    if(ul)txt.append(ul);
    if(isOpen&&body)txt.append(fullText(body));
    txt.append(foot);a.append(pic,txt);
  }
  return a;
}
function fullText(body){const full=el("div","full");for(const p of String(body).split(/\n\s*\n/))if(p.trim())full.append(el("p",null,p.trim()));return full}

let posts=[],tgLang=null;
function tgBox(where){
  const x=X[lang];const p=posts[0];const langs=["ru","kk"].filter(l=>p[l]);
  if(!langs.length)return null;
  let tl=tgLang&&p[tgLang]?tgLang:(lang==="kk"&&p.kk?"kk":langs[0]);
  const box=el("section","box tgbox tg-"+where);
  const head=el("div","tg-head");head.append(el("h3",null,x.tg));
  const tabs=el("div","tg-tabs");
  for(const l of langs){const b=el("button",null,l==="kk"?"KZ":"RU");b.type="button";b.setAttribute("aria-pressed",l===tl);b.onclick=()=>{tgLang=l;render()};tabs.append(b)}
  head.append(tabs);box.append(head);
  box.append(el("div","tg-meta",fmtDate(p.date)+" · "+x.only));
  const ta=el("textarea","tg-text");ta.id="tg-text-"+where;ta.readOnly=true;ta.value=p[tl];ta.rows=12;box.append(ta);
  const row=el("div","tg-row");const btn=el("button","tg-copy",x.copy);btn.type="button";const msg=el("span","tg-msg");
  btn.onclick=()=>{
    const done=()=>{msg.textContent=x.copied;btn.textContent="✓ "+x.copied;setTimeout(()=>{btn.textContent=x.copy;msg.textContent=""},2500)};
    const fail=()=>{ta.focus();ta.select();msg.textContent=x.copyFail};
    try{navigator.clipboard.writeText(ta.value).then(done,fail)}catch(e){fail()}
  };
  row.append(btn,msg);box.append(row);return box;
}
let stats=null,events=[],statsAnimated=false;
const todayISO=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const nf=n=>{try{return Number(n).toLocaleString(LOCALE[lang]).replace(/\u00a0|\u202f/g," ")}catch(e){return String(n)}};
const mlnFmt=n=>{try{return (n/1e6).toLocaleString(LOCALE[lang],{maximumFractionDigits:2})}catch(e){return (n/1e6).toFixed(2)}};
function statBox(){
  const x=X[lang];const box=el("section","kxs");
  const head=el("div","kxs-h");head.append(el("span",null,x.stats),el("span","kxs-y",stats&&stats.year?"/ "+stats.year:""));box.append(head);
  const st=stats;
  if(!st||!st.t1d){box.append(el("p","kxs-wait",x.statsWait));return box}
  const share=Number(st.t2d_share_min)||90;const adults=Number(st.adults)||0;const t2=Math.floor(adults*share/100);
  const rows=[
   {n:adults/1e6,fmt:v=>Math.round(v),suf:x.mln,lab:x.adults,c:"var(--fg)",wide:true,pct:100},
   {n:t2/1e6,fmt:v=>Math.round(v),pre:x.more,suf:x.mln,lab:x.t2,sub:x.t2s(share),c:"var(--t2)",pct:share},
   {n:Number(st.t1d)/1e6,fmt:v=>v.toLocaleString(LOCALE[lang],{minimumFractionDigits:2,maximumFractionDigits:2}),suf:x.mln,lab:x.t1,sub:x.t1s,c:"var(--t1)",pct:Number(st.t1d)/(adults||1)*100},
   st.t1d_kids?{n:Number(st.t1d_kids),fmt:v=>nf(Math.round(v)),lab:x.kids,sub:x.kidsSub,c:"var(--kid)",wide:true,pct:Number(st.t1d_kids)/(Number(st.t1d)||1)*100}:null
  ].filter(Boolean);
  const pctFmt=p=>p.toLocaleString(LOCALE[lang],{maximumFractionDigits:p<10?1:0})+"%";
  const reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;const anim=!statsAnimated&&!reduce;statsAnimated=true;
  const grid=el("div","kxs-grid");box.append(grid);
  rows.forEach((r,i)=>{const row=el("div","kxs-tile"+(r.wide?" wide":""));row.style.setProperty("--c",r.c);
    const top=el("div","kxs-t");top.append(el("span","kxs-l",r.lab));
    const num=el("div","kxs-n");if(r.pre)num.append(el("small","kxs-pre",r.pre));const v=el("span","kxs-v",r.fmt(anim?0:r.n));num.append(v);if(r.suf)num.append(el("small","kxs-suf",r.suf));
    const bar=el("div","kxs-bar");const fill=el("i");const pct=Math.max(2,Math.min(100,r.pct));fill.style.width=anim?"0%":pct+"%";bar.append(fill);
    row.append(top,num);if(i>0)row.append(el("div","kxs-p",pctFmt(r.pct)+" "+(i===3?x.ofT1:x.ofAll)));row.append(bar);if(r.sub)row.append(el("div","kxs-s",r.sub));grid.append(row);
    if(anim){const t0=performance.now()+i*150;const step=t=>{if(!v.isConnected)return;const p=Math.max(0,Math.min((t-t0)/1500,1));const e=1-Math.pow(1-p,3);v.textContent=r.fmt(r.n*e);if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step);requestAnimationFrame(()=>requestAnimationFrame(()=>{fill.style.width=pct+"%"}))}
  });
  const src=el("div","kxs-src");const href=safeUrl(st.url);src.append(document.createTextNode("↘ "+UI[lang].source+": "));
  if(href){const a=el("a",null,st.src||href);a.href=href;a.target="_blank";a.rel="noopener";src.append(a)}else src.append(document.createTextNode(st.src||""));
  box.append(src);return box;
}
function calBox(){
  const x=X[lang];const t=todayISO();
  const up=events.filter(e=>e.start&&String(e.end||e.start)>=t).sort((a,b)=>String(a.start).localeCompare(String(b.start))).slice(0,8);
  if(!up.length)return null;
  const box=el("section","box calbox");box.append(el("h3",null,x.cal));const ul=el("ul");
  for(const e of up){const li=el("li");const cd=el("div","cd");
    let dd,mm;try{const d=new Date(e.start+"T12:00:00");dd=d.getDate();mm=d.toLocaleDateString(LOCALE[lang],{month:"short"})+" "+String(d.getFullYear()).slice(2)}catch(_){dd="";mm=e.start}
    cd.append(el("b",null,String(dd)),document.createTextNode(mm));
    const w=el("div");w.style.minWidth="0";const href=safeUrl(e.url);const nm=href?el("a",null,pick(e.name)):el("span","nm",pick(e.name));if(href){nm.href=href;nm.target="_blank";nm.rel="noopener"}
    w.append(nm);if(e.start<=t)w.append(el("span","now",x.now));
    const range=e.end&&e.end!==e.start?`${fmtDate(e.start)} – ${fmtDate(e.end)}`:fmtDate(e.start);
    w.append(el("span","pl",range+(e.place?" · "+pick(e.place):"")));li.append(cd,w);ul.append(li)}
  box.append(ul);return box;
}
function rail(list){
  const u=UI[lang];const r=el("aside","rail");
  r.append(statBox());
  if(posts.length){const t=tgBox("desk");if(t)r.append(t)}
  const latest=[...items].sort((a,b)=>String(b.added||b.date||"").localeCompare(String(a.added||a.date||""))).slice(0,8);
  const box=el("section","kxs kxl");const lh=el("div","kxs-h");lh.append(el("span",null,X[lang].latest),el("span","kxs-y",latest.length?String(latest[0].added||latest[0].date).slice(0,10).split("-").reverse().join("."):""));box.append(lh);
  const ol=el("ol","kxl-list");
  latest.forEach((it,i)=>{const li=el("li");li.style.setProperty("--c",cvar(it.cat));const b=el("button");b.type="button";
    const meta=el("span","kxl-m");meta.append(el("span","kxl-c",u.cats[it.cat]||""),el("span","kxl-d",fmtDate(it.date)));
    b.append(el("span","kxl-i",String(i+1).padStart(2,"0")),el("span","kxl-t",pick(it.title)),meta,el("span","kxl-a","↘"));
    b.onclick=()=>{if(cat!=="all"&&it.cat!==cat){cat="all"}toggle(it,!!pick(it.body))};li.append(b);ol.append(li)});
  box.append(ol);r.append(box);
  const cb=calBox();if(cb)r.append(cb);
  const sb=el("section","kxs kxc");const sh=el("div","kxs-h");sh.append(el("span",null,X[lang].sections),el("span","kxs-y",String(items.length)));sb.append(sh);const chips=el("div","kxc-list");
  let ci=0;for(const c of CATS){const n=items.filter(i=>i.cat===c).length;if(!n)continue;ci++;const b=el("button");b.type="button";b.style.setProperty("--c",cvar(c));if(cat===c)b.setAttribute("aria-current","true");
    b.append(el("span","kxc-i",String(ci).padStart(2,"0")),el("span","kxc-n",u.cats[c]),el("span","kxc-c",String(n)),el("span","kxc-a","↘"));b.onclick=()=>setCat(c);chips.append(b)}
  sb.append(chips);r.append(sb);
  return r;
}

function ticker(){
  const t=$("ticker"),tr=$("ticker-track");tr.replaceChildren();
  const top=items.slice(0,6);if(!top.length){t.hidden=true;return}
  t.hidden=false;
  for(let pass=0;pass<2;pass++)for(const it of top){const b=el("button",null,pick(it.title));b.type="button";if(pass)b.tabIndex=-1,b.setAttribute("aria-hidden","true");b.onclick=()=>{cat="all";toggle(it,!!pick(it.body))};tr.append(b)}
}

function render(){
  renderChrome();const u=UI[lang];const feed=$("feed");feed.replaceChildren();gid=0;
  if(state!=="ready"||!items.length){
    $("ticker").hidden=true;
    const box=el("div","state");
    if(state==="loading")box.append(el("strong",null,u.loading));
    else box.append(el("strong",null,u.empty),el("span",null,u.emptyText));
    feed.append(box);$("t-count").textContent="";$("t-upd").textContent="";return}
  ticker();
  const list=items.filter(i=>cat==="all"||i.cat===cat);
  $("t-count").textContent=u.count(list.length);
  const latest=items.reduce((m,i)=>i.added&&i.added>m?i.added:m,"");
  $("t-upd").textContent=latest?`${u.upd}: ${fmtDate(latest.slice(0,10))}`:"";
  const layout=el("div","layout");const main=el("div","maincol");
  if(posts.length){const t=tgBox("mob");if(t)main.append(t)}
  if(list[0])main.append(story(list[0],"lead"));
  const pair=list.slice(1,3);
  if(pair.length===2){const d=el("div","duo");pair.forEach(it=>d.append(story(it,"duo")));main.append(d)}
  const restStart=pair.length===2?3:1;
  const rows=el("div","rows");list.slice(restStart).forEach(it=>rows.append(story(it,"row")));
  if(rows.childElementCount)main.append(rows);
  layout.append(main,rail(list));feed.append(layout);
  if(DIA_NEWS.demo)feed.prepend(el("div","demo","Демо-режим: примеры материалов, настоящая лента ещё не подключена. / Demo mode: sample stories, the live feed is not connected yet."));
}

/* Content comes from data/news.js; swap that file (or generate it) to publish a new feed. */
const byDate=(a,b)=>String(b.date||"").localeCompare(String(a.date||""));
const rankKey=x=>{const d=String(x.date||"");return d>todayISO()?String(x.added||d):d};
items=DIA_NEWS.items.map(x=>Object.assign({},x,{_id:x.id})).filter(x=>x.title).sort((a,b)=>rankKey(b).localeCompare(rankKey(a)));
posts=[...DIA_NEWS.posts].sort(byDate);
events=DIA_NEWS.events;
stats=DIA_NEWS.stats;
state="ready";
render();
