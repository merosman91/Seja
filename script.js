/* ملف اللعبة الرئيسي — يدعم:
   - لوحة 9x5، توزيع 22 قطعة لكل لاعب
   - مربع مركزي (X) قابل للحركة
   - قفز/أكل حسب القاعدة: [مهاجم][خصم ملاصق][مربع فارغ خلفه]
   - قفز متتالي تنفيذي تلقائياً
   - AI toggle (تشغيل/ايقاف)، Sound toggle
   - ثنائية اللغة (AR/EN)
   - توافق وحجم اللوح التلقائي */
   
// ثابتات
const COLS = 9, ROWS = 5, SIZE = COLS * ROWS;
const CENTER_X_INDEX = 2*COLS + 4;

// عناصر DOM
const boardEl = document.getElementById('board');
const startBtn = document.getElementById('startBtn');
const aiToggleBtn = document.getElementById('aiToggleBtn');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const diffSelect = document.getElementById('difficulty');
const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const turnInfo = document.getElementById('turnInfo');
const hintEl = document.getElementById('hint');
const langSelect = document.getElementById('langSelect');
const p1nameEl = document.getElementById('p1name');
const p2nameEl = document.getElementById('p2name');
const legMove = document.getElementById('legMove');
const legJump = document.getElementById('legJump');
const legSel = document.getElementById('legSel');
const legX = document.getElementById('legX');
const howTitle = document.getElementById('howTitle');
const howList = document.getElementById('howList');
const aiBtn = aiToggleBtn, soundBtn = soundToggleBtn;
const gameTitleEl = document.getElementById('gameTitle');
const gameSubEl = document.getElementById('gameSubtitle');

// حالة اللعبة
let grid = Array(SIZE).fill(null);
let currentPlayer = 'p1';
let selected = null;
let availableMoves = []; // [{to,type,capturedIdx}]
let playingAgainstAI = true;
let soundEnabled = true;
let difficulty = 'medium';
let score = { p1:22, p2:22 };

// audio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, dur=120, type='sine', vol=0.06){
  if (!soundEnabled) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  setTimeout(()=>{ try{ o.stop(); o.disconnect(); g.disconnect(); }catch(e){} }, dur);
}
function playMove(){ playTone(480,90,'sine',0.04); }
function playJump(){ playTone(220,160,'triangle',0.08); playTone(520,120,'sine',0.05); }
function playWin(){ playTone(880,220,'sawtooth',0.12); playTone(660,240,'sine',0.10); }

