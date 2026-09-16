
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
