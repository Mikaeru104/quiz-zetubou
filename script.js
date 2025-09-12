const ws = new WebSocket('wss://quiz-zetubou.onrender.com'); // WebSocketサーバー接続先

// 現在のステージ 1=かくれんぼ, 2=絵しりとり
let currentStage = 1;

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
// WebSocket接続
// ======================
ws.onopen = () => {
    console.log('Connected to WebSocket');
    waitingMessage.innerText = "サーバーに接続されました";
};

ws.onclose = () => {
    console.log('WebSocket切断');
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
    const message = JSON.parse(event.data);

    switch (message.type) {
        case 'stage':
            stageTitle.innerText = message.name;
            break;
        case 'waiting':
            waitingMessage.innerText = message.message;
            break;
        case 'question':
            questionDiv.innerText = `問題: ${message.question}`;
            timerDiv.innerText = "20"; // 問題タイマー初期化
            waitingMessage.innerText = "";
            break;
        case 'questionTimer':
            timerDiv.innerText = message.timeLeft;
            break;
        case 'gameTimer':
            gameTimerDiv.innerText = `残り時間: ${message.timeLeft}秒`;
            break;
        case 'score':
            scoreDiv.innerText = `スコア: ${message.score}`;
            break;
        case 'end':
            questionDiv.innerText = message.message;
            timerDiv.innerText = "";
            startBtn.style.display = "inline-block"; // 終了後にスタート再表示
            break;
        case 'info':
            waitingMessage.innerText = message.message;
            break;
        default:
            console.log("不明なメッセージ:", message);
    }
};

// ======================
// スタートボタン
// ======================
startBtn.addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'start', stage: currentStage }));
    waitingMessage.innerText = "準備中...";
    questionDiv.innerText = "ゲーム開始準備中...";
    startBtn.style.display = "none"; // 押したら消す
});

// ======================
// 回答ボタン
// ======================
answerBtn.addEventListener('click', () => {
    const answer = answerInput.value.trim();
    if (!answer) return;
    ws.send(JSON.stringify({ type: 'answer', answer: answer, stage: currentStage }));
    answerInput.value = "";
});
