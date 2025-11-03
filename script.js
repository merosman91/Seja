/* لعبة سيجة السودانية — النسخة النهائية (حديث بسيط)
   مميزات في هذا الملف:
   - لوحة 9×5، توزيع 22 قطعة لكل لاعب
   - مربع مركزي X (قابل للحركة)
   - قفز/أكل وفق [مهاجم][خصم ملاصق][مربع فارغ خلفه]
   - قفز متتالي تلقائي
   - Undo (تراجع لحالة واحدة)
   - Auto-reset بعد انتهاء الجولة (مع إلغاء)
   - Toggle AI، Toggle Sound، صعوبة، ثنائية اللغة
   - Board responsive: يظهر كاملًا على الشاشات
*/

// ثابتات اللوح
const COLS = 9, ROWS = 5, SIZE = COLS * ROWS;
const CENTER_IDX = 2 * COLS + 4;

// عناصر DOM
const boardEl = document.getElementById('board');
const langSelect = document.getElementById('langSelect');
const diffSelect = document.getElementById('diffSelect');
const aiToggle = document.getElementById('aiToggle');
const soundToggleBtn = document.getElementById('soundToggle');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');
const startBtn = document.getElementById('startBtn');

const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const scoreLabel1 = document.getElementById('scoreLabel1');
const scoreLabel2 = document.getElementById('scoreLabel2');
const p1name = document.getElementById('p1name');
const p2name = document.getElementById('p2name');
const turnInfo = document.getElementById('turnInfo');
const hint = document.getElementById('hint');
const howList = document.getElementById('howList');
const soundDesc = document.getElementById('soundDesc');

const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlayMsg');
const countdownEl = document.getElementById('countdown');
const cancelReset = document.getElementById('cancelReset');

// حالة اللعبة
let grid = Array(SIZE).fill(null);
let currentPlayer = 'p1';
let selected = null;
let availableMoves = []; // {to,type,capturedIdx}
let playingAgainstAI = true;
let soundEnabled = true;
let difficulty = 'medium';
let score = { p1: 22, p2: 22 };

// history for undo (store objects: {grid, currentPlayer, score})
let history = null; // store last state only (one-step undo)

// audio: WebAudio simple tones
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function tone(freq, dur=120, type='sine', vol=0.06){
  if (!soundEnabled) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  setTimeout(()=>{ try{ o.stop(); o.disconnect(); g.disconnect(); }catch(e){} }, dur);
}
function sMove(){ tone(520,80,'sine',0.04) }
function sCapture(){ tone(220,160,'triangle',0.08); tone(520,120,'sine',0.05) }
function sWin(){ tone(880,220,'sawtooth',0.12); tone(660,240,'sine',0.1) }

// bilingual texts
const TEXT = {
  ar: {
    title: 'لعبة سيجة السودانية',
    subtitle: 'Sudanese Seega Game — v1.0',
    start: 'ابدأ / Start',
    aiOn: 'AI: تشغيل',
    aiOff: 'AI: إيقاف',
    soundOn: 'Sound: On',
    soundOff: 'Sound: Off',
    undo: '↩️ تراجع',
    reset: '🔄 إعادة',
    hint: 'اختر قطعة لتحريكها — ستُبرز الحركات المسموح بها',
    how: [
      'لكل لاعب 22 قطعة (صفان من 9 وصف ثالث 4).',
      'اللوح 9×5 والمربع الأوسط يحمل علامة X كمركز (قابل للحركة).',
      'التحرك في أربع اتجاهات فقط إلى مربع فارغ مجاور.',
      'قواعد الأكل (قفزة): إذا كانت أمام قطعتك قطعة خصم ملاصقة وخلفها مربع فارغ → تقفز إلى المربع الفارغ وتحذف قطعة الخصم.',
      'بعد القفزة، إذا توفرت قفزات إضافية فستُنفَّذ تلقائياً في نفس الدور.',
      'الفائز: من يبقى لديه قطع بينما الآخر يفقدها أو عند انعدام الحركات.'
    ],
    soundsDesc: 'الأصوات: نقرة للحركة، طنين خفيف عند الأكل، لحن انتصار عند الفوز.',
    autoResetMsg: 'انتهت الجولة — ستعاد اللعبة خلال {n} ثانية.',
    resetCancel: 'إلغاء الإعادة',
    turnPrefix: 'دور:',
    winnerText: '🏆 انتهت اللعبة — الفائز:'
  },
  en: {
    title: 'Sudanese Seega Game',
    subtitle: 'لعبة سيجة السودانية — v1.0',
    start: 'Start / Restart',
    aiOn: 'AI: On',
    aiOff: 'AI: Off',
    soundOn: 'Sound: On',
    soundOff: 'Sound: Off',
    undo: '↩️ Undo',
    reset: '🔄 Reset',
    hint: 'Select a piece — legal squares will be highlighted',
    how: [
      'Each player has 22 pieces (two full rows of 9 and one row of 4).',
      'Board is 9×5; middle cell shows X as center (movable).',
      'Move in 4 directions to adjacent empty cell.',
      'Capture (jump): If adjacent cell has opponent piece and the cell behind it is empty → jump there and remove the opponent piece.',
      'After a jump, further jumps are executed automatically in the same turn.',
      'Winner: player who has pieces while opponent has none, or when no moves remain.'
    ],
    soundsDesc: 'Sounds: click for move, soft buzz for capture, victory tune on win.',
    autoResetMsg: 'Round finished — will reset in {n} seconds.',
    resetCancel: 'Cancel reset',
    turnPrefix: 'Turn:',
    winnerText: '🏆 Game over — Winner:'
  }
};

