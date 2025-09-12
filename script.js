const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

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
            // クリア者にはunlockStage2が来るので、ここでは不合格者のみ第一ステージボタンを再表示
            if (!message.message.includes("第一ステージクリア")) {
                document.getElementById('startBtn').style.display = "inline-block";
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
            break;
        case 'unlockStage2':
            // 第一ステージクリア者には第二ステージボタンを表示
            document.getElementById('startBtnStage2').style.display = "inline-block";
            break;
    }
};

// 第一ステージ開始ボタン
document.getElementById('startBtn').addEventListener('click', () => {
    console.log('第一ステージスタート押下');
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket未接続です');
        return;
    }
    ws.send(JSON.stringify({ type: 'start', stage: 1 }));
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "クイズ中...";
    document.getElementById('startBtn').style.display = "none";
});

// 第二ステージ開始ボタン
document.getElementById('startBtnStage2').addEventListener('click', () => {
    console.log('第二ステージスタート押下');
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket未接続です');
        return;
    }
    ws.send(JSON.stringify({ type: 'start', stage: 2 }));
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "クイズ中...";
    document.getElementById('startBtnStage2').style.display = "none";
});

// 回答ボタン
document.getElementById('answerBtn').addEventListener('click', () => {
    const answer = document.getElementById('answerInput').value;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket未接続です');
        return;
    }
    ws.send(JSON.stringify({ type: 'answer', answer }));
});
