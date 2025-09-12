const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname)));

let players = [];

const requiredPlayersStage1 = 4; // 第一ステージ開始に必要な人数
const requiredPlayersStage2 = 3; // 第二ステージ開始に必要な人数

// 質問データ
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
    { question: "「新」が乗っているページを答えてください", correctAnswer: "100" },
    { question: "「井」と「猿」が乗ってるページの値を和を答えてください", correctAnswer: "200" },
    { question: "「講」と「別」の乗ってるページの値の差をお答えください", correctAnswer: "300" },
];

// WebSocket接続
wss.on('connection', ws=>{
    console.log('クライアント接続');
    players.push({
        ws,
        stage: 1,
        answered: false,
        scoreStage1: 0,
        scoreStage2: 0,
        scoreStage3: 0,
        scoreStage4: 0,
        clearedStage1: false,
        clearedStage2: false,
        ready: false,
        handleAnswer: null
    });

    ws.on('message', msg=>{
        const data = JSON.parse(msg);
        const player = players.find(p=>p.ws===ws);
        if(!player) return;

        // スタートボタン押下
        if(data.type==='start'){
            player.stage = data.stage;
            player.ready = true;

            if(data.stage===1){
                const stagePlayers = players.filter(p=>p.stage===1);
                const readyCount = stagePlayers.filter(p=>p.ready).length;

                if(readyCount === requiredPlayersStage1){
                    // 人数揃ったら第一ステージ開始
                    stagePlayers.forEach(p=>p.ready=false);
                    startStage1(stagePlayers);
                } else {
                    // 待機中表示（端末には不要なので空文字）
                    ws.send(JSON.stringify({ type:'waiting', message:'' }));
                }
            }

            if(data.stage===2){
                if(!player.clearedStage1) return;
                const clearedPlayers = players.filter(p=>p.clearedStage1);
                const readyCount = clearedPlayers.filter(p=>p.ready).length;

                if(readyCount === requiredPlayersStage2){
                    clearedPlayers.forEach(p=>p.ready=false);
                    startStage2(clearedPlayers);
                } else {
                    ws.send(JSON.stringify({ type:'waiting', message:'' }));
                }
            }

            if(data.stage===3){
                if(!player.clearedStage2) return;
                startStage3([player]);
            }

            if(data.stage===4){
                startStage4([player]);
            }
        }

        // 回答
        if(data.type==='answer'){
            if(player.handleAnswer) player.handleAnswer(player, data.answer);
        }
    });

    ws.on('close', ()=>{ players = players.filter(p=>p.ws!==ws); });

    ws.send(JSON.stringify({ type:'connected', message:'サーバー接続成功！' }));
});

// 第一ステージ（以前の人数待機ロジックを活かした形）
function startStage1(stagePlayers){
    stagePlayers.forEach(p=>{ p.scoreStage1=0; p.answered=false; });
    let index=0;
    let timeLeft=120;

    stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'stage', name:'第一ステージ', stage:1 })));

    const gameTimer=setInterval(()=>{
        timeLeft--;
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'gameTimer', timeLeft })));
        if(timeLeft<=0){ clearInterval(gameTimer); endStage1(stagePlayers); }
    },1000);

    function sendNext(){
        if(index>=stage1Questions.length){ clearInterval(gameTimer); endStage1(stagePlayers); return; }
        const q = stage1Questions[index];
        stagePlayers.forEach(p=>{ p.answered=false; p.ws.send(JSON.stringify({ type:'question', question:q.question, index, timeLeft:20 })); });

        let qTime=20;
        const questionTimer=setInterval(()=>{
            qTime--;
            stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'questionTimer', timeLeft:qTime })));
            if(qTime<=0){ clearInterval(questionTimer); index++; sendNext(); }
        },1000);

        stagePlayers.forEach(p=>{
            p.handleAnswer=(pl, answer)=>{
                if(pl.answered) return;
                if(answer.trim().toUpperCase()===q.correctAnswer) pl.scoreStage1+=10;
                pl.answered=true;
                pl.ws.send(JSON.stringify({ type:'score', score:pl.scoreStage1 }));
                clearInterval(questionTimer); index++; sendNext();
            };
        });
    }
    sendNext();
}

function endStage1(players){
    players.forEach(p=>{
        let msg=`第一ステージ終了！スコア:${p.scoreStage1}点`;
        if(p.scoreStage1>=10){ msg+="\nクリア！"; p.clearedStage1=true; p.ws.send(JSON.stringify({ type:'unlockStage2' })); }
        else msg+="\nクリアならず";
        p.ws.send(JSON.stringify({ type:'end', message:msg }));
    });
}

