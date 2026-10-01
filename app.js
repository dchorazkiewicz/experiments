
const NOTE_NAMES=['C','C♯/D♭','D','D♯/E♭','E','F','F♯/G♭','G','G♯/A♭','A','A♯/B♭','H'];
const WHITE_PCS=new Set([0,2,4,5,7,9,11]);
const NATURAL_INDEX={0:0,2:1,4:2,5:3,7:4,9:5,11:6};
const OCTAVE_NAMES={2:'wielka',3:'mała',4:'razkreślna',5:'dwukreślna',6:'trzykreślna'};
const STAFF={top:100,bottom:220,left:90};
const MEASURE_NOTES=[[60,1],[62,1],[64,1],[65,1]];

let audioCtx;
let stage='pitch';
let currentMidi=60;
let currentDuration=1;
let currentSong=0;
let timers=[];
let playingType=null;
let melodyBeatPositions=[];

const SONGS=[
  {
    title:'Panie Janie',meter:[4,4],bpm:92,
    description:'Zastosowanie: wysokości C–D–E–F–G oraz poznane wartości rytmiczne tworzą melodię.',
    notes:[
      [60,1],[62,1],[64,1],[60,1],
      [60,1],[62,1],[64,1],[60,1],
      [64,1],[65,1],[67,2],
      [64,1],[65,1],[67,2],
      [67,.5],[69,.5],[67,.5],[65,.5],[64,1],[60,1],
      [67,.5],[69,.5],[67,.5],[65,.5],[64,1],[60,1],
      [60,1],[55,1],[60,2]
    ]
  },
  {
    title:'Oda do radości',meter:[4,4],bpm:104,
    description:'Dużo ruchu po sąsiednich stopniach pięciolinii — dobry materiał do śledzenia linii i pól.',
    notes:[
      [64,1],[64,1],[65,1],[67,1],
      [67,1],[65,1],[64,1],[62,1],
      [60,1],[60,1],[62,1],[64,1],
      [64,1.5],[62,.5],[62,2],
      [64,1],[64,1],[65,1],[67,1],
      [67,1],[65,1],[64,1],[62,1],
      [60,1],[60,1],[62,1],[64,1],
      [62,1.5],[60,.5],[60,2]
    ]
  },
  {
    title:'Twinkle, Twinkle',meter:[4,4],bpm:88,
    description:'Pokazuje większe skoki wysokości: C → G → A i powrót.',
    notes:[
      [60,1],[60,1],[67,1],[67,1],[69,1],[69,1],[67,2],
      [65,1],[65,1],[64,1],[64,1],[62,1],[62,1],[60,2],
      [67,1],[67,1],[65,1],[65,1],[64,1],[64,1],[62,2],
      [67,1],[67,1],[65,1],[65,1],[64,1],[64,1],[62,2],
      [60,1],[60,1],[67,1],[67,1],[69,1],[69,1],[67,2],
      [65,1],[65,1],[64,1],[64,1],[62,1],[62,1],[60,2]
    ]
  },
  {
    title:'Mary Had a Little Lamb',meter:[4,4],bpm:98,
    description:'Mały zakres dźwięków — łatwo obserwować powtarzające się E–D–C.',
    notes:[
      [64,1],[62,1],[60,1],[62,1],
      [64,1],[64,1],[64,2],
      [62,1],[62,1],[62,2],
      [64,1],[67,1],[67,2],
      [64,1],[62,1],[60,1],[62,1],
      [64,1],[64,1],[64,1],[64,1],
      [62,1],[62,1],[64,1],[62,1],[60,4]
    ]
  }
];

