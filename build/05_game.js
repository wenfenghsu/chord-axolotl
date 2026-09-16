
/* ==========================================================
   遊戲邏輯
   ========================================================== */
const G = {
  songs:[], song:null, secIdx:0, diff:'easy', bpm:72, tol:1, pattern:PATTERNS[0],
  chords:[], idx:0, score:0, combo:0, maxCombo:0, hit:0, total:0,
  per:{}, trans:{}, notes:[], running:false, startAt:0, cands:[], timer:0, endAt:0
};

/* ---------- 固定歌曲目錄：舊的自訂譜不覆蓋內建原曲 ---------- */
function loadSongs(){
  G.songs=JSON.parse(JSON.stringify(BUILTIN));
  G.songs.forEach(s=>{
    const original=ORIGINAL_CHARTS[s.id];
    if(original){
      const chords=parseOriginalChart(original.text).filter(r=>r.chord!=='REST').slice(0,24).map(r=>r.chord).join(' ');
      s.sections=[{name:'換和弦慢練（非原曲時間）',chords}];
    }
  });
}

function renderSongs(){
  const grid = $('#songGrid'); grid.innerHTML = '';
  G.songs.forEach((s,i)=>{
    const d = document.createElement('div');
    d.className = 'song' + (G.song === s ? ' sel' : '');
    d.innerHTML = `<h3>${escapeHTML(s.title)}</h3><p><b>${escapeHTML(s.artist)}</b><br>${escapeHTML(s.note||'')}</p>
      <p style="margin-top:8px" class="mono" style="font-size:12px">${s.sections.map(x=>escapeHTML(x.name)).join(' · ')}</p>`;
    d.onclick = ()=>{ clearLocalAudio(); $('#sourceMode').value=s.id==='warm'?'practice':'mp3'; G.song = s; G.secIdx = 0; $('#bpm').value = s.bpm||72; $('#bpmVal').textContent = s.bpm||72; renderSongs(); renderSecPick(); };
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
  if ($('#sourceMode').value === 'mp3') return startMP3Game();
  quitGame();
  $('#rhythmCoach').hidden=true;
  G.original = false; G.freePlay = false; G.paused = false; G.extra = 0; G.reasons = {chord:0,timing:0};
  $('#trackPanel').hidden = true;
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
  if (typeof M !== 'undefined' && M.audio) M.audio.pause();
  if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume().catch(()=>{});
  stopMetronome(); clearInterval(G.timer);
}

/* ---------- 畫面：目前和弦 ---------- */
function showChord(){
  const c = G.chords[G.idx];
  $('#curChord').textContent = c === 'REST' ? '休息' : c || '—';
  $('#curDiagram').innerHTML = c && c !== 'REST' ? diagram(c, 1.45) : '';
  const n = G.chords[G.idx+1];
  $('#nextChord').textContent = n === 'REST' ? '休息' : n || '最後一個！';
  $('#nextDiagram').innerHTML = n && n !== 'REST' ? diagram(n, 0.95) : '';
  $('#progN').textContent = `${Math.min(G.idx+1,G.chords.length)}/${G.chords.length}`;
  if (c && G.running && !G.timed && $('#demoOn') && $('#demoOn').checked)
    padChord(c, A.ctx.currentTime + 0.05, 0.55, 0.08);
  const hints = {easy:'按好之後，右手刷一下', mid:'跟著伴奏刷四下', hard:'照下面的箭頭刷'};
  $('#curHint').textContent = c === 'REST' ? '這一段先聽，準備下一個和弦' : G.diff === 'easy' && G.original ? '換到這個和弦時刷一下' : G.diff === 'easy' && G.timed ? '每小節第一拍刷一下' : hints[G.diff];
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
  if (!G.running || G.paused || (G.original && !trackPlaying())) return;
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
  if (!G.running || G.paused || (G.original && !trackPlaying())) return;
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
      if (n.isFirst) logTransition(n.fromIdx ?? n.chordIdx-1, n.chord, false, 'timing');
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
  const ci = G.original ? G.chart.findIndex(row=>now >= row.time && now < row.end) : Math.floor((now - G.startAt)/(beat*4)) - G.leadBars;
  if (ci === 0 && G.idx === 0 && $('#curHint').textContent.startsWith('準備')) showChord();
  if (ci >= 0 && ci !== G.idx && ci < G.chords.length){ G.idx = ci; showChord(); }
  if (ci < 0 && !G.original){
    const cd = Math.ceil((G.startAt + G.leadBars*4*beat - now)/beat);
    $('#curHint').textContent = `預備… ${cd}`;
  }

  // 延遲判定
  while (G.pending.length && G.pending[0].at <= A.ctx.currentTime){
    const p = G.pending.shift();
    const n = p.note;
    const r = judgeChordNow(n.chord, 0.18);
    G.total++;
    if (n.isFirst) logTransition(n.fromIdx ?? n.chordIdx-1, n.chord, r.ok);
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
  const played = G.original ? M.audio.currentTime : 0;
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
