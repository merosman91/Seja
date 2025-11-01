// عناصر الواجهة
const boardEl = document.getElementById('board');
const startBtn = document.getElementById('startBtn');
const diffSelect = document.getElementById('difficulty');
const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const turnInfo = document.getElementById('turnInfo');
const soundToggle = document.getElementById('soundToggle');
const swapBtn = document.getElementById('swapBtn');

let grid = Array(25).fill(null);
let currentPlayer = 'p1';
let selected = null;
let playingAgainstAI = true;
let difficulty = 'medium';

// نقاط (يمكن تعديل لاحقًا لحفظ أعلى نتيجة)
let score = { p1: 10, p2: 10 };

// صوت: Web Audio API (لا ملفات خارجية)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, duration=120, type='sine', volume=0.08) {
  if (!soundToggle.checked) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = volume;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  setTimeout(()=>{ o.stop(); o.disconnect(); g.disconnect(); }, duration);
}
function playMove(){ playTone(440,80,'sine',0.04) }
function playEat(){ playTone(220,160,'triangle',0.09); playTone(520,120,'sine',0.05) }
function playWin(){ playTone(880,220,'sawtooth',0.12); playTone(660,240,'sine',0.10) }

// إعداد اللوح (5×5)
function resetGame(){
  grid = Array(25).fill(null);
  for (let i=0;i<10;i++) grid[i]='p1';
  for (let i=15;i<25;i++) grid[i]='p2';
  currentPlayer='p1';
  selected=null;
  score = { p1: 10, p2: 10 };
  updateUI();
  render();
}

