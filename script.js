// إعداد ثابتات اللوح
const COLS = 9;
const ROWS = 5;
const SIZE = COLS * ROWS;
const CENTER_X_INDEX = 2*COLS + 4; // صف 2 (0-based), عمود 4

// عناصر الواجهة
const boardEl = document.getElementById('board');
const startBtn = document.getElementById('startBtn');
const diffSelect = document.getElementById('difficulty');
const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const turnInfo = document.getElementById('turnInfo');
const hintEl = document.getElementById('hint');
const soundToggle = document.getElementById('soundToggle');
const swapBtn = document.getElementById('swapBtn');

const langSelect = document.getElementById('langSelect');
const titleEl = document.getElementById('title');
const langLabel = document.getElementById('langLabel');
const diffLabel = document.getElementById('diffLabel');
const soundLabel = document.getElementById('soundLabel');
const p1name = document.getElementById('p1name');
const p2name = document.getElementById('p2name');
const legMove = document.getElementById('legMove');
const legJump = document.getElementById('legJump');
const legSel = document.getElementById('legSel');
const legX = document.getElementById('legX');
const howTitle = document.getElementById('howTitle');
const howList = document.getElementById('howList');
const creditLink = document.getElementById('creditLink');
const disableNote = document.getElementById('disableNote');

// حالة اللعبة
let grid = Array(SIZE).fill(null);
let currentPlayer = 'p1';
let selected = null;
let availableMoves = []; // عناصر {to, type, capturedIdx}
let playingAgainstAI = true;
let difficulty = 'medium';
let score = { p1: 22, p2: 22 };

// أصوات (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, dur=120, type='sine', vol=0.07){ if (!soundToggle.checked) return; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = vol; o.connect(g); g.connect(audioCtx.destination); o.start(); setTimeout(()=>{ try{ o.stop(); o.disconnect(); g.disconnect(); }catch(e){} }, dur); }
function playMove(){ playTone(480,90,'sine',0.04); }
function playJump(){ playTone(220,160,'triangle',0.08); playTone(520,120,'sine',0.05); }
function playWin(){ playTone(880,220,'sawtooth',0.12); playTone(660,240,'sine',0.10); }

// ===== ترجمة النصوص ثنائية اللغة =====
const TEXTS = {
  ar: {
    title: '🎮 السيجة السودانية',
    langLabel: 'اللغة',
    diffLabel: 'درجة الصعوبة',
    startBtn: 'ابدأ / إعادة',
    swapBtn_local: 'العب محليًا',
    swapBtn_vscomp: 'العب ضد كمبيوتر',
    soundLabel: 'تشغيل الأصوات',
    p1name: 'اللاعب الأسود',
    p2name: 'اللاعب الأبيض',
    pieces: 'قطعة',
    turnPrefix: 'دور:',
    hint_default: 'اختر قطعة لتحريكها — سيتم تمييز الخانات المسموح بها',
    legMove: 'حركة عادية',
    legJump: 'حركة تؤدي لقفزة/أكل',
    legSel: 'قطعة مختارة',
    legX: 'مربع مركزي',
    howTitle: 'كيف تلعب',
    howList: [
      'في البداية لكل لاعب 22 قطعة (صفان كاملان من 9 قطع ثم صف ثالث 4 قطع).',
      'اللوح مكوّن من 9 أعمدة × 5 صفوف والمربع الأوسط في الصف الثالث يحمل علامة X ويمثل المركز.',
      'التحرك في أربع اتجاهات فقط (أعلى/أسفل/يسار/يمين) إلى مربع فارغ مجاور.',
      'قواعد الأكل (قفزة): إذا كانت أمام قطعتك قطعة خصم ملاصقة وخلف قطعة الخصم مربع فارغ → يمكنك القفز إلى ذلك المربع الفارغ وإزالة قطعة الخصم.',
      'بعد القفزة، إن توفرت قفزات إضافية من موقعك الجديد فستُنفَّذ تلقائيًا في نفس الدور.',
      'الفائز: من يبقى لديه قطع أو عندما لا تبقى حركات.'
    ],
    disableNote: 'يمكنك تعطيل الأصوات من خانة "تشغيل الأصوات" أعلاه.',
    creditText: 'تصميم: '
  },
  en: {
    title: '🎮 Seega (Sudanese game)',
    langLabel: 'Language',
    diffLabel: 'Difficulty',
    startBtn: 'Start / Restart',
    swapBtn_local: 'Local play',
    swapBtn_vscomp: 'Play vs Computer',
    soundLabel: 'Sound On',
    p1name: 'Black Player',
    p2name: 'White Player',
    pieces: 'pieces',
    turnPrefix: 'Turn:',
    hint_default: 'Select a piece to move — legal squares will be highlighted',
    legMove: 'Normal move',
    legJump: 'Jump / Capture',
    legSel: 'Selected piece',
    legX: 'Center square',
    howTitle: 'How to play',
    howList: [
      'At start each player has 22 pieces (two full rows of 9 and one row of 4).',
      'Board is 9×5 and the center square in row 3 shows an X as the center.',
      'Move only in four directions (up/down/left/right) to an adjacent empty square.',
      'Capture (jump): If an adjacent cell has an opponent piece and the cell right behind it is empty → you may jump there and remove the opponent piece.',
      'After a jump, if further jumps are possible from the new position they are executed automatically in the same turn.',
      'Winner: the player who keeps pieces while the opponent has none, or when no moves remain.'
    ],
    disableNote: 'You can disable sound with the "Sound On" checkbox above.',
    creditText: 'Design: '
  }
};

