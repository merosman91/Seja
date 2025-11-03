/* لعبة السيجة — 9x5 — توزيع 22 قطعة لكل لاعب — مربع X واحد في مركز الصف الثالث
   قواعد:
   - التحرك 4 اتجاهات فقط إلى مربع فارغ مجاور.
   - قفزة/أكل: إذا أمام قطعتك قطعة خصم ملاصقة (لا توجد خانة فارغة بينكما) وخلف قطعة الخصم مربع فارغ،
     يمكنك القفز إلى ذلك المربع الفارغ وإزالة قطعة الخصم.
   - بعد القفزة، إن توفرت قفزة ثانية من الموقع الجديد تُنفّذ تلقائياً كجزء من نفس الحركة (أكل متتالي).
*/

const COLS = 9;
const ROWS = 5;
const SIZE = COLS * ROWS;

const boardEl = document.getElementById('board');
const startBtn = document.getElementById('startBtn');
const diffSelect = document.getElementById('difficulty');
const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const turnInfo = document.getElementById('turnInfo');
const hintEl = document.getElementById('hint');
const soundToggle = document.getElementById('soundToggle');
const swapBtn = document.getElementById('swapBtn');

let grid = Array(SIZE).fill(null);
let currentPlayer = 'p1';
let selected = null;
let availableMoves = []; // array of {to, type:'move'|'jump', capturedIdx}
let playingAgainstAI = true;
let difficulty = 'medium';

// نقاط
let score = { p1: 22, p2: 22 };

// أصوات — Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, dur=120, type='sine', vol=0.07){
  if (!soundToggle.checked) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  setTimeout(()=>{ try{ o.stop(); o.disconnect(); g.disconnect(); }catch(e){} }, dur);
}
function playMove(){ playTone(480,90,'sine',0.04); }
function playJump(){ playTone(220,160,'triangle',0.08); playTone(520,120,'sine',0.05); }
function playWin(){ playTone(880,220,'sawtooth',0.12); playTone(660,240,'sine',0.10); }

