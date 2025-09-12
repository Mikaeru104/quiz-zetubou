const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

// ==== HTTP サーバー（フロント配信用） ====
const server = http.createServer((req, res) => {
  // index.html を返す
  let filePath = path.join(__dirname, "index.html");
  if (req.url.endsWith("script.js")) {
    filePath = path.join(__dirname, "script.js");
    res.writeHead(200, { "Content-Type": "application/javascript" });
  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end("Error loading file");
      return;
    }
    res.end(content);
  });
});

// ==== WebSocket サーバー ====
const wss = new WebSocket.Server({ server });

// ルーム管理
let rooms = {
  stage1: { players: [], startVotes: 0, totalPlayers: 0, gameStarted: false },
  stage2: { players: [], startVotes: 0, totalPlayers: 0, gameStarted: false }
};

// 参加者割り当て
function assignRoom(ws) {
  if (rooms.stage1.players.length < 4 || rooms.stage1.gameStarted === false) {
    rooms.stage1.players.push({ ws, score: 0, answered: false });
    rooms.stage1.totalPlayers = 4;
    return "stage1";
  } else {
    rooms.stage2.players.push({ ws, score: 0, answered: false });
    rooms.stage2.totalPlayers = 3;
    return "stage2";
  }
}

// メッセージ送信
function broadcast(roomName, msg) {
  rooms[roomName].players.forEach(p => {
    p.ws.send(JSON.stringify(msg));
  });
}

wss.on("connection", (ws) => {
  const room = assignRoom(ws);
  ws.send(JSON.stringify({ type: "info", message: `${room} に参加しました` }));

  ws.on("message", (message) => {
    const msg = JSON.parse(message);
    if (msg.type === "start") {
      rooms[room].startVotes++;
      if (rooms[room].startVotes >= rooms[room].totalPlayers) {
        rooms[room].gameStarted = true;
        if (room === "stage1") {
          startStage1();
        } else if (room === "stage2") {
          startStage2();
        }
      } else {
        broadcast(room, {
          type: "waiting",
          message: `準備中... (${rooms[room].startVotes}/${rooms[room].totalPlayers})`
        });
      }
    }
  });

  ws.on("close", () => {
    rooms[room].players = rooms[room].players.filter(p => p.ws !== ws);
  });
});

// ==== ステージ1 ====
const stage1Questions = [
  { question: "104", answer: "T" },
  { question: "374", answer: "B" },
  { question: "638", answer: "Z" },
  { question: "946", answer: "S" },
  { question: "233", answer: "W" },
  { question: "578", answer: "G" },
];

function startStage1() {
  broadcast("stage1", { type: "question", question: "104" });
  // TODO: 回答処理 & タイマー
}

// ==== ステージ2 ====
function startStage2() {
  // 全員スコアをリセット
  rooms.stage2.players.forEach(p => (p.score = 0));

  broadcast("stage2", {
    type: "question",
    question: "四桁を答えてください"
  });

  // 120秒で終了
  setTimeout(() => {
    endStage2();
  }, 120 * 1000);
}

function endStage2() {
  rooms.stage2.players.forEach(p => {
    let result = `第2ステージ終了！あなたのスコア: ${p.score}`;
    if (p.score >= 100) {
      result += "\nクリア！";
    } else {
      result += "\n失敗...";
    }
    p.ws.send(JSON.stringify({ type: "end", message: result }));
  });
}

// ==== サーバー起動 ====
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