function audio(){
  audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume();
  return audioCtx;
}
function frequency(midi){return 440*Math.pow(2,(midi-69)/12)}
function noteInfo(midi){
  const pc=((midi%12)+12)%12,octave=Math.floor(midi/12)-1;
  return {midi,pc,octave,pitch:NOTE_NAMES[pc],full:NOTE_NAMES[pc]+octave};
}
function playTone(midi,duration=.62,gain=.13){
  const ac=audio(),now=ac.currentTime,f=frequency(midi),master=ac.createGain();
  master.gain.setValueAtTime(.0001,now);
  master.gain.exponentialRampToValueAtTime(gain,now+.012);
  master.gain.exponentialRampToValueAtTime(gain*.72,now+.09);
  master.gain.exponentialRampToValueAtTime(.0001,now+duration);
  master.connect(ac.destination);
  [[1,'sine',1],[2,'sine',.25],[3,'triangle',.1],[4,'sine',.035]].forEach(([mult,type,level])=>{
    const osc=ac.createOscillator(),g=ac.createGain();
    osc.type=type;osc.frequency.value=f*mult;g.gain.value=level;
    osc.connect(g);g.connect(master);osc.start(now);osc.stop(now+duration+.04);
  });
}
function clickSound(accent=false){
  const ac=audio(),now=ac.currentTime,osc=ac.createOscillator(),g=ac.createGain();
  osc.type='square';osc.frequency.value=accent?1320:880;
  g.gain.setValueAtTime(accent?.08:.04,now);g.gain.exponentialRampToValueAtTime(.0001,now+.055);
  osc.connect(g);g.connect(ac.destination);osc.start(now);osc.stop(now+.06);
}
function clearTimers(){timers.forEach(clearTimeout);timers=[]}
function stopAllPlayback(){
  clearTimers();playingType=null;
  document.querySelectorAll('.score-note').forEach(g=>g.classList.remove('active'));
  clearPiano();
  const m=document.getElementById('playMelody');if(m)m.textContent='▶ Graj';
  const t=document.getElementById('playMeasure');if(t)t.textContent='▶ Zagraj takt';
}

function diatonicIndex(midi){
  const n=noteInfo(midi);let pc=n.pc;
  if(NATURAL_INDEX[pc]===undefined)pc-=1;
  return n.octave*7+NATURAL_INDEX[pc];
}
function staffY(midi){
  const e4=4*7+2;
  return STAFF.bottom-(diatonicIndex(midi)-e4)*15;
}
function ledgerLines(y,x){
  const ys=[];
  if(y>STAFF.bottom){for(let ly=STAFF.bottom+30;ly<=y;ly+=30)ys.push(ly)}
  else if(y<STAFF.top){for(let ly=STAFF.top-30;ly>=y;ly-=30)ys.push(ly)}
  return ys.map(ly=>'<line x1="'+(x-23)+'" x2="'+(x+23)+'" y1="'+ly+'" y2="'+ly+'" stroke="#3b4851" stroke-width="2.6"/>').join('');
}
function accidental(midi){return WHITE_PCS.has(noteInfo(midi).pc)?'':'♯'}
function staffBase(width){
  const lines=[100,130,160,190,220].map(y=>'<line x1="'+STAFF.left+'" x2="'+(width-40)+'" y1="'+y+'" y2="'+y+'" stroke="#3b4851" stroke-width="2.6"/>').join('');
  return '<rect width="100%" height="100%" fill="#f7f3e9"/>'+lines+
    '<text x="18" y="214" font-family="Times New Roman" font-size="96" fill="#16212a">𝄞</text>';
}
function durationName(beats){
  if(beats===.5)return 'ósemka';
  if(beats===1)return 'ćwierćnuta';
  if(beats===1.5)return 'ćwierćnuta z kropką';
  if(beats===2)return 'półnuta';
  if(beats===3)return 'półnuta z kropką';
  if(beats===4)return 'cała nuta';
  return beats+' pulsu';
}
function slotDescription(midi){
  const n=noteInfo(midi),delta=diatonicIndex(midi)-(4*7+2);let place;
  if(delta>=0&&delta<=8){
    const level=Math.floor(delta/2)+1;
    place=delta%2===0?level+'. linia od dołu':level+'. pole od dołu';
  }else if(delta===-1)place='pole pod pierwszą linią';
  else if(delta===-2)place='dodatkowa linia pod pięciolinią';
  else if(delta<0)place='poniżej pięciolinii — linia/pole dodatkowe';
  else place='powyżej pięciolinii — linia/pole dodatkowe';
  return n.full+' — '+place;
}
function updateCurrent(midi){
  currentMidi=midi;
  const n=noteInfo(midi),octaveName=OCTAVE_NAMES[n.octave]||('nr '+n.octave);
  document.getElementById('currentNote').innerHTML='<span>Aktualny dźwięk</span><strong>'+n.full+'</strong><small>'+frequency(midi).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' Hz • oktawa '+octaveName+'</small>';
  document.getElementById('notePositionText').textContent=slotDescription(midi);
  document.getElementById('lineSpaceHint').textContent=slotDescription(midi)+'.';
  document.getElementById('octaveHint').textContent='Numer '+n.octave+' oznacza oktawę '+octaveName+'.';
  document.querySelectorAll('[data-jump-midi]').forEach(b=>b.classList.toggle('active',Number(b.dataset.jumpMidi)===midi));
}
function clearPiano(){document.querySelectorAll('.piano-key').forEach(k=>k.classList.remove('active'))}
function highlightPiano(midi){
  clearPiano();
  const key=document.querySelector('.piano-key[data-midi="'+midi+'"]');
  if(key){
    key.classList.add('active');
    const scroller=key.closest('.piano-scroll');
    if(scroller)scroller.scrollTo({left:Math.max(0,key.offsetLeft-key.clientWidth*3),behavior:'smooth'});
  }
}

