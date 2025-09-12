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

const stage3Questions = [
    { question: "「新」が乗っているページを答えてください", correctAnswer: "100" },
    { question: "「井」と「猿」が乗ってるページの値を和を答えてください", correctAnswer: "200" },
    { question: "「講」と「別」の乗ってるページの値の差をお答えください", correctAnswer: "300" },
];

const requiredPlayersStage1 = 4;
const requiredPlayersStage2 = 3;

// ======================
// WebSocket接続
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
        handleAnswer: null,
        clearedStage1: false,
        clearedStage2: false
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

                if (readyCount === requiredPlayersStage1) startStage1(stagePlayers);
                else ws.send(JSON.stringify({ type: 'waiting', message: `第一ステージ: あと ${requiredPlayersStage1 - readyCount} 人を待っています...` }));
            }

            if (msg.stage === 2) {
                const clearedPlayers = players.filter(p => p.clearedStage1);
                const readyCount = clearedPlayers.filter(p => p.ready).length;

                if (!player.clearedStage1) {
                    ws.send(JSON.stringify({ type: 'waiting', message: "あなたは第一ステージをクリアしていないため第二ステージに参加できません" }));
                    return;
                }

                if (readyCount === requiredPlayersStage2) startStage2(clearedPlayers);
                else ws.send(JSON.stringify({
                    type: 'waiting',
                    message: `第二ステージ: あと ${requiredPlayersStage2 - readyCount} 人のクリア者を待っています...`
                }));
            }

            if (msg.stage === 3) {
                if (!player.clearedStage2) {
                    ws.send(JSON.stringify({ type: 'waiting', message: "あなたは第二ステージをクリアしていないため第三ステージに参加できません" }));
                    return;
                }
                startStage3([player]); // 第三ステージは一人だけ
            }

            if (msg.stage === 4) {
                if (player.scoreStage3 < 80) {
                    ws.send(JSON.stringify({ type: 'waiting', message: "あなたは第三ステージをクリアしていないため第四ステージに参加できません" }));
                    return;
                }
                startStage4([player]);
            }

        } else if (msg.type === 'answer') {
            if (player.handleAnswer) player.handleAnswer(player, msg.answer, msg.stage, msg.index);
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

    stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'stage', name: 'かくれんぼ', stage: 1 })));

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
            stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'question', question: question.question, index: questionIndex, timeLeft: 20 })));

            // 回答処理
            stagePlayers.forEach(p => {
                p.handleAnswer = (player, answer, stage, index) => {
                    if (!player || player.answered || stage !== 1 || index !== questionIndex) return;
                    if (answer.trim().toUpperCase() === question.correctAnswer) {
                        player.answered = true;
                        answeredPlayers.push(player);
                        player.ws.send(JSON.stringify({ type: 'waiting', message: '次の問題をお待ちください...' }));
                    }

                    // 全員回答したら次の問題へ
                    if (stagePlayers.every(pl => pl.answered)) {
                        assignScoresStage1();
                        stagePlayers.forEach(p => p.answered = false);
                        questionIndex++;
                        setTimeout(sendNextQuestion, 1000);
                    }
                };
            });
        } else {
            endStage1(stagePlayers);
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
        if (p.scoreStage1 >= 41) {
            msg += "\n第一ステージクリア、Bに移動してください";
            p.clearedStage1 = true;
            p.ws.send(JSON.stringify({ type: 'unlockStage2' }));
        } else {
            msg += "\nクリアならず、速やかに退場してください";
            p.clearedStage1 = false;
        }
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

    stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'stage', name: '絵しりとり', stage: 2 })));
    stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'question', question: question.question, index: 0, timeLeft: 40 })));

    const gameTimer = setInterval(() => {
        timeLeft--;
        stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'gameTimer', timeLeft })));
        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            endStage2(stagePlayers, answeredPlayers);
        }
    }, 1000);

    stagePlayers.forEach(p => {
        p.handleAnswer = (player, answer, stage, index) => {
            if (!player || player.answered || stage !== 2) return;
            if (question.correctAnswers.includes(answer.trim())) {
                player.answered = true;
                answeredPlayers.push(player);
                player.ws.send(JSON.stringify({ type: 'waiting', message: '回答完了しました' }));
            }
            if (answeredPlayers.length === stagePlayers.length) {
                clearInterval(gameTimer);
                endStage2(stagePlayers, answeredPlayers);
            }
        };
    });
}

