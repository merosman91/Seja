const board = document.getElementById("board");
const startBtn = document.getElementById("startBtn");
const diffSelect = document.getElementById("difficulty");
const score1 = document.getElementById("score1");
const score2 = document.getElementById("score2");

let currentPlayer = "p1";
let selectedCell = null;
let difficulty = "medium";
let grid = Array(25).fill(null);

startBtn.addEventListener("click", startGame);

function startGame() {
  difficulty = diffSelect.value;
  resetGame();
  renderBoard();
}

function renderBoard() {
  board.innerHTML = "";
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    if (selectedCell === i) cell.classList.add("selected");

    const piece = grid[i];
    if (piece) {
      const div = document.createElement("div");
      div.classList.add("piece", piece);
      cell.appendChild(div);
    }

    cell.addEventListener("click", () => handleClick(i));
    board.appendChild(cell);
  }
}

function handleClick(i) {
  const piece = grid[i];

  if (selectedCell === null) {
    if (piece === currentPlayer) selectedCell = i;
  } else {
    if (piece === null && isNeighbor(selectedCell, i)) {
      grid[i] = currentPlayer;
      grid[selectedCell] = null;
      selectedCell = null;

      eatOpponents(i);
      updateScores();

      if (checkWin()) {
        setTimeout(() => alert(`🎉 ${getPlayerName(currentPlayer)} فاز!`), 200);
        resetGame();
        return;
      }

      currentPlayer = currentPlayer === "p1" ? "p2" : "p1";

      if (currentPlayer === "p2" && difficulty !== "easy") {
        setTimeout(aiMove, getAIDelay());
      }
    } else {
      selectedCell = null;
    }
  }
  renderBoard();
}

function isNeighbor(a, b) {
  const rowA = Math.floor(a / 5);
  const colA = a % 5;
  const rowB = Math.floor(b / 5);
  const colB = b % 5;
  return Math.abs(rowA - rowB) + Math.abs(colA - colB) === 1;
}

function eatOpponents(i) {
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
  const row = Math.floor(i / 5);
  const col = i % 5;

  dirs.forEach(([dr, dc]) => {
    const r1 = row + dr, c1 = col + dc, r2 = row + dr*2, c2 = col + dc*2;
    if (r2 >= 0 && r2 < 5 && c2 >= 0 && c2 < 5) {
      const idx1 = r1*5 + c1, idx2 = r2*5 + c2;
      if (grid[idx1] && grid[idx1] !== currentPlayer && grid[idx2] === currentPlayer) {
        grid[idx1] = null;
      }
    }
  });
}

function aiMove() {
  // الذكاء الاصطناعي البسيط
  const aiPieces = grid.map((p, i) => p === "p2" ? i : -1).filter(i => i !== -1);
  const empty = grid.map((p, i) => p === null ? i : -1).filter(i => i !== -1);

  let move = null;

  if (difficulty === "hard") {
    // يحاول الأكل أولًا
    for (let i of aiPieces) {
      for (let e of empty) {
        if (isNeighbor(i, e)) {
          const temp = [...grid];
          temp[e] = "p2";
          temp[i] = null;
          if (canEat(temp, e)) {
            move = [i, e];
            break;
          }
        }
      }
      if (move) break;
    }
  }

  // حركة عشوائية في الوضع المتوسط أو السهل
  if (!move) {
    const randomPiece = aiPieces[Math.floor(Math.random() * aiPieces.length)];
    const possibleMoves = empty.filter(e => isNeighbor(randomPiece, e));
    if (possibleMoves.length > 0) {
      const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      move = [randomPiece, randomMove];
    }
  }

  if (move) {
    grid[move[1]] = "p2";
    grid[move[0]] = null;
    eatOpponents(move[1]);
    updateScores();
    if (checkWin()) {
      setTimeout(() => alert("🤖 اللاعب الأبيض (الكمبيوتر) فاز!"), 200);
      resetGame();
      return;
    }
    currentPlayer = "p1";
    renderBoard();
  }
}

function canEat(temp, i) {
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
  const row = Math.floor(i / 5);
  const col = i % 5;
  return dirs.some(([dr, dc]) => {
    const r1 = row + dr, c1 = col + dc, r2 = row + dr*2, c2 = col + dc*2;
    if (r2 >= 0 && r2 < 5 && c2 >= 0 && c2 < 5) {
      const idx1 = r1*5 + c1, idx2 = r2*5 + c2;
      return temp[idx1] === "p1" && temp[idx2] === "p2";
    }
    return false;
  });
}

function updateScores() {
  score1.textContent = grid.filter(x => x === "p1").length;
  score2.textContent = grid.filter(x => x === "p2").length;
}

function getPlayerName(p) {
  return p === "p1" ? "اللاعب الأسود" : "اللاعب الأبيض";
}

function getAIDelay() {
  return difficulty === "hard" ? 600 : difficulty === "medium" ? 800 : 1000;
}

function checkWin() {
  const p1 = grid.filter(x => x === "p1").length;
  const p2 = grid.filter(x => x === "p2").length;
  return p1 === 0 || p2 === 0;
}

function resetGame() {
  grid = Array(25).fill(null);
  for (let i = 0; i < 10; i++) grid[i] = "p1";
  for (let i = 15; i < 25; i++) grid[i] = "p2";
  currentPlayer = "p1";
  selectedCell = null;
  updateScores();
  renderBoard();
  }
