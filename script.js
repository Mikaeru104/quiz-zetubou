const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

let currentStage = 1; // 現在のステージ番号
let currentQuestionIndex = 0; // 問題番号（第3ステージ対応）

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

            // 第3ステージ用に問題インデックスを保存
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
            // 終了時はステージスタートボタンを再度表示
            if (currentStage === 1) document.getElementById('startBtn').style.display = "inline-block";
            if (currentStage === 2) document.getElementById('startBtnStage2').style.display = "inline-block";
            if (currentStage === 3) document.getElementById('startBtnStage3').style.display = "inline-block";
            if (currentStage === 4) document.getElementById('startBtnStage4').style.display = "inline-block";
            break;

        case 'score':
            document.getElementById('score').innerText = `スコア: ${message.score}`;
            break;

        case 'waiting':
            document.getElementById('waitingMessage').innerText = message.message;
            break;

        case 'stage':
            document.querySelector('h1').innerText = message.name;
            currentStage = message.stage; // サーバーが送るステージ番号を保存
            break;

        case 'unlockStage2':
            document.getElementById('startBtnStage2').style.display = "inline-block";
            document.getElementById('startBtn').style.display = "none";
            break;

        case 'unlockStage3':
            document.getElementById('startBtnStage3').style.display = "inline-block";
            document.getElementById('startBtnStage2').style.display = "none";
            break;

        case 'showClearButton': // 第四ステージ用
            document.getElementById('clearStage4Btn').style.display = "inline-block";
            break;
    }
};

// =======================
// 各ステージ開始ボタン
// =======================

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

// 第四ステージ
document.getElementById('startBtnStage4').addEventListener('click', () => {
    console.log('第四ステージスタート押下');
    ws.send(JSON.stringify({ type: 'start', stage: 4 }));
    currentStage = 4;
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "ゲーム進行中...";
    document.getElementById('startBtnStage4').style.display = "none";
});

// =======================
// 回答ボタン（全ステージ共通）
// =======================
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

// =======================
// 第四ステージ専用クリアボタン
// =======================
document.getElementById('clearStage4Btn').addEventListener('click', () => {
    console.log("第四ステージクリアボタン押下");
    ws.send(JSON.stringify({ type: 'answer', answer: "CLEAR", stage: 4 }));
    document.getElementById('clearStage4Btn').style.display = "none";
});

