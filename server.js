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
    { question: "「講」と「別」の乗ってるページの値の差をお答えください", correctAnswer: "300" }
];

const requiredPlayersStage1 = 4;
const requiredPlayersStage2 = 3;

// ======================
// WebSocket接続
// ======================
wss.on('connection', (ws) => {
    const player = {
        ws,
        scoreStage1:0, scoreStage2:0, scoreStage3:0, scoreStage4:0,
        answered:false, stage:1, ready:false,
        handleAnswer:null,
        clearedStage1:false, clearedStage2:false, clearedStage3:false
    };
    players.push(player);

    ws.send(JSON.stringify({ type:'connected', message:'サーバー接続成功！' }));

    ws.on('message', (message)=>{
        const msg = JSON.parse(message);
        if(msg.type==='start') handleStart(player, msg.stage);
        else if(msg.type==='answer' && player.handleAnswer) player.handleAnswer(player,msg.answer);
    });

    ws.on('close', ()=>{
        players = players.filter(p=>p.ws!==ws);
    });
});

function handleStart(player, stage){
    player.ready = true;
    player.stage = stage;

    if(stage===1){
        const stagePlayers = players.filter(p=>p.stage===1);
        const readyCount = stagePlayers.filter(p=>p.ready).length;
        if(readyCount===requiredPlayersStage1) startStage1(stagePlayers);
        else player.ws.send(JSON.stringify({type:'waiting', message:`第一ステージ: あと ${requiredPlayersStage1-readyCount} 人を待っています...`}));
    }
    if(stage===2){
        if(!player.clearedStage1){ player.ws.send(JSON.stringify({type:'waiting', message:"第一ステージ未クリアのため参加できません"})); return; }
        const clearedPlayers = players.filter(p=>p.clearedStage1);
        if(clearedPlayers.filter(p=>p.ready).length===requiredPlayersStage2) startStage2(clearedPlayers);
        else player.ws.send(JSON.stringify({type:'waiting', message:`第二ステージ: あと ${requiredPlayersStage2-clearedPlayers.filter(p=>p.ready).length} 人を待っています...`}));
    }
    if(stage===3){
        if(!player.clearedStage2){ player.ws.send(JSON.stringify({type:'waiting', message:"第二ステージ未クリアのため参加できません"})); return; }
        startStage3([player]);
    }
    if(stage===4){
        if(!player.clearedStage3){ player.ws.send(JSON.stringify({type:'waiting', message:"第三ステージ未クリアのため参加できません"})); return; }
        startStage4([player]);
    }
}

// ======================
// 第一ステージ
// ======================
function startStage1(stagePlayers){
    stagePlayers.forEach(p=>{ p.scoreStage1=0; p.answered=false; p.ready=false; });
    let questionIndex=0;
    let answeredPlayers=[];

    const gameTimer = setInterval(()=>{
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'gameTimer', timeLeft:120 })));
    },1000);

    function sendNextQuestion(){
        if(questionIndex>=stage1Questions.length){ endStage1(stagePlayers); clearInterval(gameTimer); return; }

        const question = stage1Questions[questionIndex];
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'question', question:question.question, stageName:"かくれんぼ", index:questionIndex, timeLeft:20 })));

        let qTime = 20;
        const questionTimer = setInterval(()=>{
            qTime--;
            stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'questionTimer', timeLeft:qTime })));
            if(qTime<=0){ clearInterval(questionTimer); assignScoresStage1(); answeredPlayers=[]; questionIndex++; setTimeout(sendNextQuestion,2000); }
        },1000);

        stagePlayers.forEach(p=>{
            p.handleAnswer = (player,answer)=>{
                if(!player || player.answered) return;
                const correct = stage1Questions[questionIndex].correctAnswer;
                if(answer.trim().toUpperCase()===correct){ player.answered=true; answeredPlayers.push(player); player.ws.send(JSON.stringify({type:'waiting', message:'次の問題をお待ちください...'})); }
            };
        });
    }

    function assignScoresStage1(){
        const scores=[10,7,3,1];
        for(let i=0;i<answeredPlayers.length;i++){
            const p=answeredPlayers[i]; const score=scores[i]||1;
            p.scoreStage1+=score;
            p.ws.send(JSON.stringify({ type:'score', score:p.scoreStage1 }));
        }
    }

    sendNextQuestion();
}

function endStage1(stagePlayers){
    const sorted=[...stagePlayers].sort((a,b)=>b.scoreStage1-a.scoreStage1);
    if(sorted[0]) sorted[0].scoreStage1+=50;
    for(let i=1;i<=2;i++){ if(sorted[i]&&sorted[i].scoreStage1<41) sorted[i].scoreStage1=41; }

    stagePlayers.forEach(p=>{
        let msg=`第一ステージ終了！最終スコア: ${p.scoreStage1}点`;
        if(p.scoreStage1>=41){ msg+="\n第一ステージクリア、Bに移動してください"; p.clearedStage1=true; p.ws.send(JSON.stringify({type:'unlockStage2'})); }
        else{ msg+="\nクリアならず"; p.clearedStage1=false; }
        p.ws.send(JSON.stringify({ type:'end', message:msg }));
    });
}