// helper for language
function getLang(){ return langSelect.value || 'ar'; }
function applyLang(){
  const L = getLang();
  document.documentElement.lang = L;
  document.documentElement.dir = (L==='ar') ? 'rtl' : 'ltr';
  document.getElementById('gameTitle').textContent = TEXT[L].title;
  document.getElementById('gameSub').textContent = TEXT[L].subtitle;
  startBtn.textContent = TEXT[L].start;
  aiToggle.textContent = playingAgainstAI ? TEXT[L].aiOn : TEXT[L].aiOff;
  soundToggleBtn.textContent = soundEnabled ? TEXT[L].soundOn : TEXT[L].soundOff;
  undoBtn.textContent = TEXT[L].undo;
  resetBtn.textContent = TEXT[L].reset;
  hint.textContent = TEXT[L].hint;
  // how list
  howList.innerHTML = '';
  TEXT[L].how.forEach(s => {
    const li = document.createElement('li'); li.textContent = s; howList.appendChild(li);
  });
  soundDesc.textContent = TEXT[L].soundsDesc;
  scoreLabel1.textContent = (L==='ar') ? 'قطعة' : 'pieces';
  scoreLabel2.textContent = scoreLabel1.textContent;
  updateTurnText();
  document.getElementById('langSelect').value = L;
}

// initial setup grid
function initGrid(){
  grid = Array(SIZE).fill(null);
  // rows 0,1 full p1
  for (let r=0;r<2;r++) for (let c=0;c<COLS;c++) grid[r*COLS + c] = 'p1';
  // row 2: 0..3 p1 , 4 center null, 5..8 p2
  for (let c=0;c<4;c++) grid[2*COLS + c] = 'p1';
  grid[2*COLS + 4] = null; // center (movable) marked X
  for (let c=5;c<9;c++) grid[2*COLS + c] = 'p2';
  // rows 3,4 full p2
  for (let r=3;r<5;r++) for (let c=0;c<COLS;c++) grid[r*COLS + c] = 'p2';

  currentPlayer = 'p1'; selected = null; availableMoves = [];
  score.p1 = count('p1'); score.p2 = count('p2');
  history = null; // clear undo
}

// count pieces
function count(player){ return grid.filter(x=> x===player).length; }

// compute moves for index
function computeMoves(idx){
  const moves = [];
  const r = Math.floor(idx/COLS), c = idx%COLS;
  const deltas = [[-1,0],[1,0],[0,-1],[0,1]];
  deltas.forEach(([dr,dc])=>{
    const nr = r+dr, nc = c+dc;
    if (nr<0||nr>=ROWS||nc<0||nc>=COLS) return;
    const adj = nr*COLS + nc;
    // normal move if empty
    if (grid[adj] === null){
      moves.push({to:adj,type:'move',captured:null});
    }
    // jump if adj is opponent and beyond empty
    const mover = grid[idx], opponent = mover==='p1' ? 'p2' : 'p1';
    if (grid[adj] === opponent){
      const br = nr+dr, bc = nc+dc;
      if (br>=0 && br<ROWS && bc>=0 && bc<COLS){
        const beyond = br*COLS + bc;
        if (grid[beyond] === null){
          moves.push({to:beyond,type:'jump',captured:adj});
        }
      }
    }
  });
  return moves;
}

// render board
function render(){
  boardEl.innerHTML = '';
  for (let i=0;i<SIZE;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.i = i;
    if (i === CENTER_IDX) cell.classList.add('xcell');

    const mv = availableMoves.find(m=> m.to===i);
    if (mv) cell.classList.add(mv.type==='jump' ? 'capture' : 'legal');
    if (selected === i) cell.classList.add('selected');

    const piece = grid[i];
    if (piece){
      const p = document.createElement('div'); p.className = `piece ${piece}`; cell.appendChild(p);
    }

    cell.addEventListener('click', ()=> onCellClick(i));
    boardEl.appendChild(cell);
  }
  updateUI();
}

