const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// === 静的ファイルを配信 ===
app.use(express.static(path.join(__dirname)));

// ======================
// プレイヤー管理
// ======================
let rooms = {
  stage1: { players: [], startVotes: 0, totalPlayers: 4, gameStarted: false },
  stage2: { players: [], startVotes: 0, totalPlayers: 3, gameStarted: false },
};

// ======================
// 第一ステージ（かくれんぼ）問題
// ======================
const stage1Questions = [
  { question: "104", answer: "T" },
  { question: "374", answer: "B" },
  { question: "638", answer: "Z" },
  { question: "946", answer: "S" },
  { question: "233", answer: "W" },
  { question: "578", answer: "G" },
];

// ======================
// 第二ステージ（絵しりとり）問題
// ======================
const stage2Question = {
  question: "四桁を教えてください",
  answers: ["4768", "3229", "5610"],
};

let stage1Index = 0;
let stage1AnsweredPlayers = [];
let stage1GameTimer;
let stage1QuestionTimer;

let stage2AnsweredPlayers = [];
let stage2GameTimer;

// ======================
// ユーティリティ
// ======================
function broadcast(room, data) {
  rooms[room].players.forEach((p) => {
    try {
      p.ws.send(JSON.stringify(data));
    } catch (e) {
      console.error("送信エラー:", e);
    }
  });
}

// ======================
// WebSocket接続処理
// ======================
wss.on("connection", (ws) => {
  console.log("新しいクライアント接続");

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "join") {
      if (data.stage === 1) {
        rooms.stage1.players.push({ ws, score: 0, answered: false });
        ws.send(JSON.stringify({ type: "stage", name: "かくれんぼ" }));
      } else if (data.stage === 2) {
        rooms.stage2.players.push({ ws, score: 0, answered: false });
        ws.send(JSON.stringify({ type: "stage", name: "絵しりとり" }));
      }
    }

    if (data.type === "start") {
      if (data.stage === 1) {
        rooms.stage1.startVotes++;
        if (rooms.stage1.startVotes >= rooms.stage1.totalPlayers) {
          startStage1();
        } else {
          ws.send(JSON.stringify({ type: "waiting", message: "他のプレイヤーを待っています..." }));
        }
      } else if (data.stage === 2) {
        rooms.stage2.startVotes++;
        if (rooms.stage2.startVotes >= rooms.stage2.totalPlayers) {
          startStage2();
        } else {
          ws.send(JSON.stringify({ type: "waiting", message: "他のプレイヤーを待っています..." }));
        }
      }
    }

    if (data.type === "answer") {
      if (data.stage === 1) handleStage1Answer(ws, data.answer);
      if (data.stage === 2) handleStage2Answer(ws, data.answer);
    }
  });

  ws.on("close", () => {
    rooms.stage1.players = rooms.stage1.players.filter((p) => p.ws !== ws);
    rooms.stage2.players = rooms.stage2.players.filter((p) => p.ws !== ws);
  });
});

// ======================
// 第一ステージ：かくれんぼ
// ======================
function startStage1() {
  broadcast("stage1", { type: "stage", name: "かくれんぼ" });

  stage1Index = 0;
  stage1AnsweredPlayers = [];
  rooms.stage1.players.forEach((p) => {
    p.score = 0;
    p.answered = false;
  });

  let timeLeft = 120;
  stage1GameTimer = setInterval(() => {
    timeLeft--;
    broadcast("stage1", { type: "gameTimer", timeLeft });
    if (timeLeft <= 0) {
      clearInterval(stage1GameTimer);
      endStage1();
    }
  }, 1000);

  sendStage1Question();
}

function sendStage1Question() {
  if (stage1Index >= stage1Questions.length) {
    endStage1();
    return;
  }

  const q = stage1Questions[stage1Index];
  broadcast("stage1", { type: "question", question: q.question });

  let timeLeft = 20;
  stage1QuestionTimer = setInterval(() => {
    timeLeft--;
    broadcast("stage1", { type: "questionTimer", timeLeft });
    if (timeLeft <= 0) {
      clearInterval(stage1QuestionTimer);
      assignStage1Scores();
      rooms.stage1.players.forEach((p) => (p.answered = false));
      stage1Index++;
      setTimeout(() => sendStage1Question(), 2000);
    }
  }, 1000);
}

