const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

/**
 * ルーム管理
 * stage1: かくれんぼ
 * stage2: 絵しりとり
 */
let rooms = {
  stage1: {
    players: [],
    gameInProgress: false,
    startVotes: 0,
    totalPlayers: 4,
    timer: null,
    // ★ 第一ステージかくれんぼの問題セット
    questions: [
      { q: "104", a: "T" },
      { q: "374", a: "B" },
      { q: "638", a: "Z" },
      { q: "946", a: "S" },
      { q: "233", a: "W" },
      { q: "578", a: "G" }
    ],
    currentQuestionIndex: 0,
    answeredPlayers: []
  },
  stage2: {
    players: [],
    gameInProgress: false,
    startVotes: 0,
    totalPlayers: 3,
    timer: null,
    answers: [],
    validAnswers: ["4768", "3229", "5610"]
  }
};

function broadcast(roomName, data) {
  rooms[roomName].players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(data));
    }
  });
}

wss.on('connection', (ws) => {
  // 新規参加者は stage1 へ
  let player = { ws, score: 0, room: 'stage1' };
  rooms.stage1.players.push(player);

  ws.on('message', (message) => {
    const msg = JSON.parse(message);

    // ===== ステージ1: かくれんぼ =====
    if (player.room === 'stage1') {
      if (msg.type === 'start') {
        rooms.stage1.startVotes++;
        if (rooms.stage1.startVotes >= rooms.stage1.totalPlayers) {
          startStage1();
        }
      } else if (msg.type === 'answer') {
        handleStage1Answer(player, msg.answer);
      }
    }

    // ===== ステージ2: 絵しりとり =====
    if (player.room === 'stage2') {
      if (msg.type === 'start') {
        rooms.stage2.startVotes++;
        if (rooms.stage2.startVotes >= rooms.stage2.totalPlayers) {
          startStage2();
        }
      } else if (msg.type === 'answer') {
        handleStage2Answer(player, msg.answer);
      }
    }
  });

  ws.on('close', () => {
    if (rooms[player.room]) {
      rooms[player.room].players = rooms[player.room].players.filter(p => p !== player);
    }
  });
});

// ===== ステージ1開始 =====
function startStage1() {
  const room = rooms.stage1;
  if (room.gameInProgress) return;

  room.gameInProgress = true;
  room.startVotes = 0;
  room.currentQuestionIndex = 0;
  room.answeredPlayers = [];
  room.players.forEach(p => p.score = 0);

  sendStage1Question();

  let timeLeft = 120; // 全体タイマー
  room.timer = setInterval(() => {
    timeLeft--;
    broadcast('stage1', { type: 'gameTimer', timeLeft });
    if (timeLeft <= 0) {
      clearInterval(room.timer);
      endStage1();
    }
  }, 1000);
}

function sendStage1Question() {
  const room = rooms.stage1;
  if (room.currentQuestionIndex >= room.questions.length) {
    endStage1();
    return;
  }

  const q = room.questions[room.currentQuestionIndex];
  room.answeredPlayers = [];
  broadcast('stage1', { type: 'question', question: q.q });
}

function handleStage1Answer(player, answer) {
  const room = rooms.stage1;
  const q = room.questions[room.currentQuestionIndex];

  if (answer.trim().toUpperCase() === q.a && !room.answeredPlayers.includes(player)) {
    room.answeredPlayers.push(player);
    const rank = room.answeredPlayers.length;
    if (rank === 1) player.score += 50;
    else if (rank === 2) player.score = Math.max(player.score, 41);
    else if (rank === 3) player.score = Math.max(player.score, 41);

    player.ws.send(JSON.stringify({ type: 'score', score: player.score }));

    if (room.answeredPlayers.length >= room.players.length) {
      room.currentQuestionIndex++;
      setTimeout(sendStage1Question, 2000); // 2秒後に次の問題
    }
  }
}

function endStage1() {
  const room = rooms.stage1;
  broadcast('stage1', { type: 'end', message: 'ステージ1終了！' });

  // 上位3人をステージ2へ
  const top3 = [...room.players].sort((a, b) => b.score - a.score).slice(0, 3);
  top3.forEach(p => {
    p.room = 'stage2';
    rooms.stage2.players.push(p);
  });

  // ステージ1をリセット（次の新規プレイヤー用に空にする）
  room.players = [];
  room.gameInProgress = false;
  room.startVotes = 0;
  clearInterval(room.timer);
}

// ===== ステージ2開始 =====
function startStage2() {
  const room = rooms.stage2;
  if (room.gameInProgress) return;

  room.gameInProgress = true;
  room.startVotes = 0;
  room.answers = [];
  room.players.forEach(p => p.score = 0);

  broadcast('stage2', { type: 'question', question: '絵しりとり：四桁を教えてください' });

  let timeLeft = 120;
  room.timer = setInterval(() => {
    timeLeft--;
    broadcast('stage2', { type: 'gameTimer', timeLeft });
    if (timeLeft <= 0) {
      clearInterval(room.timer);
      endStage2();
    }
  }, 1000);
}

function handleStage2Answer(player, answer) {
  const room = rooms.stage2;
  if (room.validAnswers.includes(answer.trim()) && !room.answers.find(a => a.player === player)) {
    room.answers.push({ player, answer });
    const rank = room.answers.length;
    if (rank === 1) player.score = 100;
    else if (rank === 2) player.score = 80;
    else if (rank === 3) player.score = 60;

    player.ws.send(JSON.stringify({ type: 'score', score: player.score }));

    if (room.answers.length >= room.players.length) {
      clearInterval(room.timer);
      endStage2();
    }
  }
}

function endStage2() {
  const room = rooms.stage2;
  room.players.forEach(p => {
    const cleared = p.score >= 100;
    p.ws.send(JSON.stringify({ type: 'end', message: cleared ? 'クリア！' : 'ゲームオーバー' }));
  });

  // 完全リセット
  room.players = [];
  room.gameInProgress = false;
  room.startVotes = 0;
  clearInterval(room.timer);
}