// UI update
function updateUI(){
  score1El.textContent = score.p1;
  score2El.textContent = score.p2;
  updateTurnText();
}
function updateTurnText(){
  const L = getLang();
  const prefix = TEXT[L].turnPrefix;
  const name = currentPlayer==='p1' ? (L==='ar' ? 'اللاعب الأسود' : 'Black') : (L==='ar' ? 'اللاعب الأبيض' : 'White');
  turnInfo.textContent = `${prefix} ${name}`;
}

// handle click
function onCellClick(i){
  const piece = grid[i];
  if (selected === null){
    if (piece === currentPlayer){
      selected = i;
      availableMoves = computeMoves(i);
      hint.textContent = TEXT[getLang()].hint;
      if (availableMoves.length === 0) hint.textContent = (getLang()==='ar' ? 'لا توجد حركات لهذه القطعة' : 'No moves for this piece');
    }
    render(); return;
  }

  // check chosen move
  const mv = availableMoves.find(m=> m.to===i);
  if (mv){
    saveHistory(); // save state for undo
    performMove(selected, mv);
    return;
  }

  // change selection
  if (piece === currentPlayer){
    selected = i; availableMoves = computeMoves(i); render(); return;
  }

  // else cancel
  selected = null; availableMoves = []; render();
}

// save history (single-level)
function saveHistory(){
  history = {
    grid: grid.slice(),
    currentPlayer,
    score: { p1: score.p1, p2: score.p2 }
  };
  undoBtn.disabled = false;
}

// undo
function undo(){
  if (!history) return;
  grid = history.grid.slice();
  currentPlayer = history.currentPlayer;
  score = { ...history.score };
  selected = null; availableMoves = [];
  history = null; undoBtn.disabled = true;
  render();
}

// perform move (with jump handling)
function performMove(src, mv){
  const dst = mv.to;
  const mover = grid[src];
  grid[dst] = mover; grid[src] = null;
  sMove();

  if (mv.type === 'jump' && mv.captured != null){
    grid[mv.captured] = null;
    sCapture();
  }
  // update scores
  score.p1 = count('p1'); score.p2 = count('p2');
  render();

  if (mv.type === 'jump'){
    // perform auto-chain jumps
    setTimeout(()=> autoChain(dst), 260);
  } else {
    selected = null; availableMoves = [];
    toggleTurn();
  }
}

// auto chain jumps
function autoChain(pos){
  let cur = pos;
  while (true){
    const jumps = computeMoves(cur).filter(m=> m.type==='jump');
    if (!jumps || jumps.length===0) break;
    let chosen = jumps[0];
    if (difficulty === 'hard' && jumps.length>1){
      // simple heuristic: pick jump leading to more immediate extra jumps
      let best = chosen, bestG = jumpGain(cur, chosen);
      for (let i=1;i<jumps.length;i++){
        const g = jumpGain(cur, jumps[i]); if (g > bestG){ bestG = g; best = jumps[i]; }
      }
      chosen = best;
    }
    // execute chosen
    const to = chosen.to, cap = chosen.captured;
    grid[to] = grid[cur]; grid[cur] = null;
    if (cap != null) grid[cap] = null;
    sCapture();
    score.p1 = count('p1'); score.p2 = count('p2');
    render();
    cur = to;
  }
  selected = null; availableMoves = [];
  if (!checkEnd()) toggleTurn();
}

// simple heuristic for jump gain
function jumpGain(fromIdx, jumpObj){
  const temp = grid.slice();
  const to = jumpObj.to, cap = jumpObj.captured;
  temp[to] = temp[fromIdx]; temp[fromIdx] = null; if (cap!=null) temp[cap]=null;
  let gain = 0;
  const r = Math.floor(to/COLS), c = to%COLS;
  const deltas = [[-1,0],[1,0],[0,-1],[0,1]];
  deltas.forEach(([dr,dc])=>{
    const nr=r+dr, nc=c+dc, br=nr+dr, bc=nc+dc;
    if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && br>=0 && br<ROWS && bc>=0 && bc<COLS){
      const adj = nr*COLS+nc, beyond = br*COLS+bc; if (temp[adj] && temp[adj] !== temp[to] && temp[beyond]===null) gain++;
    }
  });
  return gain;
}

// switch turn
function toggleTurn(){
  currentPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';
  updateTurnText();
  if (playingAgainstAI && currentPlayer === 'p2') {
    setTimeout(()=> aiMove(), difficulty==='hard'?450: difficulty==='medium'?700:1000);
  }
}

