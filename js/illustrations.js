/* ---------- Editorial illustrations: a library of scenes, one chosen per article ---------- */
let gid=0;
const Wa=a=>`rgba(255,255,255,${a})`;
const BG=(a,b)=>{const id="g"+(++gid);return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="200" fill="url(#${id})"/>`};
const SK=["#f1c7a4","#c98d62","#8d5a3b","#e7b48c"];
/* person: head centre (0,10), shoulders ~44, body bottom 110 */
const P=(x,y,s,skin,shirt,hair,extra="")=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M-36 112 C-36 62 -24 46 0 46 C24 46 36 62 36 112 Z" fill="${shirt}"/><rect x="-8" y="26" width="16" height="22" rx="4" fill="${skin}"/><circle cx="0" cy="10" r="22" fill="${skin}"/><path d="M-23 8 C-24 -18 24 -20 23 6 C15 -6 -8 -8 -23 8Z" fill="${hair}"/>${extra}</g>`;
const curve=(pts,col,w=4,dash="")=>`<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${dash?`stroke-dasharray="${dash}"`:""}/>`;
const sensor=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x}" cy="${y}" r="${r*.72}" fill="#e9f1fa"/><circle cx="${x}" cy="${y}" r="${r*.22}" fill="#9fb4c8"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="2"/>`;
const phone=(x,y,w,h,inner)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w*.14}" fill="#0f1b26"/><rect x="${x+5}" y="${y+12}" width="${w-10}" height="${h-24}" rx="4" fill="#fff"/>${inner}`;
const SCENES={
 "sensor-arm":()=>BG("#0f5fb0","#49a8f2")+
   `<g transform="rotate(-14 160 128)"><rect x="-40" y="88" width="300" height="78" rx="39" fill="${SK[0]}"/><rect x="-40" y="88" width="300" height="20" rx="10" fill="rgba(0,0,0,.05)"/></g>`+sensor(150,118,30)+
   phone(282,26,86,150,`<rect x="292" y="54" width="66" height="26" fill="#e6f7ee"/>`+curve("294,110 306,100 318,104 330,86 342,92 356,78","#1677d2",3)+`<text x="296" y="74" font-family="IBM Plex Mono,monospace" font-size="16" font-weight="500" fill="#1b9a62">6.1</text><text x="296" y="150" font-family="IBM Plex Mono,monospace" font-size="9" fill="#56687a">mmol/L ↗</text>`)+
   `<path d="M196 112 Q240 70 278 82" fill="none" stroke="${Wa(.7)}" stroke-width="2" stroke-dasharray="4 5"/>`,
 "phone-graph":()=>BG("#1360a8","#5bb6f0")+P(105,52,1.25,SK[1],"#ffffff","#2b1d14")+
   `<rect x="122" y="118" width="34" height="56" rx="6" fill="#0f1b26" transform="rotate(-8 139 146)"/><path d="M78 160 Q100 150 128 140" stroke="${SK[1]}" stroke-width="16" stroke-linecap="round" fill="none"/>`+
   `<rect x="200" y="30" width="178" height="132" rx="12" fill="#fff"/><rect x="212" y="70" width="154" height="40" fill="#e6f7ee"/>`+curve("214,120 236,112 254,92 274,86 292,100 312,116 332,96 360,84","#1677d2",4)+
   `<text x="212" y="56" font-family="IBM Plex Mono,monospace" font-size="13" font-weight="500" fill="#0f1b26">TIR 78%</text><circle cx="360" cy="84" r="5" fill="#1677d2"/>`,
 "ketone-sensor":()=>BG("#0c4f8f","#2c8fd8")+sensor(110,104,58)+
   `<text x="84" y="110" font-family="IBM Plex Mono,monospace" font-size="15" font-weight="500" fill="#1677d2">G + K</text>`+
   `<rect x="196" y="36" width="182" height="128" rx="12" fill="${Wa(.14)}"/>`+curve("206,120 236,106 262,112 290,88 318,92 346,74 370,80","#fff",4)+curve("206,148 240,146 270,140 300,132 330,118 370,100","#ffd166",4,"7 6")+
   `<text x="208" y="58" font-family="IBM Plex Mono,monospace" font-size="12" fill="#fff">GLU</text><text x="250" y="58" font-family="IBM Plex Mono,monospace" font-size="12" fill="#ffd166">KET</text>`+
   `<path d="M350 128 C350 128 336 146 336 156 A14 14 0 0 0 364 156 C364 146 350 128 350 128Z" fill="#ffd166"/>`,
 "doctor-patient":()=>BG("#137a52","#45c890")+
   P(120,46,1.3,SK[0],"#ffffff","#6b4b2a",`<path d="M-14 50 C-18 78 -6 92 6 92" fill="none" stroke="#1677d2" stroke-width="4"/><circle cx="8" cy="94" r="6" fill="#1677d2"/><rect x="18" y="62" width="10" height="10" fill="#e0533d"/><rect x="21" y="59" width="4" height="16" fill="#e0533d"/><rect x="15" y="65" width="16" height="4" fill="#e0533d"/>`)+
   P(270,58,1.2,SK[2],"#f0ad3d","#1a1a1a")+`<rect x="168" y="120" width="56" height="70" rx="6" fill="#fff"/><rect x="184" y="114" width="24" height="10" rx="3" fill="#cfd8e3"/>${[136,150,164,178].map(y=>`<rect x="176" y="${y}" width="${y%28?34:26}" height="5" rx="2" fill="#cfd8e3"/>`).join("")}`,
 "lab":()=>BG("#4a2fb5","#9d7ff3")+
   P(110,46,1.3,SK[3],"#ffffff","#3a2a1c",`<rect x="-30" y="58" width="60" height="6" fill="#dfe6ee"/>`)+
   `<g fill="#fff"><rect x="236" y="168" width="110" height="12" rx="4"/><rect x="282" y="70" width="18" height="100" rx="6"/><rect x="250" y="48" width="70" height="26" rx="10" transform="rotate(-30 285 61)"/><rect x="252" y="130" width="70" height="10" rx="3"/></g>`+
   [[350,50,16],[330,110,10],[60,40,12],[200,40,9]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${Wa(.2)}" stroke="#fff" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${r*.4}" fill="#fff"/>`).join(""),
 "cells":()=>BG("#3d2a9e","#8b6ef0")+[[70,70,34],[150,120,46],[250,70,30],[320,140,40],[200,175,22],[40,160,26]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${Wa(.18)}" stroke="${Wa(.7)}" stroke-width="2"/><circle cx="${x+r*.2}" cy="${y-r*.15}" r="${r*.36}" fill="${Wa(.85)}"/>`).join(""),
 "pen":()=>BG("#b8361f","#f39563")+
   `<g transform="rotate(-10 200 100)"><rect x="40" y="82" width="230" height="40" rx="12" fill="#fff"/><rect x="230" y="82" width="40" height="40" rx="10" fill="#ffd9cf"/><rect x="22" y="94" width="20" height="16" rx="3" fill="#fff"/><rect x="10" y="100" width="14" height="4" fill="#fff"/><rect x="110" y="90" width="70" height="24" rx="4" fill="#f2b8a8"/><text x="122" y="107" font-family="IBM Plex Mono,monospace" font-size="13" fill="#7a2414">700 U/mL</text></g>`+
   `<rect x="292" y="40" width="88" height="120" rx="10" fill="#fff"/><rect x="292" y="40" width="88" height="26" rx="10" fill="#7a2414"/><text x="336" y="122" text-anchor="middle" font-family="Archivo,Arial,sans-serif" font-size="40" font-weight="800" fill="#b8361f">1×</text>`+
   [0,1,2,3,4,5,6].map(i=>`<circle cx="${304+i*11}" cy="140" r="4" fill="${i===0?"#b8361f":"#f2c9be"}"/>`).join(""),
 "pills":()=>BG("#c43a28","#f6a06a")+
   `<rect x="250" y="44" width="96" height="130" rx="14" fill="#fff"/><rect x="242" y="30" width="112" height="24" rx="6" fill="#7a2414"/><rect x="262" y="84" width="72" height="50" rx="4" fill="#ffe4dc"/><text x="298" y="116" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="14" font-weight="500" fill="#7a2414">GLP-1</text>`+
   [[70,120,-30],[150,80,20],[120,160,60],[190,140,-10]].map(([x,y,r])=>`<g transform="rotate(${r} ${x} ${y})"><rect x="${x-34}" y="${y-14}" width="68" height="28" rx="14" fill="#fff"/><rect x="${x}" y="${y-14}" width="34" height="28" rx="14" fill="#ffd2c4"/><rect x="${x}" y="${y-14}" width="12" height="28" fill="#ffd2c4"/></g>`).join(""),
 "heart":()=>BG("#a92a3c","#f07a6a")+
   `<path d="M130 70 C130 40 90 34 78 58 C66 34 26 40 26 70 C26 104 78 136 78 136 C78 136 130 104 130 70Z" fill="#fff" transform="translate(30 10) scale(1.25)"/>`+
   curve("170,110 210,110 224,84 240,140 256,64 272,124 284,110 380,110","#fff",5)+`<circle cx="380" cy="110" r="6" fill="#fff"/>`,
 "scale":()=>BG("#b84a2a","#f5b06a")+
   `<rect x="110" y="70" width="180" height="120" rx="26" fill="#fff"/><rect x="150" y="88" width="100" height="40" rx="8" fill="#0f1b26"/><text x="200" y="116" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="20" font-weight="500" fill="#7ee0a8">−20.8%</text><ellipse cx="160" cy="160" rx="22" ry="12" fill="#f0e3dc"/><ellipse cx="240" cy="160" rx="22" ry="12" fill="#f0e3dc"/>`+
   `<path d="M20 60 C60 20 110 20 120 50" fill="none" stroke="#ffe08a" stroke-width="14" stroke-linecap="round"/><path d="M300 40 C340 10 390 30 380 70" fill="none" stroke="#ffe08a" stroke-width="14" stroke-linecap="round"/>`,
 "price":()=>BG("#a66300","#f3c050")+P(320,60,1.15,SK[1],"#1667b0","#2a1a10")+
   `<path d="M40 56 H190 L232 100 L190 144 H40 Z" fill="#fff"/><circle cx="196" cy="100" r="8" fill="#d48708"/><text x="58" y="120" font-family="Archivo,Arial,sans-serif" font-size="56" font-weight="800" fill="#a66300">$35</text>`+
   [[120,176],[150,170],[180,180]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="22" ry="9" fill="#ffe8a8" stroke="#fff" stroke-width="2"/>`).join(""),
 "chart":()=>BG("#0a6e6e","#3cc6b8")+[[50,60],[100,85],[150,75],[200,110],[250,130],[300,150]].map(([x,h])=>`<rect x="${x}" y="${180-h}" width="34" height="${h}" rx="4" fill="${Wa(.85)}"/>`).join("")+curve("40,130 117,95 167,104 217,70 267,50 330,28","#fff",4)+`<polygon points="330,28 314,30 326,42" fill="#fff"/>`,
 "shield":()=>BG("#0f7a4b","#3cc488")+`<path d="M200 22 L262 46 V104 C262 140 236 166 200 180 C164 166 138 140 138 104 V46 Z" fill="${Wa(.95)}"/>`+curve("172,102 194,124 232,82","#1b9a62",12),
 "stage":()=>BG("#8e1f57","#e46aa4")+
   `<rect x="96" y="24" width="208" height="104" rx="6" fill="#fff"/><rect x="108" y="36" width="184" height="80" fill="#fbe3ef"/>`+curve("118,104 150,90 176,96 206,70 236,78 266,54 284,60","#b0306e",4)+
   `<rect x="182" y="132" width="36" height="58" rx="4" fill="#5a0f33"/><rect x="172" y="128" width="56" height="10" rx="3" fill="#5a0f33"/>`+
   P(60,92,.85,SK[0],"#ffd166","#3a2a1c")+P(340,96,.8,SK[2],"#ffffff","#141414")+
   [40,80,120,280,320,360].map((x,i)=>`<circle cx="${x}" cy="${184-(i%2)*4}" r="12" fill="${Wa(.55)}"/>`).join(""),
 "community":()=>BG("#3f6b0c","#9ccc4f")+
   P(90,70,1,SK[1],"#ffffff","#2a1a10")+P(170,56,1.1,SK[0],"#1672cc","#6b4b2a")+P(250,62,1.05,SK[2],"#f0ad3d","#141414")+P(325,74,.95,SK[3],"#d3192b","#8a5a2a")+
   `<circle cx="200" cy="36" r="22" fill="#1672cc" stroke="#fff" stroke-width="5"/><circle cx="200" cy="36" r="9" fill="none" stroke="#fff" stroke-width="4"/>`,
 "trial":()=>BG("#5a35c8","#a88bf5")+
   `<rect x="40" y="26" width="130" height="160" rx="10" fill="#fff"/><rect x="80" y="18" width="50" height="16" rx="4" fill="#cfc4f5"/>`+[60,92,124,156].map((y,i)=>`<rect x="56" y="${y}" width="18" height="18" rx="4" fill="${i<3?"#6b4fd8":"#e5def9"}"/>${i<3?curve(`59,${y+9} 64,${y+14} 72,${y+4}`,"#fff",3):""}<rect x="84" y="${y+5}" width="70" height="8" rx="3" fill="#e5def9"/>`).join("")+
   P(240,70,.95,SK[0],"#ffd166","#5a3a1a")+P(310,62,1.05,SK[2],"#ffffff","#141414")+P(370,74,.9,SK[3],"#4cc48b","#8a5a2a")
};
const CAT_SCENES={cure:["cells","lab","trial"],research:["lab","trial","cells"],approval:["shield","doctor-patient"],devices:["sensor-arm","phone-graph","ketone-sensor"],drugs:["pills","pen","heart","scale"],access:["price","doctor-patient"],market:["chart","sensor-arm"],events:["stage"],community:["community"]};
function sceneFor(it){
  if(it.art&&SCENES[it.art])return it.art;
  const list=CAT_SCENES[it.cat]||Object.keys(SCENES);let h=0;for(const ch of (it._id||"x"))h=(h*31+ch.charCodeAt(0))>>>0;return list[h%list.length];
}
const svgFor=it=>`<svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${SCENES[sceneFor(it)]()}</svg>`;
