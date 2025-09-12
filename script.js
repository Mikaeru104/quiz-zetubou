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
            document.getElementById('startBtn').style.display = "inline-block";
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
    }
};

document.getElementById('startBtn').addEventListener('click', () => {
    console.log('スタートボタン押下');
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket未接続です');
        return;
    }

    const stageName = document.querySelector('h1').innerText.trim();
    const stage = stageName === "かくれんぼ" ? 1 : 2;
    console.log("stage送信:", stage);

    ws.send(JSON.stringify({ type: 'start', stage }));

    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "クイズ中...";
    document.getElementById('startBtn').style.display = "none";
});

document.getElementById('answerBtn').addEventListener('click', () => {
    const answer = document.getElementById('answerInput').value;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket未接続です');
        return;
    }
    ws.send(JSON.stringify({ type: 'answer', answer }));
});

