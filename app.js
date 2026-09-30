
const NOTE_NAMES = ['C','C♯/D♭','D','D♯/E♭','E','F','F♯/G♭','G','G♯/A♭','A','A♯/B','H'];
const WHITE_PCS = new Set([0,2,4,5,7,9,11]);
const PL_WHITE = ['C','D','E','F','G','A','H'];
let ctx;
let timers = [];
let currentMelody = 0;
let playingMelody = false;

function audio(){
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if(ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function hz(midi){ return 440 * Math.pow(2,(midi-69)/12); }
function midiName(midi){
  const pc=midi%12, oct=Math.floor(midi/12)-1;
  return {full:NOTE_NAMES[pc]+oct, pitch:NOTE_NAMES[pc], octave:oct, pc};
}
function playTone(midi, seconds=.55, gain=.13){
  const ac=audio(), t=ac.currentTime, f=hz(midi);
  const out=ac.createGain();
  out.gain.setValueAtTime(.0001,t);
  out.gain.exponentialRampToValueAtTime(gain,t+.012);
  out.gain.exponentialRampToValueAtTime(gain*.68,t+.08);
  out.gain.exponentialRampToValueAtTime(.0001,t+seconds);
  out.connect(ac.destination);
  [
    [1,'sine',1],[2,'sine',.24],[3,'triangle',.11],[4,'sine',.05]
  ].forEach(([mult,type,level])=>{
    const o=ac.createOscillator(), g=ac.createGain();
    o.type=type;o.frequency.value=f*mult;g.gain.value=level;
    o.connect(g);g.connect(out);o.start(t);o.stop(t+seconds+.04);
  });
}
function clickSound(strong=false){
  const ac=audio(),t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();
  o.type='square';o.frequency.value=strong?1350:900;
  g.gain.setValueAtTime(strong?.08:.045,t);g.gain.exponentialRampToValueAtTime(.0001,t+.06);
  o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+.07);
}
function clearTimers(){
  timers.forEach(clearTimeout);timers=[];
}
function diatonicIndex(midi){
  const {pc,oct}=midiName(midi);
  const naturalMap={0:0,2:1,4:2,5:3,7:4,9:5,11:6};
  let naturalPc=pc;
  if(naturalMap[naturalPc]===undefined){
    naturalPc = [1,3,6,8,10].includes(pc) ? pc-1 : pc;
  }
  return oct*7 + naturalMap[naturalPc];
}
function staffY(midi, bottomY=220){
  const e4Index=4*7+2; // E4
  return bottomY-(diatonicIndex(midi)-e4Index)*15;
}
function ledgerYs(y, top=100, bottom=220){
  const ys=[];
  if(y>bottom){
    for(let ly=bottom+30;ly<=y;ly+=30) ys.push(ly);
  } else if(y<top){
    for(let ly=top-30;ly>=y;ly-=30) ys.push(ly);
  }
  return ys;
}
function accidentalForMidi(midi){
  const pc=midi%12;
  return WHITE_PCS.has(pc)?'': '♯';
}

function renderSingleStaff(midi){
  const svg=document.getElementById('singleStaff');
  if(!svg) return;
  const y=staffY(midi,220), acc=accidentalForMidi(midi);
  const ledgers=ledgerYs(y,100,220).map(ly=>'<line x1="350" x2="430" y1="'+ly+'" y2="'+ly+'" stroke="#263644" stroke-width="3"/>').join('');
  svg.querySelector('#singleLedger').innerHTML=ledgers;
  const g=svg.querySelector('#singleNote');
  g.setAttribute('transform','translate(390,'+y+')');
  g.querySelector('.acc').textContent=acc;
}

function setReadout(midi){
  const n=midiName(midi);
  const polishOct={3:'oktawa mała',4:'oktawa razkreślna',5:'oktawa dwukreślna',6:'oktawa trzykreślna'};
  document.getElementById('noteReadout').innerHTML='<strong>'+n.full+'</strong><span>'+hz(midi).toFixed(2)+' Hz • '+(polishOct[n.octave]||('oktawa '+n.octave))+'</span>';
  const desc=document.getElementById('noteExplain');
  if(desc){
    const natural = WHITE_PCS.has(n.pc);
    desc.textContent = natural
      ? 'To naturalny dźwięk '+n.pitch+' w oktawie '+n.octave+'. Kliknij inny klawisz i porównaj wysokość.'
      : 'To klawisz chromatyczny. Ten sam dźwięk można nazwać na dwa sposoby zależnie od kontekstu tonalnego.';
  }
}
function clearPianoHighlight(){
  document.querySelectorAll('.piano-key').forEach(k=>k.classList.remove('active'));
}
function highlightPiano(midi){
  clearPianoHighlight();
  const el=document.querySelector('.piano-key[data-midi="'+midi+'"]');
  if(el){el.classList.add('active');el.scrollIntoView({block:'nearest',inline:'nearest'});}
}
function selectNote(midi, sound=true){
  setReadout(midi);renderSingleStaff(midi);highlightPiano(midi);
  if(sound) playTone(midi,.72);
}

function buildPiano(){
  const piano=document.getElementById('piano');
  if(!piano) return;
  const start=48,end=83; // C3-H5
  const whiteMidis=[];
  for(let m=start;m<=end;m++) if(WHITE_PCS.has(m%12)) whiteMidis.push(m);
  whiteMidis.forEach(m=>{
    const n=midiName(m);
    const key=document.createElement('button');
    key.className='white-key piano-key';key.dataset.midi=m;
    key.innerHTML='<span>'+n.pitch.replace('H','H')+'<sub>'+n.octave+'</sub></span>';
    key.onclick=()=>selectNote(m,true);
    piano.appendChild(key);
  });
  const whiteCount=whiteMidis.length;
  for(let m=start;m<=end;m++){
    if(WHITE_PCS.has(m%12)) continue;
    let preceding=whiteMidis.filter(w=>w<m).length;
    const key=document.createElement('button');
    key.className='black-key piano-key';key.dataset.midi=m;
    key.style.left='calc('+(preceding/whiteCount*100)+'% - 2.3%)';
    key.innerHTML='<span>'+NOTE_NAMES[m%12].split('/')[0]+'</span>';
    key.onclick=()=>selectNote(m,true);
    piano.appendChild(key);
  }
}
buildPiano();
selectNote(60,false); // C4

document.querySelectorAll('[data-octave-c]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-octave-c]').forEach(b=>b.classList.toggle('active',b===btn));
    selectNote(Number(btn.dataset.octaveC),true);
  });
});

