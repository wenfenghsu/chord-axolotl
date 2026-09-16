<script>
/* ==========================================================
   和弦蠑螈 — 電吉他和弦練習遊戲
   單檔執行，所有判斷都在瀏覽器裡用 Web Audio 做
   ========================================================== */

const PC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const OPEN_MIDI = [40,45,50,55,59,64];          // E2 A2 D3 G3 B3 E4

/* ---------- 和弦指法庫：只寫指法，音名自動算出來 ---------- */
const SHAPES = {
  'Cm':'x35543','Gm':'355333','C':'x32010','Cmaj7':'x32000','Cadd9':'x32033','C7':'x32310',
  'D':'xx0232','Dm':'xx0231','D7':'xx0212','Dm7':'xx0211','Dsus4':'xx0233',
  'E':'022100','Em':'022000','E7':'020100','Em7':'020000',
  'F':'133211','Fmaj7':'xx3210','F7':'131211',
  'G':'320003','G7':'320001','Gsus4':'330013','G/B':'x20003',
  'A':'x02220','Am':'x02210','A7':'x02020','Am7':'x02010','Asus4':'x02230',
  'B':'x24442','Bm':'x24432','B7':'x21202','Bm7':'x24232',
  'Bb':'x13331','Bbmaj7':'x13231',
  'C#m':'x46654','D#m':'x68876','F#m':'244222','F#':'244322','G#m':'466444',
  'Eb':'x68886','Ab':'466544','Db':'x46664'
};
/* 手指編號（只給常用開放和弦，指板圖上會標數字） */
const FINGERS = {
  'C':'032010','G':'210003','Am':'002310','Em':'023000','Dm':'000231','D':'000132',
  'E':'023100','A':'001230','Em7':'020000','Am7':'002010','Cmaj7':'032000','Fmaj7':'003210',
  'G7':'320001','D7':'000213','Dm7':'000211'
};

function parseShape(s){
  return s.split('').map(c => c==='x' || c==='X' ? -1 : parseInt(c,36));
}
function shapeOf(name){
  if (SHAPES[name]) return parseShape(SHAPES[name]);
  return null;
}
/* 從指法算出「這個和弦包含哪些音（pitch class）」與最低音 */
function chordInfo(name){
  const fr = shapeOf(name);
  if (!fr) return null;
  const pcs = new Set(); let bass = null;
  fr.forEach((f,i)=>{
    if (f < 0) return;
    const m = OPEN_MIDI[i] + f;
    pcs.add(m % 12);
    if (bass === null) bass = m % 12;
  });
  return {frets:fr, pcs:[...pcs], bass, name};
}

/* ---------- 節奏型（8 格 = 一小節的八分音符） ---------- */
const PATTERNS = [
  {id:'q4',    name:'四分音符 ↓↓↓↓（最基本）',      hits:[1,0,1,0,1,0,1,0], dir:'D D D D '.split(' ')},
  {id:'ddu',   name:'↓ ↓↑ ↓↑（三拍半刷）',          hits:[1,0,1,1,0,0,1,1]},
  {id:'folk',  name:'↓ ↓↑ ↑↓↑（經典民謠刷法）',      hits:[1,0,1,1,0,1,1,1]},
  {id:'eight', name:'八分全刷 ↓↑↓↑↓↑↓↑',            hits:[1,1,1,1,1,1,1,1]},
  {id:'ballad',name:'慢歌 ↓ · ↑↓ · ↑（抒情）',        hits:[1,0,0,1,1,0,0,1]},
  {id:'rock',  name:'搖滾 ↓↓ ↑↓ ↑（倔強副歌感）',     hits:[1,0,1,1,0,1,0,1]}
];
function dirOf(idx){ return idx % 2 === 0 ? '↓' : '↑'; }

/* ---------- 固定歌曲目錄；原曲資料在 03_originals.js ---------- */
const BUILTIN = [
  {
    id:'warm', title:'暖身：四和弦循環', artist:'練手用',
    note:'C–G–Am–F，換和弦最基本的四顆。先把這個練順再挑戰歌。',
    bpm:70,
    sections:[
      {name:'循環 A', chords:'C G Am F C G Am F'},
      {name:'加一點變化', chords:'C G Am Em F C F G'},
      {name:'封閉和弦特訓（F / Bm）', chords:'C F C F G Bm G Bm F Bm F C'}
    ]
  },
  {"id": "jue", "title": "倔強", "artist": "五月天", "note": "原調 A · MP3 同步和弦與節奏提示。", "bpm": 156, "sections": []},
  {"id": "xwg", "title": "笑忘歌", "artist": "五月天", "note": "原調 G · MP3 同步和弦與節奏提示。", "bpm": 120, "sections": []},
  {"id": "ifu", "title": "I for You", "artist": "LUNA SEA", "note": "原調 C / Am · MP3 同步和弦與節奏提示。", "bpm": 95, "sections": []},
  {"id": "comp", "title": "Complicated", "artist": "Avril Lavigne", "note": "原調 F · MP3 同步和弦與節奏提示。", "bpm": 78, "sections": []},
  {"id": "gf", "title": "Girlfriend", "artist": "Avril Lavigne", "note": "原調 D · MP3 同步和弦與節奏提示。", "bpm": 164, "sections": []}
];