// نصوص ثنائية اللغة
const TEXTS = {
  ar: {
    title: 'لعبة سيجة السودانية',
    subtitle: 'Sudanese Seega Game',
    langLabel: 'اللغة',
    diffLabel: 'درجة الصعوبة',
    startBtn: 'ابدأ / Start',
    aiOn: 'AI: تشغيل',
    aiOff: 'AI: إيقاف',
    soundOn: 'الصوت: تشغيل',
    soundOff: 'الصوت: إيقاف',
    p1: 'اللاعب الأسود',
    p2: 'اللاعب الأبيض',
    pieces: 'قطعة',
    turnPrefix: 'دور:',
    hint_default: 'اختر قطعة لتحريكها — ستُبرز الحركات المسموح بها',
    legMove: 'حركة عادية',
    legJump: 'قفزة/أكل',
    legSel: 'قطعة مختارة',
    legX: 'المربع المركزي',
    howTitle: 'كيف تلعب',
    howList: [
      'لكل لاعب 22 قطعة (صفان من 9 وصف ثالث 4).',
      'اللوح 9×5 والمربع الأوسط يحمل علامة X كمركز.',
      'التحرك في أربع اتجاهات (أعلى/أسفل/يسار/يمين) إلى مربع فارغ مجاور.',
      'قواعد الأكل (قفزة): إذا كانت أمام قطعتك قطعة خصم ملاصقة وخلفها مربع فارغ → تقفز إلى المربع الفارغ وتحذف قطعة الخصم.',
      'بعد القفزة، إذا توفرت قفزات إضافية فستُنفَّذ تلقائياً في نفس الدور.',
      'الفائز: من يبقى لديه قطع بينما الآخر يخسرها أو عندما لا تبقى حركات.'
    ],
    disableNote: 'يمكنك كتم الأصوات بواسطة زر "الصوت".',
    swapLocal: 'العب محليًا',
    swapVs: 'العب ضد كمبيوتر'
  },
  en: {
    title: 'Sudanese Seega Game',
    subtitle: 'لعبة سيجة السودانية',
    langLabel: 'Language',
    diffLabel: 'Difficulty',
    startBtn: 'Start / Restart',
    aiOn: 'AI: On',
    aiOff: 'AI: Off',
    soundOn: 'Sound: On',
    soundOff: 'Sound: Off',
    p1: 'Black Player',
    p2: 'White Player',
    pieces: 'pieces',
    turnPrefix: 'Turn:',
    hint_default: 'Select a piece — legal squares will be highlighted',
    legMove: 'Normal move',
    legJump: 'Jump / Capture',
    legSel: 'Selected piece',
    legX: 'Center square',
    howTitle: 'How to play',
    howList: [
      'Each player has 22 pieces (two full rows of 9 and one row of 4).',
      'Board is 9×5 and the middle cell shows an X as the center.',
      'Move in 4 directions (up/down/left/right) to an adjacent empty cell.',
      'Capture (jump): If adjacent cell has an opponent piece and the following cell is empty → jump there and remove the opponent piece.',
      'After a jump, further jumps (if available) are executed automatically in the same turn.',
      'Winner: the player with pieces remaining when the opponent has none, or when no moves remain.'
    ],
    disableNote: 'You can mute sound with the "Sound" button.',
    swapLocal: 'Local play',
    swapVs: 'Play vs Computer'
  }
};

// language apply
function getLang(){ return langSelect.value || 'ar'; }
function applyLanguage(lang){
  const t = TEXTS[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang==='ar') ? 'rtl' : 'ltr';
  gameTitleEl.textContent = t.title;
  gameSubEl.textContent = t.subtitle;
  document.getElementById('diffLabel').textContent = t.diffLabel;
  startBtn.textContent = t.startBtn;
  aiBtn.textContent = playingAgainstAI ? t.aiOn : t.aiOff;
  soundBtn.textContent = soundEnabled ? t.soundOn : t.soundOff;
  p1nameEl.textContent = t.p1;
  p2nameEl.textContent = t.p2;
  document.getElementById('scoreLabel1').textContent = t.pieces;
  document.getElementById('scoreLabel2').textContent = t.pieces;
  turnInfo.textContent = `${t.turnPrefix} ${ (currentPlayer==='p1' ? t.p1 : t.p2) }`;
  hintEl.textContent = t.hint_default;
  legMove.textContent = t.legMove;
  legJump.textContent = t.legJump;
  legSel.textContent = t.legSel;
  legX.textContent = t.legX;
  howTitle.textContent = t.howTitle;
  howList.innerHTML = '';
  t.howList.forEach(txt => { const li = document.createElement('li'); li.textContent = txt; howList.appendChild(li); });
  document.getElementById('disableNote').textContent = t.disableNote;
  document.getElementById('langLabel').textContent = t.langLabel;
  document.getElementById('startBtn').textContent = t.startBtn;
  document.getElementById('diffLabel').textContent = t.diffLabel;
}
langSelect.addEventListener('change', ()=> { applyLanguage(getLang()); render(); });