function endStage2(stagePlayers, answeredPlayers) {
    const sorted = [...answeredPlayers];
    if (sorted[0]) sorted[0].scoreStage2 = 100;
    if (sorted[1]) sorted[1].scoreStage2 = 80;
    if (sorted[2]) sorted[2].scoreStage2 = 60;

    stagePlayers.forEach(p => {
        if (!answeredPlayers.includes(p)) p.scoreStage2 = 0;
        let msg = `第二ステージ終了！スコア: ${p.scoreStage2}点`;
        if (p.scoreStage2 >= 100) {
            msg += "\n第二ステージクリア！第三ステージへ進めます";
            p.clearedStage2 = true;
            p.ws.send(JSON.stringify({ type: 'unlockStage3' }));
        } else {
            msg += "\nクリアならず";
            p.clearedStage2 = false;
        }
        p.ws.send(JSON.stringify({ type: 'end', message: msg }));
    });
}

// ======================
// 第三ステージ
// ======================
function startStage3(stagePlayers) {
    stagePlayers.forEach(p => { p.scoreStage3 = 0; p.answered = false; p.ready = false; });
    let questionIndex = 0;
    let timeLeft = 120;

    stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'stage', name: 'イライラ本', stage: 3 })));

    const gameTimer = setInterval(() => {
        timeLeft--;
        stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'gameTimer', timeLeft })));
        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            endStage3(stagePlayers);
        }
    }, 1000);

    function sendNextQuestion() {
        if (questionIndex < stage3Questions.length) {
            const q = stage3Questions[questionIndex];
            stagePlayers.forEach(p => p.answered = false);
            stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'question', question: q.question, index: questionIndex, timeLeft: 40 })));

            stagePlayers.forEach(p => {
                p.handleAnswer = (player, answer, stage, index) => {
                    if (!player || player.answered || stage !== 3 || index !== questionIndex) return;

                    if (answer.trim() === q.correctAnswer) {
                        player.scoreStage3 += 30;
                        player.ws.send(JSON.stringify({ type: 'score', score: player.scoreStage3 }));
                        player.ws.send(JSON.stringify({ type: 'waiting', message: '正解！次の問題を待ってください' }));
                    } else {
                        player.ws.send(JSON.stringify({ type: 'waiting', message: '不正解！次の問題を待ってください' }));
                    }
                    player.answered = true;

                    if (stagePlayers.every(pl => pl.answered)) {
                        questionIndex++;
                        setTimeout(sendNextQuestion, 1000);
                    }
                };
            });

        } else {
            clearInterval(gameTimer);
            endStage3(stagePlayers);
        }
    }

    sendNextQuestion();
}

function endStage3(stagePlayers) {
    stagePlayers.forEach(p => {
        let msg = `第三ステージ終了！スコア: ${p.scoreStage3}点`;
        if (p.scoreStage3 >= 80) {
            msg += "\n第三ステージクリア！おめでとう！";
        } else {
            msg += "\nクリアならず";
        }
        p.ws.send(JSON.stringify({ type: 'end', message: msg }));
    });
}

// ======================
// 第四ステージ
// ======================
function startStage4(stagePlayers) {
    stagePlayers.forEach(p => { p.scoreStage4 = 0; p.ready = false; p.answered = false; });
    let timeLeft = 180;

    stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'stage', name: '絶棒', stage: 4 })));
    stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'showClearButton' })));

    const gameTimer = setInterval(() => {
        timeLeft--;
        stagePlayers.forEach(p => p.ws.send(JSON.stringify({ type: 'gameTimer', timeLeft })));
        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            endStage4(stagePlayers);
        }
    }, 1000);

    stagePlayers.forEach(p => {
        p.handleAnswer = (player, answer, stage, index) => {
            if (stage !== 4 || player.answered) return;
            if (answer === "CLEAR") {
                player.scoreStage4 += 100;
                player.answered = true;
                clearInterval(gameTimer);
                endStage4(stagePlayers);
            }
        };
    });
}

function endStage4(stagePlayers) {
    stagePlayers.forEach(p => {
        let msg = `第四ステージ終了！スコア: ${p.scoreStage4}点`;
        if (p.scoreStage4 >= 100) msg += "\n第四ステージクリア！おめでとう！";
        else msg += "\nクリアならず";
        p.ws.send(JSON.stringify({ type: 'end', message: msg }));
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