// Rhythm lab
const rhythmPattern=[
  {label:'♩',name:'ćwierćnuta',beats:1,midi:60},
  {label:'♪',name:'ósemka',beats:.5,midi:62},
  {label:'♪',name:'ósemka',beats:.5,midi:62},
  {label:'𝅗𝅥',name:'półnuta',beats:2,midi:64}
];
function buildRhythm(){
  const box=document.getElementById('rhythmBar'); if(!box)return;
  box.innerHTML='';
  rhythmPattern.forEach((r,i)=>{
    const d=document.createElement('div');d.className='rhythm-cell';d.style.setProperty('--beats',r.beats);
    d.dataset.rhythm=i;d.innerHTML='<div class="sym">'+r.label+'</div><b>'+r.beats+(r.beats===1?' uderzenie':' uderzenia')+'</b><small>'+r.name+'</small>';
    d.onclick=()=>{playTone(r.midi,Math.max(.18,r.beats*.35));d.classList.add('active');setTimeout(()=>d.classList.remove('active'),250)};
    box.appendChild(d);
  });
}
buildRhythm();
function playRhythm(){
  clearTimers();
  const bpm=Number(document.getElementById('rhythmBpm').value), beatMs=60000/bpm;
  let offset=0;
  rhythmPattern.forEach((r,i)=>{
    timers.push(setTimeout(()=>{
      document.querySelectorAll('.rhythm-cell').forEach(x=>x.classList.remove('active'));
      const cell=document.querySelector('[data-rhythm="'+i+'"]'); if(cell)cell.classList.add('active');
      clickSound(i===0);playTone(r.midi,Math.max(.14,beatMs*r.beats/1000*.78),.09);
    },offset));
    offset += beatMs*r.beats;
  });
  timers.push(setTimeout(()=>document.querySelectorAll('.rhythm-cell').forEach(x=>x.classList.remove('active')),offset+80));
}
document.getElementById('playRhythm')?.addEventListener('click',playRhythm);
document.getElementById('rhythmBpm')?.addEventListener('input',e=>document.getElementById('rhythmBpmValue').textContent=e.target.value);