function handleStage1Answer(ws, answer) {
  const player = rooms.stage1.players.find((p) => p.ws === ws);
  if (!player || player.answered) return;

  const correct = stage1Questions[stage1Index].answer;
  if (answer.trim().toUpperCase() === correct) {
    player.answered = true;
    stage1AnsweredPlayers.push(player);
    ws.send(JSON.stringify({ type: "waiting", message: "正解！次の問題を待ってください..." }));
  }
}

function assignStage1Scores() {
  const scores = [10, 7, 3, 1];
  for (let i = 0; i < stage1AnsweredPlayers.length; i++) {
    const player = stage1AnsweredPlayers[i];
    const score = scores[i] || 1;
    player.score += score;
    player.ws.send(JSON.stringify({ type: "score", score: player.score }));
  }
  stage1AnsweredPlayers = [];
}

function endStage1() {
  clearInterval(stage1GameTimer);
  clearInterval(stage1QuestionTimer);

  const sorted = [...rooms.stage1.players].sort((a, b) => b.score - a.score);

  if (sorted[0]) sorted[0].score += 50;

  for (let i = 1; i <= 2; i++) {
    if (sorted[i] && sorted[i].score < 41) sorted[i].score = 41;
  }

  rooms.stage1.players.forEach((p) => {
    let msg = `第1ステージ終了！最終スコア: ${p.score}点`;
    if (p.score >= 41) {
      msg += "\nクリア！第2ステージへ進んでください";
    } else {
      msg += "\nクリアならず、退場してください";
    }
    p.ws.send(JSON.stringify({ type: "end", message: msg }));
  });

  rooms.stage1 = { players: [], startVotes: 0, totalPlayers: 4, gameStarted: false };
}

// ======================
// 第二ステージ：絵しりとり
// ======================
function startStage2() {
  broadcast("stage2", { type: "stage", name: "絵しりとり" });
  stage2AnsweredPlayers = [];
  rooms.stage2.players.forEach((p) => {
    p.score = 0;
    p.answered = false;
  });

  broadcast("stage2", { type: "question", question: stage2Question.question });

  let timeLeft = 120;
  stage2GameTimer = setInterval(() => {
    timeLeft--;
    broadcast("stage2", { type: "gameTimer", timeLeft });
    if (timeLeft <= 0) {
      clearInterval(stage2GameTimer);
      endStage2();
    }
  }, 1000);
}

function handleStage2Answer(ws, answer) {
  const player = rooms.stage2.players.find((p) => p.ws === ws);
  if (!player || player.answered) return;

  if (stage2Question.answers.includes(answer.trim())) {
    player.answered = true;
    stage2AnsweredPlayers.push(player);

    if (stage2AnsweredPlayers.length === rooms.stage2.players.length) {
      clearInterval(stage2GameTimer);
      endStage2();
    }
  }
}

function endStage2() {
  const scores = [100, 80, 60];
  for (let i = 0; i < stage2AnsweredPlayers.length; i++) {
    const player = stage2AnsweredPlayers[i];
    const score = scores[i] || 0;
    player.score = score;
    player.ws.send(JSON.stringify({ type: "score", score: player.score }));
  }

  rooms.stage2.players.forEach((p) => {
    let msg = `第2ステージ終了！最終スコア: ${p.score}点`;
    if (p.score >= 100) {
      msg += "\nクリア！";
    } else {
      msg += "\nクリアならず...";
    }
    p.ws.send(JSON.stringify({ type: "end", message: msg }));
  });

  rooms.stage2 = { players: [], startVotes: 0, totalPlayers: 3, gameStarted: false };
}

// ======================
// サーバー起動
// ======================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