function buildPiano(){
  const piano=document.getElementById('piano'),start=48,end=83,whites=[];
  for(let m=start;m<=end;m++)if(WHITE_PCS.has(m%12))whites.push(m);
  whites.forEach(m=>{
    const n=noteInfo(m),key=document.createElement('button');
    key.className='white-key piano-key';key.dataset.midi=m;
    key.innerHTML='<span class="key-label">'+n.pitch+'<sub>'+n.octave+'</sub></span>';
    key.addEventListener('click',()=>handlePianoClick(m));
    piano.appendChild(key);
  });
  const count=whites.length;
  for(let m=start;m<=end;m++){
    if(WHITE_PCS.has(m%12))continue;
    const before=whites.filter(w=>w<m).length,key=document.createElement('button');
    key.className='black-key piano-key';key.dataset.midi=m;
    key.style.left='calc('+(before/count*100)+'% - 1.775%)';
    key.innerHTML='<span class="key-label">'+NOTE_NAMES[m%12].split('/')[0]+'</span>';
    key.addEventListener('click',()=>handlePianoClick(m));
    piano.appendChild(key);
  }
}
function handlePianoClick(midi){
  stopAllPlayback();
  if(stage==='measure'||stage==='melody')setStage('pitch',false);
  updateCurrent(midi);highlightPiano(midi);
  renderSingleScore(midi,stage==='duration'?currentDuration:1);
  playTone(midi,.72);
  document.getElementById('playbackStatus').innerHTML='<b>'+noteInfo(midi).full+':</b> '+slotDescription(midi)+'.';
}

