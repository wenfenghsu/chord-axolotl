// Regression tests for scoring and transport. No network or guitar is required.
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
function element(){return {style:{},value:'0',textContent:'',innerHTML:'',clientWidth:900,checked:false,children:[],classList:{add(){},remove(){},toggle(){},contains(){return true;}},appendChild(x){this.children.push(x)},querySelectorAll(){return []}};}
const elements=new Map();
const ctx={console,URLSearchParams,Float32Array,Math,Set,Date,performance:{now:()=>10000},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},window:{},location:{origin:'http://localhost'},localStorage:{getItem(){return null;}},document:{querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s)},querySelectorAll(){return []},createElement:element}};
vm.createContext(ctx);
vm.runInContext(['03_data.js','03_originals.js','04_audio.js','05_game.js','05_media.js'].map(f=>fs.readFileSync('build/'+f,'utf8').replace('<script>','')).join('\n'),ctx);
function run(s){return vm.runInContext(s,ctx)}
let count=0;function test(name,fn){fn();count++;console.log('PASS',name)}
run(`const realEndGame=endGame;drawDetect=()=>{};showChord=()=>{};updHUD=()=>{};axoReact=()=>{};showJudge=()=>{};fx=()=>{};say=()=>{};
A.ctx={currentTime:20,resume:async()=>{},suspend:async()=>{}};
M.audio={currentTime:10,paused:false,ended:false,readyState:4,playbackRate:1,duration:120,pause(){this.paused=true;},play(){this.paused=false;return Promise.resolve();}};`);
test('five built-in recording charts',()=>assert.equal(run('Object.keys(ORIGINAL_CHARTS).length'),5));
test('timestamp chart supports variable bar lengths and rest',()=>{
 assert.equal(run("parseOriginalChart('1 C\\n4 G\\n8 REST\\n12 END')[1].end"),8);
 for(const raw of ['','0 C','0 C\n0 END','0 X\n2 END','0 END\n2 C\n4 END','0 REST\n2 END','NaN C\n4 END'])assert.throws(()=>run(`parseOriginalChart(${JSON.stringify(raw)})`));
});
function prepare(diff){run(`G.diff='${diff}';G.chart=parseOriginalChart('1 C\\n4 G\\n8 END');G.chords=['C','G'];G.beatBars=[[1,1.75,2.5,3.25,4],[4,5,6,7,8]];G.pattern=PATTERNS[2];G.notes=[];G.barLabels=[];G.per={C:{ok:0,no:0},G:{ok:0,no:0}};G.pending=[];G.trans={};G.reasons={chord:0,timing:0};G.extra=0;G.total=0;G.hit=0;G.score=0;G.combo=0;G.maxCombo=0;G.bpm=80;G.tol=1;G.idx=0;G.running=true;G.paused=false;G.freePlay=false;G.original=true;G.timed=true;buildOriginalNotes();`);}
test('simple once per change; medium four and hard six strums per bar',()=>{
 for(const [diff,n] of [['easy',2],['mid',8],['hard',12]]){prepare(diff);assert.equal(run('G.notes.length'),n);}
});
test('no misses while MP3 is buffering or paused',()=>{
 prepare('mid');run('M.audio.readyState=2;tickRhythm();');assert.equal(run('G.total'),0);
 run('M.audio.readyState=4;M.audio.paused=false;G.paused=true;tickRhythm();');assert.equal(run('G.total'),0);
});
test('expired notes are counted even after a delayed frame',()=>{
 prepare('mid');run('M.audio.currentTime=7.5;tickRhythm();');assert.equal(run('G.total'),8);assert.equal(run('G.reasons.timing'),8);
 assert.equal(run("G.trans['C → G'].timing"),1);
 run('tickRhythm()');assert.equal(run('G.total'),8);
});
test('strum uses MP3 clock, analysis delay uses audio clock',()=>{
 prepare('mid');run('M.audio.currentTime=1;A.ctx.currentTime=20;onPlayerStrum(20)');
 assert.equal(run('G.pending[0].at'),20.17);assert.equal(run('G.pending[0].note.dt'),0);
 run("judgeChordNow=()=>({ok:true,top:{name:'C'}});A.ctx.currentTime=20.2;tickRhythm();");
 assert.equal(run('G.hit'),1);assert.equal(run('G.total'),1);
});
test('wrong chord classified separately from timing',()=>{
 prepare('mid');run("M.audio.currentTime=4;A.ctx.currentTime=30;onPlayerStrum(30);judgeChordNow=()=>({ok:false,top:{name:'Am'}});A.ctx.currentTime=30.2;tickRhythm();");
 assert.equal(run("G.trans['C → G'].chord"),1);assert.equal(run('G.reasons.chord'),1);
});
test('free play counts attacks without fabricated scores',()=>{
 prepare('easy');run('G.freePlay=true;G.strums=0;onPlayerStrum(20);');assert.equal(run('G.strums'),1);assert.equal(run('G.total'),0);assert.equal(run('G.pending.length'),0);
});
test('latency correction moves onset to the intended beat',()=>{
 prepare('mid');run("$('#inputLatency').value='100';M.audio.currentTime=1.1;onPlayerStrum(20)");assert.ok(Math.abs(run('G.pending[0].note.dt'))<1e-9);
});
test('seek ends current take before counting skipped beats',()=>{
 prepare('mid');run('M.lastTime=1;M.lastWall=10;M.audio.currentTime=30;endGame=()=>{G.running=false;};tickMP3();');assert.equal(run('G.running'),false);assert.equal(run('G.total'),0);
});
test('song change clears local backing audio and offset',()=>{
 run("G.bgBuffer={duration:20};$('#bgOffset').value='12';clearLocalAudio()");assert.equal(run('G.bgBuffer'),null);assert.equal(run("$('#bgOffset').value"),0);
});

