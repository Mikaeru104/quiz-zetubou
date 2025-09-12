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
    { question: "四桁を教えてください", correctAnswers: ["4768","3229","5610"] }
];

const stage3Questions = [
    { question:"「新」が乗っているページを答えてください", correctAnswer:"100"},
    { question:"「井」と「猿」が乗ってるページの値を和を答えてください", correctAnswer:"200"},
    { question:"「講」と「別」の乗ってるページの値の差をお答えください", correctAnswer:"300"}
];

const requiredPlayersStage1 = 4;
const requiredPlayersStage2 = 3;

wss.on('connection', ws => {
    players.push({
        ws, scoreStage1:0, scoreStage2:0, scoreStage3:0, scoreStage4:0,
        answered:false, stage:1, ready:false,
        handleAnswer:null, clearedStage1:false, clearedStage2:false
    });
    ws.send(JSON.stringify({type:'connected', message:'サーバー接続成功！'}));

    ws.on('message', message => {
        const msg = JSON.parse(message);
        const player = players.find(p => p.ws === ws);
        if(!player) return;

        if(msg.type === 'start'){
            player.ready = true;
            player.stage = msg.stage;

            if(msg.stage === 1){
                const stagePlayers = players.filter(p => p.stage === 1);
                const readyCount = stagePlayers.filter(p => p.ready).length;
                if(readyCount === requiredPlayersStage1) startStage1(stagePlayers);
                else ws.send(JSON.stringify({type:'waiting', message:`第一ステージ: あと ${requiredPlayersStage1-readyCount} 人を待っています...`}));
            }

            if(msg.stage === 2){
                if(!player.clearedStage1){
                    ws.send(JSON.stringify({type:'waiting', message:"第一ステージ未クリアのため参加不可"}));
                    return;
                }
                const clearedPlayers = players.filter(p=>p.clearedStage1);
                startStage2(clearedPlayers);
            }

            if(msg.stage === 3){
                if(!player.clearedStage2){
                    ws.send(JSON.stringify({type:'waiting', message:"第二ステージ未クリアのため参加不可"}));
                    return;
                }
                startStage3([player]);
            }

            if(msg.stage === 4){
                startStage4([player]);
            }
        }

        if(msg.type === 'answer'){
            if(player.handleAnswer) player.handleAnswer(player, msg.answer);
        }
    });

    ws.on('close', ()=>{ players = players.filter(p=>p.ws!==ws); });
});

// ======================
// 第一ステージ（修正版）
// ======================
function startStage1(stagePlayers){
    stagePlayers.forEach(p=>{ p.scoreStage1=0; p.answered=false; p.ready=false; });
    let questionIndex = 0;
    let answeredPlayers = [];
    let stageTimeLeft = 120; // ステージ全体制限時間

    const stageTimer = setInterval(()=>{
        stageTimeLeft--;
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({type:'gameTimer', timeLeft: stageTimeLeft})));
        if(stageTimeLeft <= 0){
            clearInterval(stageTimer);
            endStage1(stagePlayers);
        }
    }, 1000);

    function sendNextQuestion(){
        if(questionIndex < stage1Questions.length){
            const question = stage1Questions[questionIndex];
            stagePlayers.forEach(p=>{
                p.ws.send(JSON.stringify({
                    type:'question',
                    question: question.question,
                    index: questionIndex,
                    timeLeft: 20
                }));
                p.ws.send(JSON.stringify({type:'waiting', message:''}));
            });

            let qTime = 20;
            const qTimer = setInterval(()=>{
                qTime--;
                stagePlayers.forEach(p=>p.ws.send(JSON.stringify({type:'questionTimer', timeLeft:qTime})));
                if(qTime <= 0){
                    clearInterval(qTimer);
                    assignScores();
                    answeredPlayers = [];
                    questionIndex++;
                    setTimeout(sendNextQuestion, 1000);
                }
            }, 1000);

            stagePlayers.forEach(p=>{
                p.handleAnswer = (plr, answer)=>{
                    if(!plr || plr.answered) return;
                    if(answer.trim().toUpperCase() === question.correctAnswer){
                        plr.answered = true;
                        answeredPlayers.push(plr);
                        plr.ws.send(JSON.stringify({type:'waiting', message:'次の問題を待ってください...'}));
                    }
                };
            });

        } else {
            clearInterval(stageTimer);
            endStage1(stagePlayers);
        }
    }

    function assignScores(){
        const scores=[10,7,3,1];
        for(let i=0;i<answeredPlayers.length;i++){
            let s=scores[i]||1;
            answeredPlayers[i].scoreStage1 += s;
            answeredPlayers[i].ws.send(JSON.stringify({type:'score', score: answeredPlayers[i].scoreStage1}));
        }
    }

    sendNextQuestion();
}

