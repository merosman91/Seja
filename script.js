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

let grid = Array(25).fill(null);
let currentPlayer = 'p1';
let selected = null;
let playingAgainstAI = true;
let difficulty = 'medium';
let availableMoves = []; // لتخزين الحركات المسموح بها لما نحدد قطعة

// نقاط وعدادات
let score = { p1: 10, p2: 10 };

// Audio (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, dur=120, type='sine', vol=0.07){
  if (!soundToggle.checked) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  setTimeout(()=>{ o.stop(); o.disconnect(); g.disconnect(); }, dur);
}
function playMove(){ playTone(480,90,'sine',0.04) }
function playCapture(){ playTone(220,160,'triangle',0.09); playTone(520,120,'sine',0.05) }
function playWin(){ playTone(880,220,'sawtooth',0.12); playTone(660,240,'sine',0.10) }

// إعداد اللعبة الافتراضي
function resetGame(){
  grid = Array(25).fill(null);
  for (let i=0;i<10;i++) grid[i] = 'p1';
  for (let i=15;i<25;i++) grid[i] = 'p2';
  currentPlayer = 'p1';
  selected = null;
  availableMoves = [];
  score = { p1: 10, p2: 10 };
  updateUI();
  render();
  hintEl.textContent = 'اختر قطعة لتحريكها — سيتم تمييز الخانات المسموح بها';
}