// ===== إعداد اللوح الأولي (الخيار A) =====
function setupInitialGrid(){
  grid = Array(SIZE).fill(null);
  // صفان علويان p1
  for (let r=0;r<2;r++) for (let c=0;c<COLS;c++) grid[r*COLS + c] = 'p1';
  // صف وسط: 0..3 p1 ; 4 = center (فارغ) ; 5..8 p2
  for (let c=0;c<4;c++) grid[2*COLS + c] = 'p1';
  grid[2*COLS + 4] = null; // center allowed to move
  for (let c=5;c<9;c++) grid[2*COLS + c] = 'p2';
  // صفان سفليان p2
  for (let r=3;r<5;r++) for (let c=0;c<COLS;c++) grid[r*COLS + c] = 'p2';
  currentPlayer = 'p1';
  selected = null; availableMoves = [];
  score.p1 = countPieces('p1'); score.p2 = countPieces('p2');
}

// عد القطع
function countPieces(p){ return grid.filter(x => x===p).length; }

// حساب الحركات لقطعة idx
function calculateMovesFor(idx){
  const moves = [];
  const r = Math.floor(idx / COLS), c = idx % COLS;
  const deltas = [[-1,0],[1,0],[0,-1],[0,1]];
  deltas.forEach(([dr,dc]) => {
    const nr = r+dr, nc = c+dc;
    if (nr<0||nr>=ROWS||nc<0||nc>=COLS) return;
    const adj = nr*COLS + nc;
    // حركة عادية إذا فارغ
    if (grid[adj] === null){
      moves.push({to:adj,type:'move',capturedIdx:null});
    }
    // قفزة إذا المجاور خصم ومربع بعده فارغ
    const mover = grid[idx];
    const opponent = mover==='p1' ? 'p2' : 'p1';
    if (grid[adj] === opponent){
      const br = nr+dr, bc = nc+dc;
      if (br>=0 && br<ROWS && bc>=0 && bc<COLS){
        const beyond = br*COLS + bc;
        if (grid[beyond] === null){
          moves.push({to:beyond,type:'jump',capturedIdx:adj});
        }
      }
    }
  });
  return moves;
}

// رندر اللوح
function render(){
  boardEl.innerHTML = '';
  for (let i=0;i<SIZE;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.i = i;
    if (i === CENTER_X_INDEX) cell.classList.add('xcell');
    const mv = availableMoves.find(m=> m.to===i);
    if (mv) cell.classList.add(mv.type === 'jump' ? 'capture' : 'legal');
    if (selected === i) cell.classList.add('selected');
    const piece = grid[i];
    if (piece){
      const p = document.createElement('div');
      p.className = `piece ${piece}`;
      cell.appendChild(p);
    }
    cell.addEventListener('click', ()=> onCellClick(i));
    boardEl.appendChild(cell);
  }
  updateUI();
}

// تفاعل الضغط
function onCellClick(i){
  const piece = grid[i];
  if (selected === null){
    if (piece === currentPlayer){
      selected = i;
      availableMoves = calculateMovesFor(i);
      hintEl.textContent = TEXTS[getLang()].hint_default;
      if (availableMoves.length===0) hintEl.textContent = (getLang()==='ar' ? 'لا توجد حركات لهذه القطعة' : 'No moves for this piece');
    }
    render(); return;
  }

  // العثور على الحركة المطلوبة
  const move = availableMoves.find(m=> m.to === i);
  if (move){
    performMove(selected, move); return;
  }

  // تبديل الاختيار إن ضغط على قطعة له
  if (piece === currentPlayer){
    selected = i; availableMoves = calculateMovesFor(i); render(); return;
  }

  // خلاف ذلك إلغاء الاختيار
  selected = null; availableMoves = []; render();
}

// تنفيذ الحركة
function performMove(src, moveObj){
  const dst = moveObj.to; const mover = grid[src];
  grid[dst] = mover; grid[src] = null; playMove();
  if (moveObj.type === 'jump' && moveObj.capturedIdx != null){ grid[moveObj.capturedIdx] = null; playJump(); }
  score.p1 = countPieces('p1'); score.p2 = countPieces('p2'); render();

  if (moveObj.type === 'jump'){
    setTimeout(()=> autoChainJumps(dst), 260);
  } else { selected=null; availableMoves=[]; toggleTurn(); }
}

