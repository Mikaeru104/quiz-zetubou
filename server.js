const WebSocket = require('ws');
const http = require('http');

// HTTPサーバーの作成
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('WebSocket Server is running');
});

// WebSocketサーバーを作成
const wss = new WebSocket.Server({ server });

let players = [];
let readyPlayers = 0;
let questionIndex = 0;
let gameStarted = false;
let answeredPlayers = [];
let gameTimer;
let questionTimerInterval;

// クイズの問題
const questions = [
    { question: "104", correctAnswer: "T" },
    { question: "374", correctAnswer: "B" },
    { question: "638", correctAnswer: "Z" },
    { question: "946", correctAnswer: "S" },
    { question: "233", correctAnswer: "W" },
    { question: "578", correctAnswer: "G" }
];

// クライアント接続時
wss.on('connection', (ws) => {
    console.log('New client connected');

    players.push({ ws, score: 0, answered: false });

    ws.on('message', (message) => {
        const msg = JSON.parse(message);

        if (msg.type === 'start') {
            readyPlayers++;

            if (readyPlayers === players.length) {
                startQuiz();
            } else {
                ws.send(JSON.stringify({ type: 'waiting', message: 'しばらくお待ちください...' }));
            }
        } else if (msg.type === 'answer') {
            handleAnswer(ws, msg.answer);
        }
    });

    ws.on('close', () => {
        players = players.filter(player => player.ws !== ws);
    });
});

// クイズ開始
function startQuiz() {
    gameStarted = true;
    readyPlayers = 0;
    answeredPlayers = [];

    let timeLeft = 120;
    gameTimer = setInterval(() => {
        timeLeft--;

        players.forEach(player => {
            player.ws.send(JSON.stringify({
                type: 'gameTimer',
                timeLeft
            }));
        });

        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            endQuiz();
        }
    }, 1000);

    sendNextQuestion();
}

// 問題送信
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

// 回答処理
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

// 問題タイマー管理
function startQuestionTimer() {
    let timeLeft = 20;

    questionTimerInterval = setInterval(() => {
        timeLeft--;

        players.forEach(player => {
            player.ws.send(JSON.stringify({
                type: 'questionTimer',
                timeLeft
            }));
        });

        if (timeLeft <= 0) {
            clearInterval(questionTimerInterval);
            assignScores();

            players.forEach(player => {
                player.answered = false;
            });

            questionIndex++;
            setTimeout(() => {
                sendNextQuestion();
            }, 2000);
        }
    }, 1000);
}

// スコア割り当て
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

// クイズ終了
function endQuiz() {
    // スコア順にソート（降順）
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    // 2位のスコアを取得（2人以上いる場合）
    const secondScore = sortedPlayers[1] ? sortedPlayers[1].score : null;

    if (secondScore !== null && secondScore < 41) {
        // 2位と同じスコアを持っているプレイヤーを抽出
        const secondPlacePlayers = sortedPlayers.filter(p => p.score === secondScore);

        if (secondPlacePlayers.length > 1) {
            // 複数いたらランダムで1人選んでスコアを41点に昇格
            const selectedPlayer = secondPlacePlayers[Math.floor(Math.random() * secondPlacePlayers.length)];
            selectedPlayer.score = 41;
        } else {
            // 1人だけならその人のスコアを41点に
            secondPlacePlayers[0].score = 41;
        }
    }

    // 各プレイヤーに結果を送信
    players.forEach(player => {
        let message = `クイズ終了！最終スコア: ${player.score}点`;

        if (player.score >= 41) {
            message += "\n第一ステージクリア、Bに移動してください";
        } else {
            message += "\nクリアならず、速やかに退場してください";
        }

        player.ws.send(JSON.stringify({ type: 'end', message }));
    });
}



// サーバー起動
server.listen(8080, () => {
    console.log('Server is listening on port 8080');
});