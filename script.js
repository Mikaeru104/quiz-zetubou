const ws = new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);

let currentStage = 1;
let currentQuestionIndex = 0;

ws.onopen = ()=>{
    console.log('WebSocket接続成功');
    document.getElementById('waitingMessage').innerText = "サーバー接続成功！";
};

ws.onmessage = (event)=>{
    const msg = JSON.parse(event.data);

    switch(msg.type){
        case 'connected':
            document.getElementById('waitingMessage').innerText = msg.message;
            break;
        case 'question':
            document.getElementById('question').innerText = `問題: ${msg.question}`;
            document.getElementById('timer').innerText = msg.timeLeft ? `残り: ${msg.timeLeft}秒` : "";
            if(typeof msg.index!=="undefined") currentQuestionIndex=msg.index;
            break;
        case 'gameTimer':
            document.getElementById('gameTimer').innerText = `制限時間: ${msg.timeLeft}秒`;
            break;
        case 'questionTimer':
            document.getElementById('timer').innerText = `残り: ${msg.timeLeft}秒`;
            break;
        case 'score':
            document.getElementById('score').innerText = `スコア: ${msg.score}`;
            break;
        case 'end':
            document.getElementById('question').innerText = msg.message;
            document.getElementById('timer').innerText = "";
            break;
        case 'stage':
            document.querySelector('h1').innerText = msg.name;
            currentStage = msg.stage;
            break;
        case 'unlockStage2':
            document.getElementById('startBtnStage2').style.display="inline-block";
            break;
        case 'unlockStage3':
            document.getElementById('startBtnStage3').style.display="inline-block";
            break;
        case 'showClearButton':
            document.getElementById('clearBtn').style.display="inline-block";
            break;
    }
};

// 第一ステージ
document.getElementById('startBtn').addEventListener('click', ()=>{
    ws.send(JSON.stringify({ type:'start', stage:1 }));
    document.getElementById('startBtn').style.display="none";
    document.getElementById('waitingMessage').innerText = "";
});

// 第二ステージ
document.getElementById('startBtnStage2').addEventListener('click', ()=>{
    ws.send(JSON.stringify({ type:'start', stage:2 }));
    document.getElementById('startBtnStage2').style.display="none";
});

// 第三ステージ
document.getElementById('startBtnStage3').addEventListener('click', ()=>{
    ws.send(JSON.stringify({ type:'start', stage:3 }));
    document.getElementById('startBtnStage3').style.display="none";
});

// 第四ステージ
document.getElementById('startBtnStage4').addEventListener('click', ()=>{
    ws.send(JSON.stringify({ type:'start', stage:4 }));
    document.getElementById('startBtnStage4').style.display="none";
});

// 回答ボタン
document.getElementById('answerBtn').addEventListener('click', ()=>{
    const answer = document.getElementById('answerInput').value;
    if(!ws || ws.readyState!==WebSocket.OPEN) { alert("未接続"); return; }
    ws.send(JSON.stringify({ type:'answer', answer, stage:currentStage, index:currentQuestionIndex }));
    document.getElementById('answerInput').value="";
});

// 第四ステージ: クリアボタン
document.getElementById('clearBtn').addEventListener('click', ()=>{
    ws.send(JSON.stringify({ type:'answer', answer:'CLEAR', stage:4 }));
    document.getElementById('clearBtn').style.display="none";
});