// -------------------
// 第二ステージ
// -------------------
function startStage2(stagePlayers){
    stagePlayers.forEach(p=>{ p.scoreStage2=0; p.answered=false; });
    const q = stage2Questions[0];
    let timeLeft=120;
    stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'stage', name:'第二ステージ', stage:2 })));

    const gameTimer=setInterval(()=>{
        timeLeft--;
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'gameTimer', timeLeft })));
        if(timeLeft<=0){ clearInterval(gameTimer); endStage2(stagePlayers); }
    },1000);

    stagePlayers.forEach(p=>{
        p.ws.send(JSON.stringify({ type:'question', question:q.question }));
        p.handleAnswer=(pl, answer)=>{
            if(pl.answered) return;
            if(q.correctAnswers.includes(answer.trim())) pl.scoreStage2=100;
            pl.answered=true;
            pl.ws.send(JSON.stringify({ type:'score', score:pl.scoreStage2 }));
            clearInterval(gameTimer);
            endStage2(stagePlayers);
        };
    });
}

function endStage2(stagePlayers){
    stagePlayers.forEach(p=>{
        let msg=`第二ステージ終了！スコア:${p.scoreStage2}点`;
        if(p.scoreStage2>=100){ msg+="\nクリア！"; p.clearedStage2=true; p.ws.send(JSON.stringify({ type:'unlockStage3' })); }
        else msg+="\nクリアならず";
        p.ws.send(JSON.stringify({ type:'end', message:msg }));
    });
}

// -------------------
// 第三ステージ
// -------------------
function startStage3(stagePlayers){
    stagePlayers.forEach(p=>{ p.scoreStage3=0; p.answered=false; });
    let index=0;
    let timeLeft=120;
    stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'stage', name:'第三ステージ', stage:3 })));

    const gameTimer=setInterval(()=>{
        timeLeft--;
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'gameTimer', timeLeft })));
        if(timeLeft<=0){ clearInterval(gameTimer); endStage3(stagePlayers); }
    },1000);

    function sendNext(){
        if(index>=stage3Questions.length){ clearInterval(gameTimer); endStage3(stagePlayers); return; }
        const q = stage3Questions[index];
        stagePlayers.forEach(p=>{ p.answered=false; p.ws.send(JSON.stringify({ type:'question', question:q.question, index, timeLeft:40 })); });

        const questionTimer=setInterval(()=>{
            q.timeLeft=(q.timeLeft||40)-1;
            stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'questionTimer', timeLeft:q.timeLeft })));
            if(q.timeLeft<=0){ clearInterval(questionTimer); index++; sendNext(); }
        },1000);

        stagePlayers.forEach(p=>{
            p.handleAnswer=(pl, answer)=>{
                if(pl.answered) return;
                if(answer.trim()===q.correctAnswer) pl.scoreStage3+=30;
                pl.answered=true;
                pl.ws.send(JSON.stringify({ type:'score', score:pl.scoreStage3 }));
                clearInterval(questionTimer); index++; sendNext();
            };
        });
    }
    sendNext();
}

function endStage3(stagePlayers){
    stagePlayers.forEach(p=>{
        let msg=`第三ステージ終了！スコア:${p.scoreStage3}点`;
        if(p.scoreStage3>=80){ msg+="\nクリア！"; p.ws.send(JSON.stringify({ type:'unlockStage4' })); }
        else msg+="\nクリアならず";
        p.ws.send(JSON.stringify({ type:'end', message:msg }));
    });
}

// -------------------
// 第四ステージ
// -------------------
function startStage4(stagePlayers){
    stagePlayers.forEach(p=>{ p.scoreStage4=0; p.answered=false; p.ws.send(JSON.stringify({ type:'stage', name:'第四ステージ', stage:4 })); });
    stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'showClearButton' })));
    let timeLeft=180;
    const gameTimer=setInterval(()=>{
        timeLeft--;
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'gameTimer', timeLeft })));
        if(timeLeft<=0){ clearInterval(gameTimer); endStage4(stagePlayers); }
    },1000);

    stagePlayers.forEach(p=>{
        p.handleAnswer=(pl, answer)=>{
            if(answer==="CLEAR" && !pl.answered){
                pl.scoreStage4+=100; pl.answered=true;
                clearInterval(gameTimer); endStage4(stagePlayers);
            }
        };
    });
}

function endStage4(stagePlayers){
    stagePlayers.forEach(p=>{
        let msg=`第四ステージ終了！スコア:${p.scoreStage4}点`;
        if(p.scoreStage4>=100) msg+="\nクリア！";
        else msg+="\nクリアならず";
        p.ws.send(JSON.stringify({ type:'end', message:msg }));
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`Server running on ${PORT}`));

 