// قفزات متتالية تلقائياً
function autoChainJumps(idx){
  let cur = idx;
  while (true){
    const jumps = calculateMovesFor(cur).filter(m=> m.type === 'jump');
    if (!jumps || jumps.length === 0) break;
    let chosen = jumps[0];
    if (difficulty === 'hard' && jumps.length > 1){
      let best = chosen, bestG = evaluateJumpGain(cur, chosen);
      for (let i=1;i<jumps.length;i++){ const g = evaluateJumpGain(cur, jumps[i]); if (g>bestG){ bestG=g; best=jumps[i]; } }
      chosen = best;
    }
    const to = chosen.to, cap = chosen.capturedIdx;
    grid[to] = grid[cur]; grid[cur] = null; if (cap != null) grid[cap] = null; playJump();
    score.p1 = countPieces('p1'); score.p2 = countPieces('p2'); render();
    cur = to;
  }
  selected = null; availableMoves = [];
  if (!checkWin()) toggleTurn();
}

// تقييم فائدة القفزة لمساعدة AI
function evaluateJumpGain(fromIdx, jumpObj){
  const temp = grid.slice(); const to = jumpObj.to, cap = jumpObj.capturedIdx;
  temp[to] = temp[fromIdx]; temp[fromIdx] = null; if (cap != null) temp[cap] = null;
  let gain = 0; const r = Math.floor(to/COLS), c = to%COLS; const deltas = [[-1,0],[1,0],[0,-1],[0,1]];
  deltas.forEach(([dr,dc])=>{
    const nr=r+dr,nc=c+dc, br=nr+dr, bc=nc+dc;
    if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && br>=0 && br<ROWS && bc>=0 && bc<COLS){
      const adj=nr*COLS+nc, beyond=br*COLS+bc; if (temp[adj] && temp[adj]!==temp[to] && temp[beyond]===null) gain++;
    }
  });
  return gain;
}

// تبديل الدور
function toggleTurn(){
  currentPlayer = currentPlayer==='p1' ? 'p2' : 'p1'; updateTurnText();
  if (playingAgainstAI && currentPlayer==='p2') setTimeout(()=> aiMove(), difficulty==='hard'?450: difficulty==='medium'?700:1000);
}

// AI مبسط
function aiMove(){
  if (!playingAgainstAI || currentPlayer!=='p2') return;
  difficulty = diffSelect.value;
  const aiPieces = grid.map((v,i)=> v==='p2' ? i : -1).filter(i=> i!==-1);
  let best = null;
  aiPieces.forEach(from=>{
    const moves = calculateMovesFor(from);
    moves.forEach(m=>{
      let sc = (m.type==='jump') ? 10 + evaluateJumpGain(from,m) : 1;
      if (difficulty==='medium') sc += Math.random()*3;
      if (!best || sc > best[2]) best=[from,m,sc];
    });
  });
  if (best) performMove(best[0], best[1]);
  else toggleTurn();
}

// فحص انتهاء اللعبة
function checkWin(){
  const p1 = countPieces('p1'), p2 = countPieces('p2');
  if (p1===0 || p2===0){
    const lang = getLang(); const winner = p1===0 ? (lang==='ar' ? 'اللاعب الأبيض' : 'White player') : (lang==='ar' ? 'اللاعب الأسود' : 'Black player');
    playWin(); setTimeout(()=> alert(`${ lang==='ar'? '🏆 انتهت اللعبة — ' : '🏆 Game over — ' }${winner}`), 120);
    return true;
  }
  return false;
}