function noteSvg(midi,x,beats,index=null){
  const y=staffY(midi),isHalf=beats>=2&&beats<4,isWhole=beats>=4;
  const fill=isHalf||isWhole?'#f7f3e9':'#16212a';
  const stem=isWhole?'':'<line class="stem" x1="'+(x+12)+'" x2="'+(x+12)+'" y1="'+(y-2)+'" y2="'+(y-58)+'" stroke="#16212a" stroke-width="3.7" stroke-linecap="round"/>';
  const flag=beats<=.5?'<path class="flag" d="M '+(x+12)+' '+(y-58)+' Q '+(x+35)+' '+(y-43)+' '+(x+18)+' '+(y-25)+'" fill="none" stroke="#16212a" stroke-width="4"/>':'';
  const dot=(beats===1.5||beats===3)?'<circle cx="'+(x+27)+'" cy="'+y+'" r="4" fill="#16212a"/>':'';
  const acc=accidental(midi),accText=acc?'<text x="'+(x-32)+'" y="'+(y+8)+'" font-size="25" fill="#16212a">'+acc+'</text>':'';
  const idx=index===null?'':(' data-note-index="'+index+'"');
  return ledgerLines(y,x)+accText+
    '<g class="score-note"'+idx+' data-midi="'+midi+'" data-x="'+x+'">'+
    '<ellipse class="note-head" cx="'+x+'" cy="'+y+'" rx="14" ry="9.5" fill="'+fill+'" stroke="#16212a" stroke-width="3"/>'+
    stem+flag+dot+
    '<text class="pitch-label" x="'+x+'" y="'+(y+34)+'" text-anchor="middle">'+noteInfo(midi).full+'</text>'+
    '</g>';
}
function renderSingleScore(midi,beats=1){
  const svg=document.getElementById('score'),width=1000,x=520;
  svg.setAttribute('viewBox','0 0 '+width+' 390');svg.style.width='100%';
  svg.innerHTML=staffBase(width)+noteSvg(midi,x,beats);
  document.getElementById('scoreScroll').scrollLeft=0;applyLabelVisibility();
}
function renderMeasure(){
  const svg=document.getElementById('score'),width=1000,positions=[290,440,590,740];
  let notes='';
  MEASURE_NOTES.forEach(([midi,beats],i)=>notes+=noteSvg(midi,positions[i],beats,i));
  svg.setAttribute('viewBox','0 0 '+width+' 390');svg.style.width='100%';
  svg.innerHTML=staffBase(width)+
    '<text x="101" y="151" font-size="24" font-weight="900" fill="#16212a">4</text>'+
    '<text x="101" y="180" font-size="24" font-weight="900" fill="#16212a">4</text>'+
    notes+
    '<line x1="830" x2="830" y1="'+STAFF.top+'" y2="'+STAFF.bottom+'" stroke="#5f6b73" stroke-width="3"/>';
  document.getElementById('scoreScroll').scrollLeft=0;applyLabelVisibility();
}
function renderMelody(){
  const song=SONGS[currentSong],svg=document.getElementById('score'),pxBeat=48,startX=140;
  const total=song.notes.reduce((s,n)=>s+n[1],0),width=Math.max(1000,startX+total*pxBeat+80);
  let cursor=0,notes='',bars='';melodyBeatPositions=[];
  song.notes.forEach(([midi,beats],i)=>{
    const x=startX+cursor*pxBeat+beats*pxBeat/2;
    melodyBeatPositions.push(cursor);notes+=noteSvg(midi,x,beats,i);
    const next=cursor+beats;
    if(Math.abs(next/song.meter[0]-Math.round(next/song.meter[0]))<.001){
      const bx=startX+next*pxBeat;
      bars+='<line x1="'+bx+'" x2="'+bx+'" y1="'+STAFF.top+'" y2="'+STAFF.bottom+'" stroke="#6c757b" stroke-width="2.5"/>';
    }
    cursor=next;
  });
  svg.setAttribute('viewBox','0 0 '+width+' 390');svg.style.width=width+'px';
  svg.innerHTML=staffBase(width)+
    '<text x="101" y="151" font-size="24" font-weight="900" fill="#16212a">'+song.meter[0]+'</text>'+
    '<text x="101" y="180" font-size="24" font-weight="900" fill="#16212a">'+song.meter[1]+'</text>'+
    bars+notes;
  document.getElementById('tempo').value=song.bpm;
  document.getElementById('tempoValue').textContent=song.bpm;
  document.getElementById('scoreScroll').scrollLeft=0;applyLabelVisibility();
}
function applyLabelVisibility(){
  document.getElementById('score').classList.toggle('hide-pitch-labels',!document.getElementById('showLabels').checked);
  document.getElementById('piano').classList.toggle('hide-labels',!document.getElementById('showKeyboardLabels').checked);
}
function highlightScore(index){
  document.querySelectorAll('.score-note').forEach(g=>g.classList.remove('active'));
  const g=document.querySelector('.score-note[data-note-index="'+index+'"]');
  if(!g)return;
  g.classList.add('active');
  const x=Number(g.dataset.x),scroller=document.getElementById('scoreScroll');
  scroller.scrollTo({left:Math.max(0,x-scroller.clientWidth*.48),behavior:'smooth'});
}

