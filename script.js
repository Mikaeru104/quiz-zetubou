const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

let currentStage = 1; // 現在のステージを保持
let currentQuestionIndex = 0; // ステージ内の問題番号（第3ステージ対応）

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
            // 問題が送られてきたら表示を更新
            document.getElementById('question').innerText = `問題: ${message.question}`;
            document.getElementById('timer').innerText = message.timeLeft || 20;
            document.getElementById('waitingMessage').innerText = "";

            // 現在の問題番号を更新（特に第3ステージで必要）
            if (typeof message.index !== "undefined") {
                currentQuestionIndex = message.index;
            }
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
            break;

        case 'score':
            document.getElementById('score').innerText = `スコア: ${message.score}`;
            break;

        case 'waiting':
            document.getElementById('waitingMessage').innerText = message.message;
            break;

        case 'stage':
            document.querySelector('h1').innerText = message.name;
            currentStage = message.stage; // サーバーから送られたステージ番号を保存
            break;

        case 'unlockStage2':
            document.getElementById('startBtnStage2').style.display = "inline-block";
            document.getElementById('startBtn').style.display = "none";
            break;

        case 'unlockStage3':
            document.getElementById('startBtnStage3').style.display = "inline-block";
            document.getElementById('startBtnStage2').style.display = "none";
            break;
    }
};

// 第一ステージ
document.getElementById('startBtn').addEventListener('click', () => {
    console.log('第一ステージスタート押下');
    ws.send(JSON.stringify({ type: 'start', stage: 1 }));
    currentStage = 1;
    currentQuestionIndex = 0;
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "クイズ中...";
    document.getElementById('startBtn').style.display = "none";
});

// 第二ステージ
document.getElementById('startBtnStage2').addEventListener('click', () => {
    console.log('第二ステージスタート押下');
    ws.send(JSON.stringify({ type: 'start', stage: 2 }));
    currentStage = 2;
    currentQuestionIndex = 0;
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "クイズ中...";
    document.getElementById('startBtnStage2').style.display = "none";
});

// 第三ステージ
document.getElementById('startBtnStage3').addEventListener('click', () => {
    console.log('第三ステージスタート押下');
    ws.send(JSON.stringify({ type: 'start', stage: 3 }));
    currentStage = 3;
    currentQuestionIndex = 0;
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "クイズ中...";
    document.getElementById('startBtnStage3').style.display = "none";
});

// 回答ボタン（全ステージ共通で常に動作）
document.getElementById('answerBtn').addEventListener('click', () => {
    const answer = document.getElementById('answerInput').value;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket未接続です');
        return;
    }

    // サーバーに現在のステージと問題番号を送る
    ws.send(JSON.stringify({
        type: 'answer',
        answer,
        stage: currentStage,
        index: currentQuestionIndex
    }));

    // 入力欄をクリア
    document.getElementById('answerInput').value = "";
});
