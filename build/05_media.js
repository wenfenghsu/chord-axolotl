/* MP3 playback supplies the transport clock; guitar analysis only reads the input device. */
const M={audio:null,files:{},lastTime:null,lastWall:null,starting:false};
const TRACK_FILES={
 xwg:'音樂 MP3/Mayday五月天[笑忘歌] HD MV官方完整版.mp3',
 ifu:'音樂 MP3/LUNA SEA - 「I for You」MV.mp3'
};
function songIdForFilename(name){
 const normalized=name.toLowerCase().replace(/[\s_\-「」\[\]()]/g,'');
 return normalized.includes('笑忘歌')?'xwg':normalized.includes('倔強')?'jue':normalized.includes('iforyou')?'ifu':normalized.includes('complicated')?'comp':normalized.includes('girlfriend')?'gf':null;
}
async function discoverLocalTracks(){
 if(!localMusicAvailable() || location.protocol==='file:')return;
 try{
  const base=new URL('音樂 MP3/',location.href),response=await fetch(base,{cache:'no-store'});
  if(!response.ok)return;
  const page=new DOMParser().parseFromString(await response.text(),'text/html'),matches={};
  page.querySelectorAll('a[href]').forEach(link=>{
   const url=new URL(link.getAttribute('href'),base);
   if(url.origin!==base.origin || !url.pathname.startsWith(base.pathname) || !/\.mp3$/i.test(url.pathname))return;
   const name=decodeURIComponent(url.pathname.split('/').at(-1)),id=songIdForFilename(name);
   if(id)(matches[id]||=[]).push('音樂 MP3/'+name);
  });
  Object.entries(matches).forEach(([id,paths])=>{if(paths.length===1)TRACK_FILES[id]=paths[0];});
  refreshOriginalSettings();
 }catch(e){/* Manual file selection remains available. */}
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function formatTime(s){s=Math.max(0,Math.floor(s||0));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
function inputLatencySeconds(){return clamp(Number($('#inputLatency').value)||0,0,500)/1000;}
function gameTime(){return G.original && M.audio ? M.audio.currentTime : A.ctx.currentTime;}
function trackPlaying(){return !!M.audio && !M.audio.paused && !M.audio.ended && M.audio.readyState>=3;}
function localMusicAvailable(){return location.protocol==='file:' || ['localhost','127.0.0.1','::1','[::1]'].includes(location.hostname);}
function trackSource(id){return M.files[id]?.url || (localMusicAvailable() && TRACK_FILES[id] ? encodeURI(TRACK_FILES[id]) : '');}
function clearLocalAudio(){G.bgBuffer=null;$('#bgFile').value='';$('#bgName').textContent='未載入（用內建伴奏）';$('#bgOffset').value=0;}
function readOriginalChart(){return G.song ? ORIGINAL_CHARTS[G.song.id]?.text||'' : '';}
function refreshOriginalSettings(){
 const original=$('#sourceMode').value==='mp3';
 $('#originalSettings').hidden=!original;
 if($('#secPick'))$('#secPick').hidden=original;
 const chart=G.song && ORIGINAL_CHARTS[G.song.id],source=G.song && trackSource(G.song.id);
 $('#originalInfo').textContent=chart ? `${G.song.title} · 原調 ${chart.key} · ${source?'MP3 已備妥':'請選取這首歌的 MP3'}` : '請先選一首歌曲；暖身請用合成伴奏。';
 $('#originalFileName').textContent=G.song ? M.files[G.song.id]?.name || (source ? TRACK_FILES[G.song.id].split('/').at(-1) : '尚未選取 MP3') : '先選歌，再選音檔';
 $('#btnOriginalPick').disabled=!chart;
 $('#btnStart').disabled=original && (!chart || !source);
 $('#btnStart').textContent=original?'跟 MP3 練習 ♪':'開始練習 ♪';
 ['backMode','bgOffset','btnBgPick','btnBgClear','demoOn','bpm','clickOn','waitMode','backVol'].forEach(id=>$('#'+id).disabled=original);
 if(original && chart){$('#bpm').value=chart.bpm;$('#bpmVal').textContent=chart.bpm;}
}
function parseOriginalChart(raw){
 const lines=raw.trim().split(/\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length<2)throw Error('原曲時間資料不完整。');
 const rows=lines.map((line,i)=>{
  const parts=line.split(/\s+/),time=Number(parts[0]),chord=parts[1];
  if(parts.length!==2 || !/^\d+(\.\d+)?$/.test(parts[0]) || !Number.isFinite(time) || time<0 || time>86400)throw Error(`第 ${i+1} 行時間不正確。`);
  if(chord!=='END' && chord!=='REST' && !chordInfo(chord))throw Error(`和弦 ${chord} 尚未定義指法。`);
  return {time,chord};
 });
 if(rows.at(-1).chord!=='END')throw Error('缺少練習終點。');
 rows.forEach((r,i)=>{
  if(i && r.time<=rows[i-1].time)throw Error('時間必須依序增加。');
  if(i<rows.length-1 && (r.chord==='END' || rows[i+1].time-r.time<.2))throw Error('和弦段資料不正確。');
 });
 const chart=rows.slice(0,-1).map((r,i)=>({...r,end:rows[i+1].time}));
 if(!chart.some(r=>r.chord!=='REST') || chart.length>1500)throw Error('原曲時間資料不正確。');
 return chart;
}
function mediaState(){
 if(!G.original || !G.running)return;
 G.paused=!trackPlaying();
 M.lastTime=M.audio.currentTime;M.lastWall=performance.now()/1000;
 $('#btnPause').textContent=G.paused?'繼續':'暫停';
 $('#trackStatus').textContent=G.paused?'MP3 已暫停 · 評分也暫停':'MP3 播放中 · 戴耳機練習';
 if(G.paused){G.pending.forEach(p=>{if(p.note?.state==='pending')p.note.state=null;});G.pending=[];}
}
function setupMedia(){
 M.audio=$('#audioPlayer');
 ['play','playing','pause','waiting','stalled','canplay'].forEach(event=>M.audio.addEventListener(event,mediaState));
 M.audio.addEventListener('ended',()=>{if(G.original && G.running)endGame();});
 M.audio.addEventListener('seeking',()=>{
  if(G.original && G.running && !M.starting && M.lastTime!==null && Math.abs(M.audio.currentTime-M.lastTime)>.15){
   endGame();toast('播放位置已移動，本次已結算。再來一次可從頭練習。',4000);
  }
 });
 M.audio.addEventListener('error',()=>{
  if(G.original){G.paused=true;$('#trackStatus').textContent='MP3 無法讀取，請回選歌頁重新選取音檔。';}
 });
}
function loadTrack(src){
 return new Promise((resolve,reject)=>{
  const audio=M.audio;
  const cleanup=()=>{clearTimeout(timeout);audio.removeEventListener('loadedmetadata',ready);audio.removeEventListener('error',fail);};
  const ready=()=>{cleanup();resolve(audio.duration);};
  const fail=()=>{cleanup();reject(Error('讀不到 MP3，請回選歌頁按「選取這首的 MP3」。'));};
  const timeout=setTimeout(fail,12000);
  audio.addEventListener('loadedmetadata',ready);audio.addEventListener('error',fail);
  audio.src=src;audio.load();
 });
}
async function startMP3Game(){
 const data=G.song && ORIGINAL_CHARTS[G.song.id],source=G.song && trackSource(G.song.id);
 if(!data || !source){toast('先選歌曲和對應 MP3。');return;}
 if(!A.running){toast('先回校準頁開始吉他收音。');return;}
 let chart;
 try{chart=parseOriginalChart(data.text);}catch(e){toast(e.message,4000);return;}
 quitGame();
 G.original=true;G.freePlay=false;G.timed=true;G.chart=chart;G.beatBars=data.bars;
 G.paused=true;G.strums=0;G.extra=0;G.reasons={chord:0,timing:0};
 G.idx=0;G.score=0;G.combo=0;G.maxCombo=0;G.hit=0;G.total=0;
 G.per={};G.trans={};G.notes=[];G.pending=[];G.barLabels=[];
 G.tol=+$('#tol').value;G.bpm=data.bpm;
 G.pattern=PATTERNS.find(p=>p.id===$('#patSel').value)||PATTERNS[0];
 G.chords=chart.map(r=>r.chord);G.cands=[...new Set([...G.chords.filter(c=>c!=='REST'),...COMMON])];
 G.chords.forEach(c=>G.per[c]={ok:0,no:0});
 $('#playTitle').textContent=G.song.title+' · MP3 跟彈';
 $('#playDiff').textContent={easy:'簡單・換和弦刷一下',mid:'中等・每小節四下',hard:'困難・指定節奏'}[G.diff];
 $('#playSec').textContent='內建原調跟彈譜';
 $('#trackPanel').hidden=false;$('#lane').style.display='block';
 $('#trackTitle').textContent=G.song.title+' — '+G.song.artist;
 $('#trackStatus').textContent='讀取 MP3…';$('#btnPause').textContent='繼續';
 updHUD();go('scPlay');buildOriginalNotes();showChord();renderRhythmGuide();
 $('#btnStart').disabled=true;
 const token=G.loadToken=(G.loadToken||0)+1;
 try{
  await A.ctx.resume();M.starting=true;
  const duration=await loadTrack(source);
  if(G.loadToken!==token || !$('#scPlay').classList.contains('on'))return;
  if(!Number.isFinite(duration) || Math.abs(duration-data.duration)>.4)throw Error(`這份 MP3 長 ${formatTime(duration)}，內建譜對應 ${formatTime(data.duration)}，版本不同，暫不評分。請選同版本音檔。`);
  M.audio.currentTime=0;M.audio.volume=+$('#mp3Volume').value/100;M.audio.playbackRate=1;
  M.lastTime=null;M.lastWall=null;G.running=true;A.onOnset=onPlayerStrum;
  G.timer=setInterval(tickMP3,30);
  try{await M.audio.play();}catch(e){$('#trackStatus').textContent='請按 MP3 播放器的播放鍵開始。';}
 }catch(e){$('#trackStatus').textContent=e.message;toast(e.message,6000);}
 finally{M.starting=false;$('#btnStart').disabled=false;}
}
function chartIndexAt(time){return G.chart.findIndex(row=>time>=row.time-.001 && time<row.end-.001);}
function barSlotTime(bar,slot){const beat=Math.floor(slot/2);return slot%2?(bar[beat]+bar[beat+1])/2:bar[beat];}
function buildOriginalNotes(){
 const lane=$('#lane');lane.querySelectorAll('.note,.barlab').forEach(e=>e.remove());G.notes=[];G.barLabels=[];
 const add=(t,ci,slot)=>{
  if(ci<0 || G.chart[ci].chord==='REST')return;
  const row=G.chart[ci],previous=G.notes.at(-1),el=document.createElement('div');
  el.className='note';el.textContent=dirOf(slot);el.title=row.chord;lane.appendChild(el);
  const isFirst=!previous || previous.chordIdx!==ci;
  const restBetween=previous && G.chart.slice(previous.chordIdx+1,ci).some(r=>r.chord==='REST');
  G.notes.push({t,el,chordIdx:ci,chord:row.chord,slot,state:null,isFirst,fromIdx:previous && !restBetween?previous.chordIdx:-1});
 };
 G.chart.forEach((row,ci)=>{
  const label=document.createElement('div');label.className='barlab';label.textContent=row.chord==='REST'?'休息':row.chord;
  lane.appendChild(label);G.barLabels.push({t:row.time,el:label});if(G.diff==='easy')add(row.time,ci,0);
 });
 if(G.diff!=='easy'){
  const pat=G.diff==='mid'?[1,0,1,0,1,0,1,0]:G.pattern.hits;
  for(const bar of G.beatBars)pat.forEach((hit,slot)=>{if(hit){const t=barSlotTime(bar,slot);add(t,chartIndexAt(t),slot);}});
 }
 G.startAt=G.chart[0].time;G.leadBars=0;G.endAt=G.chart.at(-1).end;
}
function tickMP3(){
 if(!G.running)return;
 drawDetect();const now=gameTime(),wall=performance.now()/1000;
 if(M.lastTime!==null && Math.abs((now-M.lastTime)-(trackPlaying()?(wall-M.lastWall)*M.audio.playbackRate:0))>1.2){
  endGame();toast('播放位置已移動，本次已結算。再來一次可從頭練習。',4000);return;
 }
 M.lastTime=now;M.lastWall=wall;
 if(!trackPlaying() || G.paused)return;
 $('#playSec').textContent=formatTime(now)+' / '+formatTime(M.audio.duration);
 updateRhythmGuide(now);tickRhythm();
}
async function togglePause(forcePause=false){
 if(!G.running)return;
 if(G.original){
  if(forcePause || trackPlaying())M.audio.pause();
  else{await A.ctx.resume();try{await M.audio.play();}catch(e){toast('請按播放器的播放鍵。');}}
  return;
 }
 G.paused=forcePause||!G.paused;
 if(G.paused)await A.ctx.suspend();else await A.ctx.resume();
 $('#btnPause').textContent=G.paused?'繼續':'暫停';
}
function renderRhythmGuide(){
 $('#rhythmGuide').innerHTML=Array.from({length:8},(_,i)=>`<div class="rhythm-step"><small>${['1','＆','2','＆','3','＆','4','＆'][i]}</small><b>·</b><span></span></div>`).join('');
 $('#rhythmCoach').hidden=false;G.guideBar=null;updateRhythmGuide(0);
}
function updateRhythmGuide(now){
 const row=G.chart[chartIndexAt(now)],bar=G.beatBars.find(b=>now>=b[0] && now<b[4]);
 const slots=bar?Array.from({length:8},(_,i)=>barSlotTime(bar,i)):[];
 let active=-1;slots.forEach((t,i)=>{if(t<=now)active=i;});
 const cells=Array.from($('#rhythmGuide').children);
 if(G.guideBar!==bar){
  G.guideBar=bar;
  cells.forEach((el,i)=>{
   const next=i===7?bar?.[4]:slots[i+1],note=bar && G.notes.find(n=>n.t>=slots[i]-.02 && n.t<next-.02);
   el.classList.toggle('strum',!!note);el.querySelector('b').textContent=note?dirOf(note.slot):'·';el.querySelector('span').textContent=note?.chord||'';
  });
 }
 cells.forEach((el,i)=>el.classList.toggle('active',!!row && row.chord!=='REST' && i===active));
 const next=G.notes.find(n=>n.t>now+.02);
 $('#rhythmCaption').textContent=!row || row.chord==='REST'?
  (next?`這段先聽 · ${Math.ceil(next.t-now)} 秒後準備 ${next.chord}`:'演奏完成，聽歌曲收尾'):
  `${{easy:'換和弦時刷一下',mid:'每小節四下；左手依和弦提示更換',hard:'跟著亮格的箭頭刷弦'}[G.diff]}${next?' · 下一下 '+next.chord:''}`;
}
$('#sourceMode').onchange=refreshOriginalSettings;
$('#mp3Volume').oninput=()=>{if(M.audio)M.audio.volume=+$('#mp3Volume').value/100;};
$('#btnPause').onclick=()=>togglePause();
$('#btnOriginalPick').onclick=()=>$('#originalFile').click();
$('#originalFile').onchange=e=>{
 const file=e.target.files[0];if(!file || !G.song)return;
 const id=G.song.id;if(M.files[id])URL.revokeObjectURL(M.files[id].url);
 M.files[id]={name:file.name,url:URL.createObjectURL(file)};refreshOriginalSettings();
};