// عرض اللوح
function render(){
  boardEl.innerHTML = '';
  for (let i=0;i<25;i++){
    const cell = document.createElement('div');
    cell.className='cell';
    cell.dataset.i = i;
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

// النقر على خلية
function onCellClick(i){
  const piece = grid[i];
  // اختيار قطعة
  if (selected === null){
    if (piece === currentPlayer){
      selected = i;
      render();
    }
    return;
  }

  // محاولة الحركة
  if (piece === null && isNeighbor(selected, i)){
    movePiece(selected, i);
    selected = null;
    render();
    // بعد الحركة إذا كان ضد AI ودور AI، نفّذ نقلة AI
    if (checkWin()) return;
    if (playingAgainstAI && currentPlayer === 'p2'){
      const delay = difficulty === 'hard' ? 500 : difficulty === 'medium' ? 700 : 1000;
      setTimeout(aiMove, delay);
    }
  } else {
    // إلغاء الاختيار أو اختيار قطعة جديدة من نفس اللاعب
    if (piece === currentPlayer) selected = i;
    else selected = null;
    render();
  }
}

// تحقق ما إذا الخانتان متجاورتان (أفقياً/عمودياً فقط سابقاً) — نسمح بالتحرك إلى الخلية المجاورة في 8 اتجاهات أو 4؟ نص اللعبة سابقًا كان 4، لكن نحتفظ بـ4 (اختيارك)
// هنا سنبقي التحرك في 4 اتجاهات (أعلى/أسفل/يمين/يسار) كما قبل، لأن الانتقالات القطرية قد تكسر توازن.
// إذا أردت السماح بالتحرك قطرياً أيضاً، غيّر الشرط لاحقاً.
function isNeighbor(a,b){
  const ra = Math.floor(a/5), ca = a%5;
  const rb = Math.floor(b/5), cb = b%5;
  const rowDiff = Math.abs(ra - rb), colDiff = Math.abs(ca - cb);
  return (rowDiff + colDiff === 1); // مجاورة أفقياً أو عمودياً فقط
}

// نقل قطعة من src إلى dst ثم تنفيذ الأكل حسب القاعدة الجديدة
function movePiece(src,dst){
  grid[dst] = grid[src];
  grid[src] = null;
  playMove();

  // تطبيق قاعدة الأكل الجديدة:
  // نأكل أي قطعة للخصم موجودة مباشرة بجانب الخانة التي انتقلنا إليها (في جميع الاتجاهات الـ8)
  const eaten = performAdjacentCapture(dst, grid[dst]);
  if (eaten > 0) { playEat(); score[grid[dst]] += eaten; updateUI(); }

  // تبديل الدور (بعد الأكل)
  currentPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';
  updateTurnText();

  // تحقق من الفوز
  if (checkWin()){
    const winnerName = currentPlayer === 'p1' ? 'اللاعب الأبيض' : 'اللاعب الأسود';
    // لاحظ: بعد تبديل الدور أعلاه، الفائز هو العكس
    playWin();
    setTimeout(()=> alert(`🎉 ${winnerName} فاز!`), 120);
    // لا تعيد التعيين التلقائي؛ إن رغبت يمكن إعادة التشغيل
  }
}

// تنفيذ الأكل: يحذف كل قطع الخصم المجاورة مباشرة في 8 اتجاهات
function performAdjacentCapture(pos, mover){
  const opponent = mover === 'p1' ? 'p2' : 'p1';
  const row = Math.floor(pos/5), col = pos%5;
  const dirs = [
    [-1,-1],[-1,0],[-1,1],
    [0,-1],       [0,1],
    [1,-1],[1,0],[1,1]
  ];
  let total = 0;
  dirs.forEach(([dr,dc])=>{
    const r = row+dr, c = col+dc;
    if (r>=0 && r<5 && c>=0 && c<5){
      const idx = r*5 + c;
      if (grid[idx] === opponent){
        grid[idx] = null;
        total++;
      }
    }
  });
  // تحديث العد الفعلي للقطع المتبقية بعد الأكل
  score.p1 = grid.filter(x=>x==='p1').length;
  score.p2 = grid.filter(x=>x==='p2').length;
  return total;
}

// تحديث النص والنتائج في الواجهة
function updateUI(){
  score1El.textContent = score.p1;
  score2El.textContent = score.p2;
  updateTurnText();
}

// معلومات الدور
function updateTurnText(){
  const name = currentPlayer === 'p1' ? 'اللاعب الأسود' : 'اللاعب الأبيض';
  turnInfo.textContent = `دور: ${name}`;
}

// فحص الفوز (لا قطع لواحد من اللاعبين)
function checkWin(){
  const p1count = grid.filter(x=>x==='p1').length;
  const p2count = grid.filter(x=>x==='p2').length;
  if (p1count === 0 || p2count === 0) {
    // الفائز هو من لديه قطع
    const winner = p1count === 0 ? 'اللاعب الأبيض' : 'اللاعب الأسود';
    // إعلام بعد مكالمة الصوت من قبل الناقل
    setTimeout(()=> alert(`🏆 انتهت اللعبة — ${winner} فاز!`), 80);
    return true;
  }
  return false;
}

/* ------------------ الذكاء الاصطناعي (محلي، يعتمد على difficulty) ------------------ */
function aiMove(){
  if (!playingAgainstAI) return;
  difficulty = diffSelect.value;

  // جمع قطع AI والمساحات الفارغة
  const ai = grid.map((v,i)=> v==='p2' ? i : -1).filter(i=>i!==-1);
  const empty = grid.map((v,i)=> v===null ? i : -1).filter(i=>i!==-1);

  // إننا نريد أفضل حركة بناءً على عدد الأكل الذي سيحققه
  let best = null; // [from,to,capturedCount]
  ai.forEach(from=>{
    empty.forEach(to=>{
      if (!isNeighbor(from,to)) return;
      // محاكاة حركة
      const temp = grid.slice();
      temp[to] = temp[from];
      temp[from] = null;
      // عد الأكل الذي سينتج (جزئية: فقط القطع المجاورة للموقع الجديد)
      const captured = countAdjacentCapturesTemp(temp,to,'p2');
      // في الوضع الصعب نفضل أعلى captured، في المتوسط نأخذ احتمال 70% أفضل، في السهل نتحرك عشوائياً
      if (!best || captured > best[2]) best = [from,to,captured];
    });
  });

  let chosen = null;
  if (difficulty === 'hard' && best) {
    chosen = best;
  } else if (difficulty === 'medium' && best) {
    // اختر أفضل بنسبة أفضلية، أو عشوائي أحيانًا
    if (Math.random() < 0.75) chosen = best;
  }

  if (!chosen && ai.length>0){
    // حركة عشوائية: اختر قطعة عشوائية ولها حركة متاحة
    for (let attempt=0; attempt<40; attempt++){
      const f = ai[Math.floor(Math.random()*ai.length)];
      const moves = empty.filter(e=>isNeighbor(f,e));
      if (moves.length>0){
        chosen = [f, moves[Math.floor(Math.random()*moves.length)], 0];
        break;
      }
    }
  }

  if (chosen){
    const [f,t] = chosen;
    grid[t] = grid[f];
    grid[f] = null;
    const eaten = performAdjacentCapture(t,'p2');
    if (eaten>0) playEat();
    else playMove();
    currentPlayer = 'p1';
    updateUI();
    render();
    if (checkWin()) return;
  }
}

// عد الأكل في مصفوفة مؤقتة
function countAdjacentCapturesTemp(tempGrid,pos, mover){
  const opponent = mover === 'p1' ? 'p2' : 'p1';
  const row = Math.floor(pos/5), col = pos%5;
  const dirs = [
    [-1,-1],[-1,0],[-1,1],
    [0,-1],       [0,1],
    [1,-1],[1,0],[1,1]
  ];
  let cnt = 0;
  dirs.forEach(([dr,dc])=>{
    const r=row+dr, c=col+dc;
    if (r>=0 && r<5 && c>=0 && c<5){
      const idx = r*5 + c;
      if (tempGrid[idx] === opponent) cnt++;
    }
  });
  return cnt;
}

/* ------------------ تحكمات الواجهة ------------------ */
startBtn.addEventListener('click', ()=>{
  difficulty = diffSelect.value;
  playingAgainstAI = true;
  resetGame();
});

swapBtn.addEventListener('click', ()=>{
  // تبديل بين اللعب ضد AI واللعب محليًا على نفس الجهاز
  playingAgainstAI = !playingAgainstAI;
  swapBtn.textContent = playingAgainstAI ? 'العب محليًا' : 'العب ضد كمبيوتر';
});

diffSelect.addEventListener('change', ()=> difficulty = diffSelect.value);

// بدء أولي
resetGame();
render();
