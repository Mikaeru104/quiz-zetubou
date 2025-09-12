// ======================
// WebSocket URL設定
// ======================
// ローカルテストは ws://localhost:3000
// 本番サーバーは wss://your-app.onrender.com に変更
const WS_URL = window.location.hostname === "localhost" ? "ws://localhost:3000" : "wss://your-app.onrender.com";
const ws = new WebSocket(WS_URL);

let currentStage = 1; // 1:かくれんぼ, 2:絵しりとり

const stageTitle = document.querySelector("h1");
const waitingMessage = document.getElementById("waitingMessage");
const questionDiv = document.getElementById("question");
const timerDiv = document.getElementById("timer");
const gameTimerDiv = document.getElementById("gameTimer");
const scoreDiv = document.getElementById("score");
const startBtn = document.getElementById("startBtn");
const answerInput = document.getElementById("answerInput");
const answerBtn = document.getElementById("answerBtn");

// ======================
// WebSocket 接続
// ======================
ws.onopen = () => {
    console.log("WebSocket接続成功");
    waitingMessage.innerText = "サーバーに接続されました";

    // ステージに参加
    ws.send(JSON.stringify({ type: "join", stage: currentStage }));
};

ws.onclose = () => {
    console.log("WebSocket切断");
    waitingMessage.innerText = "サーバーとの接続が切れました";
};

ws.onerror = (err) => {
    console.error("WebSocketエラー:", err);
    waitingMessage.innerText = "サーバーに接続できません";
};

// ======================
// メッセージ受信
// ======================
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
        case "stage":
            stageTitle.innerText = msg.name;
            break;
        case "waiting":
            waitingMessage.innerText = msg.message;
            break;
        case "question":
            questionDiv.innerText = `問題: ${msg.question}`;
            timerDiv.innerText = "20"; // 問題タイマー初期値
            waitingMessage.innerText = "";
            break;
        case "questionTimer":
            timerDiv.innerText = msg.timeLeft;
            break;
        case "gameTimer":
            gameTimerDiv.innerText = `残り時間: ${msg.timeLeft}秒`;
            break;
        case "score":
            scoreDiv.innerText = `スコア: ${msg.score}`;
            break;
        case "end":
            questionDiv.innerText = msg.message;
            timerDiv.innerText = "";
            startBtn.style.display = "inline-block"; // ゲーム終了後にスタート再表示
            break;
        case "info":
            waitingMessage.innerText = msg.message;
            break;
        default:
            console.log("不明なメッセージ:", msg);
    }
};

// ======================
// スタートボタン
// ======================
startBtn.addEventListener("click", () => {
    ws.send(JSON.stringify({ type: "start", stage: currentStage }));
    waitingMessage.innerText = "準備中...";
    questionDiv.innerText = "ゲーム開始準備中...";
    startBtn.style.display = "none"; // 押したら非表示
});

// ======================
// 回答ボタン
// ======================
answerBtn.addEventListener("click", () => {
    const answer = answerInput.value.trim();
    if (!answer) return;
    ws.send(JSON.stringify({ type: "answer", answer: answer, stage: currentStage }));
    answerInput.value = "";
});
