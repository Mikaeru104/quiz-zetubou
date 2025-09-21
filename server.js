const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app); // HTTPサーバー
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname)));

// =====================
// プレイヤー・ステージデータ
// =====================
let players = [];
let stage1Sessions = [];
let stage2Sessions = [];
let stage3Sessions = [];
let stage4Sessions = [];

const stage1Questions = [
    { question: "104", correctAnswer: "T" },
    { question: "374", correctAnswer: "B" },
    { question: "638", correctAnswer: "Z" },
    { question: "946", correctAnswer: "S" },
    { question: "233", correctAnswer: "W" },
    { question: "578", correctAnswer: "G" },
    { question: "482", correctAnswer: "K" },
    { question: "037", correctAnswer: "M" },
    { question: "915", correctAnswer: "R" },
    { question: "624", correctAnswer: "N" },
    { question: "308", correctAnswer: "F" },
    { question: "771", correctAnswer: "Z" },
    { question: "459", correctAnswer: "Q" },
    { question: "186", correctAnswer: "C" },
    { question: "520", correctAnswer: "L" },
    { question: "893", correctAnswer: "E" },
    { question: "244", correctAnswer: "X" },
    { question: "639", correctAnswer: "H" },
    { question: "052", correctAnswer: "J" },
    { question: "707", correctAnswer: "P" },
];

const stage2Questions = [
    { question: "四桁を教えてください", correctAnswers: ["4768", "3229", "5610"] }
];

const stage3QuestionsTemplate = [
    { question: "「新」が乗っているページを答えてください", correctAnswer: "596" },
    { question: "「井」と「猿」が乗ってるページの値を和を答えてください", correctAnswer: "905" },
    { question: "「講」と「別」の乗ってるページの値の差をお答えください", correctAnswer: "1138" },
    { question: "「左」と「冬」の乗ってるページの値の和をお答えください", correctAnswer: "539" },
    { question: "「近」と「汁」の乗ってるページの値の差をお答えください", correctAnswer: "614" },
    { question: "「焦」と「扱」の乗ってるページの値の差をお答えください", correctAnswer: "299" },
    { question: "「荷」と「安」の乗ってるページの値の和をお答えください", correctAnswer: "1505" },
];

// =====================
// ユーティリティ
// =====================
let nextId = 1;
function createPlayer(ws) {
    return {
        ws,
        id: nextId++,
        stage: 1,
        ready: false,
        answered: false,
        scoreStage1: 0,
        scoreStage2: 0,
        scoreStage3: 0,
        scoreStage4: 0,
        clearedStage1: false,
        clearedStage2: false,
        clearedStage3: false,
        handleAnswer: null
    };
}

function removePlayerFromAllSessions(player) {
    const allSessions = [stage1Sessions, stage2Sessions, stage3Sessions, stage4Sessions];
    allSessions.forEach(sessions => {
        sessions.forEach(session => {
            session.players = session.players.filter(p => p !== player);
            if (session.players.length === 0) {
                if (session.gameTimer) clearInterval(session.gameTimer);
                if (session.questionTimer) clearInterval(session.questionTimer);
                if (session.timer) clearInterval(session.timer);
                if (session.gTimer) clearInterval(session.gTimer);
            }
        });
    });
    stage1Sessions = stage1Sessions.filter(s => s.players.length > 0);
    stage2Sessions = stage2Sessions.filter(s => s.players.length > 0);
    stage3Sessions = stage3Sessions.filter(s => s.players.length > 0);
    stage4Sessions = stage4Sessions.filter(s => s.players.length > 0);
}