function prepareSong(id,diff){
 prepare(diff);
 run(`G.song=BUILTIN.find(s=>s.id===${JSON.stringify(id)});G.chart=parseOriginalChart(ORIGINAL_CHARTS[G.song.id].text);G.beatBars=ORIGINAL_CHARTS[G.song.id].bars;G.bpm=ORIGINAL_CHARTS[G.song.id].bpm;G.chords=G.chart.map(r=>r.chord);G.per={};G.chords.forEach(c=>G.per[c]={ok:0,no:0});$('#inputLatency').value='0';buildOriginalNotes();`);
}
test('five complete recording-specific charts, valid fingerings and ordered beat grids',()=>{
 for(const id of ['jue','xwg','ifu','comp','gf']){
  prepareSong(id,'easy');
  assert.ok(run('ORIGINAL_CHARTS[G.song.id].duration>200'));
  assert.ok(run('G.chart.length>80 && G.endAt>220'));
  assert.equal(run('G.chart[0].chord'), 'REST');
  assert.equal(run('G.chart.at(-1).chord'), 'REST');
  assert.equal(run('G.notes.length===G.chart.filter(r=>r.chord!=="REST").length'),true);
  assert.equal(run('G.beatBars.every((b,i)=>b.length===5 && b.every((t,j)=>Number.isFinite(t) && (!j||t>b[j-1])) && (!i||b[0]>=G.beatBars[i-1][4]-.002))'),true);
  assert.equal(run('G.chart.every(r=>r.chord==="REST" || chordInfo(r.chord))'),true);
 }
});
test('all 15 song/difficulty combinations schedule only playable notes in chronological order',()=>{
 for(const id of ['jue','xwg','ifu','comp','gf'])for(const diff of ['easy','mid','hard']){
  prepareSong(id,diff);
  assert.equal(run('G.notes.every((n,i)=>n.chord!=="REST" && n.t>=G.chart[n.chordIdx].time-.001 && n.t<G.chart[n.chordIdx].end && (!i || n.t>G.notes[i-1].t))'),true,id+' '+diff);
  assert.ok(run('G.notes.length>80'));
 }
});
test('medium strokes use quarter-note beats, not four compressed strokes per chord',()=>{
 prepareSong('gf','mid');
 assert.equal(run('G.notes.every(n=>G.beatBars.some(b=>b.slice(0,4).some(t=>Math.abs(n.t-t)<.001)))'),true);
 assert.ok(run('G.notes.some((n,i)=>i && n.chordIdx===G.notes[i-1].chordIdx)'));
 assert.ok(run('G.notes.some((n,i)=>i && n.chordIdx!==G.notes[i-1].chordIdx)'));
});
test('MV dialogue and ending never generate scoring targets',()=>{
 for(const diff of ['easy','mid','hard']){
  prepareSong('xwg',diff);
  assert.equal(run('G.notes.some(n=>n.t>=166.88 && n.t<174.5)'),false);
  assert.equal(run('G.notes.some(n=>n.t>=275.3)'),false);
 }
});
test('full-song scoring simulation: each requested attack scored exactly once in all 15 combinations',()=>{
 for(const id of ['jue','xwg','ifu','comp','gf'])for(const diff of ['easy','mid','hard']){
  prepareSong(id,diff);
  run(`judgeChordNow=target=>({ok:true,top:{name:target}});M.audio.readyState=4;M.audio.paused=false;
    for(const note of G.notes){
      M.audio.currentTime=note.t;A.ctx.currentTime=note.t+100;onPlayerStrum(A.ctx.currentTime);
      A.ctx.currentTime+=.171;tickRhythm();
    }`);
  assert.equal(run('G.total'),run('G.notes.length'),id+' '+diff);
  assert.equal(run('G.hit'),run('G.notes.length'),id+' '+diff);
  assert.equal(run('G.reasons.timing+G.reasons.chord+G.extra'),0);
  assert.equal(run('G.pending.length'),0);
  assert.ok(run('Object.keys(G.trans).length>5'));
 }
});
test('rests reset transition attribution, and skipped subdivisions use the previous requested chord',()=>{
 prepare('mid');run(`G.chart=parseOriginalChart(${JSON.stringify('0 C\n0.5 F\n0.8 G\n2 REST\n3 Am\n5 END')});G.chords=G.chart.map(r=>r.chord);G.beatBars=[[0,1,2,3,4],[4,5,6,7,8]];buildOriginalNotes();`);
 assert.equal(run('G.notes.find(n=>n.t===1).fromIdx'),0);
 assert.equal(run('G.notes.find(n=>n.t===3).fromIdx'),-1);
});
test('editor removed and stored legacy charts cannot replace the built-in charts',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.equal(/scEditor|editorOpen|btnEdit|改和弦譜|編輯和弦譜|originalChart|btnSaveChart/.test(html),false);
 run(`localStorage.getItem=()=>JSON.stringify([{id:'jue',title:'wrong',sections:[]}]);loadSongs();`);
 assert.equal(run('G.songs.length'),6);
 assert.equal(run('G.songs.find(s=>s.id==="jue").title'),'倔強');
 assert.ok(run('G.songs.find(s=>s.id==="jue").sections[0].chords.startsWith("A Bm C#m")'));
});
test('published game contains no video player or external playback dependency',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.equal(/youtube|iframe_api|new YT\.|<iframe/i.test(html),false);
 assert.ok(html.includes('<audio id="audioPlayer"'));
});
test('local tracks auto-resolve; hosted version requires a local user selection',()=>{
 run("location.hostname='localhost';location.protocol='http:'");
 assert.ok(run("trackSource('xwg').endsWith('.mp3')"));
 assert.equal(run("trackSource('gf')"),'');
 run("location.hostname='wenfenghsu.github.io';location.protocol='https:'");
 assert.equal(run("trackSource('xwg')"),'');
 run("M.files.xwg={url:'blob:local-user-file',name:'笑忘歌.mp3'}");
 assert.equal(run("trackSource('xwg')"),'blob:local-user-file');
});
test('media pause resets pending notes and suppresses scoring until playback resumes',()=>{
 prepare('mid');run('M.audio.currentTime=1;M.audio.paused=false;M.audio.readyState=4;onPlayerStrum(20);M.audio.paused=true;mediaState();tickRhythm();');
 assert.equal(run('G.paused'),true);assert.equal(run('G.pending.length'),0);assert.equal(run('G.notes[0].state'),null);assert.equal(run('G.total'),0);
 run('M.audio.paused=false;mediaState()');assert.equal(run('G.paused'),false);
});
test('MP3 completion produces the final score and transition table without an external player',()=>{
 prepare('mid');run("G.song=BUILTIN.find(s=>s.id==='xwg');G.total=2;G.hit=1;G.score=150;G.trans={'C → G':{ok:0,no:1,chord:1,timing:0,from:'C',to:'G'}};G.per.C={ok:1,no:0};G.per.G={ok:0,no:1};realEndGame();");
 assert.equal(run('G.running'),false);assert.equal(run("$('#resScore').textContent"),150);
 assert.equal(run("$('#resAcc').textContent"),'50%');assert.ok(run("$('#resTrans').innerHTML.includes('C → G')"));
});
console.log(`${count} regression checks passed`);