const STAGE_COPY={
  pitch:['1. Najpierw tylko wysokość dźwięku.','Klikaj klawisze i patrz, jak nuta przesuwa się po liniach i polach. Na tym etapie nie musisz jeszcze rozumieć rytmu.','Położenie = wysokość dźwięku. Na razie ignoruj rytm.'],
  duration:['2. Teraz naucz się, jak długo trwa nuta.','Wybierz ósemkę, ćwierćnutę, półnutę albo całą nutę. Dźwięk C4 może mieć każdą z tych wartości — wysokość pozostaje ta sama.','Kształt nuty = czas trwania. Położenie nadal oznacza wysokość.'],
  measure:['3. Połącz cztery ćwierćnuty w takt 4/4.','C4, D4, E4 i F4 mają po jednym pulsie. Razem wypełniają jeden takt: 1–2–3–4.','Takt porządkuje czas. W 4/4 masz cztery ćwierćnutowe pulsy.'],
  melody:['4. Dopiero teraz pełna melodia.','Masz już wysokość, wartości rytmiczne i pojęcie taktu. Teraz zobacz, jak te same elementy tworzą „Panie Janie” i inne melodie.','Melodia = wysokości + wartości rytmiczne ułożone w takty.']
};
function setStage(next,resetStatus=true){
  stopAllPlayback();stage=next;
  document.querySelectorAll('[data-stage]').forEach(b=>b.classList.toggle('active',b.dataset.stage===stage));
  ['pitch','duration','measure','melody'].forEach(name=>{
    document.getElementById(name+'Toolbar').classList.toggle('hidden',name!==stage);
  });
  const copy=STAGE_COPY[stage];
  document.getElementById('stageExplanation').innerHTML='<strong>'+copy[0]+'</strong><span>'+copy[1]+'</span>';
  document.getElementById('conceptHint').textContent=copy[2];
  document.getElementById('beatStatus').textContent='';
  if(stage==='pitch'){
    renderSingleScore(currentMidi,1);
    if(resetStatus)document.getElementById('playbackStatus').innerHTML='<b>Wysokość:</b> kliknij klawisz i obserwuj położenie nuty.';
  }else if(stage==='duration'){
    renderSingleScore(currentMidi,currentDuration);
    if(resetStatus)document.getElementById('playbackStatus').innerHTML='<b>'+durationName(currentDuration)+':</b> ten sam dźwięk, inny czas trwania.';
  }else if(stage==='measure'){
    renderMeasure();
    document.getElementById('beatStatus').textContent='4/4';
    if(resetStatus)document.getElementById('playbackStatus').innerHTML='<b>Jeden takt:</b> C4 – D4 – E4 – F4, po jednej ćwierćnucie.';
  }else{
    renderMelody();
    const song=SONGS[currentSong];
    document.getElementById('playbackStatus').innerHTML='<b>'+song.title+':</b> '+song.description;
    document.getElementById('beatStatus').textContent=song.meter[0]+'/'+song.meter[1];
  }
}

function buildSongPicker(){
  const box=document.getElementById('songPicker');
  SONGS.forEach((song,i)=>{
    const b=document.createElement('button');b.textContent=song.title;b.dataset.song=i;
    b.classList.toggle('active',i===currentSong);
    b.addEventListener('click',()=>{
      stopAllPlayback();currentSong=i;
      document.querySelectorAll('[data-song]').forEach(x=>x.classList.toggle('active',Number(x.dataset.song)===i));
      renderMelody();
      document.getElementById('playbackStatus').innerHTML='<b>'+song.title+':</b> '+song.description;
      document.getElementById('beatStatus').textContent=song.meter[0]+'/'+song.meter[1];
    });
    box.appendChild(b);
  });
}