// =====================
// WebSocket接続処理
// =====================
wss.on('connection', (ws) => {
    console.log('✅ Client connected via WSS');
    const player = createPlayer(ws);
    players.push(player);

    ws.on('message', (message) => {
        let msg;
        try { msg = JSON.parse(message); } catch { return; }

        if (msg.type === 'start') {
            player.ready = true;
            player.stage = msg.stage || 1;

            if (msg.stage === 1) {
                const candidates = players.filter(p => p.stage === 1 && p.ready);
                if (candidates.length >= 4) startStage1(candidates.slice(0, 4));
                else ws.send(JSON.stringify({ type:'waiting', message:`第一ステージ: あと ${4-candidates.length} 人待ち` }));
            }
            if (msg.stage === 2) {
                if (!player.clearedStage1) { ws.send(JSON.stringify({type:'waiting',message:"第一ステージ未クリア"})); player.ready=false; return; }
                startStage2([player]);
            }
            if (msg.stage === 3) {
                if (!player.clearedStage2) { ws.send(JSON.stringify({type:'waiting',message:"第二ステージ未クリア"})); player.ready=false; return; }
                startStage3([player]);
            }
            if (msg.stage === 4) {
                if (!player.clearedStage3) { ws.send(JSON.stringify({type:'waiting',message:"第三ステージ未クリア"})); player.ready=false; return; }
                startStage4([player]);
            }
        }

        if (msg.type === 'answer') {
            if (player.handleAnswer) player.handleAnswer(player, msg.answer, msg.index);
            else ws.send(JSON.stringify({type:'waiting',message:'現在回答不可'}));
        }
    });

    ws.on('close', () => {
        console.log('❌ Client disconnected:', player.id);
        players = players.filter(p => p !== player);
        removePlayerFromAllSessions(player);
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'サーバー接続成功！' }));
});

// =====================
// 以下、第一～第四ステージの既存処理
// startStage1, endStage1, startStage2, endStage2, startStage3, endStage3, startStage4, endStage4
// 第三ステージは 1問目固定 + 2問目以降ランダム
// 回答時の加点も正しく反映
// =====================

// ※既存コードをここに貼り付け（以前提示された修正版を丸ごと使えます）



// ==================================================
// 第一ステージ（かくれんぼ）
// ==================================================
function startStage1(sessionPlayers) {
    // ★問題をシャッフルしてコピー
    const shuffledQuestions = [...stage1Questions].sort(() => Math.random() - 0.5);

    // セッションオブジェクト
    const session = {
        players: sessionPlayers,
        questionIndex: 0,
        answeredPlayers: [],
        timeLeft: 120,
        gameTimer: null,
        questionTimer: null,
        questions: shuffledQuestions   // ← コピーを保存
    };
    stage1Sessions.push(session);

    // 初期化
    session.players.forEach(p => {
        p.scoreStage1 = 0;
        p.answered = false;
        p.ready = false;
        p.handleAnswer = null;
    });

    // ゲームタイマー
    session.gameTimer = setInterval(() => {
        session.timeLeft--;
        session.players.forEach(p =>
            p.ws.send(JSON.stringify({ type: 'gameTimer', timeLeft: session.timeLeft }))
        );
        if (session.timeLeft <= 0) {
            clearInterval(session.gameTimer);
            if (session.questionTimer) clearInterval(session.questionTimer);
            endStage1(session);
        }
    }, 1000);

    // 問題を送信
    function sendNextQuestion() {
        // ★制限時間切れなら問題を送らない
        if (session.timeLeft <= 0) return;

        if (session.questionIndex < session.questions.length) {
            const q = session.questions[session.questionIndex];
            // 各プレイヤーに問題を送る
            session.players.forEach(p => {
                p.answered = false;
                p.ws.send(JSON.stringify({
                    type: 'question',
                    question: q.question,
                    stageName: "かくれんぼ"
                }));
            });
            startQuestionTimer();
        } else {
            // 問題終了
            clearInterval(session.gameTimer);
            if (session.questionTimer) clearInterval(session.questionTimer);
            endStage1(session);
        }
    }

    // 問題タイマー
    function startQuestionTimer() {
        let qTime = 20;
        if (session.questionTimer) clearInterval(session.questionTimer);

        session.questionTimer = setInterval(() => {
            qTime--;
            session.players.forEach(p =>
                p.ws.send(JSON.stringify({ type: 'questionTimer', timeLeft: qTime }))
            );

            if (qTime <= 0) {
                clearInterval(session.questionTimer);
                assignScoresStage1();
                session.players.forEach(p => p.answered = false);
                session.answeredPlayers = [];
                session.questionIndex++;

                // ★制限時間切れチェックを追加
                if (session.timeLeft > 0) {
                    setTimeout(() => {
                        if (session.timeLeft > 0) sendNextQuestion();
                    }, 2000);
                }
            }
        }, 1000);

        // 回答ハンドラ
        session.players.forEach(p => {
            p.handleAnswer = (player, answer) => {
                if (!player || player.answered) return;
                const correct = session.questions[session.questionIndex].correctAnswer;
                if (answer && answer.trim().toUpperCase() === correct) {
                    player.answered = true;
                    session.answeredPlayers.push(player);
                    player.ws.send(JSON.stringify({
                        type: 'waiting',
                        message: '正解、次の問題をお待ちください...'
                    }));
                } else {
                    player.answered = true;
                    player.ws.send(JSON.stringify({
                        type: 'waiting',
                        message: '不正解、次の問題をお待ちください...'
                    }));
                }

                // 全員回答済みなら次へ
                if (session.players.every(pl => pl.answered)) {
                    clearInterval(session.questionTimer);
                    assignScoresStage1();
                    session.players.forEach(pl => pl.answered = false);
                    session.answeredPlayers = [];
                    session.questionIndex++;

                    // ★制限時間切れチェックを追加
                    if (session.timeLeft > 0) {
                        setTimeout(() => {
                            if (session.timeLeft > 0) sendNextQuestion();
                        }, 1000);
                    }
                }
            };
        });
    }

    // 得点処理
    function assignScoresStage1() {
        const scores = [10, 7, 3, 1];
        for (let i = 0; i < session.answeredPlayers.length; i++) {
            const p = session.answeredPlayers[i];
            const score = scores[i] || 1;
            p.scoreStage1 += score;
            p.ws.send(JSON.stringify({ type: 'score', score: p.scoreStage1 }));
        }
    }

    // セッション開始
    sendNextQuestion();
}