function endStage1(stagePlayers){
    const sorted = [...stagePlayers].sort((a,b)=>b.scoreStage1 - a.scoreStage1);
    if(sorted[0]) sorted[0].scoreStage1+=50;
    for(let i=1;i<=2;i++){ if(sorted[i]&&sorted[i].scoreStage1<41) sorted[i].scoreStage1=41; }

    stagePlayers.forEach(p=>{
        let msg = `第一ステージ終了！スコア: ${p.scoreStage1}点`;
        if(p.scoreStage1 >= 41){ msg += "\n第一ステージクリア"; p.clearedStage1 = true; p.ws.send(JSON.stringify({type:'unlockStage2'})); }
        else{ msg += "\nクリアならず"; p.clearedStage1 = false; }
        p.ws.send(JSON.stringify({type:'end', message:msg}));
    });
}

// ======================
// 第二ステージ（修正版）
// ======================
function startStage2(stagePlayers){
    stagePlayers.forEach(p=>{ 
        p.scoreStage2=0; p.answered=false; p.ready=false; 
        p.ws.send(JSON.stringify({type:'waiting', message:''}));
    });

    const question = stage2Questions[0];
    let answeredPlayers=[];

    stagePlayers.forEach(p=>{
        p.ws.send(JSON.stringify({type:'stage', name:'絵しりとり', stage:2}));
        p.ws.send(JSON.stringify({type:'question', question: question.question}));
    });

    let timeLeft = 120;
    const gTimer=setInterval(()=>{
        timeLeft--;
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({type:'gameTimer', timeLeft})));
        if(timeLeft <= 0){
            clearInterval(gTimer);
            endStage2(stagePlayers, answeredPlayers);
        }
    },1000);

    stagePlayers.forEach(p=>{
        p.handleAnswer = (plr, answer)=>{
            if(!plr || plr.answered) return;
            if(question.correctAnswers.includes(answer.trim())){
                plr.answered = true;
                answeredPlayers.push(plr);
                plr.ws.send(JSON.stringify({type:'waiting', message:'回答完了'}));
            }
            if(answeredPlayers.length === stagePlayers.length){
                clearInterval(gTimer);
                endStage2(stagePlayers, answeredPlayers);
            }
        };
    });
}

function endStage2(stagePlayers, answeredPlayers){
    const sorted = [...answeredPlayers];
    if(sorted[0]) sorted[0].scoreStage2=100;
    if(sorted[1]) sorted[1].scoreStage2=80;
    if(sorted[2]) sorted[2].scoreStage2=60;

    stagePlayers.forEach(p=>{
        if(!answeredPlayers.includes(p)) p.scoreStage2=0;
        let msg = `第二ステージ終了！スコア: ${p.scoreStage2}点`;
        if(p.scoreStage2>=100){ msg+="\n第二ステージクリア！"; p.clearedStage2=true; p.ws.send(JSON.stringify({type:'unlockStage3'})); }
        else{ msg+="\nクリアならず"; p.clearedStage2=false; }
        p.ws.send(JSON.stringify({type:'end', message:msg}));
    });
}

