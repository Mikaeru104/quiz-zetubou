const ws = new WebSocket('wss://quiz-zetubou.onrender.com');  // WebSocketサーバーの接続先

ws.onopen = () => {
    console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'question') {
        // サーバーから問題が送られてきた場合
        document.getElementById('question').innerText = `問題: ${message.question}`;
        document.getElementById('waitingMessage').innerText = "";
        document.getElementById('timer').innerText = 20;

        // ❌ ここではスタートボタンを消さない（削除）
    } else if (message.type === 'gameTimer') {
        document.getElementById('gameTimer').innerText = `残り時間: ${message.timeLeft}秒`;
    } else if (message.type === 'questionTimer') {
        document.getElementById('timer').innerText = message.timeLeft;
    } else if (message.type === 'end') {
        document.getElementById('question').innerText = message.message;
        document.getElementById('timer').innerText = "";

        // ✅ ゲーム終了時にスタートボタンを再表示
        document.getElementById('startBtn').style.display = "inline-block";
    } else if (message.type === 'score') {
        document.getElementById('score').innerText = `スコア: ${message.score}`;
    } else if (message.type === 'waiting') {
        document.getElementById('waitingMessage').innerText = message.message;
    }
};

// クイズ開始ボタンの処理
document.getElementById('startBtn').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'start' }));  // サーバーに「start」メッセージを送信
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "クイズ中...";
    
    // ✅ スタートボタンを押した瞬間に消す
    document.getElementById('startBtn').style.display = "none";
});

// 回答入力処理
document.getElementById('answerBtn').addEventListener('click', () => {
    const answer = document.getElementById('answerInput').value;
    ws.send(JSON.stringify({ type: 'answer', answer: answer }));  // サーバーに回答を送信
});