function endStage1(session) {
    // 最終順位付け
    const sorted = [...session.players].sort((a, b) => b.scoreStage1 - a.scoreStage1);

    if (sorted[0]) sorted[0].scoreStage1 += 50;

    for (let i = 1; i <= 2; i++) {
        if (sorted[i] && sorted[i].scoreStage1 < 41) sorted[i].scoreStage1 = 41;
    }

    session.players.forEach(p => {
        let msg = `第一ステージ終了！最終スコア: ${p.scoreStage1}点`;
        if (p.scoreStage1 >= 41) {
            msg += "\n第一ステージクリア、Bに移動してください";
            p.clearedStage1 = true;
            // クライアント側に第二ステージボタン解放シグナル（個別）
            p.ws.send(JSON.stringify({ type: 'unlockStage2' }));
        } else {
            msg += "\nクリアならず、速やかに退場してください";
            p.clearedStage1 = false;
        }
        p.ws.send(JSON.stringify({ type: 'end', message: msg }));
        // セッションからハンドラを外す
        p.handleAnswer = null;
    });

    // セッションのクリーンアップ
    if (session.gameTimer) clearInterval(session.gameTimer);
    if (session.questionTimer) clearInterval(session.questionTimer);
    stage1Sessions = stage1Sessions.filter(s => s !== session);
}


// ==================================================
// 第二ステージ（複数同時セッション対応）
// ==================================================
function startStage2(stagePlayers) {
    const session = {
        players: stagePlayers,
        answeredPlayers: [],
        timeLeft: 120,
        timer: null
    };
    stage2Sessions.push(session);

    // 初期化
    session.players.forEach(p => {
        p.scoreStage2 = 0;
        p.answered = false;
        p.ready = false;
        p.handleAnswer = null;
    });

    const question = stage2Questions[0];

    session.players.forEach(p => {
        p.ws.send(JSON.stringify({ type: 'stage', name: '絵しりとり', stage: 2 }));
        p.ws.send(JSON.stringify({ type: 'question', question: question.question }));
    });

    // タイマー
    session.timer = setInterval(() => {
        session.timeLeft--;
        session.players.forEach(p => p.ws.send(JSON.stringify({ type: 'gameTimer', timeLeft: session.timeLeft })));
        if (session.timeLeft <= 0) {
            clearInterval(session.timer);
            endStage2(session);
        }
    }, 1000);

    // 回答ハンドラ
    session.players.forEach(p => {
        p.handleAnswer = (player, answer) => {
            if (!player || player.answered) return;
            if (!answer) return;
            if (question.correctAnswers.includes(answer.trim())) {
                player.answered = true;
                session.answeredPlayers.push(player);
                player.ws.send(JSON.stringify({ type: 'waiting', message: '回答完了しました' }));
            } else {
                // 不正解でも回答済み扱いにする場合はここで player.answered = true;
                player.answered = true;
                player.ws.send(JSON.stringify({ type: 'waiting', message: '不正解ですが回答登録しました' }));
            }

            if (session.answeredPlayers.length === session.players.length) {
                clearInterval(session.timer);
                endStage2(session);
            }
        };
    });
}