/* ---------- 小工具 ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function toast(msg, ms=1800){
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('on'), ms);
}
function go(id){
  $$('.screen').forEach(s=>s.classList.remove('on'));
  $('#'+id).classList.add('on');
  if (id === 'scSelect') renderSongs();
}
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function fmtChords(str){ return str.replace(/\|/g,' ').split(/\s+/).filter(Boolean); }

/* ---------- 指板圖 ---------- */
function diagram(name, size=1){
  const info = chordInfo(name);
  const W = 132*size, H = 168*size;
  if (!info) return `<svg width="${W}" height="${H}"><text x="8" y="60" fill="#ff6b6b" font-size="14">未知和弦<tspan x="8" dy="20">${name}</tspan></text></svg>`;
  const fr = info.frets;
  const used = fr.filter(f=>f>0);
  const minF = used.length ? Math.min(...used) : 1;
  const maxF = used.length ? Math.max(...used) : 1;
  const base = (maxF <= 4) ? 1 : minF;                       // 第一格從哪裡開始
  const nF = 4, L = 28*size, T = 34*size, SW = 15*size, FH = 26*size;
  const fing = FINGERS[name] ? FINGERS[name].split('') : null;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  // 弦（直線）
  for (let i=0;i<6;i++) s += `<line x1="${L+i*SW}" y1="${T}" x2="${L+i*SW}" y2="${T+nF*FH}" stroke="#8c7fb5" stroke-width="${1.4*size}"/>`;
  // 琴衍（橫線）
  for (let j=0;j<=nF;j++){
    const top = (j===0 && base===1);
    s += `<line x1="${L}" y1="${T+j*FH}" x2="${L+5*SW}" y2="${T+j*FH}" stroke="${top?'#fff':'#8c7fb5'}" stroke-width="${top?5*size:1.4*size}" stroke-linecap="round"/>`;
  }
  if (base > 1) s += `<text x="${L-10*size}" y="${T+FH*0.75}" fill="#b9a8cc" font-size="${13*size}" text-anchor="end">${base}</text>`;
  // 每弦記號
  fr.forEach((f,i)=>{
    const x = L + i*SW;
    if (f < 0){
      s += `<text x="${x}" y="${T-8*size}" fill="#ff6b6b" font-size="${15*size}" text-anchor="middle" font-weight="700">✕</text>`;
    } else if (f === 0){
      s += `<circle cx="${x}" cy="${T-13*size}" r="${5*size}" fill="none" stroke="#5ce6a0" stroke-width="${2*size}"/>`;
    } else {
      const y = T + (f - base + 0.5)*FH;
      s += `<circle cx="${x}" cy="${y}" r="${8.2*size}" fill="#ff7fb6"/>`;
      if (fing && fing[i] && fing[i] !== '0')
        s += `<text x="${x}" y="${y+4.6*size}" fill="#3a0f24" font-size="${11*size}" text-anchor="middle" font-weight="900">${fing[i]}</text>`;
    }
  });
  // 封閉指（barre）
  const barF = barreFret(fr);
  if (barF){
    const idx = fr.findIndex(f=>f===barF);
    const last = 5 - [...fr].reverse().findIndex(f=>f===barF);
    const y = T + (barF - base + 0.5)*FH;
    s += `<rect x="${L+idx*SW-8.2*size}" y="${y-8.2*size}" width="${(last-idx)*SW+16.4*size}" height="${16.4*size}" rx="${8.2*size}" fill="#ff7fb6" opacity=".92"/>`;
  }
  s += `<text x="${W/2}" y="${H-8*size}" fill="#b9a8cc" font-size="${12*size}" text-anchor="middle">${info.pcs.map(p=>PC[p]).join(' ')}</text>`;
  s += `</svg>`;
  return s;
}
function barreFret(fr){
  const used = fr.filter(f=>f>0);
  if (used.length < 3) return 0;
  const m = Math.min(...used);
  const cnt = fr.filter(f=>f===m).length;
  return cnt >= 3 ? m : 0;
}
