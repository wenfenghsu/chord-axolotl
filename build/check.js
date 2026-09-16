
/* ==========================================================
   和弦蠑螈 — 電吉他和弦練習遊戲
   單檔執行，所有判斷都在瀏覽器裡用 Web Audio 做
   ========================================================== */

const PC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const OPEN_MIDI = [40,45,50,55,59,64];          // E2 A2 D3 G3 B3 E4

/* ---------- 和弦指法庫：只寫指法，音名自動算出來 ---------- */
const SHAPES = {
  'C':'x32010','Cmaj7':'x32000','Cadd9':'x32033','C7':'x32310',
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

/* ---------- 內建歌曲（練習用簡化進行，可在編輯器改） ---------- */
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
  {
    id:'jue', title:'倔強', artist:'五月天（練習簡化版）',
    note:'簡化成 C 調的和弦進行，好按、好換。不是官方譜，拿到正式譜請到編輯器改。',
    bpm:76,
    sections:[
      {name:'主歌', chords:'C G Am Em F C F G'},
      {name:'副歌', chords:'F G Em Am F G C C'},
      {name:'全曲（主歌＋副歌）', chords:'C G Am Em F C F G F G Em Am F G C C'}
    ]
  },
  {
    id:'xwg', title:'笑忘歌', artist:'五月天（練習簡化版）',
    note:'C 調簡化進行。副歌衝起來的地方右手可以刷重一點。',
    bpm:84,
    sections:[
      {name:'主歌', chords:'C G Am Em F C Dm G'},
      {name:'副歌', chords:'F G Em Am F G C C'},
      {name:'全曲（主歌＋副歌）', chords:'C G Am Em F C Dm G F G Em Am F G C C'}
    ]
  },
  {
    id:'ifu', title:'I for you', artist:'LUNA SEA（練習簡化版）',
    note:'簡化成 Am/C 調。原曲是慢板，BPM 建議壓在 60–70，右手輕一點。',
    bpm:64,
    sections:[
      {name:'主歌', chords:'Am F C G Am F Dm G'},
      {name:'副歌', chords:'F G Em Am F G C C'},
      {name:'全曲（主歌＋副歌）', chords:'Am F C G Am F Dm G F G Em Am F G C C'}
    ]
  },
  {
    id:'comp', title:'Complicated', artist:'Avril Lavigne（練習簡化版）',
    note:'原曲是 F 大調，這裡移到 C 調讓左手好按。四個和弦一直循環，很適合練換和弦。',
    bpm:78,
    sections:[
      {name:'主歌', chords:'C G Am F C G Am F'},
      {name:'副歌', chords:'F C G Am F C G G'},
      {name:'全曲（主歌＋副歌）', chords:'C G Am F C G Am F F C G Am F C G G'}
    ]
  },
  {
    id:'gf', title:'Girlfriend', artist:'Avril Lavigne（練習簡化版）',
    note:'原調 D 大調的四和弦循環（D–A–Bm–G），Bm 是封閉和弦。按不動就先練下面的 C 調版。',
    bpm:90,
    sections:[
      {name:'原調（有 Bm 封閉）', chords:'D A Bm G D A Bm G'},
      {name:'C 調簡單版', chords:'C G Am F C G Am F'},
      {name:'原調 全段', chords:'D A Bm G D A Bm G D A Bm G D A G G'}
    ]
  }
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
  if (id === 'scEditor') editorOpen();
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

/* ==========================================================
   音訊引擎：收音 → 起音偵測 → 音高分析 → 和弦比對
   ========================================================== */
const A = {
  ctx:null, stream:null, src:null, big:null, small:null,
  sr:48000, td:null, fd:null, sfd:null, prevMag:null,
  rms:0, flux:0, noiseFlux:0.02, noiseRms:0.002,
  fluxThresh:0.25, rmsGate:0.006, sens:12,
  lastOnset:0, running:false, onOnset:null, timer:0,
  liveChroma:new Float32Array(12), liveGuess:null
};

async function listDevices(){
  try{
    const ds = await navigator.mediaDevices.enumerateDevices();
    const sel = $('#devSel'); sel.innerHTML = '';
    ds.filter(d=>d.kind==='audioinput').forEach(d=>{
      const o = document.createElement('option');
      o.value = d.deviceId; o.textContent = d.label || '輸入裝置';
      sel.appendChild(o);
    });
  }catch(e){}
}

async function initAudio(deviceId){
  const constraints = {audio:{
    echoCancellation:false, noiseSuppression:false, autoGainControl:false, channelCount:1
  }};
  if (deviceId) constraints.audio.deviceId = {exact:deviceId};
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  if (A.stream) A.stream.getTracks().forEach(t=>t.stop());
  if (A.src) A.src.disconnect();
  if (A.filters) A.filters.forEach(node=>node.disconnect());
  A.stream = stream;
  A.lastOnset=0; _fluxHist=[];
  if (!A.ctx) A.ctx = new (window.AudioContext||window.webkitAudioContext)();
  await A.ctx.resume();
  A.sr = A.ctx.sampleRate;

  A.src = A.ctx.createMediaStreamSource(A.stream);
  const hp = A.ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=65; hp.Q.value=0.7;
  const lp = A.ctx.createBiquadFilter(); lp.type='lowpass';  lp.frequency.value=4000;
  A.filters=[hp,lp];

  A.big = A.ctx.createAnalyser();   A.big.fftSize = 16384; A.big.smoothingTimeConstant = 0;
  A.small = A.ctx.createAnalyser(); A.small.fftSize = 2048; A.small.smoothingTimeConstant = 0;
  A.src.connect(hp); hp.connect(lp); lp.connect(A.big); lp.connect(A.small);

  A.td  = new Float32Array(A.big.fftSize);
  A.fd  = new Float32Array(A.big.frequencyBinCount);
  A.sfd = new Float32Array(A.small.frequencyBinCount);
  A.std = new Float32Array(A.small.fftSize);
  A.prevMag = new Float32Array(120);
  A.running = true;
  clearInterval(A.timer);
  A.timer = setInterval(loop, 16);
  return true;
}

/* ---------- 每幀：音量 + 起音 ---------- */
let _fluxHist = [];
function loop(){
  if (!A.running || !A.small) return;
  A.small.getFloatTimeDomainData(A.std);
  let s = 0;
  for (let i=0;i<A.std.length;i++) s += A.std[i]*A.std[i];
  A.rms = Math.sqrt(s/A.std.length);

  A.small.getFloatFrequencyData(A.sfd);
  let flux = 0;
  for (let i=4;i<120;i++){
    const m = Math.pow(10, A.sfd[i]/20);
    const d = m - A.prevMag[i];
    if (d > 0) flux += d;
    A.prevMag[i] = m;
  }
  A.flux = flux;
  _fluxHist.push(flux); if (_fluxHist.length > 6) _fluxHist.shift();

  const now = A.ctx.currentTime;
  const recentAvg = _fluxHist.slice(0,-1).reduce((a,b)=>a+b,0) / Math.max(1,_fluxHist.length-1);
  if (A.rms > A.rmsGate && flux > A.fluxThresh && flux > recentAvg*1.25 && (now - A.lastOnset) > 0.085){
    A.lastOnset = now;
    if (A.onOnset) A.onOnset(now);
    pulse();
  }
  drawMeters();
  drawLive();
}
function pulse(){
  const l = $('#lane'); if (l) { l.style.boxShadow='0 0 24px rgba(255,127,182,.5) inset'; setTimeout(()=>l.style.boxShadow='',110); }
}
function setSens(v){
  A.sens = v;
  A.fluxThresh = Math.max(A.noiseFlux*2.2, 1.2/v);
  A.rmsGate    = Math.max(A.noiseRms*2.5, 0.05/v);
  const ci = $('#calInfo');
  if (ci) ci.textContent = `noise floor: ${A.noiseRms.toExponential(2)} · 觸發門檻 flux ${A.fluxThresh.toFixed(3)} / rms ${A.rmsGate.toFixed(4)}`;
}

/* ---------- Goertzel：算某個頻率在這段訊號裡有多強 ---------- */
let _hann = null, _hannN = 0;
function hann(N){
  if (_hannN === N) return _hann;
  _hann = new Float32Array(N);
  for (let i=0;i<N;i++) _hann[i] = 0.5 - 0.5*Math.cos(2*Math.PI*i/(N-1));
  _hannN = N; return _hann;
}
function goertzel(buf, off, N, freq, sr){
  const w = 2*Math.PI*freq/sr, c = 2*Math.cos(w);
  const win = hann(N);
  let s1 = 0, s2 = 0;
  for (let i=0;i<N;i++){
    const s0 = buf[off+i]*win[i] + c*s1 - s2;
    s2 = s1; s1 = s0;
  }
  const p = s1*s1 + s2*s2 - c*s1*s2;
  return p > 0 ? Math.sqrt(p)/(N/4) : 0;
}
const MIDI_LO = 40, MIDI_HI = 88;
const NOTE_F = [];
for (let m=MIDI_LO;m<=MIDI_HI;m++) NOTE_F.push(440*Math.pow(2,(m-69)/12));

/* 精準版 chroma（判定用）：winSec 決定分析窗長 */
function chromaGoertzel(winSec){
  A.big.getFloatTimeDomainData(A.td);
  let N = Math.round(winSec*A.sr);
  N = Math.min(N, A.td.length);
  const off = A.td.length - N;
  const chroma = new Float32Array(12);
  const notes = new Float32Array(NOTE_F.length);
  for (let i=0;i<NOTE_F.length;i++){
    const e = goertzel(A.td, off, N, NOTE_F[i], A.sr);
    notes[i] = e;
    chroma[(MIDI_LO+i)%12] += Math.sqrt(e);
  }
  return {chroma:norm(harmonicClean(chroma)), notes};
}
/* 便宜版 chroma（畫面即時顯示用） */
function chromaFFT(){
  A.big.getFloatFrequencyData(A.fd);
  const binHz = A.sr/A.big.fftSize;
  const chroma = new Float32Array(12);
  for (let i=0;i<NOTE_F.length;i++){
    const f = NOTE_F[i];
    const lo = Math.max(1, Math.floor(f*0.9715/binHz));
    const hi = Math.min(A.fd.length-1, Math.ceil(f*1.0293/binHz));
    let mx = -140;
    for (let b=lo;b<=hi;b++) if (A.fd[b] > mx) mx = A.fd[b];
    const lin = Math.pow(10, mx/20);
    chroma[(MIDI_LO+i)%12] += Math.sqrt(lin);
  }
  return norm(harmonicClean(chroma));
}
function harmonicClean(v){
  const o = new Float32Array(12);
  for (let p=0;p<12;p++)
    o[p] = Math.max(0, v[p] - 0.22*v[(p+5)%12] - 0.12*v[(p+8)%12]);
  return o;
}
function norm(v){
  let mx = 0; for (const x of v) if (x > mx) mx = x;
  const out = new Float32Array(12);
  if (mx <= 0) return out;
  for (let i=0;i<12;i++) out[i] = v[i]/mx;
  return out;
}
/* 最低的明顯音（拿來當根音線索） */
function bassPC(notes){
  let best = -1, bestE = 0, mx = 0;
  for (let i=0;i<notes.length;i++) if (notes[i] > mx) mx = notes[i];
  for (let i=0;i<24;i++){                    // MIDI 40..63 = E2..D#4
    if (notes[i] > mx*0.28){ best = (MIDI_LO+i)%12; break; }
  }
  return best;
}

/* ---------- 和弦模板比對 ---------- */
function rootPC(name){
  const m = name.match(/^([A-G])([#b]?)/);
  if (!m) return -1;
  let p = PC.indexOf(m[1]);
  if (m[2] === '#') p = (p+1)%12;
  if (m[2] === 'b') p = (p+11)%12;
  return p;
}
const _tmplCache = {};
function templateOf(name){
  if (_tmplCache[name]) return _tmplCache[name];
  const info = chordInfo(name);
  if (!info) return null;
  const t = new Float32Array(12);
  const r = rootPC(name);
  info.pcs.forEach(p=>{ t[p] = 0.85; });
  if (r >= 0) t[r] = 1.0;
  const third = (r+3)%12, third2 = (r+4)%12, fifth = (r+7)%12;
  if (info.pcs.includes(third))  t[third]  = 0.95;
  if (info.pcs.includes(third2)) t[third2] = 0.95;
  if (info.pcs.includes(fifth))  t[fifth]  = 0.80;
  let n = 0; for (const x of t) n += x*x; n = Math.sqrt(n);
  for (let i=0;i<12;i++) t[i] /= n;
  _tmplCache[name] = t; return t;
}
function matchChord(chroma, candidates, bass){
  let cn = 0; for (const x of chroma) cn += x*x; cn = Math.sqrt(cn) || 1;
  const out = [];
  for (const name of candidates){
    const t = templateOf(name); if (!t) continue;
    let dot = 0;
    for (let i=0;i<12;i++) dot += (chroma[i]/cn)*t[i];
    const r = rootPC(name);
    let sc = dot;
    if (chordInfo(name).pcs.length >= 4) sc -= 0.045;
    if (bass >= 0 && bass === r) sc += 0.075;
    else if (bass >= 0 && !chordInfo(name).pcs.includes(bass)) sc -= 0.05;
    out.push({name, score:sc});
  }
  out.sort((a,b)=>b.score-a.score);
  return out;
}
const COMMON = ['C','G','Am','Em','F','D','Dm','E','A','Bm','Bb','Am7','Em7','Dm7','G7','Cmaj7','Fmaj7','F#m','C#m'];

/* ---------- 調音器（自相關） ---------- */
function detectPitch(){
  A.big.getFloatTimeDomainData(A.td);
  const N = Math.min(4096, A.td.length);
  const off = A.td.length - N;
  const buf = A.td.subarray(off, off+N);
  let rms = 0; for (let i=0;i<N;i++) rms += buf[i]*buf[i];
  rms = Math.sqrt(rms/N);
  if (rms < 0.004) return null;
  const minLag = Math.floor(A.sr/1200), maxLag = Math.floor(A.sr/60);
  let bestLag = -1, best = 0;
  for (let lag=minLag; lag<maxLag; lag++){
    let s = 0;
    for (let i=0;i<N-lag;i+=2) s += buf[i]*buf[i+lag];
    s /= (N-lag);
    if (s > best){ best = s; bestLag = lag; }
  }
  if (bestLag < 0 || best < 0.0005) return null;
  // 拋物線插值
  const y = l => { let s=0; for (let i=0;i<N-l;i+=2) s += buf[i]*buf[i+l]; return s/(N-l); };
  const y0 = y(bestLag-1), y1 = best, y2 = y(bestLag+1);
  const d = (y0 - y2) / (2*(y0 - 2*y1 + y2) || 1);
  const f = A.sr/(bestLag + d);
  if (f < 60 || f > 1300) return null;
  const midi = 69 + 12*Math.log2(f/440);
  const near = Math.round(midi);
  return {freq:f, note:PC[(near%12+12)%12], octave:Math.floor(near/12)-1, cents:Math.round((midi-near)*100)};
}

/* ==========================================================
   遊戲邏輯
   ========================================================== */
const G = {
  songs:[], song:null, secIdx:0, diff:'easy', bpm:72, tol:1, pattern:PATTERNS[0],
  chords:[], idx:0, score:0, combo:0, maxCombo:0, hit:0, total:0,
  per:{}, trans:{}, notes:[], running:false, startAt:0, cands:[], timer:0, endAt:0
};

/* ---------- 歌曲存取（含使用者自訂） ---------- */
function loadSongs(){
  let saved = null;
  try{ saved = JSON.parse(localStorage.getItem('axo_songs')||'null'); }catch(e){}
  G.songs = (saved && Array.isArray(saved) && saved.length) ? saved : JSON.parse(JSON.stringify(BUILTIN));
}
function saveSongs(){ localStorage.setItem('axo_songs', JSON.stringify(G.songs)); }

function renderSongs(){
  const grid = $('#songGrid'); grid.innerHTML = '';
  G.songs.forEach((s,i)=>{
    const d = document.createElement('div');
    d.className = 'song' + (G.song === s ? ' sel' : '');
    d.innerHTML = `<h3>${escapeHTML(s.title)}</h3><p><b>${escapeHTML(s.artist)}</b><br>${escapeHTML(s.note||'')}</p>
      <p class="mono" style="margin-top:8px;font-size:12px">${s.sections.map(x=>escapeHTML(x.name)).join(' · ')}</p>`;
    d.onclick = ()=>{ clearLocalAudio(); G.song = s; G.secIdx = 0; $('#bpm').value = s.bpm||72; $('#bpmVal').textContent = s.bpm||72; renderSongs(); renderSecPick(); };
    d.tabIndex=0; d.setAttribute('role','button'); d.setAttribute('aria-pressed',String(G.song===s));
    d.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();d.click();}};
    grid.appendChild(d);
  });
  renderSecPick();
  refreshOriginalSettings();
}
function renderSecPick(){
  let box = $('#secPick');
  if (!box){
    box = document.createElement('div'); box.id = 'secPick'; box.className = 'row';
    box.style.marginTop = '12px';
    $('#songGrid').after(box);
  }
  if (!G.song){ box.innerHTML = '<span class="sub">先點一首歌</span>'; return; }
  box.innerHTML = '<span class="sub">段落：</span>';
  G.song.sections.forEach((sec,i)=>{
    const b = document.createElement('button');
    b.className = 'btn small ' + (i===G.secIdx ? '' : 'ghost');
    b.textContent = `${sec.name}（${fmtChords(sec.chords).length} 小節）`;
    b.onclick = ()=>{ G.secIdx = i; renderSecPick(); };
    box.appendChild(b);
  });
}

/* ---------- 開始 ---------- */
async function startGame(){
  if ($('#sourceMode').value === 'youtube') return startYouTubeGame();
  quitGame();
  G.youtube = false; G.freePlay = false; G.paused = false; G.extra = 0; G.reasons = {chord:0,timing:0};
  $('#videoPanel').hidden = true;
  $('#btnPause').textContent = '暫停';
  if (A.ctx) await A.ctx.resume();
  if (!G.song){ toast('先選一首歌'); return; }
  if (!A.running){ toast('還沒開始收音，先回校準頁'); return; }
  const sec = G.song.sections[G.secIdx];
  G.chords = fmtChords(sec.chords);
  if (!G.chords.length){ toast('和弦譜是空的，請先加入和弦'); return; }
  const bad = G.chords.filter(c=>!chordInfo(c));
  if (bad.length){ toast('這些和弦沒有指法：' + [...new Set(bad)].join(' ')); return; }

  G.timed = G.diff !== 'easy' || !!G.bgBuffer || !$('#waitMode').checked;
  if (G.bgBuffer && (!(+$('#bgOffset').value >= 0) || +$('#bgOffset').value >= G.bgBuffer.duration)){ toast('音檔起點必須在音檔長度內'); return; }
  G.bpm = +$('#bpm').value; G.tol = +$('#tol').value;
  G.pattern = PATTERNS.find(p=>p.id === $('#patSel').value) || PATTERNS[0];
  G.idx = 0; G.score = 0; G.combo = 0; G.maxCombo = 0; G.hit = 0; G.total = 0;
  G.per = {}; G.trans = {}; G.notes = []; G.pending = []; G.barLabels = []; G.running = true;
  G.cands = [...new Set([...G.chords, ...COMMON])];
  G.chords.forEach(c=>{ if(!G.per[c]) G.per[c] = {ok:0, no:0}; });

  $('#playTitle').textContent = `${G.song.title} — ${sec.name}`;
  $('#playDiff').textContent = {easy:'簡單',mid:'中等',hard:'困難'}[G.diff];
  $('#playSec').textContent = !G.timed ? '不限時間' : `${G.bpm} BPM`;
  $('#lane').style.display = !G.timed ? 'none' : 'block';
  go('scPlay');
  say('準備好了嗎～', 1400);
  showChord(); updHUD();

  A.onOnset = onPlayerStrum;
  clearInterval(G.timer);
  if (!G.timed){
    G.timer = setInterval(tickEasy, 16);
  } else {
    buildNotes();
    startMetronome();
    G.timer = setInterval(tickRhythm, 16);
  }
}
function quitGame(){
  G.running = false; G.paused = false; A.onOnset = null;
  clearTimeout(G.endTimer);
  if (typeof Y !== 'undefined' && Y.ready) Y.player.pauseVideo();
  if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume().catch(()=>{});
  stopMetronome(); clearInterval(G.timer);
}

/* ---------- 畫面：目前和弦 ---------- */
function showChord(){
  const c = G.chords[G.idx];
  $('#curChord').textContent = c === 'REST' ? '休息' : c || '—';
  $('#curDiagram').innerHTML = c && c !== 'REST' ? diagram(c, 1.45) : '';
  const n = G.chords[G.idx+1];
  $('#nextChord').textContent = n ? n : '最後一個！';
  $('#nextDiagram').innerHTML = n && n !== 'REST' ? diagram(n, 0.95) : '';
  $('#progN').textContent = `${Math.min(G.idx+1,G.chords.length)}/${G.chords.length}`;
  if (c && G.running && !G.timed && $('#demoOn') && $('#demoOn').checked)
    padChord(c, A.ctx.currentTime + 0.05, 0.55, 0.08);
  const hints = {easy:'按好之後，右手刷一下', mid:'跟著伴奏刷四下', hard:'照下面的箭頭刷'};
  $('#curHint').textContent = c === 'REST' ? '這一段先聽，準備下一個和弦' : G.diff === 'easy' && G.timed ? '每小節第一拍刷一下' : hints[G.diff];
}
function updHUD(){
  $('#scoreN').textContent = G.score;
  $('#comboN').textContent = G.combo;
  $('#comboBig').textContent = G.combo >= 3 ? `${G.combo} 連！` : '';
}

/* ---------- 蠑螈 ---------- */
let sayTimer = 0;
function say(txt, ms=1200){
  const b = $('#bubble'); b.textContent = txt; b.classList.add('show');
  clearTimeout(sayTimer); sayTimer = setTimeout(()=>b.classList.remove('show'), ms);
}
function axoReact(kind){
  const a = $('#axo'); a.className = '';
  void a.offsetWidth;
  a.classList.add(kind);
  setTimeout(()=>a.className='', 1100);
}
function fx(sym){
  const w = document.querySelector('#scPlay .axo-wrap'); if (!w) return;
  const e = document.createElement('div');
  e.className = 'fx'; e.textContent = sym;
  e.style.left = (60 + Math.random()*120) + 'px';
  e.style.top = '140px';
  e.style.setProperty('--dx', (Math.random()*80-40) + 'px');
  w.appendChild(e); setTimeout(()=>e.remove(), 1000);
}
const CHEER = ['讚！','就是這個！','好聽！','穩！','再來～','漂亮～'];
const OOPS  = ['嗯…再一次','手指壓緊一點','差一點點','聽起來不太對','慢慢來沒關係'];

/* ---------- 音效 ---------- */
function blip(freq, dur=0.09, type='sine', gain=0.14){
  if (!A.ctx) return;
  const o = A.ctx.createOscillator(), g = A.ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, A.ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, A.ctx.currentTime+dur);
  o.connect(g); g.connect(A.ctx.destination);
  o.start(); o.stop(A.ctx.currentTime+dur+0.02);
}
function clickAt(t, strong){
  if (!$('#clickOn').checked || !A.ctx) return;
  const o = A.ctx.createOscillator(), g = A.ctx.createGain();
  o.type = 'square'; o.frequency.value = strong ? 1600 : 1050;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(strong?0.16:0.08, t+0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t+0.05);
  o.connect(g); g.connect(A.ctx.destination);
  o.start(t); o.stop(t+0.07);
}

/* ---------- 記錄換和弦的成敗：真正卡人的往往不是和弦本身，是「換過去」 ---------- */
function logTransition(fromIdx, toChord, ok, reason = 'chord'){
  if (fromIdx < 0) return;
  const from = G.chords[fromIdx];
  if (!from || from === 'REST' || toChord === 'REST' || from === toChord) return;          // 同一個和弦不算換
  const key = from + ' → ' + toChord;
  if (!G.trans[key]) G.trans[key] = {ok:0, no:0, chord:0, timing:0, from, to:toChord};
  G.trans[key][ok ? 'ok' : 'no']++;
  if (!ok) G.trans[key][reason]++;
}
/* 兩個和弦之間可以不用放開的手指 */
function commonHold(a, b){
  const fa = shapeOf(a), fb = shapeOf(b);
  if (!fa || !fb) return [];
  const out = [];
  for (let i=0;i<6;i++) if (fa[i] > 0 && fa[i] === fb[i]) out.push({str:6-i, fret:fa[i]});
  return out;
}

/* ---------- 和弦判定（延遲一點點再聽，讓撥弦雜音過去） ---------- */
function judgeChordNow(target, winSec){
  const {chroma, notes} = chromaGoertzel(winSec);
  const b = bassPC(notes);
  const rank = matchChord(chroma, G.cands, b);
  const top = rank[0];
  const me = rank.find(r=>r.name === target) || {name:target, score:0};
  const slack = 0.04*G.tol;
  const ok = A.rms > A.rmsGate*0.5 && me.score > 0.68 && ((top.name === target) || me.score >= top.score - slack);
  return {ok, top, me, chroma};
}

/* ================= 簡單模式 ================= */
G.pending = [];
function onPlayerStrum(t){
  if (!G.running || G.paused || (G.youtube && !youtubePlaying())) return;
  const audioTime = t;
  t = gameTime() - inputLatencySeconds();
  if (G.freePlay){ G.strums++; return; }
  if (!G.timed){
    G.pending.push({at:audioTime + 0.20, target:G.chords[G.idx], idx:G.idx});
  } else {
    // 找最接近的音符
    const win = 0.22*G.tol;
    let best = null, bd = 9;
    for (const n of G.notes){
      if (n.state) continue;
      const d = Math.abs(n.t - t);
      if (d < bd){ bd = d; best = n; }
    }
    if (best && bd <= win){
      best.state = 'pending'; best.dt = t - best.t;
      G.pending.push({at:audioTime + 0.17, note:best});
    } else {
      G.extra++;
      showJudge('多彈了', 'var(--dim)');
    }
  }
}
function tickEasy(){
  if (!G.running || G.paused) return;
  drawDetect();
  const now = A.ctx.currentTime;
  while (G.pending.length && G.pending[0].at <= now){
    const p = G.pending.shift();
    if (p.idx !== G.idx) continue;
    const r = judgeChordNow(p.target, 0.30);
    G.total++;
    logTransition(p.idx-1, p.target, r.ok);
    if (r.ok){
      G.hit++; G.per[p.target].ok++;
      G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
      G.score += 100 + Math.min(G.combo,10)*10;
      axoReact('happy'); fx('✨'); blip(880,0.1,'sine',0.12); blip(1320,0.12,'sine',0.08);
      say(CHEER[(Math.random()*CHEER.length)|0]);
      showJudge('對了！','var(--ok)');
      G.idx++;
      if (G.idx >= G.chords.length){ G.endTimer = setTimeout(()=>{ if (G.running) endGame(); }, 700); return; }
      showChord();
    } else {
      G.reasons.chord++; G.per[p.target].no++;
      G.combo = 0;
      axoReact('sad'); blip(160,0.16,'sawtooth',0.10);
      say(OOPS[(Math.random()*OOPS.length)|0], 1600);
      showJudge(`像 ${r.top.name}`, 'var(--bad)');
    }
    updHUD();
  }
}
function showJudge(txt, color){
  const j = $('#judge'); j.textContent = txt; j.style.color = color || '#fff';
  j.classList.remove('show'); void j.offsetWidth; j.classList.add('show');
}

/* ================= 中等 / 困難：跟著拍子 ================= */
function buildNotes(){
  const beat = 60/G.bpm;
  const pat = G.diff === 'easy' ? [1,0,0,0,0,0,0,0] : G.diff === 'mid' ? [1,0,1,0,1,0,1,0] : G.pattern.hits;
  const firstSlot = pat.findIndex(x=>x);
  G.startAt = A.ctx.currentTime + 1.0;
  G.leadBars = 2;
  const lane = $('#lane'); 
  [...lane.querySelectorAll('.note,.barlab')].forEach(e=>e.remove());
  G.chords.forEach((c, ci)=>{
    pat.forEach((h, s)=>{
      if (!h) return;
      const t = G.startAt + ((G.leadBars + ci)*4 + s*0.5)*beat;
      const el = document.createElement('div');
      el.className = 'note'; el.textContent = dirOf(s);
      lane.appendChild(el);
      G.notes.push({t, el, chordIdx:ci, chord:c, slot:s, state:null, isFirst:(s === firstSlot)});
    });
    // 小節上的和弦標籤
    const t0 = G.startAt + ((G.leadBars + ci)*4)*beat;
    const lab = document.createElement('div');
    lab.className = 'barlab';
    lab.style.cssText = 'position:absolute;top:6px;transform:translateX(-50%);font-size:14px;font-weight:800;color:#ffd166';
    lab.textContent = c;
    lane.appendChild(lab);
    G.bars = G.bars || []; 
    G.barLabels = G.barLabels || [];
    G.barLabels.push({t:t0, el:lab});
  });
  G.endAt = G.startAt + (G.leadBars + G.chords.length)*4*beat + 0.3;
  G.total = 0;
}
/* ---------- 伴奏樂器 ---------- */
let noiseBuf = null;
function getNoise(){
  if (noiseBuf) return noiseBuf;
  const n = Math.floor(A.ctx.sampleRate*0.4);
  noiseBuf = A.ctx.createBuffer(1, n, A.ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i=0;i<n;i++) d[i] = Math.random()*2-1;
  return noiseBuf;
}
function backBus(){
  if (!A.backGain){
    A.backGain = A.ctx.createGain();
    A.backGain.connect(A.ctx.destination);
  }
  A.backGain.gain.value = (+$('#backVol').value/100) * 0.5;
  return A.backGain;
}
function kick(t){
  const o = A.ctx.createOscillator(), g = A.ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(135, t);
  o.frequency.exponentialRampToValueAtTime(45, t+0.10);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t+0.22);
  o.connect(g); g.connect(backBus()); o.start(t); o.stop(t+0.25);
}
function snare(t){
  const s = A.ctx.createBufferSource(); s.buffer = getNoise();
  const f = A.ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1900; f.Q.value=0.7;
  const g = A.ctx.createGain();
  g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.13);
  s.connect(f); f.connect(g); g.connect(backBus()); s.start(t); s.stop(t+0.16);
}
function hat(t){
  const s = A.ctx.createBufferSource(); s.buffer = getNoise();
  const f = A.ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=7500;
  const g = A.ctx.createGain();
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.045);
  s.connect(f); f.connect(g); g.connect(backBus()); s.start(t); s.stop(t+0.08);
}
function bassNote(chord, t, dur){
  const r = rootPC(chord); if (r < 0) return;
  const f = 440*Math.pow(2,((36+r)-69)/12);
  const o = A.ctx.createOscillator(), g = A.ctx.createGain();
  o.type = 'triangle'; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.45, t+0.012);
  g.gain.exponentialRampToValueAtTime(0.001, t+dur*0.95);
  o.connect(g); g.connect(backBus()); o.start(t); o.stop(t+dur);
}
function padChord(chord, t, dur, vol){
  const info = chordInfo(chord); if (!info) return;
  vol = vol || 0.10;
  info.pcs.forEach(p=>{
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 440*Math.pow(2,((60+p)-69)/12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t+0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(g); g.connect(backBus()); o.start(t); o.stop(t+dur+0.05);
  });
}

/* ---------- 伴奏排程：整首歌帶著你往前走 ---------- */
let metroId = 0, metroNext = 0, metroBeat = 0;
function startMetronome(){
  const beat = 60/G.bpm;
  const mode = $('#backMode').value;
  metroNext = G.startAt; metroBeat = 0;

  // 自己載入的音檔：從第一個小節開始放
  if (G.bgBuffer && mode !== 'off'){
    const s = A.ctx.createBufferSource();
    s.buffer = G.bgBuffer;
    const g = A.ctx.createGain(); g.gain.value = +$('#backVol').value/100;
    s.connect(g); g.connect(A.ctx.destination);
    const at = G.startAt + G.leadBars*4*beat;
    s.start(at, Math.max(0, +$('#bgOffset').value));
    G.bgSource = s; G.bgGain = g;
    s.onended = ()=>{ if (G.running && G.bgSource === s) endGame(); };
  }

  metroId = setInterval(()=>{
    if (!A.ctx || G.paused) return;
    const ahead = A.ctx.currentTime + 0.25;
    while (metroNext < ahead){
      const b = metroBeat, inBar = b % 4, bar = Math.floor(b/4);
      const ci = bar - G.leadBars;
      clickAt(metroNext, inBar === 0);
      if (mode !== 'off' && !G.bgBuffer){
        if (inBar === 0 || inBar === 2) kick(metroNext);
        if (inBar === 1 || inBar === 3) snare(metroNext);
        hat(metroNext); hat(metroNext + beat/2);
        if (mode !== 'drums' && ci >= 0 && ci < G.chords.length){
          const ch = G.chords[ci];
          bassNote(ch, metroNext, beat*0.9);
          if (mode === 'full' && (inBar === 0 || inBar === 2))
            padChord(ch, metroNext, beat*1.8, inBar === 0 ? 0.10 : 0.07);
        }
      }
      metroNext += beat; metroBeat++;
    }
  }, 30);
}
function stopMetronome(){
  clearInterval(metroId);
  if (G.bgSource){ try{ G.bgSource.stop(); }catch(e){} G.bgSource = null; }
}

function tickRhythm(){
  if (!G.running || G.paused || (G.youtube && !youtubePlaying())) return;
  drawDetect();
  const now = gameTime();
  const lane = $('#lane'), W = lane.clientWidth;
  const hitX = W*0.14;
  const look = (60/G.bpm)*4*2;                 // 畫面上看得到兩小節
  const pps = (W - hitX - 20)/look;

  // 音符位置
  for (const n of G.notes){
    const dt = n.t - now;
    if (dt > look){ n.el.style.display = 'none'; continue; }
    n.el.style.display = 'block';
    n.el.style.left = (hitX + dt*pps) + 'px';
    if (!n.state && dt < -0.22*G.tol){
      n.state = 'miss'; n.el.classList.add('miss');
      G.reasons.timing++; G.total++; G.per[n.chord].no++; G.combo = 0; updHUD();
      if (n.isFirst) logTransition(n.chordIdx-1, n.chord, false, 'timing');
      axoReact('sad'); showJudge('沒彈到', 'var(--bad)');
    }
    if (dt < -0.9) n.el.style.display = 'none';
  }
  for (const b of (G.barLabels||[])){
    const dt = b.t - now;
    if (dt > look || dt < -0.9){ b.el.style.display = 'none'; continue; }
    b.el.style.display = 'block';
    b.el.style.left = (hitX + dt*pps + 14) + 'px';
  }

  // 目前小節 → 更新大和弦圖
  const beat = 60/G.bpm;
  const ci = G.youtube ? G.chart.findIndex(row=>now >= row.time && now < row.end) : Math.floor((now - G.startAt)/(beat*4)) - G.leadBars;
  if (ci === 0 && G.idx === 0 && $('#curHint').textContent.startsWith('準備')) showChord();
  if (ci >= 0 && ci !== G.idx && ci < G.chords.length){ G.idx = ci; showChord(); }
  if (ci < 0 && !G.youtube){
    const cd = Math.ceil((G.startAt + G.leadBars*4*beat - now)/beat);
    $('#curHint').textContent = `預備… ${cd}`;
  }

  // 延遲判定
  while (G.pending.length && G.pending[0].at <= A.ctx.currentTime){
    const p = G.pending.shift();
    const n = p.note;
    const r = judgeChordNow(n.chord, 0.18);
    G.total++;
    if (n.isFirst) logTransition(n.chordIdx-1, n.chord, r.ok);
    const adt = Math.abs(n.dt);
    if (r.ok){
      const perfect = adt < 0.085*G.tol;
      G.hit++; G.per[n.chord].ok++;
      G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
      G.score += (perfect?150:90) + Math.min(G.combo,20)*5;
      n.state = 'hit'; n.el.classList.add('hit');
      showJudge(perfect?'PERFECT':'GOOD', perfect?'var(--warn)':'var(--ok)');
      if (perfect) fx('⭐'); else fx('♪');
      if (G.combo % 4 === 0){ axoReact('happy'); say(CHEER[(Math.random()*CHEER.length)|0], 900); }
    } else {
      G.reasons.chord++; G.per[n.chord].no++; G.combo = 0;
      n.state = 'miss'; n.el.classList.add('miss');
      showJudge(`和弦像 ${r.top.name}`, 'var(--bad)');
      axoReact('sad');
    }
    updHUD();
  }

  if (now > G.endAt){ endGame(); }
}

/* ---------- 即時偵測面板 ---------- */
let lastDraw = 0;
function drawDetect(){
  const now = performance.now();
  if (now - lastDraw < 110) return;
  lastDraw = now;
  const ch = chromaFFT();
  A.liveChroma = ch;
  drawChroma('#chroma2', ch);
  if (A.rms > A.rmsGate*0.7){
    const rank = matchChord(ch, G.cands.length?G.cands:COMMON, -1);
    $('#guess2').textContent = rank[0].name;
    $('#guess2').style.cssText = 'font-size:26px;font-weight:900;text-align:center;color:' +
      (G.running && rank[0].name === G.chords[G.idx] ? 'var(--ok)' : 'var(--ink)');
    $('#guessConf2').textContent = `音型相似度 ${clamp(rank[0].score*100,0,100).toFixed(0)}%`;
  }
  if(A.rms <= A.rmsGate*0.7){ $('#guess2').textContent='—'; $('#guessConf2').textContent='等待吉他聲音'; }
  const mb = $('#meterBar2'); if (mb) mb.style.width = clamp(A.rms*900,0,100) + '%';
}
function drawChroma(sel, ch){
  const box = document.querySelector(sel); if (!box) return;
  const bars = box.children;
  for (let i=0;i<12;i++){
    if (!bars[i]) continue;
    bars[i].style.height = Math.max(2, ch[i]*100) + '%';
    bars[i].classList.toggle('hot', ch[i] > 0.62);
  }
}
function drawMeters(){
  const m = $('#meterBar'); if (m) m.style.width = clamp(A.rms*900,0,100) + '%';
}

/* ---------- 結算 ---------- */
function transTip(from, to){
  const hold = commonHold(from, to);
  if (barreFret(shapeOf(to)||[]))
    return `${to} 是封閉和弦：食指先橫按到位，其他手指再一起落下`;
  if (hold.length)
    return `${hold.map(h=>`第${h.str}弦第${h.fret}格`).join('、')}位置相同，可試著保留作支點（依實際指法調整）`;
  if (barreFret(shapeOf(from)||[]))
    return `從 ${from} 放開時容易慢半拍，提早一點放`;
  return '先不出聲換十次，手指記住位置再配拍子';
}
function endGame(){
  if (!G.running) return;
  const played = G.youtube ? Y.player.getCurrentTime() : 0;
  quitGame();
  $('#resSummary').textContent = G.freePlay ? `跟彈到 ${formatTime(played)}，共偵測 ${G.strums} 次刷弦。尚無校對時間譜，這次不評分。` : `已判定 ${G.total} 次 · 和弦不符 ${G.reasons.chord} 次 · 未跟上節拍 ${G.reasons.timing} 次 · 額外刷弦 ${G.extra} 次（另列，不扣分）`;
  if (G.freePlay){
    $('#resTitle').textContent = '今天也有好好練琴！';
    ['resScore','resAcc','resCombo','resStars'].forEach(id=>$('#'+id).textContent='—');
    $('#resTrans').textContent = '加入已校對的原曲時間譜後，這裡會分析換和弦的成功率。';
    $('#resTable').textContent = '自由跟彈不判對錯。'; go('scResult'); return;
  }
  const acc = G.total ? Math.round(G.hit/G.total*100) : 0;
  $('#resScore').textContent = G.score;
  $('#resAcc').textContent = acc + '%';
  $('#resCombo').textContent = G.maxCombo;
  const stars = acc >= 90 ? '★★★' : acc >= 70 ? '★★☆' : acc >= 45 ? '★☆☆' : '☆☆☆';
  $('#resStars').textContent = stars;
  $('#resTitle').textContent = acc >= 90 ? '蠑螈超開心！' : acc >= 70 ? '進步很多！' : '再練一次會更好';
  $('#axoEnd').className = acc >= 70 ? 'cheer' : '';
  // 換和弦分析：使用者最想知道的是「哪兩個和弦之間會卡」
  const tr = Object.entries(G.trans).map(([k,v])=>{
    const n = v.ok + v.no;
    return {k, ...v, n, rate: v.ok/n};
  }).filter(x=>x.n > 0).sort((a,b)=> a.rate - b.rate || b.n - a.n);

  if (!tr.length){
    $('#resTrans').innerHTML = '<p class="sub">這次沒有換到不同的和弦，換一個長一點的段落再試試。</p>';
  } else {
    const worst = tr.filter(x=>x.rate < 1);
    const head = worst.length
      ? `<p class="sub" style="margin-top:0">這幾個換法最容易掉拍，下次先單獨練它們：</p>`
      : `<p class="sub" style="margin-top:0">每個換和弦都接得起來，很穩。</p>`;
    $('#resTrans').innerHTML = head + '<table><tr><th>換法</th><th>成功</th><th>失敗</th><th>和弦錯／漏拍</th><th>接得順嗎</th><th>怎麼練</th></tr>' +
      tr.slice(0,8).map(x=>{
        const pct = Math.round(x.rate*100);
        const col = pct >= 85 ? 'var(--ok)' : pct >= 55 ? 'var(--warn)' : 'var(--bad)';
        return `<tr><td><b>${x.k}</b></td><td>${x.ok}</td><td>${x.no}</td>` +
               `<td>${x.chord||0}／${x.timing||0}</td><td style="color:${col};font-weight:700">${pct}%</td><td>${transTip(x.from, x.to)}</td></tr>`;
      }).join('') + '</table>';
  }

  const rows = Object.entries(G.per).filter(([k,v])=>v.ok+v.no>0)
    .sort((a,b)=> (a[1].ok/(a[1].ok+a[1].no)) - (b[1].ok/(b[1].ok+b[1].no)));
  $('#resTable').innerHTML = '<table><tr><th>和弦</th><th>成功</th><th>失敗</th><th>正確率</th><th>建議</th></tr>' +
    rows.map(([k,v])=>{
      const r = Math.round(v.ok/(v.ok+v.no)*100);
      const tip = r>=85 ? '很穩' : r>=60 ? '再熟一點' : (barreFret(shapeOf(k)||[]) ? '封閉和弦，手腕角度要正' : '確認每根弦都有聲音');
      return `<tr><td><b>${k}</b></td><td>${v.ok}</td><td>${v.no}</td><td>${r}%</td><td>${tip}</td></tr>`;
    }).join('') + '</table>';
  go('scResult');
}
/* 官方播放器只提供播放與時間軸；吉他分析始終只讀麥克風輸入。 */
const OFFICIAL = {
  jue:{id:'R2s-H_crYkc',channel:'滾石唱片 ROCK RECORDS'},
  xwg:{id:'f6qn6C_sU-4',channel:'相信音樂 BinMusic'},
  ifu:{id:'MehNUIRekX4',channel:'LUNA SEA'},
  comp:{id:'5NPBIwQyPWE',channel:'Avril Lavigne'},
  gf:{id:'Bg59q4puhmg',channel:'Avril Lavigne'}
};
const Y = {player:null,ready:false,promise:null,lastTime:null,lastWall:null,timer:0};
function escapeHTML(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatTime(s){ s=Math.max(0,Math.floor(s||0)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function inputLatencySeconds(){ return clamp(Number($('#inputLatency').value)||0,0,500)/1000; }
function gameTime(){ return G.youtube && Y.ready ? Y.player.getCurrentTime() : A.ctx.currentTime; }
function youtubePlaying(){ return Y.ready && Y.player.getPlayerState() === 1; }
function clearLocalAudio(){
  G.bgBuffer=null; $('#bgFile').value=''; $('#bgName').textContent='未載入（用內建伴奏）'; $('#bgOffset').value=0;
}
function chartKey(){ return 'axo_original_'+G.song.id+'_'+OFFICIAL[G.song.id].id; }
function readOriginalChart(){ try{return localStorage.getItem(chartKey())||'';}catch{return '';} }
function refreshOriginalSettings(){
  const original = $('#sourceMode').value==='youtube';
  $('#originalSettings').hidden=!original;
  const video=G.song && OFFICIAL[G.song.id];
  $('#originalInfo').textContent = video ? `${G.song.title} · ${video.channel} 官方 MV · ${readOriginalChart() ? '使用你儲存的時間譜評分' : '自由跟彈（未校對時間譜）'}` : '暖身與自訂歌曲請選合成伴奏／本機音檔；其餘五首可播放官方 MV。';
  $('#originalChart').value=video ? readOriginalChart() : '';
  $('#chartStatus').textContent='';
  $('#btnStart').textContent=original ? (video && readOriginalChart() ? '跟原曲評分 ♪' : '播放原曲・自由跟彈 ♪') : '開始練習 ♪';
  ['backMode','bgOffset','btnBgPick','btnBgClear','demoOn','bpm','clickOn','waitMode'].forEach(id=>$('#'+id).disabled=original);
  $('#saveOriginalChart').disabled=!video; $('#clearOriginalChart').disabled=!video;
}
function parseOriginalChart(raw){
  const lines=raw.trim().split(/\n/).map(x=>x.trim()).filter(Boolean);
  if(lines.length<2) throw Error('至少要有一個小節，以及最後的 END 時間。');
  const rows=lines.map((line,i)=>{
    const parts=line.split(/\s+/);
    if(parts.length!==2 || !/^\d+(\.\d+)?$/.test(parts[0])) throw Error(`第 ${i+1} 行請填「秒數 和弦」。`);
    const time=Number(parts[0]), chord=parts[1];
    if(!Number.isFinite(time)||time<0||time>86400) throw Error(`第 ${i+1} 行時間不正確。`);
    if(chord!=='END' && chord!=='REST' && !chordInfo(chord)) throw Error(`第 ${i+1} 行的和弦 ${chord} 尚未定義指法。`);
    return {time,chord};
  });
  if(rows.at(-1).chord!=='END') throw Error('最後一行請用「秒數 END」標記練習終點。');
  rows.forEach((r,i)=>{
    if(i && r.time<=rows[i-1].time) throw Error('秒數必須依序增加，不能重複。');
    if(i<rows.length-1 && r.chord==='END') throw Error('END 只能放在最後一行。');
    if(i<rows.length-1 && rows[i+1].time-r.time<0.4) throw Error('每小節至少 0.4 秒，請確認時間。');
  });
  const chart=rows.slice(0,-1).map((r,i)=>({...r,end:rows[i+1].time}));
  if(!chart.some(r=>r.chord!=='REST')) throw Error('時間譜至少要有一個和弦。');
  if(chart.length>1500) throw Error('最多支援 1500 小節。');
  return chart;
}
function loadYouTube(){
  if(Y.ready) return Promise.resolve();
  if(Y.promise) return Y.promise;
  Y.promise=new Promise((resolve,reject)=>{
    let done=false;
    const fail=()=>{if(done)return;done=true;Y.promise=null;if(Y.player){Y.player.destroy();Y.player=null;}reject(Error('YouTube 載入逾時，請檢查網路或使用官方影片連結。'));};
    const timeout=setTimeout(fail,18000);
    const create=()=>{
      if(done)return;
      if(!document.getElementById('youtubePlayer')){const el=document.createElement('div');el.id='youtubePlayer';$('#videoPanel').prepend(el);}
      Y.player=new YT.Player('youtubePlayer',{
        width:480,height:270,host:'https://www.youtube.com',
        playerVars:{playsinline:1,origin:location.origin,rel:0},
        events:{onReady:()=>{if(done)return;done=true;clearTimeout(timeout);Y.ready=true;resolve();},
          onStateChange:youtubeState,
          onError:e=>{ $('#videoStatus').textContent=`影片無法嵌入播放（${e.data}）。可點官方連結觀看，或改用本機音檔。`; if(G.running && G.youtube) {G.paused=true;$('#btnPause').textContent='重試播放';}},
          onAutoplayBlocked:()=>{$('#videoStatus').textContent='請點影片中央的播放鍵開始。';}}
      });
    };
    if(window.YT && YT.Player) create();
    else {
      window.onYouTubeIframeAPIReady=create;
      let script=document.getElementById('youtubeApi');
      if(!script){script=document.createElement('script');script.id='youtubeApi';script.src='https://www.youtube.com/iframe_api';document.head.appendChild(script);}
      script.onerror=()=>{clearTimeout(timeout);script.remove();fail();};
    }
  });
  return Y.promise;
}
function youtubeState(e){
  if(!G.youtube || !G.running)return;
  const playing=e.data===1;
  G.paused=!playing;
  $('#btnPause').textContent=playing?'暫停':'繼續';
  $('#videoStatus').textContent=({1:'原曲播放中 · 戴耳機練習',2:'已暫停 · 評分也暫停',3:'影片緩衝中 · 評分暫停',5:'請點影片播放鍵',0:'播放結束'})[e.data]||'等待 YouTube 播放…';
  if(!playing){
    G.pending.forEach(p=>{if(p.note && p.note.state==='pending')p.note.state=null;});
    G.pending=[];
  }
  if(e.data===0) endGame();
}
async function startYouTubeGame(){
  if(!G.song || !OFFICIAL[G.song.id]){toast('請選五首原曲之一，或切換到合成伴奏練暖身。');return;}
  if(!A.running){toast('先回校準頁開始吉他收音。');return;}
  let chart=[];
  try{ const raw=readOriginalChart();if(raw)chart=parseOriginalChart(raw); }catch(e){toast(e.message,4000);return;}
  quitGame();
  G.youtube=true; G.freePlay=!chart.length; G.timed=true; G.chart=chart;
  G.paused=true; G.strums=0; G.extra=0; G.reasons={chord:0,timing:0};
  G.idx=0; G.score=0; G.combo=0; G.maxCombo=0; G.hit=0; G.total=0;
  G.per={}; G.trans={}; G.notes=[]; G.pending=[]; G.barLabels=[];
  G.tol=+$('#tol').value; G.bpm=+$('#bpm').value;
  G.pattern=PATTERNS.find(p=>p.id===$('#patSel').value)||PATTERNS[0];
  G.chords=chart.map(r=>r.chord); G.cands=[...new Set([...G.chords.filter(c=>c!=='REST'),...COMMON])];
  G.chords.forEach(c=>G.per[c]={ok:0,no:0});
  $('#playTitle').textContent=G.song.title+' · 官方原曲';
  $('#playDiff').textContent=G.freePlay?'自由跟彈':{easy:'簡單・每小節一下',mid:'中等・每小節四下',hard:'困難・指定節奏'}[G.diff];
  $('#playSec').textContent=G.freePlay?'尚無時間譜・不評分':'自訂時間譜';
  $('#videoPanel').hidden=false; $('#lane').style.display=G.freePlay?'none':'block';
  $('#videoTitle').textContent=G.song.title+' — '+OFFICIAL[G.song.id].channel;
  $('#videoLink').href='https://www.youtube.com/watch?v='+OFFICIAL[G.song.id].id;
  $('#videoStatus').textContent='載入官方播放器…';
  $('#btnPause').textContent='繼續'; updHUD(); go('scPlay');
  if(G.freePlay){
    $('#curChord').textContent='跟彈'; $('#curDiagram').innerHTML=''; $('#nextChord').textContent='聽原唱・練手感';$('#nextDiagram').innerHTML='';
    $('#curHint').textContent='目前不判對錯，右側顯示你彈的和弦';$('#progN').textContent='0:00';
  }else{buildOriginalNotes();showChord();}
  $('#btnStart').disabled=true;
  const token=G.loadToken=(G.loadToken||0)+1;
  try{
    await A.ctx.resume(); await loadYouTube();
    if(G.loadToken!==token || !$('#scPlay').classList.contains('on'))return;
    G.running=true; A.onOnset=onPlayerStrum; Y.lastTime=null;Y.lastWall=null;
    Y.player.setVolume(+$('#youtubeVolume').value); Y.player.setPlaybackRate(1);
    Y.player.loadVideoById({videoId:OFFICIAL[G.song.id].id,startSeconds:chart.length?Math.max(0,chart[0].time-3):0});
    G.timer=setInterval(tickYouTube,30);
  }catch(e){$('#videoStatus').textContent=e.message;toast(e.message,5000);}
  finally{$('#btnStart').disabled=false;}
}
function buildOriginalNotes(){
  const lane=$('#lane');lane.querySelectorAll('.note,.barlab').forEach(e=>e.remove());
  const pat=G.diff==='easy'?[1,0,0,0,0,0,0,0]:G.diff==='mid'?[1,0,1,0,1,0,1,0]:G.pattern.hits;
  G.chart.forEach((row,ci)=>{
    if(row.chord==='REST')return;
    pat.forEach((hit,slot)=>{
      if(!hit)return;
      const el=document.createElement('div');el.className='note';el.textContent=dirOf(slot);lane.appendChild(el);
      G.notes.push({t:row.time+(row.end-row.time)*slot/8,el,chordIdx:ci,chord:row.chord,slot,state:null,isFirst:slot===pat.findIndex(Boolean)});
    });
  });
  G.startAt=G.chart[0].time;G.leadBars=0;G.endAt=G.chart.at(-1).end;
}
function tickYouTube(){
  if(!G.running)return;
  drawDetect();
  const now=gameTime(),wall=performance.now()/1000;
  // Seeking makes the current score incomparable. Finish the partial take, never mark skipped notes as misses.
  if(Y.lastTime!==null && Math.abs((now-Y.lastTime)-(youtubePlaying()?(wall-Y.lastWall)*(Y.player.getPlaybackRate()||1):0))>1.2){
    endGame();toast('影片位置已移動，本次已結算。按再來一次重新練習。',4500);return;
  }
  Y.lastTime=now;Y.lastWall=wall;
  if(!youtubePlaying() || G.paused)return;
  $('#playSec').textContent=formatTime(now)+' / '+formatTime(Y.player.getDuration());
  if(G.freePlay){$('#progN').textContent=formatTime(now);return;}
  if(now<G.chart[0].time){$('#curHint').textContent=`準備… ${Math.ceil(G.chart[0].time-now)} 秒`;}
  tickRhythm();
}
async function togglePause(forcePause=false){
  if(!G.running)return;
  if(G.youtube){
    if(forcePause || youtubePlaying())Y.player.pauseVideo();
    else {await A.ctx.resume();Y.player.playVideo();}
    return;
  }
  G.paused=forcePause||!G.paused;
  if(G.paused)await A.ctx.suspend();else await A.ctx.resume();
  $('#btnPause').textContent=G.paused?'繼續':'暫停';
}
$('#sourceMode').onchange=refreshOriginalSettings;
$('#youtubeVolume').oninput=()=>{if(Y.ready)Y.player.setVolume(+$('#youtubeVolume').value);};
$('#btnPause').onclick=()=>togglePause();
$('#saveOriginalChart').onclick=()=>{
  if(!G.song || !OFFICIAL[G.song.id])return;
  try{parseOriginalChart($('#originalChart').value);localStorage.setItem(chartKey(),$('#originalChart').value.trim());refreshOriginalSettings();$('#chartStatus').textContent='已儲存在這台瀏覽器。';}
  catch(e){$('#chartStatus').textContent=e.message;}
};
$('#clearOriginalChart').onclick=()=>{
  if(!G.song || !OFFICIAL[G.song.id])return;
  try{localStorage.removeItem(chartKey());refreshOriginalSettings();}catch(e){toast('瀏覽器不允許儲存設定');}
};

/* ==========================================================
   介面綁定
   ========================================================== */
function buildChromaBars(){
  ['#chroma','#chroma2'].forEach(sel=>{
    const box = document.querySelector(sel); if (!box) return;
    box.innerHTML = '';
    for (let i=0;i<12;i++) box.appendChild(document.createElement('div'));
  });
  ['#chromaLbl','#chromaLbl2'].forEach(sel=>{
    const box = document.querySelector(sel); if (!box) return;
    box.innerHTML = PC.map(p=>`<div>${p}</div>`).join('');
  });
}

/* 設定頁的即時顯示 */
let lastLive = 0;
function drawLive(){
  if (!$('#scSetup').classList.contains('on')) return;
  const now = performance.now();
  if (now - lastLive < 110) return;
  lastLive = now;
  const ch = chromaFFT();
  drawChroma('#chroma', ch);
  if (A.rms > A.rmsGate*0.7){
    const b = -1;
    const rank = matchChord(ch, COMMON, b);
    $('#guess').textContent = rank[0].name;
    $('#guessConf').textContent = `把握度 ${(rank[0].score*100).toFixed(0)}% · 次像：${rank[1].name}`;
  }
}

/* ---------- 收音 ---------- */
$('#btnMic').onclick = async ()=>{
  try{
    $('#micState').textContent = '要求權限中…';
    await initAudio($('#devSel').value || null);
    await listDevices();
    $('#micState').textContent = '收音中 ✔';
    $('#micState').style.color = 'var(--ok)';
    $('#btnToSongs').disabled = false;
    setSens(+$('#sens').value);
    toast('聽得到了！刷一下試試');
  }catch(e){
    $('#micState').textContent = '失敗：' + e.name;
    $('#micState').style.color = 'var(--bad)';
    toast('拿不到聲音輸入：' + e.message, 4000);
  }
};
$('#devSel').onchange = async ()=>{ if (A.running) try{await initAudio($('#devSel').value);}catch(e){toast('切換輸入失敗：'+e.message,4000);} };
$('#sens').oninput = e => { $('#sensVal').textContent = e.target.value; setSens(+e.target.value); };

/* ---------- 自動校準 ---------- */
$('#btnAutoCal').onclick = ()=>{
  if (!A.running){ toast('先按「允許並開始收音」'); return; }
  const btn = $('#btnAutoCal'); btn.disabled = true;
  let nR = 0, nF = 0, n = 0;
  btn.textContent = '安靜…不要彈（2 秒）';
  const t1 = setInterval(()=>{ nR = Math.max(nR, A.rms); nF = Math.max(nF, A.flux); n++; }, 30);
  setTimeout(()=>{
    clearInterval(t1);
    A.noiseRms = nR; A.noiseFlux = nF;
    let peaks = [];
    btn.textContent = '現在用力刷 3 下！（5 秒）';
    const t2 = setInterval(()=>{ peaks.push(A.flux); }, 25);
    setTimeout(()=>{
      clearInterval(t2);
      peaks.sort((a,b)=>b-a);
      const pk = peaks.slice(0,6).reduce((a,b)=>a+b,0)/6 || nF*6;
      A.fluxThresh = Math.max(nF*2.2, pk*0.22);
      A.rmsGate = Math.max(nR*2.6, 0.0018);
      $('#calInfo').textContent =
        `noise floor: rms ${nR.toFixed(5)} / flux ${nF.toFixed(3)} · 觸發門檻: flux ${A.fluxThresh.toFixed(3)} / rms ${A.rmsGate.toFixed(4)} · 刷弦峰值 ${pk.toFixed(3)}`;
      btn.disabled = false; btn.textContent = '自動校準（先安靜 2 秒，再刷 3 下）';
      toast('校準完成！');
    }, 5000);
  }, 2000);
};

/* ---------- 調音器 ---------- */
let tunerId = 0;
const STRING_TARGET = ['E','A','D','G','B','E'];
$('#btnTuner').onclick = ()=>{
  if (tunerId){ clearInterval(tunerId); tunerId = 0; $('#tunerOut').textContent = ''; $('#btnTuner').textContent = '調音器'; return; }
  if (!A.running){ toast('先開始收音'); return; }
  $('#btnTuner').textContent = '停止調音';
  tunerId = setInterval(()=>{
    const p = detectPitch();
    if (!p){ $('#tunerOut').textContent = '（撥一根空弦）'; return; }
    const arrow = p.cents > 8 ? '太緊 ↓' : p.cents < -8 ? '太鬆 ↑' : '準 ✔';
    const col = Math.abs(p.cents) <= 8 ? 'var(--ok)' : 'var(--warn)';
    $('#tunerOut').innerHTML = `<b style="color:${col}">${p.note}${p.octave}</b> ${p.cents>0?'+':''}${p.cents}¢ ${arrow}
      <span style="font-size:12px;color:var(--dim)"> ${p.freq.toFixed(1)}Hz</span>`;
  }, 180);
};

/* ---------- 選歌頁 ---------- */
$$('#diffRow button').forEach(b=>{
  b.onclick = ()=>{
    $$('#diffRow button').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel'); G.diff = b.dataset.d;
    $('#patSel').parentElement.style.opacity = (G.diff === 'hard') ? 1 : .4;
  };
});
$('#bpm').oninput = e => $('#bpmVal').textContent = e.target.value;
$('#btnStart').onclick = startGame;
$('#btnQuit').onclick = ()=>{ G.loadToken=(G.loadToken||0)+1; if(G.running)endGame();else{quitGame();go('scSelect');} };
$('#btnRetry').onclick = startGame;

/* ---------- 自己的伴奏音檔（只留在這台電腦，不會上傳） ---------- */
$('#btnBgPick').onclick = ()=> $('#bgFile').click();
$('#bgFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  if(!G.song){toast('請先選歌，再載入這首的音檔');return;}
  const songId=G.song.id; G.bgBuffer=null;
  try{
    if (!A.ctx) A.ctx = new (window.AudioContext||window.webkitAudioContext)();
    $('#bgName').textContent = '讀取中…';
    const buf = await f.arrayBuffer();
    const decoded = await A.ctx.decodeAudioData(buf);
    if(!G.song || G.song.id!==songId)return;
    G.bgBuffer = decoded;
    $('#bgName').textContent = `${f.name}（${G.bgBuffer.duration.toFixed(1)} 秒）`;
    toast('伴奏載入好了，記得把 BPM 調成跟這首歌一樣');
  }catch(err){
    $('#bgName').textContent = '這個檔案讀不出來';
    toast('讀不出來：' + err.message, 3500);
  }
};
$('#btnBgClear').onclick = clearLocalAudio;
$('#backVol').oninput = ()=>{ if (A.backGain) A.backGain.gain.value = (+$('#backVol').value/100)*0.5; if(G.bgGain)G.bgGain.gain.value=+$('#backVol').value/100; };

/* ---------- 和弦譜編輯器 ---------- */
function editorOpen(){
  const s = $('#edSong'); s.innerHTML = '';
  G.songs.forEach((sg,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=sg.title; s.appendChild(o); });
  s.value = Math.max(0, G.songs.indexOf(G.song));
  edSecFill();
  $('#edChordList').innerHTML = Object.keys(SHAPES).map(n=>`<span class="tag">${n}</span>`).join('');
}
function edSecFill(){
  const sg = G.songs[+$('#edSong').value];
  const s = $('#edSec'); s.innerHTML = '';
  sg.sections.forEach((sec,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=sec.name; s.appendChild(o); });
  edLoad();
}
function edLoad(){
  const sg = G.songs[+$('#edSong').value];
  $('#edText').value = sg.sections[+$('#edSec').value].chords;
}
$('#edSong').onchange = edSecFill;
$('#edSec').onchange = edLoad;
$('#edSave').onclick = ()=>{
  const sg = G.songs[+$('#edSong').value];
  const raw = $('#edText').value;
  // 支援自訂指法：Gm=355333
  const toks = raw.replace(/\|/g,' ').split(/\s+/).filter(Boolean);
  const out = [];
  for (const t of toks){
    if (t.includes('=')){
      const [n, sh] = t.split('=');
      if (!/^[A-G][#b]?(?:m|maj|sus|add|dim|aug)?[0-9]*(?:\/[A-G][#b]?)?$/.test(n) || !/^[0-9xX]{6}$/.test(sh)){ $('#edMsg').textContent = `指法要六個字元：${t}`; return; }
      SHAPES[n] = sh.toLowerCase();
      out.push(n);
    } else out.push(t);
  }
  if(!out.length){$('#edMsg').textContent='請至少輸入一個和弦';return;}
  const bad = out.filter(c=>!chordInfo(c));
  if (bad.length){ $('#edMsg').textContent = '沒有指法的和弦：' + [...new Set(bad)].join(' ') + '（可用 名稱=指法 自己定義）'; return; }
  sg.sections[+$('#edSec').value].chords = out.join(' ');
  saveSongs();
  localStorage.setItem('axo_shapes', JSON.stringify(SHAPES));
  $('#edMsg').textContent = `已儲存 ✔（${out.length} 小節）`;
  setTimeout(()=>$('#edMsg').textContent='', 2500);
};
$('#edAddSec').onclick = ()=>{
  const sg = G.songs[+$('#edSong').value];
  const name = prompt('段落名稱', '新段落' + (sg.sections.length+1));
  if (!name) return;
  sg.sections.push({name, chords:'C G Am F'});
  saveSongs(); edSecFill();
  $('#edSec').value = sg.sections.length-1; edLoad();
};
$('#edNewSong').onclick = ()=>{
  const title = prompt('歌名');
  if (!title) return;
  G.songs.push({id:'u'+Date.now(), title, artist:'自訂', note:'自己加的譜', bpm:72,
    sections:[{name:'段落 1', chords:'C G Am F'}]});
  saveSongs(); editorOpen();
  $('#edSong').value = G.songs.length-1; edSecFill();
};
$('#edReset').onclick = ()=>{
  if (!confirm('把所有歌曲還原成內建版本？自訂的譜會不見。')) return;
  localStorage.removeItem('axo_songs');
  loadSongs(); G.song = null; editorOpen(); renderSongs();
  $('#edMsg').textContent = '已還原';
};

/* ---------- 啟動 ---------- */
(function init(){
  try{
    const sh = JSON.parse(localStorage.getItem('axo_shapes')||'null');
    if (sh) Object.assign(SHAPES, sh);
  }catch(e){}
  loadSongs();
  buildChromaBars();
  const ps = $('#patSel');
  PATTERNS.forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; ps.appendChild(o); });
  ps.value = 'folk';
  $('#patSel').parentElement.style.opacity = .4;
  G.cands = COMMON;
  renderSongs();
  listDevices();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    toast('這個瀏覽器不支援錄音，請用 Chrome 或 Edge 開啟', 6000);
  }
  document.addEventListener('keydown', e=>{
    if (e.key === 'Escape' && G.running){ quitGame(); go('scSelect'); }
  });
  // 切到別的分頁時瀏覽器會凍結計時器，拍子會整個跑掉 —— 直接停下來比較誠實
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden && G.running){
      togglePause(true);
      toast('已暫停，回來後按「繼續」接著練。', 3000);
    }
  });
})();