function endStage2(session) {
    // 優先回答者順にスコア割り当て
    const sorted = [...session.answeredPlayers];

    if (sorted[0]) sorted[0].scoreStage2 = 100;
    if (sorted[1]) sorted[1].scoreStage2 = 80;
    if (sorted[2]) sorted[2].scoreStage2 = 60;

    session.players.forEach(p => {
        if (!session.answeredPlayers.includes(p)) p.scoreStage2 = 0;
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
        p.handleAnswer = null;
    });

    if (session.timer) clearInterval(session.timer);
    stage2Sessions = stage2Sessions.filter(s => s !== session);
}


// ==================================================
// 第三ステージ（セッション化。複数可能）
// ==================================================
function startStage3(stagePlayers) {
    // コピーした質問配列をセッション内で使う（安全）
    const copied = JSON.parse(JSON.stringify(stage3QuestionsTemplate));

    // 1問目は固定
    const firstQuestion = copied[0];
    // 残りをシャッフル
    const restQuestions = copied.slice(1);
    for (let i = restQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [restQuestions[i], restQuestions[j]] = [restQuestions[j], restQuestions[i]];
    }
    // 新しい配列：1問目 + ランダム残り
    const stage3Questions = [firstQuestion, ...restQuestions];

    // セッション作成
    const session = {
        players: stagePlayers,
        questionIndex: 0,
        timeLeft: 150,
        gameTimer: null,
        questionTimer: null
    };
    stage3Sessions.push(session);

    // プレイヤー初期化
    session.players.forEach(p => {
        p.scoreStage3 = 0;
        p.answered = false;
        p.ready = false;
        p.handleAnswer = null;
    });

    // ステージ名送信
    session.players.forEach(p =>
        p.ws.send(JSON.stringify({ type: 'stage', name: 'イライラ本', stage: 3 }))
    );

    // 全体タイマー
    session.gameTimer = setInterval(() => {
        session.timeLeft--;
        session.players.forEach(p =>
            p.ws.send(JSON.stringify({ type: 'gameTimer', timeLeft: session.timeLeft }))
        );
        if (session.timeLeft <= 0) {
            if (session.questionTimer) clearInterval(session.questionTimer);
            clearInterval(session.gameTimer);
            endStage3(session);
        }
    }, 1000);

    // 次の問題を送信
    function sendNextQuestion() {
        if (session.questionIndex < stage3Questions.length) {
            const qIndex = session.questionIndex; // ← この問題専用のインデックス
            const q = stage3Questions[qIndex];

            // 各問題ごとに回答状態リセット
            session.players.forEach(p => p.answered = false);

            // 問題送信
            session.players.forEach(p =>
                p.ws.send(JSON.stringify({
                    type: 'question',
                    question: q.question,
                    index: qIndex,
                    timeLeft: 50
                }))
            );

            startQuestionTimer(qIndex);
        } else {
            // 全問終了
            if (session.gameTimer) clearInterval(session.gameTimer);
            if (session.questionTimer) clearInterval(session.questionTimer);
            endStage3(session);
        }
    }

    // 問題ごとのタイマー
    function startQuestionTimer(qIndex) {
        let qTime = 50;
        if (session.questionTimer) clearInterval(session.questionTimer);

        session.questionTimer = setInterval(() => {
            qTime--;
            session.players.forEach(p =>
                p.ws.send(JSON.stringify({ type: 'questionTimer', timeLeft: qTime }))
            );
            if (qTime <= 0) {
                clearInterval(session.questionTimer);
                session.questionIndex++;
                setTimeout(sendNextQuestion, 2000);
            }
        }, 1000);

        // 回答ハンドラを設定（この問題専用）
        session.players.forEach(p => {
            p.handleAnswer = (player, answer) => {
                if (!player || player.answered) return;

                const correct = stage3Questions[qIndex].correctAnswer; // ← 固定インデックスで判定
                if (answer && answer.trim() === correct) {
                    player.scoreStage3 += 30;
                    player.ws.send(JSON.stringify({
                        type: 'score',
                        score: player.scoreStage3
                    }));
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

                // 全員が答えたら次へ
                if (session.players.every(pl => pl.answered)) {
                    clearInterval(session.questionTimer);
                    session.questionIndex++;
                    setTimeout(sendNextQuestion, 1000);
                }
            };
        });
    }

    // 開始
    sendNextQuestion();
}

function endStage3(session) {
    session.players.forEach(p => {
        let msg = `第三ステージ終了！スコア: ${p.scoreStage3 || 0}点`;
        if (p.scoreStage3 >= 80) {
            msg += "\n第三ステージクリア！第四ステージへ進めます";
            p.clearedStage3 = true;
            // クライアントに第四ステージ（クリアボタン）表示シグナルを送る
            p.ws.send(JSON.stringify({ type: 'showClearButton' }));
        } else {
            msg += "\n残念ながら進出できません";
            p.clearedStage3 = false;
        }
        p.ws.send(JSON.stringify({ type: 'end', message: msg }));
        p.handleAnswer = null;
    });

    if (session.gameTimer) clearInterval(session.gameTimer);
    if (session.questionTimer) clearInterval(session.questionTimer);
    stage3Sessions = stage3Sessions.filter(s => s !== session);
}


// ==================================================
// 第四ステージ（個別セッション）
// ==================================================
function startStage4(stagePlayers) {
    // 1プレイヤーずつを想定して作る（ただし配列受け取り）
    const session = {
        players: stagePlayers,
        timeLeft: 150,
        gTimer: null
    };
    stage4Sessions.push(session);

    session.players.forEach(p => {
        p.scoreStage4 = 0;
        p.answered = false;
        p.ready = false;
        p.handleAnswer = null;
    });

    // タイマー
    session.gTimer = setInterval(() => {
        session.timeLeft--;
        session.players.forEach(p => p.ws.send(JSON.stringify({ type: 'gameTimer', timeLeft: session.timeLeft })));
        if (session.timeLeft <= 0) {
            clearInterval(session.gTimer);
            endStage4(session);
        }
    }, 1000);

    // 回答ハンドラ: "CLEAR" を受け取れば即終了
    session.players.forEach(p => {
        p.handleAnswer = (plr, answer) => {
            if (plr.answered) return;
            if (answer === "CLEAR") {
                plr.scoreStage4 = 100;
                plr.answered = true;
                // 終了処理
                if (session.gTimer) clearInterval(session.gTimer);
                endStage4(session);
            } else {
                // それ以外は特に扱わないが、通知は可能
                plr.ws.send(JSON.stringify({ type: 'waiting', message: '正しい文字列を入力してください' }));
            }
        };
    });
}

function endStage4(session) {
    session.players.forEach(p => {
        let msg = `第四ステージ終了！スコア: ${p.scoreStage4}点`;
        if (p.scoreStage4 >= 100) {
            msg += "\n絶棒クリア！おめでとう！";
        } else {
            msg += "\nクリアならず";
        }
        p.ws.send(JSON.stringify({ type: 'end', message: msg }));
        p.handleAnswer = null;
    });

    if (session.gTimer) clearInterval(session.gTimer);
    stage4Sessions = stage4Sessions.filter(s => s !== session);
}


// ==================================================
// サーバー起動
// ==================================================
const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 Server running at https://localhost:${PORT}`));

