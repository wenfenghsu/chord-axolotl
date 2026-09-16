// Regression tests for scoring and transport. No network or guitar is required.
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
function element(){return {style:{},value:'0',textContent:'',innerHTML:'',clientWidth:900,checked:false,children:[],classList:{add(){},remove(){},contains(){return true;}},appendChild(x){this.children.push(x)},querySelectorAll(){return []}};}
const elements=new Map();
const ctx={console,Float32Array,Math,Set,Date,performance:{now:()=>10000},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},window:{},location:{origin:'http://localhost'},localStorage:{getItem(){return null;}},document:{querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s)},querySelectorAll(){return []},createElement:element}};
vm.createContext(ctx);
vm.runInContext(['03_data.js','04_audio.js','05_game.js','05_media.js'].map(f=>fs.readFileSync('build/'+f,'utf8').replace('<script>','')).join('\n'),ctx);
function run(s){return vm.runInContext(s,ctx)}
let count=0;function test(name,fn){fn();count++;console.log('PASS',name)}
run(`drawDetect=()=>{};showChord=()=>{};updHUD=()=>{};axoReact=()=>{};showJudge=()=>{};fx=()=>{};say=()=>{};
A.ctx={currentTime:20,resume:async()=>{},suspend:async()=>{}};
Y.ready=true;Y.player={getCurrentTime:()=>10,getPlayerState:()=>1,getPlaybackRate:()=>1,pauseVideo:()=>{},getDuration:()=>120};`);
test('five official video IDs, including saved legacy songs',()=>assert.equal(run('Object.keys(OFFICIAL).length'),5));
test('timestamp chart supports variable bar lengths and rest',()=>{
 assert.equal(run("parseOriginalChart('1 C\\n4 G\\n8 REST\\n12 END')[1].end"),8);
 for(const raw of ['','0 C','0 C\n0 END','0 X\n2 END','0 END\n2 C\n4 END','0 REST\n2 END','NaN C\n4 END'])assert.throws(()=>run(`parseOriginalChart(${JSON.stringify(raw)})`));
});
function prepare(diff){run(`G.diff='${diff}';G.chart=parseOriginalChart('1 C\\n4 G\\n8 END');G.chords=['C','G'];G.pattern=PATTERNS[2];G.notes=[];G.barLabels=[];G.per={C:{ok:0,no:0},G:{ok:0,no:0}};G.pending=[];G.trans={};G.reasons={chord:0,timing:0};G.extra=0;G.total=0;G.hit=0;G.score=0;G.combo=0;G.maxCombo=0;G.bpm=80;G.tol=1;G.idx=0;G.running=true;G.paused=false;G.freePlay=false;G.youtube=true;G.timed=true;buildOriginalNotes();`);}
test('simple one, medium four, hard six strums per bar',()=>{
 for(const [diff,n] of [['easy',2],['mid',8],['hard',12]]){prepare(diff);assert.equal(run('G.notes.length'),n);}
});
test('no misses while video is buffering or paused',()=>{
 prepare('mid');run('Y.player.getPlayerState=()=>3;tickRhythm();');assert.equal(run('G.total'),0);
 run('Y.player.getPlayerState=()=>1;G.paused=true;tickRhythm();');assert.equal(run('G.total'),0);
});
test('expired notes are counted even after a delayed frame',()=>{
 prepare('mid');run('Y.player.getCurrentTime=()=>7.5;tickRhythm();');assert.equal(run('G.total'),8);assert.equal(run('G.reasons.timing'),8);
 assert.equal(run("G.trans['C → G'].timing"),1);
 run('tickRhythm()');assert.equal(run('G.total'),8);
});
test('strum uses video clock, analysis delay uses audio clock',()=>{
 prepare('mid');run('Y.player.getCurrentTime=()=>1;A.ctx.currentTime=20;onPlayerStrum(20)');
 assert.equal(run('G.pending[0].at'),20.17);assert.equal(run('G.pending[0].note.dt'),0);
 run("judgeChordNow=()=>({ok:true,top:{name:'C'}});A.ctx.currentTime=20.2;tickRhythm();");
 assert.equal(run('G.hit'),1);assert.equal(run('G.total'),1);
});
test('wrong chord classified separately from timing',()=>{
 prepare('mid');run("Y.player.getCurrentTime=()=>4;A.ctx.currentTime=30;onPlayerStrum(30);judgeChordNow=()=>({ok:false,top:{name:'Am'}});A.ctx.currentTime=30.2;tickRhythm();");
 assert.equal(run("G.trans['C → G'].chord"),1);assert.equal(run('G.reasons.chord'),1);
});
test('free play counts attacks without fabricated scores',()=>{
 prepare('easy');run('G.freePlay=true;G.strums=0;onPlayerStrum(20);');assert.equal(run('G.strums'),1);assert.equal(run('G.total'),0);assert.equal(run('G.pending.length'),0);
});
test('latency correction moves onset to the intended beat',()=>{
 prepare('mid');run("$('#inputLatency').value='100';Y.player.getCurrentTime=()=>1.1;onPlayerStrum(20)");assert.ok(Math.abs(run('G.pending[0].note.dt'))<1e-9);
});
test('seek ends current take before counting skipped beats',()=>{
 prepare('mid');run('Y.lastTime=1;Y.lastWall=10;Y.player.getCurrentTime=()=>30;endGame=()=>{G.running=false;};tickYouTube();');assert.equal(run('G.running'),false);assert.equal(run('G.total'),0);
});
test('song change clears local backing audio and offset',()=>{
 run("G.bgBuffer={duration:20};$('#bgOffset').value='12';clearLocalAudio()");assert.equal(run('G.bgBuffer'),null);assert.equal(run("$('#bgOffset').value"),0);
});
console.log(`${count} regression checks passed`);
