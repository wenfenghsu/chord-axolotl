const fs = require('fs');
let src = fs.readFileSync('build/03_data.js','utf8').replace('<script>','')
        + fs.readFileSync('build/04_audio.js','utf8');
eval(src + ';Object.assign(global,{PC,OPEN_MIDI,SHAPES,shapeOf,chordInfo,goertzel,hann,NOTE_F,MIDI_LO,norm,bassPC,rootPC,templateOf,matchChord,COMMON,harmonicClean});');

const SR = 48000, DUR = 0.30, N = Math.round(SR*DUR);

// 合成一個「刷過去」的吉他和弦：每根弦有基頻 + 6 個諧波，撥弦時間錯開，音量隨機
function synth(name, opt={}){
  const fr = shapeOf(name);
  const buf = new Float32Array(N);
  let strIdx = 0;
  fr.forEach((f,i)=>{
    if (f < 0) return;
    const midi = OPEN_MIDI[i] + f;
    const f0 = 440*Math.pow(2,(midi-69)/12);
    const delay = Math.round((strIdx++)*0.012*SR);          // 刷弦錯開 12ms
    const amp = (0.6 + Math.random()*0.7) * (opt.bassBoost && i<2 ? 1.5 : 1);
    for (let h=1; h<=7; h++){
      const fh = f0*h;
      if (fh > 5000) break;
      const a = amp/Math.pow(h, 1.25);
      const ph = Math.random()*6.283;
      for (let n=delay;n<N;n++){
        const t = (n-delay)/SR;
        buf[n] += a*Math.exp(-t*(1.6+h*0.4))*Math.sin(2*Math.PI*fh*t + ph);
      }
    }
  });
  let mx = 0; for (const x of buf) mx = Math.max(mx, Math.abs(x));
  for (let i=0;i<N;i++) buf[i] = buf[i]/mx*0.7 + (Math.random()-0.5)*(opt.noise||0.01);
  return buf;
}

function chromaOf(buf, winSec){
  const M = Math.min(Math.round(winSec*SR), buf.length);
  const off = buf.length - M;
  const chroma = new Float32Array(12);
  const notes = new Float32Array(NOTE_F.length);
  for (let i=0;i<NOTE_F.length;i++){
    const e = goertzel(buf, off, M, NOTE_F[i], SR);
    notes[i] = e;
    chroma[(MIDI_LO+i)%12] += Math.sqrt(e);
  }
  return {chroma:norm(harmonicClean(chroma)), notes};
}

const TESTS = ['C','G','Am','Em','F','D','Dm','E','A','Bm','Bb','Am7','Em7','Dm7','G7','Cmaj7','Fmaj7','F#m','C#m','Cadd9','Dsus4'];
const WINDOWS = [0.30, 0.18];   // 簡單/中等用 300ms，困難用 180ms

for (const win of WINDOWS){
  let pass = 0, top1 = 0, trials = 0;
  const fails = [];
  for (const name of TESTS){
    for (let rep=0; rep<8; rep++){
      const buf = synth(name, {noise:0.02, bassBoost: rep%3===0});
      const {chroma, notes} = chromaOf(buf, win);
      const b = bassPC(notes);
      const rank = matchChord(chroma, [...new Set([...TESTS, ...COMMON])], b);
      const me = rank.find(r=>r.name===name) || {score:0};
      const ok = rank[0].name === name || (me.score >= rank[0].score - 0.04 && me.score > 0.68);
      trials++;
      if (rank[0].name === name) top1++;
      if (ok) pass++; else fails.push(`${name} → ${rank[0].name} (${rank[0].score.toFixed(3)} vs ${me.score.toFixed(3)})`);
    }
  }
  console.log(`窗長 ${(win*1000)|0}ms  判定通過 ${pass}/${trials} (${(pass/trials*100).toFixed(1)}%)  top1 ${(top1/trials*100).toFixed(1)}%`);
  const agg = {};
  fails.forEach(f=>agg[f] = (agg[f]||0)+1);
  Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v])=>console.log('   ✗', k, 'x'+v));
}

// 彈錯和弦時要判 fail：拿 C 的訊號去對 G
console.log('\n--- 彈錯時會不會誤放行 ---');
let falsePass = 0, tot = 0;
for (const a of ['C','G','Am','Em','F','D']){
  for (const b of ['C','G','Am','Em','F','D']){
    if (a===b) continue;
    for (let r=0;r<4;r++){
      const buf = synth(a,{noise:0.02});
      const {chroma, notes} = chromaOf(buf, 0.30);
      const rank = matchChord(chroma, [...new Set([...TESTS,...COMMON])], bassPC(notes));
      const me = rank.find(x=>x.name===b) || {score:0};
      const ok = rank[0].name === b || (me.score >= rank[0].score-0.04 && me.score > 0.68);
      tot++; if (ok) falsePass++;
    }
  }
}
console.log(`彈 A 卻被判成 B 的比率：${falsePass}/${tot} (${(falsePass/tot*100).toFixed(1)}%)`);
