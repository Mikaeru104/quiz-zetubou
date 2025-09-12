const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname)));

let players = [];

const stage1Questions = [
    { question: "104", correctAnswer: "T" },
    { question: "374", correctAnswer: "B" },
    { question: "638", correctAnswer: "Z" },
    { question: "946", correctAnswer: "S" },
    { question: "233", correctAnswer: "W" },
    { question: "578", correctAnswer: "G" }
];

const stage2Questions = [
    { question: "四桁を教えてください", correctAnswers: ["4768", "3229", "5610"] }
];

const requiredPlayersStage1 = 4;
const requiredPlayersStage2 = 3;

wss.on('connection', (ws) => {
    console.log('新しいクライアント接続');

    players.push({
        ws,
        scoreStage1: 0,
        scoreStage2: 0,
        answered: false,
        stage: 1,
        ready: false,
        handleAnswer: null
    });

    ws.on('message', (message) => {
        const msg = JSON.parse(message);
        const player = players.find(p => p.ws === ws);
        if (!player) return;

        if (msg.type === 'start') {
            player.ready = true;
            player.stage = msg.stage;

            const stagePlayers = players.filter(p => p.stage === msg.stage);
            const readyCount = stagePlayers.filter(p => p.ready).length;

            if (msg.stage === 1) {
                if (readyCount === requiredPlayersStage1) startStage1(stagePlayers);
                else ws.send(JSON.stringify({ type: 'waiting', message: `第一ステージ: あと ${requiredPlayersStage1 - readyCount} 人を待っています...` }));
            }

            if (msg.stage === 2) {
                if (readyCount === requiredPlayersStage2) startStage2(stagePlayers);
                else ws.send(JSON.stringify({ type: 'waiting', message: `第二ステージ: あと ${requiredPlayersStage2 - readyCount} 人を待っています...` }));
            }
        } else if (msg.type === 'answer') {
            if (player.handleAnswer) player.handleAnswer(player, msg.answer);
        }
    });

    ws.on('close', () => {
        players = players.filter(p => p.ws !== ws);
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'サーバー接続成功！' }));
});

// ======================
// 第一ステージ
// ======================
function startStage1(stagePlayers) {
    stagePlayers.forEach(p => { p.scoreStage1 = 0; p.answered = false; p.ready = false; });
    let questionIndex = 0;
    let answeredPlayers = [];
    let timeLeft = 120;

    const gameTimer = setInterval(() => {
        timeLeft--;
        stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'gameTimer', timeLeft })));
        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            endStage1(stagePlayers);
        }
    }, 1000);

    function sendNextQuestion() {
        if (questionIndex < stage1Questions.length) {
            const question = stage1Questions[questionIndex];
            stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'question', question: question.question, stageName: "かくれんぼ" })));
            startQuestionTimer(question);
        } else {
            endStage1(stagePlayers);
        }
    }

    function startQuestionTimer(question) {
        let qTime = 20;
        const questionTimer = setInterval(() => {
            qTime--;
            stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'questionTimer', timeLeft: qTime })));
            if (qTime <= 0) {
                clearInterval(questionTimer);
                assignScoresStage1();
                stagePlayers.forEach(p => p.answered = false);
                questionIndex++;
                setTimeout(sendNextQuestion, 2000);
            }
        }, 1000);
    }

    function handleAnswer(player, answer) {
        if (!player || player.answered) return;
        const correct = stage1Questions[questionIndex].correctAnswer;
        if (answer.trim().toUpperCase() === correct) {
            player.answered = true;
            answeredPlayers.push(player);
            player.ws.send(JSON.stringify({ type: 'waiting', message: '次の問題をお待ちください...' }));
        }
    }

    function assignScoresStage1() {
        const scores = [10, 7, 3, 1];
        for (let i = 0; i < answeredPlayers.length; i++) {
            const p = answeredPlayers[i];
            const score = scores[i] || 1;
            p.scoreStage1 += score;
            p.ws.send(JSON.stringify({ type: 'score', score: p.scoreStage1 }));
        }
        answeredPlayers = [];
    }

    stagePlayers.forEach(p => p.handleAnswer = handleAnswer);
    sendNextQuestion();
}

function endStage1(stagePlayers) {
    const sorted = [...stagePlayers].sort((a, b) => b.scoreStage1 - a.scoreStage1);
    if (sorted[0]) sorted[0].scoreStage1 += 50;
    for (let i = 1; i <= 2; i++) {
        if (sorted[i] && sorted[i].scoreStage1 < 41) sorted[i].scoreStage1 = 41;
    }

    stagePlayers.forEach(p => {
        let msg = `第一ステージ終了！最終スコア: ${p.scoreStage1}点`;
        if (p.scoreStage1 >= 41) msg += "\n第一ステージクリア、Bに移動してください";
        else msg += "\nクリアならず、速やかに退場してください";
        p.ws.send(JSON.stringify({ type: 'end', message: msg }));
    });
}

// ======================
// 第二ステージ
// ======================
function startStage2(stagePlayers) {
    stagePlayers.forEach(p => { p.scoreStage2 = 0; p.answered = false; p.ready = false; });
    const question = stage2Questions[0];
    let answeredPlayers = [];
    let timeLeft = 120;

    const gameTimer = setInterval(() => {
        timeLeft--;
        stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'gameTimer', timeLeft })));
        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            endStage2(stagePlayers, answeredPlayers);
        }
    }, 1000);

    stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'stage', name: '絵しりとり' })));
    stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'question', question: question.question })));

    function handleAnswer(player, answer) {
        if (!player || player.answered) return;
        if (question.correctAnswers.includes(answer.trim())) {
            player.answered = true;
            answeredPlayers.push(player);
            player.ws.send(JSON.stringify({ type: 'waiting', message: '回答完了しました' }));
        }
        if (answeredPlayers.length === stagePlayers.length) {
            clearInterval(gameTimer);
            endStage2(stagePlayers, answeredPlayers);
        }
    }

    stagePlayers.forEach(p => p.handleAnswer = handleAnswer);
}

function endStage2(stagePlayers, answeredPlayers) {
    const sorted = [...answeredPlayers];
    if (sorted[0]) sorted[0].scoreStage2 = 100;
    if (sorted[1]) sorted[1].scoreStage2 = 80;
    if (sorted[2]) sorted[2].scoreStage2 = 60;

    stagePlayers.forEach(p => {
        if (!answeredPlayers.includes(p)) p.scoreStage2 = 0;
        let msg = `第二ステージ終了！スコア: ${p.scoreStage2}点`;
        if (p.scoreStage2 >= 100) msg += "\n第二ステージクリア！";
        else msg += "\nクリアならず";
        p.ws.send(JSON.stringify({ type: 'end', message: msg }));
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