function playSelectedValue(){
  stopAllPlayback();
  if(stage!=='duration')setStage('duration',false);
  playingType='value';
  const beatMs=60000/76,durationSec=Math.max(.2,beatMs*currentDuration/1000*.92);
  const note=document.querySelector('.score-note');if(note)note.classList.add('active');
  highlightPiano(currentMidi);
  document.getElementById('playbackStatus').innerHTML='<b>'+noteInfo(currentMidi).full+' jako '+durationName(currentDuration)+':</b> trwa '+currentDuration+(currentDuration===1?' puls.':' pulsu.');
  document.getElementById('beatStatus').textContent=currentDuration+' × puls';
  playTone(currentMidi,durationSec,.12);
  timers.push(setTimeout(()=>{document.querySelectorAll('.score-note').forEach(g=>g.classList.remove('active'));clearPiano();playingType=null},durationSec*1000+70));
}
function playMeasure(){
  if(playingType==='measure'){stopAllPlayback();setStage('measure');return}
  stopAllPlayback();if(stage!=='measure')setStage('measure',false);
  playingType='measure';document.getElementById('playMeasure').textContent='■ Stop';
  const beatMs=60000/Number(document.getElementById('measureTempo').value);
  MEASURE_NOTES.forEach(([midi,beats],i)=>{
    timers.push(setTimeout(()=>{
      highlightScore(i);highlightPiano(midi);updateCurrent(midi);clickSound(i===0);
      document.getElementById('playbackStatus').innerHTML='<b>Puls '+(i+1)+' z 4:</b> '+noteInfo(midi).full+' • ćwierćnuta';
      document.getElementById('beatStatus').textContent='4/4 • '+(i+1);
      playTone(midi,beatMs/1000*.82,.11);
    },i*beatMs));
  });
  timers.push(setTimeout(()=>{
    playingType=null;document.getElementById('playMeasure').textContent='▶ Zagraj takt';
    document.querySelectorAll('.score-note').forEach(g=>g.classList.remove('active'));clearPiano();
    document.getElementById('playbackStatus').innerHTML='<b>Gotowe:</b> cztery ćwierćnuty wypełniły jeden takt 4/4.';
    document.getElementById('beatStatus').textContent='1–2–3–4';
  },MEASURE_NOTES.length*beatMs+80));
}
function startMelody(){
  if(playingType==='melody'){stopAllPlayback();setStage('melody');return}
  stopAllPlayback();if(stage!=='melody')setStage('melody',false);
  playingType='melody';document.getElementById('playMelody').textContent='■ Stop';
  const song=SONGS[currentSong],bpm=Number(document.getElementById('tempo').value),beatMs=60000/bpm;
  let offset=0;
  song.notes.forEach(([midi,beats],i)=>{
    const beatPos=melodyBeatPositions[i];
    timers.push(setTimeout(()=>{
      highlightScore(i);highlightPiano(midi);updateCurrent(midi);
      const measure=Math.floor(beatPos/song.meter[0])+1,beat=(beatPos%song.meter[0])+1;
      document.getElementById('playbackStatus').innerHTML='<b>Teraz:</b> '+noteInfo(midi).full+' • '+durationName(beats);
      document.getElementById('beatStatus').textContent='takt '+measure+' • puls '+String(beat).replace('.5','½');
      playTone(midi,Math.max(.16,beatMs*beats/1000*.86),.12);
    },offset));
    offset+=beatMs*beats;
  });
  timers.push(setTimeout(()=>{
    playingType=null;document.getElementById('playMelody').textContent='▶ Graj';
    document.querySelectorAll('.score-note').forEach(g=>g.classList.remove('active'));clearPiano();
    if(document.getElementById('loopMelody').checked)timers.push(setTimeout(startMelody,260));
    else{
      document.getElementById('playbackStatus').innerHTML='<b>'+song.title+':</b> koniec melodii.';
      document.getElementById('beatStatus').textContent='';
    }
  },offset+100));
}

function runSequence(midis,gap=330,chord=false){
  stopAllPlayback();setStage('pitch',false);
  if(chord){midis.forEach(m=>playTone(m,1.25,.07));return}
  midis.forEach((m,i)=>timers.push(setTimeout(()=>{
    updateCurrent(m);highlightPiano(m);renderSingleScore(m,1);playTone(m,.48,.11);
  },i*gap)));
  timers.push(setTimeout(clearPiano,midis.length*gap+100));
}

let selectedMeter=4;
function renderMeter(){
  const box=document.getElementById('meterDots');box.innerHTML='';
  for(let i=0;i<selectedMeter;i++){
    const d=document.createElement('div');d.className='meter-dot';
    if(i===0||(selectedMeter===6&&i===3))d.classList.add('accent');
    d.textContent=i+1;box.appendChild(d);
  }
}
function playMeter(){
  clearTimers();const dots=[...document.querySelectorAll('.meter-dot')],interval=selectedMeter===6?300:430;
  dots.forEach((d,i)=>timers.push(setTimeout(()=>{
    dots.forEach(x=>x.classList.remove('active'));d.classList.add('active');
    clickSound(i===0||(selectedMeter===6&&i===3));
  },i*interval)));
  timers.push(setTimeout(()=>dots.forEach(x=>x.classList.remove('active')),dots.length*interval+80));
}

