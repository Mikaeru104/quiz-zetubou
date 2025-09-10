const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// === 静的ファイルを配信 ===
app.use(express.static(path.join(__dirname)));

let players = [];
let readyPlayers = 0;
let questionIndex = 0;
let gameStarted = false;
let answeredPlayers = [];
let gameTimer;
let questionTimerInterval;

const questions = [
    { question: "104", correctAnswer: "T" },
    { question: "374", correctAnswer: "B" },
    { question: "638", correctAnswer: "Z" },
    { question: "946", correctAnswer: "S" },
    { question: "233", correctAnswer: "W" },
    { question: "578", correctAnswer: "G" }
];

// WebSocket接続
wss.on('connection', (ws) => {
    console.log('New client connected');

    players.push({ ws, score: 0, answered: false, ready: false });

    ws.on('message', (message) => {
        const msg = JSON.parse(message);

        if (msg.type === 'start') {
            // ✅ スタート押したら準備完了
            const player = players.find(p => p.ws === ws);
            if (player) player.ready = true;

            // ✅ 準備完了人数をカウント
            readyPlayers = players.filter(p => p.ready).length;

            // ✅ 全員押したら強制的に新ゲーム開始
            if (readyPlayers === players.length) {
                startQuiz();
            } else {
                ws.send(JSON.stringify({ type: 'waiting', message: '他のプレイヤーを待っています...' }));
            }
        } else if (msg.type === 'answer') {
            handleAnswer(ws, msg.answer);
        }
    });

    ws.on('close', () => {
        players = players.filter(player => player.ws !== ws);
    });
});

function startQuiz() {
    // ======= 🔄 完全リセット =======
    clearInterval(gameTimer);
    clearInterval(questionTimerInterval);

    questionIndex = 0;
    gameStarted = true;
    answeredPlayers = [];
    readyPlayers = 0;

    players.forEach(p => {
        p.score = 0;
        p.answered = false;
        p.ready = false; // ✅ 次回の準備状態をリセット
    });

    // 120秒のゲーム全体タイマー開始
    let timeLeft = 120;
    gameTimer = setInterval(() => {
        timeLeft--;

        players.forEach(player => {
            player.ws.send(JSON.stringify({ type: 'gameTimer', timeLeft }));
        });

        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            endQuiz();
        }
    }, 1000);

    sendNextQuestion();
}

function sendNextQuestion() {
    if (questionIndex < questions.length) {
        const question = questions[questionIndex];
        players.forEach(player => {
            player.ws.send(JSON.stringify({ type: 'question', question: question.question }));
        });
        startQuestionTimer();
    } else {
        endQuiz();
    }
}

function handleAnswer(ws, answer) {
    const player = players.find(p => p.ws === ws);
    if (!player || player.answered) return;

    const correctAnswer = questions[questionIndex].correctAnswer;
    if (answer.trim().toUpperCase() === correctAnswer) {
        player.answered = true;
        answeredPlayers.push(player);
        player.ws.send(JSON.stringify({ type: 'waiting', message: '次の問題をお待ちください...' }));
    }
}

function startQuestionTimer() {
    let timeLeft = 20;

    questionTimerInterval = setInterval(() => {
        timeLeft--;

        players.forEach(player => {
            player.ws.send(JSON.stringify({ type: 'questionTimer', timeLeft }));
        });

        if (timeLeft <= 0) {
            clearInterval(questionTimerInterval);
            assignScores();
            players.forEach(player => player.answered = false);
            questionIndex++;
            setTimeout(() => sendNextQuestion(), 2000);
        }
    }, 1000);
}

function assignScores() {
    const scores = [10, 7, 3, 1];
    for (let i = 0; i < answeredPlayers.length; i++) {
        const player = answeredPlayers[i];
        const score = scores[i] || 1;
        player.score += score;
        player.ws.send(JSON.stringify({ type: 'score', score: player.score }));
    }
    answeredPlayers = [];
}

function endQuiz() {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    // 1位のプレイヤーに+50点
    if (sortedPlayers[0]) {
        sortedPlayers[0].score += 50;
    }

    // 2位と3位をチェックして 41 点未満なら補正
    for (let i = 1; i <= 2; i++) {
        if (sortedPlayers[i] && sortedPlayers[i].score < 41) {
            sortedPlayers[i].score = 41;
        }
    }

    // 結果送信
    players.forEach(player => {
        let message = `クイズ終了！最終スコア: ${player.score}点`;
        if (player.score >= 41) {
            message += "\n第一ステージクリア、Bに移動してください";
        } else {
            message += "\nクリアならず、速やかに退場してください";
        }
        player.ws.send(JSON.stringify({ type: 'end', message }));
    });

    clearInterval(gameTimer);
    clearInterval(questionTimerInterval);
    gameStarted = false;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

    
      