// عرض اللوح
function render(){
  boardEl.innerHTML = '';
  for (let i=0;i<25;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.i = i;

    // تمييز الحركات المسموح بها
    if (availableMoves.includes(i)){
      // إذا التحقق يظهر لنا أن هذه الحركة ستؤدي لأكل - اجعلها capture
      if (willCaptureUponMove(selected, i)) cell.classList.add('capture');
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
  updateTurnText();
}

// تحديد الخانات المسموح بها بعد اختيار قطعة
function calculateAvailableMoves(idx){
  const moves = [];
  const row = Math.floor(idx/5);
  const col = idx % 5;
  const deltas = [[-1,0],[1,0],[0,-1],[0,1]]; // 4 اتجاهات فقط

  deltas.forEach(([dr,dc])=>{
    const r = row + dr, c = col + dc;
    if (r>=0 && r<5 && c>=0 && c<5){
      const to = r*5 + c;
      // الخانة يجب أن تكون فارغة لتكون حركة صالحة
      if (grid[to] === null) moves.push(to);
    }
  });

  return moves;
}

function willCaptureUponMove(src, dst) {
  if (src === null) return false;
  const sr = Math.floor(src / 5), sc = src % 5;
  const dr = Math.floor(dst / 5), dc = dst % 5;
  const mover = grid[src];
  const opponent = mover === 'p1' ? 'p2' : 'p1';

  // الاتجاه
  const drow = dr - sr;
  const dcol = dc - sc;

  // التأكد من أن الحركة في 4 اتجاهات فقط
  if (Math.abs(drow) + Math.abs(dcol) !== 1) return false;

  // نتحقق من الخانة التالية بعد وجهة الحركة (dst)
  const br = dr + drow, bc = dc + dcol;
  if (br < 0 || br >= 5 || bc < 0 || bc >= 5) return false;
  const beyondIdx = br * 5 + bc;

  // قاعدة الأكل الجديدة: الخصم ملاصق مباشرة بدون خانة فارغة
  return grid[beyondIdx] === opponent;
  }

// التعامل مع النقر على خلية
function onCellClick(i){
  const piece = grid[i];

  // إذا لا توجد قطعة محددة الآن
  if (selected === null){
    if (piece === currentPlayer){
      selected = i;
      availableMoves = calculateAvailableMoves(i);
      // إبراز الحركات فقط بعد اختيار القطعة
      if (availableMoves.length === 0) hintEl.textContent = 'لا توجد حركات لهذه القطعة';
      else hintEl.textContent = 'اختر مربعاً للتحرك (المربعات الخضراء تؤدي لأكل)';
    }
    render();
    return;
  }

  // إذا تم الضغط على خانة فارغة ومسموح بها
  if (availableMoves.includes(i) && grid[i] === null){
    const isCapture = willCaptureUponMove(selected, i);
    performMove(selected, i, isCapture);
    selected = null;
    availableMoves = [];
    render();

    // تحقق من انتهاء اللعبة
    if (checkWin()) return;

    // لو ضد AI وآن دور AI
    if (playingAgainstAI && currentPlayer === 'p2'){
      const delay = difficulty === 'hard' ? 500 : difficulty === 'medium' ? 700 : 1000;
      setTimeout(aiMove, delay);
    }
    return;
  }

  // إذا ضغط المستخدم على قطعة تخصه (تبديل الاختيار)
  if (piece === currentPlayer){
    selected = i;
    availableMoves = calculateAvailableMoves(i);
    render();
    return;
  }

  // غير ذلك: إلغاء الاختيار
  selected = null;
  availableMoves = [];
  render();
}

// تنفيذ الحركة مع تطبيق قاعدة الأكل (في 4 اتجاهات فقط)
function performMove(src, dst, capture){
  const mover = grid[src];
  grid[dst] = mover;
  grid[src] = null;
  playMove();

  if (capture){
    // نحذف القطعة التي تقع بعد dst في نفس الاتجاه
    const sr = Math.floor(src/5), sc = src%5;
    const dr = Math.floor(dst/5), dc = dst%5;
    const drow = dr - sr, dcol = dc - sc;
    const br = dr + drow, bc = dc + dcol;
    if (br>=0 && br<5 && bc>=0 && bc<5){
      const beyondIdx = br*5 + bc;
      const opponent = mover === 'p1' ? 'p2' : 'p1';
      if (grid[beyondIdx] === opponent){
        grid[beyondIdx] = null;
        playCapture();
      }
    }
  }

  // تحديث النقاط وعدد القطع
  score.p1 = grid.filter(x=>x==='p1').length;
  score.p2 = grid.filter(x=>x==='p2').length;
  updateUI();

  // تبديل الدور
  currentPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';
  hintEl.textContent = 'دور اللاعب التالي';
}

// تحديث الواجهة (النقاط والدور)
function updateUI(){
  score1El.textContent = score.p1;
  score2El.textContent = score.p2;
  updateTurnText();
}

// نص الدور
function updateTurnText(){
  const name = currentPlayer === 'p1' ? 'اللاعب الأسود' : 'اللاعب الأبيض';
  turnInfo.textContent = `دور: ${name}`;
}

/* ---------------- AI مبسّط يتناسب مع القاعدة الجديدة ---------------- */
function aiMove(){
  if (!playingAgainstAI) return;
  difficulty = diffSelect.value;

  // جمع قطع AI والمساحات الفارغة
  const aiPieces = grid.map((v,i)=> v==='p2' ? i : -1).filter(i=>i!==-1);
  const empty = grid.map((v,i)=> v===null ? i : -1).filter(i=>i!==-1);

  let best = null; // [from,to,captureFlag]
  aiPieces.forEach(from=>{
    const moves = calculateAvailableMoves(from);
    moves.forEach(to=>{
      const willCap = willCaptureUponMove(from,to) ? 1 : 0;
      if (!best || (willCap > best[2])) best = [from,to,willCap];
    });
  });

  let chosen = null;
  if (difficulty === 'hard' && best){
    chosen = best;
  } else if (difficulty === 'medium' && best){
    // احتمال كبير لاختيار أفضل، وإلا عشوائي
    chosen = Math.random() < 0.75 ? best : null;
  }

  if (!chosen){
    // حركة عشوائية محكومة
    const candidates = [];
    aiPieces.forEach(f=>{
      const m = calculateAvailableMoves(f);
      m.forEach(t=> candidates.push([f,t]));
    });
    if (candidates.length > 0){
      chosen = candidates[Math.floor(Math.random()*candidates.length)];
      chosen.push(0); // no capture flag known
    }
  }

  if (chosen){
    const [f,t] = chosen;
    const willCap = willCaptureUponMove(f,t);
    performMove(f,t,willCap);
    render();
    if (checkWin()) return;
  } else {
    // لا توجد حركة؛ تبديل الدور
    currentPlayer = 'p1';
    updateTurnText();
  }
}

/* ---------------- فحص الفائز ---------------- */
function checkWin(){
  const p1count = grid.filter(x=>x==='p1').length;
  const p2count = grid.filter(x=>x==='p2').length;
  if (p1count === 0 || p2count === 0){
    const winner = p1count === 0 ? 'اللاعب الأبيض' : 'اللاعب الأسود';
    playWin();
    setTimeout(()=> alert(`🏆 انتهت اللعبة — ${winner} فاز!`), 120);
    return true;
  }
  return false;
}

/* ------------- أحداث الواجهة ------------- */
startBtn.addEventListener('click', ()=>{
  difficulty = diffSelect.value;
  playingAgainstAI = true;
  resetGame();
});

swapBtn.addEventListener('click', ()=>{
  playingAgainstAI = !playingAgainstAI;
  swapBtn.textContent = playingAgainstAI ? 'العب محليًا' : 'العب ضد كمبيوتر';
});

diffSelect.addEventListener('change', ()=> difficulty = diffSelect.value);

// بدء اللعبة
resetGame();
render();