// إعداد بداية اللعبة (الخيار A: صفان كاملان 9 لكل لاعب + صف ثالث 4 من كل جانب ومربع فارغ في المنتصف)
function setupInitialGrid(){
  grid = Array(SIZE).fill(null);
  // صفوف 0 و1: p1 على كل الأعمدة 0..8
  for (let r=0; r<2; r++){
    for (let c=0; c<COLS; c++){
      grid[r*COLS + c] = 'p1';
    }
  }
  // صف 2 (index 2): أعمدة 0..3 = p1 (4 قطع), عمود 4 = X (مربع فاصل فارغ)، أعمدة 5..8 = p2 (4 قطع)
  for (let c=0; c<4; c++) grid[2*COLS + c] = 'p1';
  grid[2*COLS + 4] = null; // هذا المربع الفاصل (سيعرض بعلامة X)
  for (let c=5; c<9; c++) grid[2*COLS + c] = 'p2';

  // صفوف 3 و4: p2 على كل الأعمدة
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

// عدّ قطع لاعب
function countPieces(p){
  return grid.filter(x=>x===p).length;
}

// رندر اللوح
function render(){
  boardEl.innerHTML = '';
  for (let i=0;i<SIZE;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.i = i;

    // مربع الفاصل: الموضع هو صف 2 عمود 4 (index 2*COLS + 4)
    if (i === (2*COLS + 4)){
      cell.classList.add('xcell');
      // منع الضغط عليه
      cell.addEventListener('click', ()=>{ /* لا فعل */ });
      boardEl.appendChild(cell);
      continue;
    }

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

// حساب الحركات المتاحة لقطعة عند idx
// إرجاع مصفوفة عناصر {to, type: 'move'|'jump', capturedIdx (إذ وُجد)}
function calculateMovesFor(idx){
  const moves = [];
  const r = Math.floor(idx / COLS), c = idx % COLS;
  const deltas = [[-1,0],[1,0],[0,-1],[0,1]]; // أعلى, أسفل, يسار, يمين

  deltas.forEach(([dr,dc])=>{
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;
    const adjIdx = nr*COLS + nc;

    // إذا الخانة المجاورة فارغة => حركة عادية
    if (grid[adjIdx] === null && adjIdx !== (2*COLS + 4)){
      moves.push({ to: adjIdx, type: 'move', capturedIdx: null });
    }

    // إذا الخانة المجاورة تحتوي على خصم (ملاصق) ونستطيع القفز خلفه إلى مربع فارغ => قفزة
    const mover = grid[idx];
    const opponent = mover === 'p1' ? 'p2' : 'p1';
    if (grid[adjIdx] === opponent){
      const br = nr + dr, bc = nc + dc;
      if (br >=0 && br < ROWS && bc >=0 && bc < COLS){
        const beyondIdx = br*COLS + bc;
        // لا نسمح بالهبوط في مربع X (الفاصل)
        if (grid[beyondIdx] === null && beyondIdx !== (2*COLS + 4)){
          moves.push({ to: beyondIdx, type: 'jump', capturedIdx: adjIdx });
        }
      }
    }
  });

  return moves;
}

// عند الضغط على خلية
function onCellClick(i){
  // إذا مربع الفاصل — تجاهل
  if (i === (2*COLS + 4)) return;

  const piece = grid[i];

  // إذا لا توجد قطعة مختارة الآن
  if (selected === null){
    if (piece === currentPlayer){
      selected = i;
      availableMoves = calculateMovesFor(i);
      if (availableMoves.length === 0) hintEl.textContent = 'لا توجد حركات لهذه القطعة';
      else hintEl.textContent = 'اختر مربعاً للتحرك (المربعات الخضراء للحركة، الأخضر الداكن للقفز/أكل)';
    }
    render();
    return;
  }

  // إن تم الضغط على واحدة من الحركات المتاحة
  const move = availableMoves.find(m=> m.to === i);
  if (move){
    performMove(selected, move);
    return;
  }

  // إذا ضغط المستخدم مرة أخرى على قطعة له — تغيير الاختيار
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

// تنفيذ الحركة (قد تكون حركة عادية أو قفزة)
// إذا كانت قفزة، سنطبق الأكل ونفذ سلاسل القفز الآلية إن توفرت
function performMove(src, moveObj){
  const dst = moveObj.to;
  const mover = grid[src];

  // تنفيذ النقل الأساسي
  grid[dst] = mover;
  grid[src] = null;
  playMove();

  if (moveObj.type === 'jump' && moveObj.capturedIdx != null){
    // إزالة قطعة الخصم
    grid[moveObj.capturedIdx] = null;
    playJump();
  }

  // تحديث عد القطع
  score.p1 = countPieces('p1');
  score.p2 = countPieces('p2');
  updateUI();
  render();

  // الآن: إذا كانت قفزة، فحاول تنفيذ سلاسل متتالية تلقائياً من الموقع الجديد
  if (moveObj.type === 'jump'){
    // وضع تأخير بسيط لإظهار الحركة للمستخدم
    setTimeout(()=> {
      autoChainJumps(dst);
    }, 260);
  } else {
    // حركة عادية: تبديل الدور
    selected = null;
    availableMoves = [];
    toggleTurn();
  }
}

// تنفيذ قفزات متتالية تلقائياً من موقع idx — سنقوم باختيار أول قفز متاح حسب ترتيب الاتجاهات
function autoChainJumps(idx){
  let current = idx;
  while (true){
    const moves = calculateMovesFor(current).filter(m=> m.type === 'jump');
    if (!moves || moves.length === 0) break;

    // اختيار أفضل قفزة
    // في الوضع الصعب نحاول اختيار القفزة التي تؤدي لاحقًا لأكبر عدد من قفزات ممكنة (بحث بسيط بمستوى 1)
    let chosen = moves[0];
    if (difficulty === 'hard' && moves.length > 1){
      let best = chosen;
      let bestGain = evaluateJumpGain(current, chosen);
      for (let i=1;i<moves.length;i++){
        const g = evaluateJumpGain(current, moves[i]);
        if (g > bestGain){ bestGain = g; best = moves[i]; }
      }
      chosen = best;
    }

    // تنفيذ القفزة المختارة
    const to = chosen.to;
    const cap = chosen.capturedIdx;
    // تحريك
    grid[to] = grid[current];
    grid[current] = null;
    // حذف المأكول (مؤكد)
    if (cap != null) grid[cap] = null;
    playJump();
    // تحديث العداد
    score.p1 = countPieces('p1');
    score.p2 = countPieces('p2');
    render();

    // تابع من الموقع الجديد
    current = to;
  }

  // انتهت سلسلة القفزات — تبديل الدور
  selected = null;
  availableMoves = [];
  // تحقق من انتهاء اللعبة أولاً
  if (!checkWin()){
    // بعد انتهاء السلسلة نبدل الدور
    toggleTurn();
  }
}

// دالة مساعدة: بمعاينة بسيطة تحسب "فائدة" القفزة (كم أكل محتمل بعد خطوة) لمساعدة AI في الوضع الصعب
function evaluateJumpGain(fromIdx, jumpObj){
  // نسخ مؤقت للشبكة وتطبيق هذه القفزة ثم عد قفزات إضافية مباشرة (عمق 1)
  const temp = grid.slice();
  const to = jumpObj.to, cap = jumpObj.capturedIdx;
  temp[to] = temp[fromIdx];
  temp[fromIdx] = null;
  if (cap != null) temp[cap] = null;

  // عد القفزات المتاحة من 'to'
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
      if (temp[adj] === opponent && temp[beyond] === null && beyond !== (2*COLS + 4)) gain++;
    }
  });
  return gain;
}

// تبديل الدور (مع استدعاء AI عند الحاجة)
function toggleTurn(){
  currentPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';
  updateTurnText();

  // إذا دور AI ونلعب ضد الكمبيوتر
  if (playingAgainstAI && currentPlayer === 'p2'){
    const delay = difficulty === 'hard' ? 450 : difficulty === 'medium' ? 700 : 1000;
    setTimeout(()=> aiMove(), delay);
  }
}

// AI مبسّط يتبع نفس القواعد (يحاول القفز أولاً)
function aiMove(){
  if (!playingAgainstAI || currentPlayer !== 'p2') return;
  difficulty = diffSelect.value;

  // جمع مواقع قطع AI وفرص الحركة
  const aiPieces = grid.map((v,i)=> v==='p2' ? i : -1).filter(i=> i!==-1);
  let bestMove = null; // [from, moveObj, score]
  aiPieces.forEach(from=>{
    const moves = calculateMovesFor(from);
    moves.forEach(m=>{
      let scoreVal = 0;
      if (m.type === 'jump') scoreVal += 10 + evaluateJumpGain(from, m);
      else scoreVal += 1;
      // في الوضع المتوسط نضيف عشوائية
      if (difficulty === 'medium') scoreVal += Math.random()*3;
      if (!bestMove || scoreVal > bestMove[2]) bestMove = [from, m, scoreVal];
    });
  });

  // تنفيذ الحركة المختارة أو عشوائية إذا لم توجد
  if (bestMove){
    performMove(bestMove[0], bestMove[1]);
  } else {
    // إن لم تتحرك (نادر) — تبديل الدور
    toggleTurn();
  }
}

// فحص الفائز
function checkWin(){
  const p1count = countPieces('p1');
  const p2count = countPieces('p2');
  if (p1count === 0 || p2count === 0){
    const winner = p1count === 0 ? 'اللاعب الأبيض' : 'اللاعب الأسود';
    playWin();
    setTimeout(()=> alert(`🏆 انتهت اللعبة — ${winner} فاز!`), 120);
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
  const name = currentPlayer === 'p1' ? 'اللاعب الأسود' : 'اللاعب الأبيض';
  turnInfo.textContent = `دور: ${name}`;
}

// أحداث واجهة
startBtn.addEventListener('click', ()=>{
  difficulty = diffSelect.value;
  playingAgainstAI = true;
  setupInitialGrid();
  render();
});

swapBtn.addEventListener('click', ()=>{
  playingAgainstAI = !playingAgainstAI;
  swapBtn.textContent = playingAgainstAI ? 'العب محليًا' : 'العب ضد كمبيوتر';
});

diffSelect.addEventListener('change', ()=> difficulty = diffSelect.value);

// بدء اللعبة
setupInitialGrid();
render();