// ======================
// 第二ステージ
// ======================
function startStage2(stagePlayers){
    stagePlayers.forEach(p=>{ p.scoreStage2=0; p.answered=false; p.ready=false; });
    const question = stage2Questions[0];
    let answeredPlayers=[];
    let timeLeft=120;

    const gameTimer = setInterval(()=>{
        timeLeft--;
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({type:'gameTimer', timeLeft})));
        if(timeLeft<=0){ clearInterval(gameTimer); endStage2(stagePlayers,answeredPlayers); }
    },1000);

    stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'stage', name:'絵しりとり', stage:2 })));
    stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'question', question:question.question, index:0, timeLeft:120 })));

    stagePlayers.forEach(p=>{
        p.handleAnswer=(player,answer)=>{
            if(!player || player.answered) return;
            if(question.correctAnswers.includes(answer.trim())){
                player.answered=true;
                answeredPlayers.push(player);
                player.ws.send(JSON.stringify({ type:'waiting', message:'回答完了しました' }));
            }
            if(answeredPlayers.length===stagePlayers.length){ clearInterval(gameTimer); endStage2(stagePlayers,answeredPlayers); }
        };
    });
}

function endStage2(stagePlayers, answeredPlayers){
    const sorted=[...answeredPlayers];
    if(sorted[0]) sorted[0].scoreStage2=100;
    if(sorted[1]) sorted[1].scoreStage2=80;
    if(sorted[2]) sorted[2].scoreStage2=60;

    stagePlayers.forEach(p=>{
        if(!answeredPlayers.includes(p)) p.scoreStage2=0;
        let msg=`第二ステージ終了！スコア: ${p.scoreStage2}点`;
        if(p.scoreStage2>=100){ msg+="\n第二ステージクリア！第三ステージへ進めます"; p.clearedStage2=true; p.ws.send(JSON.stringify({ type:'unlockStage3' })); }
        else{ msg+="\nクリアならず"; p.clearedStage2=false; }
        p.ws.send(JSON.stringify({ type:'end', message:msg }));
    });
}

// ======================
// 第三ステージ
// ======================
function startStage3(stagePlayers){
    stagePlayers.forEach(p=>{ p.scoreStage3=0; p.answered=false; p.ready=false; });
    let questionIndex=0;
    let timeLeft=120;

    stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'stage', name:'イライラ本', stage:3 })));

    const gameTimer = setInterval(()=>{
        timeLeft--;
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({type:'gameTimer', timeLeft})));
        if(timeLeft<=0){ clearInterval(gameTimer); endStage3(stagePlayers); }
    },1000);

    function sendNextQuestion(){
        if(questionIndex>=stage3Questions.length){ clearInterval(gameTimer); endStage3(stagePlayers); return; }

        const q = stage3Questions[questionIndex];
        stagePlayers.forEach(p=>p.answered=false);
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'question', question:q.question, index:questionIndex, timeLeft:40 })));

        let qTime=40;
        const questionTimer=setInterval(()=>{
            qTime--;
            stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'questionTimer', timeLeft:qTime })));
            if(qTime<=0){ clearInterval(questionTimer); questionIndex++; setTimeout(sendNextQuestion,2000); }
        },1000);

        stagePlayers.forEach(p=>{
            p.handleAnswer=(player,answer)=>{
                if(!player || player.answered) return;
                if(answer.trim()===q.correctAnswer){
                    player.scoreStage3+=30;
                    player.ws.send(JSON.stringify({ type:'score', score:player.scoreStage3 }));
                    player.ws.send(JSON.stringify({ type:'waiting', message:'正解！次の問題を待ってください' }));
                } else { player.ws.send(JSON.stringify({ type:'waiting', message:'不正解！次の問題を待ってください' })); }
                player.answered=true;
                if(stagePlayers.every(pl=>pl.answered)){ clearInterval(questionTimer); questionIndex++; setTimeout(sendNextQuestion,2000); }
            };
        });
    }

    sendNextQuestion();
}

function endStage3(stagePlayers){
    stagePlayers.forEach(p=>{
        let msg=`第三ステージ終了！スコア: ${p.scoreStage3}点`;
        if(p.scoreStage3>=80){ msg+="\n第三ステージクリア！おめでとう！"; p.clearedStage3=true; p.ws.send(JSON.stringify({ type:'unlockStage4' })); }
        else{ msg+="\nクリアならず"; p.clearedStage3=false; }
        p.ws.send(JSON.stringify({ type:'end', message:msg }));
    });
}

// ======================
// 第四ステージ
// ======================
function startStage4(stagePlayers){
    stagePlayers.forEach(p=>{ p.scoreStage4=0; p.ready=false; p.answered=false; });
    let timeLeft=180;
    stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'stage', name:'絶棒', stage:4 })));
    stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'showClearButton' })));

    const gameTimer=setInterval(()=>{
        timeLeft--;
        stagePlayers.forEach(p=>p.ws.send(JSON.stringify({ type:'gameTimer', timeLeft })));
        if(timeLeft<=0){ clearInterval(gameTimer); endStage4(stagePlayers); }
    },1000);

    stagePlayers.forEach(p=>{
        p.handleAnswer=(player,answer)=>{
            if(answer==='CLEAR' && !player.answered){ player.scoreStage4+=100; player.answered=true; clearInterval(gameTimer); endStage4(stagePlayers); }
        };
    });
}

function endStage4(stagePlayers){
    stagePlayers.forEach(p=>{
        let msg=`第四ステージ終了！スコア: ${p.scoreStage4}点`;
        if(p.scoreStage4>=100){ msg+="\n第四ステージクリア！おめでとう！"; }
        else{ msg+="\nクリアならず"; }
        p.ws.send(JSON.stringify({ type:'end', message:msg }));
    });
}

const PORT = process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Server running on port ${PORT}`));

