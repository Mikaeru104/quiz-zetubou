const ws = new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);

let currentStage = 1;
let currentQuestionIndex = 0;

ws.onopen = () => console.log('Connected');

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch(msg.type){
        case 'connected': 
            document.getElementById('waitingMessage').innerText = msg.message; 
            break;

        case 'question':
            document.getElementById('question').innerText = `問題: ${msg.question}`;
            document.getElementById('timer').innerText = msg.timeLeft ? `問題残り時間: ${msg.timeLeft}秒` : '';
            if(typeof msg.index !== 'undefined') currentQuestionIndex = msg.index;
            break;

        case 'gameTimer':
            document.getElementById('gameTimer').innerText = `残り時間: ${msg.timeLeft}秒`;
            break;

        case 'score':
            document.getElementById('score').innerText = `スコア: ${msg.score}点`;
            break;

        case 'waiting':
            // 待機表示は不要にする
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
            document.getElementById('startBtn').style.display="none";
            break;

        case 'unlockStage3':
            document.getElementById('startBtnStage3').style.display="inline-block";
            document.getElementById('startBtnStage2').style.display="none";
            break;

        case 'unlockStage4':
            document.getElementById('startBtnStage4').style.display="inline-block";
            document.getElementById('startBtnStage3').style.display="none";
            break;

        case 'showClearButton':
            document.getElementById('answerBtn').innerText = "クリア！";
            break;
    }
};

// スタートボタン
document.getElementById('startBtn').addEventListener('click', ()=>{ startStage(1); });
document.getElementById('startBtnStage2').addEventListener('click', ()=>{ startStage(2); });
document.getElementById('startBtnStage3').addEventListener('click', ()=>{ startStage(3); });
document.getElementById('startBtnStage4').addEventListener('click', ()=>{ startStage(4); });

function startStage(stage){
    ws.send(JSON.stringify({ type:'start', stage }));
    currentStage = stage;
    currentQuestionIndex = 0;
    // 「準備中…」表示を削除
    document.getElementById('waitingMessage').innerText = "";
    document.getElementById('question').innerText = "クイズ開始！";
    document.getElementById('score').innerText = "";
}

// 回答ボタン
document.getElementById('answerBtn').addEventListener('click', ()=>{
    const answer = document.getElementById('answerInput').value;
    if(!ws || ws.readyState!==WebSocket.OPEN){ alert('WebSocket未接続'); return; }

    let sendAnswer = answer;
    if(currentStage===4) sendAnswer = "CLEAR";

    ws.send(JSON.stringify({ type:'answer', answer:sendAnswer, stage:currentStage, index:currentQuestionIndex }));
    document.getElementById('answerInput').value = "";
});