// meter demos
document.querySelectorAll('[data-meter-play]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    clearTimers();
    const count=Number(btn.dataset.meterPlay), card=btn.closest('.meter-card'), dots=[...card.querySelectorAll('.count-dot')];
    const grouped=btn.dataset.grouped==='true';
    const interval= grouped ? 260 : 430;
    dots.forEach((dot,i)=>{
      timers.push(setTimeout(()=>{
        dots.forEach(d=>d.classList.remove('active'));
        dot.classList.add('active');
        clickSound(i===0 || (grouped && i===3));
      },i*interval));
    });
    timers.push(setTimeout(()=>dots.forEach(d=>d.classList.remove('active')),dots.length*interval+80));
  });
});

// melodies
const MELODIES=[
  {
    title:'Panie Janie', subtitle:'4/4 • spokojnie • świetna do czytania krokami',
    bpm:92,
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
    title:'Oda do radości', subtitle:'4/4 • Beethoven • fragment tematu',
    bpm:104,
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
    title:'Twinkle, Twinkle', subtitle:'4/4 • melodia ludowa • duże skoki C–G–A',
    bpm:88,
    notes:[
      [60,1],[60,1],[67,1],[67,1],
      [69,1],[69,1],[67,2],
      [65,1],[65,1],[64,1],[64,1],
      [62,1],[62,1],[60,2]
    ]
  },
  {
    title:'Mary Had a Little Lamb', subtitle:'4/4 • prosta melodia na trzech–czterech dźwiękach',
    bpm:98,
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
function noteSvg(note,index,x,y,duration){
  const ledgers=ledgerYs(y,60,180).map(ly=>'<line x1="'+(x-22)+'" x2="'+(x+22)+'" y1="'+ly+'" y2="'+ly+'" stroke="#394650" stroke-width="2.5"/>').join('');
  const filled=duration<2;
  const stem=duration<4?'<line x1="'+(x+12)+'" y1="'+(y-2)+'" x2="'+(x+12)+'" y2="'+(y-55)+'" stroke="#17222c" stroke-width="3.5" stroke-linecap="round"/>':'';
  const flag=duration<=.5?'<path d="M '+(x+12)+' '+(y-55)+' Q '+(x+34)+' '+(y-42)+' '+(x+19)+' '+(y-26)+'" fill="none" stroke="#17222c" stroke-width="4"/>':'';
  const acc=accidentalForMidi(note);
  const accText=acc?'<text x="'+(x-30)+'" y="'+(y+7)+'" font-size="25" fill="#17222c">♯</text>':'';
  return ledgers+accText+'<g class="melody-note" data-note-index="'+index+'">'+
    '<ellipse class="note-dot" cx="'+x+'" cy="'+y+'" rx="13" ry="9" transform="rotate(-18 '+x+' '+y+')" fill="'+(filled?'#17222c':'#f7f3e9')+'" stroke="#17222c" stroke-width="3"/>'+stem+flag+
    '<text class="note-label" x="'+x+'" y="'+(y+31)+'" text-anchor="middle" fill="#54636d">'+midiName(note).pitch.replace('/','')+'</text></g>';
}
function renderMelody(){
  const m=MELODIES[currentMelody], svg=document.getElementById('melodyStaff');
  document.getElementById('melodyTitle').textContent=m.title;
  document.getElementById('melodySubtitle').textContent=m.subtitle;
  document.getElementById('melodyTempo').textContent=m.bpm+' BPM';
  document.querySelectorAll('.melody-tab').forEach((b,i)=>b.classList.toggle('active',i===currentMelody));
  const totalBeats=m.notes.reduce((s,n)=>s+n[1],0), pxBeat=42, startX=105, width=Math.max(980,startX+totalBeats*pxBeat+50);
  svg.setAttribute('viewBox','0 0 '+width+' 260');
  svg.style.width=width+'px';
  const lines=[60,90,120,150,180].map(y=>'<line x1="75" x2="'+(width-25)+'" y1="'+y+'" y2="'+y+'" stroke="#394650" stroke-width="2.5"/>').join('');
  let beatCursor=0, notesHtml='', bars='';
  m.notes.forEach(([midi,dur],i)=>{
    const x=startX+beatCursor*pxBeat+dur*pxBeat/2, y=staffY(midi,180);
    notesHtml += noteSvg(midi,i,x,y,dur);
    const next=beatCursor+dur;
    if(Math.abs(next/4-Math.round(next/4))<.001){
      const bx=startX+next*pxBeat;
      bars+='<line x1="'+bx+'" x2="'+bx+'" y1="60" y2="180" stroke="#5a6670" stroke-width="2.5"/>';
    }
    beatCursor=next;
  });
  svg.innerHTML='<rect width="100%" height="100%" fill="#f7f3e9"/>'+lines+
    '<text x="18" y="174" font-family="Times New Roman" font-size="92" fill="#17222c">𝄞</text>'+
    '<text x="74" y="114" font-size="26" font-weight="800" fill="#17222c">4</text><text x="74" y="145" font-size="26" font-weight="800" fill="#17222c">4</text>'+
    bars+notesHtml;
  document.getElementById('melodyNow').textContent='Gotowe do odtworzenia';
}
document.querySelectorAll('.melody-tab').forEach((b,i)=>b.addEventListener('click',()=>{
  stopMelody();currentMelody=i;renderMelody();
}));
function stopMelody(){
  clearTimers();playingMelody=false;
  document.querySelectorAll('.melody-note .note-dot').forEach(n=>n.classList.remove('active'));
  document.getElementById('melodyPlay').textContent='▶ Odtwórz i śledź';
  document.getElementById('melodyNow').textContent='Zatrzymano';
  clearPianoHighlight();
}
function playMelody(){
  if(playingMelody){stopMelody();return;}
  playingMelody=true;
  const m=MELODIES[currentMelody], beatMs=60000/m.bpm;
  document.getElementById('melodyPlay').textContent='■ Stop';
  let offset=0;
  m.notes.forEach(([midi,dur],i)=>{
    timers.push(setTimeout(()=>{
      document.querySelectorAll('.melody-note .note-dot').forEach(n=>n.classList.remove('active'));
      const dot=document.querySelector('[data-note-index="'+i+'"] .note-dot');if(dot)dot.classList.add('active');
      highlightPiano(midi);
      document.getElementById('melodyNow').textContent='Teraz: '+midiName(midi).full+' • '+dur+(dur===1?' uderzenie':' uderzenia');
      playTone(midi,Math.max(.15,beatMs*dur/1000*.84),.12);
    },offset));
    offset += beatMs*dur;
  });
  timers.push(setTimeout(()=>{
    playingMelody=false;document.getElementById('melodyPlay').textContent='▶ Odtwórz i śledź';
    document.getElementById('melodyNow').textContent='Koniec melodii';
    document.querySelectorAll('.melody-note .note-dot').forEach(n=>n.classList.remove('active'));
    clearPianoHighlight();
  },offset+120));
}
document.getElementById('melodyPlay')?.addEventListener('click',playMelody);
document.getElementById('melodySlow')?.addEventListener('click',()=>{
  if(playingMelody)stopMelody();
  const original=MELODIES[currentMelody].bpm;
  MELODIES[currentMelody].bpm=Math.max(52,Math.round(original*.68));
  playMelody();
  timers.push(setTimeout(()=>{MELODIES[currentMelody].bpm=original;document.getElementById('melodyTempo').textContent=original+' BPM';},100));
});
renderMelody();

// Day 5 scale/chords
function sequence(midis, gap=320){
  clearTimers();
  midis.forEach((m,i)=>timers.push(setTimeout(()=>{
    document.querySelectorAll('.tone-chip').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.tone-chip[data-midi="'+m+'"]').forEach(x=>x.classList.add('active'));
    selectNote(m,false);playTone(m,.42);
  },i*gap)));
  timers.push(setTimeout(()=>document.querySelectorAll('.tone-chip').forEach(x=>x.classList.remove('active')),midis.length*gap+80));
}
document.getElementById('playScaleC')?.addEventListener('click',()=>sequence([60,62,64,65,67,69,71,72],300));
document.getElementById('playChordC')?.addEventListener('click',()=>{
  clearTimers();[60,64,67].forEach(m=>{playTone(m,1.2,.075);document.querySelectorAll('.tone-chip[data-midi="'+m+'"]').forEach(x=>x.classList.add('active'))});
  timers.push(setTimeout(()=>document.querySelectorAll('.tone-chip').forEach(x=>x.classList.remove('active')),950));
});
document.querySelectorAll('.tone-chip[data-midi]').forEach(ch=>ch.addEventListener('click',()=>selectNote(Number(ch.dataset.midi),true)));

// final practice
const quizNotes=[60,62,64,65,67,69,71];
let quizMidi=60,score=0,total=0,answered=false;
function newQuestion(){
  quizMidi=quizNotes[Math.floor(Math.random()*quizNotes.length)];answered=false;
  renderQuizStaff();
  document.querySelectorAll('.answer').forEach(b=>b.className='answer');
  document.getElementById('quizFeedback').textContent='Najpierw przeczytaj położenie nuty. Odsłuch jest pomocą.';
}
function renderQuizStaff(){
  const svg=document.getElementById('quizStaff'),y=staffY(quizMidi,180);
  const lines=[60,90,120,150,180].map(ly=>'<line x1="90" x2="650" y1="'+ly+'" y2="'+ly+'" stroke="#394650" stroke-width="3"/>').join('');
  const ledgers=ledgerYs(y,60,180).map(ly=>'<line x1="350" x2="430" y1="'+ly+'" y2="'+ly+'" stroke="#394650" stroke-width="3"/>').join('');
  svg.innerHTML='<rect width="100%" height="100%" fill="#f7f3e9"/>'+lines+
  '<text x="20" y="174" font-family="Times New Roman" font-size="92" fill="#17222c">𝄞</text>'+ledgers+
  '<ellipse cx="390" cy="'+y+'" rx="18" ry="12" transform="rotate(-18 390 '+y+')" fill="#17222c"/>'+
  '<line x1="406" y1="'+(y-2)+'" x2="406" y2="'+(y-72)+'" stroke="#17222c" stroke-width="5" stroke-linecap="round"/>';
}
document.querySelectorAll('.answer').forEach(btn=>btn.addEventListener('click',()=>{
  if(answered)return;answered=true;total++;
  const chosen=Number(btn.dataset.midi);
  if(chosen===quizMidi){score++;btn.classList.add('good');document.getElementById('quizFeedback').textContent='Dobrze — '+midiName(quizMidi).pitch+'.';playTone(quizMidi,.55)}
  else{btn.classList.add('bad');document.querySelector('.answer[data-midi="'+quizMidi+'"]').classList.add('good');document.getElementById('quizFeedback').textContent='To '+midiName(quizMidi).pitch+'. Popatrz jeszcze raz na linię/pole.'}
  document.getElementById('quizScore').textContent=score+' / '+total;
}));
document.getElementById('quizHear')?.addEventListener('click',()=>playTone(quizMidi,.65));
document.getElementById('quizNext')?.addEventListener('click',newQuestion);
newQuestion();

// progress
const completed = new Set(JSON.parse(localStorage.getItem('musicCourseDays')||'[]'));
function renderProgress(){
  document.querySelectorAll('[data-complete-day]').forEach(btn=>{
    const day=Number(btn.dataset.completeDay),done=completed.has(day);
    btn.classList.toggle('done',done);btn.textContent=done?'✓ Dzień ukończony':'Oznacz jako ukończony';
  });
  document.querySelectorAll('.path-row').forEach(row=>row.classList.toggle('done',completed.has(Number(row.dataset.day))));
  const pct=completed.size/5*100;
  document.getElementById('progressFill').style.width=pct+'%';
  document.getElementById('progressText').textContent=completed.size+' / 5 dni';
}
document.querySelectorAll('[data-complete-day]').forEach(btn=>btn.addEventListener('click',()=>{
  const day=Number(btn.dataset.completeDay);
  completed.has(day)?completed.delete(day):completed.add(day);
  localStorage.setItem('musicCourseDays',JSON.stringify([...completed]));
  renderProgress();
}));
renderProgress();

document.getElementById('startCourse')?.addEventListener('click',()=>document.getElementById('day1').scrollIntoView({behavior:'smooth'}));
document.getElementById('playC4')?.addEventListener('click',()=>selectNote(60,true));
