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
