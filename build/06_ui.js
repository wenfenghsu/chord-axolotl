
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

/* ---------- 啟動 ---------- */
(function init(){
  setupMedia();
  loadSongs();
  buildChromaBars();
  const ps = $('#patSel');
  PATTERNS.forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; ps.appendChild(o); });
  ps.value = 'folk';
  $('#patSel').parentElement.style.opacity = .4;
  G.cands = COMMON;
  renderSongs();
  discoverLocalTracks();
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
</script>
</body>
</html>