// تحديث UI (نقاط ودور)
function updateUI(){
  score1El.textContent = score.p1;
  score2El.textContent = score.p2;
  updateTurnText();
}
function updateTurnText(){
  const lang = getLang();
  const name = currentPlayer==='p1' ? (lang==='ar'? TEXTS.ar.p1 : TEXTS.en.p1) : (lang==='ar'? TEXTS.ar.p2 : TEXTS.en.p2);
  turnInfo.textContent = `${TEXTS[lang].turnPrefix} ${name}`;
}

// أحداث أزرار
startBtn.addEventListener('click', ()=>{ difficulty=diffSelect.value; playingAgainstAI=true; aiBtn.classList.add('on'); aiBtn.classList.remove('off'); playingAgainstAI=true; setupInitialGrid(); render(); });
aiBtn.addEventListener('click', ()=>{ playingAgainstAI = !playingAgainstAI; const lang=getLang(); aiBtn.textContent = playingAgainstAI ? TEXTS[lang].aiOn : TEXTS[lang].aiOff; aiBtn.classList.toggle('on'); aiBtn.classList.toggle('off'); });
soundBtn.addEventListener('click', ()=>{ soundEnabled = !soundEnabled; const lang=getLang(); soundBtn.textContent = soundEnabled ? TEXTS[lang].soundOn : TEXTS[lang].soundOff; soundBtn.classList.toggle('on'); soundBtn.classList.toggle('off'); });
diffSelect.addEventListener('change', ()=> difficulty = diffSelect.value);

// resize: تعديل حجم الخلية ليتناسب مع الشاشة (يحدث CSS متغير --max-board-width، لكن نضمن أنه مناسب)
function adjustBoardSize(){
  const wrap = document.querySelector('.wrap');
  const maxSide = Math.min(window.innerWidth - 48, window.innerHeight - 220); // مساحات للنصوص
  const boardWrap = document.getElementById('boardWrap');
  const size = Math.max(36, Math.min( Math.floor(maxSide*0.86), 88 * 9 )); // شرط معقول
  // نُحدِث متغير CSS
  boardWrap.querySelector('.board').style.setProperty('--max-board-width', `${Math.min(size, window.innerWidth - 80)}px`);
}
window.addEventListener('resize', ()=> { adjustBoardSize(); render(); });
window.addEventListener('orientationchange', ()=> { adjustBoardSize(); render(); });

// لغة افتراضية وتطبيقها
function applyInitialLanguage(){
  const lang = getLang();
  applyLanguage(lang);
}
function applyLanguage(lang){ applyLanguageImpl(lang); }
function applyLanguageImpl(lang){
  const t = TEXTS[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang==='ar')? 'rtl' : 'ltr';
  gameTitleEl.textContent = t.title;
  gameSubEl.textContent = t.subtitle;
  document.getElementById('diffLabel').textContent = t.diffLabel;
  startBtn.textContent = t.startBtn;
  aiBtn.textContent = playingAgainstAI ? t.aiOn : t.aiOff;
  soundBtn.textContent = soundEnabled ? t.soundOn : t.soundOff;
  p1nameEl.textContent = t.p1; p2nameEl.textContent = t.p2;
  document.getElementById('scoreLabel1').textContent = t.pieces; document.getElementById('scoreLabel2').textContent = t.pieces;
  turnInfo.textContent = `${t.turnPrefix} ${ (currentPlayer==='p1'? t.p1 : t.p2) }`;
  hintEl.textContent = t.hint_default;
  legMove.textContent = t.legMove; legJump.textContent = t.legJump; legSel.textContent = t.legSel; legX.textContent = t.legX;
  howTitle.textContent = t.howTitle;
  howList.innerHTML = ''; t.howList.forEach(txt=>{ const li=document.createElement('li'); li.textContent=txt; howList.appendChild(li); });
  document.getElementById('disableNote').textContent = t.disableNote;
  document.getElementById('langLabel').textContent = t.langLabel;
  document.getElementById('startBtn').textContent = t.startBtn;
}

// init
applyLanguageImpl(getLang());
setupInitialGrid();
adjustBoardSize();
render();
