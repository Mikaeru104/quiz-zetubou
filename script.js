const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

let currentStage = 1;
let currentQuestionIndex = 0;

ws.onopen = () => {
    console.log('Connected to WebSocket');
    document.getElementById('waitingMessage').innerText = "サーバー接続成功！";
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    switch (message.type) {
        case 'connected':
            document.getElementById('waitingMessage').innerText = message.message;
            break;

        case 'question':
            document.getElementById('question').innerText = `問題: ${message.question}`;
            document.getElementById('timer').innerText = message.timeLeft || 20;
            document.getElementById('waitingMessage').innerText = "";
            if (typeof message.index !== "undefined") currentQuestionIndex = message.index;
            break;

        case 'gameTimer':
            document.getElementById('gameTimer').innerText = `残り時間: ${message.timeLeft}秒`;
            break;

        case 'questionTimer':
            document.getElementById('timer').innerText = message.timeLeft;
            break;

        case 'end':
            document.getElementById('question').innerText = message.message;
            document.getElementById('timer').innerText = "";
            document.getElementById('clearBtn').style.display = "none"; // 終了時にクリアボタンを消す

            // ★ 全ステージ共通: クリア失敗した端末は回答ボタンを削除
            if (message.message.includes("クリアならず")) {
            document.getElementById('answerBtn').style.display = "none";
            document.getElementById('answerInput').style.display = "none";
            }
            break;


        case 'score':
            document.getElementById('score').innerText = `スコア: ${message.score}`;
            break;

        case 'waiting':
            document.getElementById('waitingMessage').innerText = message.message;
            break;

        case 'stage':
            document.querySelector('h1').innerText = message.name;
            currentStage = message.stage;
            break;

        case 'unlockStage2':
            document.getElementById('startBtnStage2').style.display = "inline-block";
            document.getElementById('startBtn').style.display = "none";
            break;

        case 'unlockStage3':
            document.getElementById('startBtnStage3').style.display = "inline-block";
            document.getElementById('startBtnStage2').style.display = "none";
            break;

        case 'showClearButton':
            document.getElementById('startBtnStage4').style.display = "inline-block";
            document.getElementById('startBtnStage3').style.display = "none";
            break;
    }
};

// 第一ステージ
document.getElementById('startBtn').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'start', stage: 1 }));
    currentStage = 1;
    currentQuestionIndex = 0;
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "クイズ中...";
    document.getElementById('startBtn').style.display = "none";
});

// 第二ステージ
document.getElementById('startBtnStage2').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'start', stage: 2 }));
    currentStage = 2;
    currentQuestionIndex = 0;
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "クイズ中...";
    document.getElementById('startBtnStage2').style.display = "none";
});

// 第三ステージ
document.getElementById('startBtnStage3').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'start', stage: 3 }));
    currentStage = 3;
    currentQuestionIndex = 0;
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "クイズ中...";
    document.getElementById('startBtnStage3').style.display = "none";
});

// 第四ステージ
document.getElementById('startBtnStage4').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'start', stage: 4 }));
    currentStage = 4;
    currentQuestionIndex = 0;
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "絶棒開始...";
    document.getElementById('startBtnStage4').style.display = "none";
    document.getElementById('clearBtn').style.display = "inline-block"; // ★クリアボタン表示
});

// クリアボタン
document.getElementById('clearBtn').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'answer', answer: "CLEAR", stage: currentStage }));
    document.getElementById('clearBtn').style.display = "none"; // 押したら非表示
});

// 回答ボタン
document.getElementById('answerBtn').addEventListener('click', () => {
    const answer = document.getElementById('answerInput').value;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket未接続です');
        return;
    }
    ws.send(JSON.stringify({
        type: 'answer',
        answer,
        stage: currentStage,
        index: currentQuestionIndex
    }));
    document.getElementById('answerInput').value = "";
});

 