// AI move
function aiMove(){
  if (!playingAgainstAI || currentPlayer!=='p2') return;
  difficulty = diffSelect.value;
  const aiPieces = grid.map((v,i)=> v==='p2' ? i : -1).filter(i=> i!==-1);
  let best = null;
  aiPieces.forEach(from=>{
    const moves = computeMoves(from);
    moves.forEach(m=>{
      let sc = (m.type==='jump') ? 10 + jumpGain(from,m) : 1;
      if (difficulty==='medium') sc += Math.random()*3;
      if (!best || sc > best[2]) best = [from,m,sc];
    });
  });
  if (best){
    saveHistory();
    performMove(best[0], best[1]);
  } else {
    toggleTurn();
  }
}

// check end and auto-reset
let autoResetTimer = null;
function checkEnd(){
  const p1 = count('p1'), p2 = count('p2');
  if (p1===0 || p2===0){
    const L = getLang();
    const winner = p1===0 ? (L==='ar'?'اللاعب الأبيض':'White player') : (L==='ar'?'اللاعب الأسود':'Black player');
    sWin();
    showOverlay(`${TEXT[getLang()].winnerText} ${winner}`, 5);
    return true;
  }
  return false;
}

// overlay and auto reset
function showOverlay(msg, seconds=5){
  overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden','false');
  overlayMsg.textContent = msg;
  let n = seconds;
  countdownEl.textContent = `${TEXT[getLang()].autoResetMsg.replace('{n}', n)}`;
  autoResetTimer = setInterval(()=>{
    n--;
    if (n<=0){
      clearInterval(autoResetTimer); overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true');
      startNewGame();
    } else {
      countdownEl.textContent = `${TEXT[getLang()].autoResetMsg.replace('{n}', n)}`;
    }
  }, 1000);

  // cancel handler
  cancelReset.onclick = ()=> {
    clearInterval(autoResetTimer);
    overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true');
  };
}

// start new game (reset)
function startNewGame(){
  initGrid(); render();
}

// undo handler
undoBtn.addEventListener('click', ()=> {
  undo();
});

// reset button
resetBtn.addEventListener('click', ()=> {
  startNewGame();
});

// ai toggle
aiToggle.addEventListener('click', ()=>{
  playingAgainstAI = !playingAgainstAI;
  aiToggle.textContent = playingAgainstAI ? TEXT[getLang()].aiOn : TEXT[getLang()].aiOff;
  aiToggle.classList.toggle('on');
});

// sound toggle
soundToggleBtn.addEventListener('click', ()=>{
  soundEnabled = !soundEnabled;
  soundToggleBtn.textContent = soundEnabled ? TEXT[getLang()].soundOn : TEXT[getLang()].soundOff;
  soundToggleBtn.classList.toggle('on');
});

// start button
startBtn.addEventListener('click', ()=>{
  difficulty = diffSelect.value;
  playingAgainstAI = true; aiToggle.textContent = TEXT[getLang()].aiOn;
  initGrid(); render();
});

// language change
langSelect.addEventListener('change', ()=>{
  applyLang();
});

// initial apply lang and init
function applyLang(){
  const L = getLang();
  document.documentElement.dir = (L==='ar') ? 'rtl' : 'ltr';
  // update static texts
  document.getElementById('gameTitle').textContent = TEXT[L].title;
  document.getElementById('gameSub').textContent = TEXT[L].subtitle;
  startBtn.textContent = TEXT[L].start;
  aiToggle.textContent = playingAgainstAI ? TEXT[L].aiOn : TEXT[L].aiOff;
  soundToggleBtn.textContent = soundEnabled ? TEXT[L].soundOn : TEXT[L].soundOff;
  undoBtn.textContent = TEXT[L].undo;
  resetBtn.textContent = TEXT[L].reset;
  hint.textContent = TEXT[L].hint;
  // how list
  howList.innerHTML = '';
  TEXT[L].how.forEach(t => { const li = document.createElement('li'); li.textContent=t; howList.appendChild(li); });
  soundDesc.textContent = TEXT[L].soundsDesc;
  scoreLabel1.textContent = (L==='ar') ? 'قطعة' : 'pieces';
  scoreLabel2.textContent = scoreLabel1.textContent;
  updateTurnText();
}
langSelect.value = 'ar';
applyLang();

// responsive adjustment (ensure full board visible)
function adjustBoard(){
  const boardArea = document.querySelector('.board-area');
  const maxW = Math.min(window.innerWidth - 60, window.innerHeight * 0.9);
  const size = Math.max(320, Math.min(maxW, 900));
  const boardElLocal = document.getElementById('board');
  boardElLocal.style.setProperty('--max-size', `${size}px`);
  // forcing render grid cell sizes is handled by CSS using this var; re-render
  render();
}
window.addEventListener('resize', adjustBoard);
window.addEventListener('orientationchange', adjustBoard);

// initial boot
initGrid();
applyLang();
adjustBoard();
render();