function applyLanguage(lang){
  const t = TEXTS[lang];
  // document direction
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';

  titleEl.textContent = t.title;
  langLabel.textContent = t.langLabel;
  diffLabel.textContent = t.diffLabel;
  startBtn.textContent = t.startBtn;
  document.getElementById('difficulty').value = diffSelect.value; // keep value
  soundLabel.textContent = t.soundLabel;
  p1name.textContent = t.p1name;
  p2name.textContent = t.p2name;
  document.getElementById('piecesLabel').textContent = t.pieces;
  document.getElementById('piecesLabel2').textContent = t.pieces;
  turnInfo.textContent = `${t.turnPrefix} ${t.p1name}`;
  hintEl.textContent = t.hint_default;
  legMove.textContent = t.legMove;
  legJump.textContent = t.legJump;
  legSel.textContent = t.legSel;
  legX.textContent = t.legX;
  howTitle.textContent = t.howTitle;

  // populate howList
  howList.innerHTML = '';
  t.howList.forEach(txt => {
    const li = document.createElement('li');
    li.textContent = txt;
    howList.appendChild(li);
  });

  disableNote.textContent = t.disableNote;
  // credit link text remains the same name but we can prefix label
  document.querySelector('.footer').firstChild.nodeValue = t.creditText; // replace prefix text node
  // set swap button label based on mode
  swapBtn.textContent = playingAgainstAI ? t.swapBtn_local : t.swapBtn_vscomp;
}

// ===== إعداد بداية اللعبة (الخيار A) =====
function setupInitialGrid(){
  grid = Array(SIZE).fill(null);
  // صفوف 0 و1: p1 في كل الأعمدة
  for (let r=0; r<2; r++){
    for (let c=0; c<COLS; c++){
      grid[r*COLS + c] = 'p1';
    }
  }
  // صف 2: أعمدة 0..3 p1, عمود 4 مركز (فارغ)، أعمدة 5..8 p2
  for (let c=0; c<4; c++) grid[2*COLS + c] = 'p1';
  grid[2*COLS + 4] = null; // مربع X لكن مسموح بالحركة
  for (let c=5; c<9; c++) grid[2*COLS + c] = 'p2';

  // صفوف 3 و4: p2
  for (let r=3; r<5; r++){
    for (let c=0; c<COLS; c++){
      grid[r*COLS + c] = 'p2';
    }
  }

  currentPlayer = 'p1';
  selected = null;
  availableMoves = [];
  score.p1 = countPieces('p1');
  score.p2 = countPieces('p2');
}

// ===== دوال مساعدة للحركات =====
function countPieces(p){ return grid.filter(x=>x===p).length; }