// ======================
// 第三ステージ（修正版）
// ======================
function startStage3(stagePlayers){
    stagePlayers.forEach(p=>{ p.scoreStage3=0; p.answered=false; p.ready=false; });

    let questionIndex=0;
    const questions=stage3Questions;

    stagePlayers.forEach(p=>p.ws.send(JSON.stringify({type:'stage', name:'イライラ本', stage:3})));
    stagePlayers.forEach(p=>p.ws.send(JSON.stringify({type:'waiting', message:''})));

    let stageTimeLeft = 120;
    const stageTimer = setInterval(()=>{
        stageTimeLeft--;
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({type:'gameTimer', timeLeft: stageTimeLeft})));
        if(stageTimeLeft <=0){
            clearInterval(stageTimer);
            endStage3(stagePlayers);
        }
    },1000);

    function sendNextQuestion(){
        if(questionIndex < questions.length){
            const q = questions[questionIndex];
            stagePlayers.forEach(p=>p.answered=false);
            stagePlayers.forEach(p=>p.ws.send(JSON.stringify({type:'question', question:q.question, index:questionIndex, timeLeft:40})));

            let qTime=40;
            const qTimer=setInterval(()=>{
                qTime--;
                stagePlayers.forEach(p=>p.ws.send(JSON.stringify({type:'questionTimer', timeLeft:qTime})));
                if(qTime<=0){
                    clearInterval(qTimer);
                    questionIndex++;
                    setTimeout(sendNextQuestion,1000);
                }
            },1000);

            stagePlayers.forEach(p=>{
                p.handleAnswer = (plr, answer)=>{
                    if(!plr || plr.answered) return;
                    if(answer.trim()===q.correctAnswer){
                        plr.scoreStage3 +=30;
                        plr.ws.send(JSON.stringify({type:'score', score:plr.scoreStage3}));
                        plr.ws.send(JSON.stringify({type:'waiting', message:'正解'}));
                    } else {
                        plr.ws.send(JSON.stringify({type:'waiting', message:'不正解'}));
                    }
                    plr.answered=true;
                    if(stagePlayers.every(pl=>pl.answered)){
                        clearInterval(qTimer);
                        questionIndex++;
                        setTimeout(sendNextQuestion,1000);
                    }
                };
            });
        } else {
            clearInterval(stageTimer);
            endStage3(stagePlayers);
        }
    }

    sendNextQuestion();
}

function endStage3(stagePlayers){
    stagePlayers.forEach(p=>{
        let msg=`第三ステージ終了！スコア: ${p.scoreStage3}点`;
        if(p.scoreStage3>=80){ msg+="\n第三ステージクリア！"; p.ws.send(JSON.stringify({type:'unlockStage4'})); }
        else{ msg+="\nクリアならず"; }
        p.ws.send(JSON.stringify({type:'end', message:msg}));
    });
}

// ======================
// 第四ステージ（元コード）
// ======================
function startStage4(stagePlayers){
    stagePlayers.forEach(p=>{
        p.scoreStage4=0; p.answered=false; p.ready=false;
        p.ws.send(JSON.stringify({type:'showClearButton'}));
    });

    let timeLeft=180;
    const gTimer=setInterval(()=>{
        timeLeft--;
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({type:'gameTimer', timeLeft})));
        if(timeLeft<=0){
            clearInterval(gTimer);
            endStage4(stagePlayers);
        }
    },1000);

    stagePlayers.forEach(p=>{
        p.handleAnswer=(plr, answer)=>{
            if(answer==="CLEAR" && !plr.answered){
                plr.scoreStage4=100;
                plr.answered=true;
                clearInterval(gTimer);
                endStage4(stagePlayers);
            }
        };
    });
}

function endStage4(stagePlayers){
    stagePlayers.forEach(p=>{
        let msg=`第四ステージ終了！スコア: ${p.scoreStage4}点`;
        if(p.scoreStage4>=100) msg+="\n第四ステージクリア！おめでとう！";
        else msg+="\nクリアならず";
        p.ws.send(JSON.stringify({type:'end', message:msg}));
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));

