const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname)));

let players = [];

// ======================
// 問題データ
// ======================
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

const stage3Questions = [
    { question: "「新」が乗っているページを答えてください", correctAnswer: "100" },
    { question: "「井」と「猿」が乗ってるページの値を和を答えてください", correctAnswer: "200" },
    { question: "「講」と「別」の乗ってるページの値の差をお答えください", correctAnswer: "300" },
];

const requiredPlayersStage1 = 4;
const requiredPlayersStage2 = 3;

// ======================
// StageGame クラス
// ======================
class StageGame {
    constructor(stage, players, questions, totalTime, questionTime, onEnd, stageName) {
        this.stage = stage;
        this.players = players;
        this.questions = questions;
        this.totalTime = totalTime;
        this.questionTime = questionTime;
        this.onEnd = onEnd;
        this.stageName = stageName;

        this.currentQuestionIndex = 0;
        this.answeredPlayers = [];
        this.gameTimer = null;
        this.questionTimer = null;

        // 紐づけ
        players.forEach(p => {
            p.currentGame = this;
            p.answered = false;
            p.ready = false;
        });

        // ステージ名送信
        if (this.stageName) {
            this.broadcast({ type: 'stage', name: this.stageName, stage: this.stage });
        }

        this.startGameTimer();
        this.sendNextQuestion();
    }

    // 共通送信メソッド
    broadcast(data) {
        this.players.forEach(p => {
            try {
                p.ws.send(JSON.stringify(data));
            } catch (e) {
                console.error("送信エラー:", e);
            }
        });
    }

    startGameTimer() {
        let timeLeft = this.totalTime;
        this.gameTimer = setInterval(() => {
            timeLeft--;
            this.broadcast({ type: 'gameTimer', timeLeft });
            if (timeLeft <= 0) {
                clearInterval(this.gameTimer);
                this.endGame();
            }
        }, 1000);
    }

    sendNextQuestion() {
        if (this.currentQuestionIndex >= this.questions.length) {
            return this.endGame();
        }

        const q = this.questions[this.currentQuestionIndex];
        this.players.forEach(p => (p.answered = false));

        this.broadcast({
            type: 'question',
            question: q.question,
            index: this.currentQuestionIndex,
            timeLeft: this.questionTime
        });

        this.startQuestionTimer();
    }

    startQuestionTimer() {
        let qTime = this.questionTime;
        this.questionTimer = setInterval(() => {
            qTime--;
            this.broadcast({ type: 'questionTimer', timeLeft: qTime });
            if (qTime <= 0) {
                clearInterval(this.questionTimer);
                this.currentQuestionIndex++;
                setTimeout(() => this.sendNextQuestion(), 2000);
            }
        }, 1000);
    }

    handleAnswer(player, answer) {
        switch (this.stage) {
            case 1:
                this.handleStage1Answer(player, answer);
                break;
            case 2:
                this.handleStage2Answer(player, answer);
                break;
            case 3:
                this.handleStage3Answer(player, answer);
                break;
            case 4:
                this.handleStage4Answer(player, answer);
                break;
        }
    }

    handleStage1Answer(player, answer) {
        if (!player || player.answered) return;
        const correct = this.questions[this.currentQuestionIndex].correctAnswer;
        if (answer.trim().toUpperCase() === correct) {
            player.answered = true;
            this.answeredPlayers.push(player);
            player.ws.send(JSON.stringify({
                type: 'waiting',
                message: '次の問題をお待ちください...'
            }));
        }
    }

    handleStage2Answer(player, answer) {
        if (!player || player.answered) return;
        const q = this.questions[0];
        if (q.correctAnswers.includes(answer.trim())) {
            player.answered = true;
            this.answeredPlayers.push(player);
            player.ws.send(JSON.stringify({
                type: 'waiting',
                message: '回答完了しました'
            }));
        }
        if (this.answeredPlayers.length === this.players.length) {
            clearInterval(this.gameTimer);
            this.endGame();
        }
    }

    handleStage3Answer(player, answer) {
        if (!player || player.answered) return;
        const correct = this.questions[this.currentQuestionIndex].correctAnswer;
        if (answer.trim() === correct) {
            player.scoreStage3 += 30;
            player.ws.send(JSON.stringify({ type: 'score', score: player.scoreStage3 }));
            player.ws.send(JSON.stringify({
                type: 'waiting',
                message: '正解！次の問題を待ってください'
            }));
        } else {
            player.ws.send(JSON.stringify({
                type: 'waiting',
                message: '不正解！次の問題を待ってください'
            }));
        }
        player.answered = true;

        if (this.players.every(pl => pl.answered)) {
            clearInterval(this.questionTimer);
            this.currentQuestionIndex++;
            setTimeout(() => this.sendNextQuestion(), 2000);
        }
    }

    handleStage4Answer(player, answer) {
        if (answer === "CLEAR" && !player.answered) {
            player.scoreStage4 = 100;
            player.answered = true;
            clearInterval(this.gameTimer);
            this.endGame();
        }
    }

    endGame() {
        clearInterval(this.gameTimer);
        clearInterval(this.questionTimer);
        this.onEnd(this.players, this.answeredPlayers);
    }
}