buildPiano();buildSongPicker();updateCurrent(60);highlightPiano(60);renderSingleScore(60,1);renderMeter();

document.querySelectorAll('[data-stage]').forEach(b=>b.addEventListener('click',()=>setStage(b.dataset.stage)));
document.getElementById('showLabels').addEventListener('change',applyLabelVisibility);
document.getElementById('showKeyboardLabels').addEventListener('change',applyLabelVisibility);
document.querySelectorAll('[data-jump-midi]').forEach(b=>b.addEventListener('click',()=>handlePianoClick(Number(b.dataset.jumpMidi))));

document.querySelectorAll('#valuePicker [data-beats]').forEach(b=>b.addEventListener('click',()=>{
  currentDuration=Number(b.dataset.beats);
  document.querySelectorAll('#valuePicker [data-beats]').forEach(x=>x.classList.toggle('active',x===b));
  renderSingleScore(currentMidi,currentDuration);
  document.getElementById('playbackStatus').innerHTML='<b>'+durationName(currentDuration)+':</b> '+noteInfo(currentMidi).full+' ma tę samą wysokość, ale inną długość.';
  document.getElementById('beatStatus').textContent=currentDuration+' × puls';
}));
document.getElementById('playValue').addEventListener('click',playSelectedValue);

document.getElementById('playMeasure').addEventListener('click',playMeasure);
document.getElementById('measureTempo').addEventListener('input',e=>{
  document.getElementById('measureTempoValue').textContent=e.target.value;
  if(playingType==='measure'){stopAllPlayback();setStage('measure')}
});

document.getElementById('playMelody').addEventListener('click',startMelody);
document.getElementById('restartMelody').addEventListener('click',()=>{
  stopAllPlayback();document.getElementById('scoreScroll').scrollLeft=0;startMelody();
});
document.getElementById('tempo').addEventListener('input',e=>{
  document.getElementById('tempoValue').textContent=e.target.value;
  if(playingType==='melody'){stopAllPlayback();setStage('melody')}
});

document.getElementById('score').addEventListener('click',e=>{
  const g=e.target.closest('.score-note');if(!g)return;
  stopAllPlayback();
  let midi=Number(g.dataset.midi),beats=1;
  if(stage==='melody'&&g.dataset.noteIndex!==undefined){
    const i=Number(g.dataset.noteIndex);[midi,beats]=SONGS[currentSong].notes[i];highlightScore(i);
  }else if(stage==='measure'&&g.dataset.noteIndex!==undefined){
    const i=Number(g.dataset.noteIndex);[midi,beats]=MEASURE_NOTES[i];highlightScore(i);
  }else{
    beats=stage==='duration'?currentDuration:1;
    g.classList.add('active');
  }
  highlightPiano(midi);updateCurrent(midi);playTone(midi,Math.max(.25,.55*beats));
  document.getElementById('playbackStatus').innerHTML='<b>Kliknięta nuta:</b> '+noteInfo(midi).full+' • '+durationName(beats);
});

document.querySelectorAll('[data-demo-midi]').forEach(b=>b.addEventListener('click',()=>playTone(Number(b.dataset.demoMidi),.65)));
document.getElementById('playScale').addEventListener('click',()=>runSequence([60,62,64,65,67,69,71,72],320));
document.getElementById('playChord').addEventListener('click',()=>runSequence([60,64,67],0,true));

document.querySelectorAll('[data-meter]').forEach(b=>b.addEventListener('click',()=>{
  selectedMeter=Number(b.dataset.meter);
  document.querySelectorAll('[data-meter]').forEach(x=>x.classList.toggle('active',x===b));renderMeter();
}));
document.getElementById('playMeter').addEventListener('click',playMeter);

document.addEventListener('keydown',e=>{
  if(e.repeat||['INPUT','BUTTON'].includes(document.activeElement?.tagName))return;
  const map={a:60,s:62,d:64,f:65,g:67,h:69,j:71,k:72},midi=map[e.key.toLowerCase()];
  if(midi!==undefined)handlePianoClick(midi);
});