// حساب الحركات الممكنة لقطعة في idx
function calculateMovesFor(idx){
  const moves = [];
  const r = Math.floor(idx / COLS), c = idx % COLS;
  const deltas = [[-1,0],[1,0],[0,-1],[0,1]];

  deltas.forEach(([dr,dc])=>{
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;
    const adjIdx = nr*COLS + nc;

    // حركة عادية: الخانة المجاورة فارغة -> move
    if (grid[adjIdx] === null){
      moves.push({ to: adjIdx, type: 'move', capturedIdx: null });
    }

    // قفزة: الخانة المجاورة تحتوي على خصم ملاصق وخلفها مربع فارغ
    const mover = grid[idx];
    const opponent = mover === 'p1' ? 'p2' : 'p1';
    if (grid[adjIdx] === opponent){
      const br = nr + dr, bc = nc + dc;
      if (br >=0 && br < ROWS && bc >=0 && bc < COLS){
        const beyondIdx = br*COLS + bc;
        if (grid[beyondIdx] === null){
          moves.push({ to: beyondIdx, type: 'jump', capturedIdx: adjIdx });
        }
      }
    }
  });

  return moves;
}

// ===== العرض (render) =====
function render(){
  boardEl.innerHTML = '';
  for (let i=0;i<SIZE;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.i = i;

    // مربع X: نعرضه لكن نسمح بالحركة إليه
    if (i === CENTER_X_INDEX) cell.classList.add('xcell');

    // تمييز الحركات المسموح بها
    const m = availableMoves.find(it=> it.to === i);
    if (m){
      if (m.type === 'jump') cell.classList.add('capture');
      else cell.classList.add('legal');
    }

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

// ===== التفاعل مع النقر =====
function onCellClick(i){
  // إذا لا توجد قطعة محددة الآن
  const piece = grid[i];
  if (selected === null){
    if (piece === currentPlayer){
      selected = i;
      availableMoves = calculateMovesFor(i);
      hintEl.textContent = TEXTS[getLang()].hint_default;
      if (availableMoves.length === 0) hintEl.textContent = (getLang() === 'ar') ? 'لا توجد حركات لهذه القطعة' : 'No moves for this piece';
    }
    render();
    return;
  }

  // إذا اختار المستخدم خانة قابلة للحركة
  const move = availableMoves.find(m=> m.to === i);
  if (move){
    performMove(selected, move);
    return;
  }

  // إذا نقر على قطعة له لتبديل الاختيار
  if (piece === currentPlayer){
    selected = i;
    availableMoves = calculateMovesFor(i);
    render();
    return;
  }

  // خلاف ذلك إلغاء الاختيار
  selected = null;
  availableMoves = [];
  render();
}

// تنفيذ الحركة (move أو jump)، ثم تفعيل سلاسل القفز إن وُجدت
function performMove(src, moveObj){
  const dst = moveObj.to;
  const mover = grid[src];

  grid[dst] = mover;
  grid[src] = null;
  playMove();

  if (moveObj.type === 'jump' && moveObj.capturedIdx != null){
    grid[moveObj.capturedIdx] = null;
    playJump();
  }

  // تحديث العداد
  score.p1 = countPieces('p1');
  score.p2 = countPieces('p2');
  render();

  if (moveObj.type === 'jump'){
    // تنفيذ القفزات المتتالية تلقائيا من الموقع الجديد
    setTimeout(()=> autoChainJumps(dst), 260);
  } else {
    // حركة عادية -> تبديل الدور
    selected = null;
    availableMoves = [];
    toggleTurn();
  }
}

// تنفيذ قفزات متتالية (تختار واحدة إن وجدت عدة)
function autoChainJumps(idx){
  let current = idx;
  while (true){
    const jumps = calculateMovesFor(current).filter(m=> m.type === 'jump');
    if (!jumps || jumps.length === 0) break;

    // اختيار القفزة — في الوضع الصعب نحاول تقييم الأفضل، خلاف ذلك نأخذ الأولى
    let chosen = jumps[0];
    if (difficulty === 'hard' && jumps.length > 1){
      let best = chosen;
      let bestGain = evaluateJumpGain(current, chosen);
      for (let i=1;i<jumps.length;i++){
        const g = evaluateJumpGain(current, jumps[i]);
        if (g > bestGain){ bestGain = g; best = jumps[i]; }
      }
      chosen = best;
    }

    // تنفيذ القفزة
    const to = chosen.to, cap = chosen.capturedIdx;
    grid[to] = grid[current];
    grid[current] = null;
    if (cap != null) grid[cap] = null;
    playJump();

    // تحديث عدّ القطع
    score.p1 = countPieces('p1');
    score.p2 = countPieces('p2');
    render();

    current = to;
  }

  // انتهت السلسلة -> تبديل الدور (بعد التحقق من الفوز)
  selected = null;
  availableMoves = [];
  if (!checkWin()) toggleTurn();
}

// تقييم بسيطة لفائدة القفزة لمساعدة AI
function evaluateJumpGain(fromIdx, jumpObj){
  const temp = grid.slice();
  const to = jumpObj.to, cap = jumpObj.capturedIdx;
  temp[to] = temp[fromIdx];
  temp[fromIdx] = null;
  if (cap != null) temp[cap] = null;

  // عد قفزات إضافية متاحة من 'to'
  let gain = 0;
  const r = Math.floor(to/COLS), c = to % COLS;
  const deltas = [[-1,0],[1,0],[0,-1],[0,1]];
  deltas.forEach(([dr,dc])=>{
    const nr = r+dr, nc = c+dc;
    const br = nr+dr, bc = nc+dc;
    if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && br>=0 && br<ROWS && bc>=0 && bc<COLS){
      const adj = nr*COLS + nc;
      const beyond = br*COLS + bc;
      const mover = temp[to];
      const opponent = mover === 'p1' ? 'p2' : 'p1';
      if (temp[adj] === opponent && temp[beyond] === null) gain++;
    }
  });
  return gain;
}

// تبديل الدور (مع استدعاء AI إن لازم)
function toggleTurn(){
  currentPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';
  updateTurnText();
  if (playingAgainstAI && currentPlayer === 'p2'){
    const delay = difficulty === 'hard' ? 450 : difficulty === 'medium' ? 700 : 1000;
    setTimeout(()=> aiMove(), delay);
  }
}

// AI بسيط
function aiMove(){
  if (!playingAgainstAI || currentPlayer !== 'p2') return;
  difficulty = diffSelect.value;

  const aiPieces = grid.map((v,i)=> v==='p2' ? i : -1).filter(i=> i!==-1);
  let bestMove = null;
  aiPieces.forEach(from=>{
    const moves = calculateMovesFor(from);
    moves.forEach(m=>{
      let scoreVal = 0;
      if (m.type === 'jump') scoreVal += 10 + evaluateJumpGain(from, m);
      else scoreVal += 1;
      if (difficulty === 'medium') scoreVal += Math.random()*3;
      if (!bestMove || scoreVal > bestMove[2]) bestMove = [from, m, scoreVal];
    });
  });

  if (bestMove){
    performMove(bestMove[0], bestMove[1]);
  } else {
    toggleTurn();
  }
}

// فحص الفائز
function checkWin(){
  const p1count = countPieces('p1');
  const p2count = countPieces('p2');
  if (p1count === 0 || p2count === 0){
    const lang = getLang();
    const winner = p1count === 0 ? (lang==='ar' ? 'اللاعب الأبيض' : 'White player') : (lang==='ar' ? 'اللاعب الأسود' : 'Black player');
    playWin();
    setTimeout(()=> alert(`${(lang==='ar' ? '🏆 انتهت اللعبة — ' : '🏆 Game over — ')}${winner}`), 140);
    return true;
  }
  return false;
}

// تحديث الواجهة
function updateUI(){
  score1El.textContent = score.p1;
  score2El.textContent = score.p2;
  updateTurnText();
}
function updateTurnText(){
  const lang = getLang();
  const name = currentPlayer === 'p1' ? (lang==='ar' ? 'اللاعب الأسود' : 'Black player') : (lang==='ar' ? 'اللاعب الأبيض' : 'White player');
  turnInfo.textContent = `${TEXTS[lang].turnPrefix} ${name}`;
}

// ===== عناصر واجهة وتفاعلات =====
startBtn.addEventListener('click', ()=>{
  difficulty = diffSelect.value;
  playingAgainstAI = true;
  setupInitialGrid();
  render();
});

swapBtn.addEventListener('click', ()=>{
  playingAgainstAI = !playingAgainstAI;
  const lang = getLang();
  swapBtn.textContent = playingAgainstAI ? TEXTS[lang].swapBtn_local : TEXTS[lang].swapBtn_vscomp;
});

diffSelect.addEventListener('change', ()=> difficulty = diffSelect.value);

// لغة
langSelect.addEventListener('change', ()=> {
  applyLanguage(langSelect.value);
  render();
});

function getLang(){ return langSelect.value || 'ar'; }

// تهيئة أولية
applyLanguage(getLang());
setupInitialGrid();
render();