// ======================
// WebSocket 接続
// ======================
wss.on('connection', (ws) => {
    console.log('新しいクライアント接続');

    players.push({
        ws,
        scoreStage1: 0,
        scoreStage2: 0,
        scoreStage3: 0,
        scoreStage4: 0,
        answered: false,
        stage: 1,
        ready: false,
        currentGame: null,
        clearedStage1: false,
        clearedStage2: false,
        clearedStage3: false
    });

    ws.on('message', (message) => {
        const msg = JSON.parse(message);
        const player = players.find(p => p.ws === ws);
        if (!player) return;

        if (msg.type === 'start') {
            player.ready = true;
            player.stage = msg.stage;

            if (msg.stage === 1) {
                const stagePlayers = players.filter(p => p.stage === 1);
                const readyCount = stagePlayers.filter(p => p.ready).length;
                if (readyCount === requiredPlayersStage1) {
                    new StageGame(1, stagePlayers, stage1Questions, 120, 20, endStage1, "かくれんぼ");
                } else {
                    ws.send(JSON.stringify({
                        type: 'waiting',
                        message: `第一ステージ: あと ${requiredPlayersStage1 - readyCount} 人を待っています...`
                    }));
                }
            }

            if (msg.stage === 2) {
                const clearedPlayers = players.filter(p => p.clearedStage1);
                const readyCount = clearedPlayers.filter(p => p.ready).length;
                if (!player.clearedStage1) {
                    ws.send(JSON.stringify({
                        type: 'waiting',
                        message: "あなたは第一ステージをクリアしていないため第二ステージに参加できません"
                    }));
                    return;
                }
                if (readyCount === requiredPlayersStage2) {
                    new StageGame(2, clearedPlayers, stage2Questions, 120, 120, endStage2, "絵しりとり");
                } else {
                    ws.send(JSON.stringify({
                        type: 'waiting',
                        message: `第二ステージ: あと ${requiredPlayersStage2 - readyCount} 人のクリア者を待っています...`
                    }));
                }
            }

            if (msg.stage === 3) {
                if (!player.clearedStage2) {
                    ws.send(JSON.stringify({
                        type: 'waiting',
                        message: "あなたは第二ステージをクリアしていないため第三ステージに参加できません"
                    }));
                    return;
                }
                new StageGame(3, [player], stage3Questions, 120, 40, endStage3, "イライラ本");
            }

            if (msg.stage === 4) {
                if (!player.clearedStage3) {
                    ws.send(JSON.stringify({
                        type: 'waiting',
                        message: "あなたは第三ステージをクリアしていないため第四ステージに参加できません"
                    }));
                    return;
                }
                new StageGame(4, [player], [{ question: "CLEARを押してください" }], 180, 180, endStage4, "絶棒");
            }
        }

        else if (msg.type === 'answer') {
            if (player.currentGame) {
                player.currentGame.handleAnswer(player, msg.answer);
            }
        }
    });

    ws.on('close', () => {
        players = players.filter(p => p.ws !== ws);
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'サーバー接続成功！' }));
});

// ======================
// 各ステージ終了処理
// ======================
function endStage1(stagePlayers, answeredPlayers) {
    const scores = [10, 7, 3, 1];
    answeredPlayers.forEach((p, i) => {
        p.scoreStage1 += scores[i] || 1;
        p.ws.send(JSON.stringify({ type: 'score', score: p.scoreStage1 }));
    });

    const sorted = [...stagePlayers].sort((a, b) => b.scoreStage1 - a.scoreStage1);
    if (sorted[0]) sorted[0].scoreStage1 += 50;
    for (let i = 1; i <= 2; i++) {
        if (sorted[i] && sorted[i].scoreStage1 < 41) sorted[i].scoreStage1 = 41;
    }

    stagePlayers.forEach(p => {
        let msg = `第一ステージ終了！最終スコア: ${p.scoreStage1}点`;
        if (p.scoreStage1 >= 41) {
            msg += "\n第一ステージクリア、Bに移動してください";
            p.clearedStage1 = true;
            p.ws.send(JSON.stringify({ type: 'unlockStage2' }));
        } else {
            msg += "\nクリアならず、速やかに退場してください";
        }
        p.ws.send(JSON.stringify({ type: 'end', message: msg }));
    });
}

function endStage2(stagePlayers, answeredPlayers) {
    if (answeredPlayers[0]) answeredPlayers[0].scoreStage2 = 100;
    if (answeredPlayers[1]) answeredPlayers[1].scoreStage2 = 80;
    if (answeredPlayers[2]) answeredPlayers[2].scoreStage2 = 60;

    stagePlayers.forEach(p => {
        if (!answeredPlayers.includes(p)) p.scoreStage2 = 0;
        let msg = `第二ステージ終了！スコア: ${p.scoreStage2}点`;
        if (p.scoreStage2 >= 100) {
            msg += "\n第二ステージクリア！第三ステージへ進めます";
            p.clearedStage2 = true;
            p.ws.send(JSON.stringify({ type: 'unlockStage3' }));
        } else {
            msg += "\nクリアならず";
        }
        p.ws.send(JSON.stringify({ type: 'end', message: msg }));
    });
}

function endStage3(stagePlayers) {
    stagePlayers.forEach(p => {
        let msg = `第三ステージ終了！スコア: ${p.scoreStage3 || 0}点`;
        if (p.scoreStage3 >= 80) {
            msg += "\n第三ステージクリア！第四ステージへ進めます";
            p.clearedStage3 = true;
            p.ws.send(JSON.stringify({ type: 'showClearButton' }));
        } else {
            msg += "\n残念ながら進出できません";
        }
        p.ws.send(JSON.stringify({ type: 'end', message: msg }));
    });
}

function endStage4(stagePlayers) {
    stagePlayers.forEach(p => {
        let msg = `第四ステージ終了！スコア: ${p.scoreStage4}点`;
        if (p.scoreStage4 >= 100) {
            msg += "\n絶棒クリア！おめでとう！";
        } else {
            msg += "\nクリアならず";
        }
        p.ws.send(JSON.stringify({ type: 'end', message: msg }));
    });
}

// ======================
// サーバー起動
// ======================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

     

