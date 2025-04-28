const ws = new WebSocket('wss://quiz-zetubou.onrender.com');  // WebSocketサーバーの接続先

// WebSocket接続時の処理
ws.onopen = () => {
    console.log('Connected to WebSocket');
};

// メッセージ受信時の処理
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'question') {
        // サーバーから問題が送られてきた場合
        document.getElementById('question').innerText = `問題: ${message.question}`;
        document.getElementById('waitingMessage').innerText = "";  // 問題が表示されたら待機メッセージを消す
        document.getElementById('timer').innerText = 20;  // 問題のタイマーを20秒にリセット
    } else if (message.type === 'gameTimer') {
        // ゲーム全体タイマーの残り時間を表示
        document.getElementById('gameTimer').innerText = `残り時間: ${message.timeLeft}秒`;
    } else if (message.type === 'questionTimer') {
        // 各問題のタイマーの残り時間を表示
        document.getElementById('timer').innerText = message.timeLeft;
    } else if (message.type === 'end') {
        // クイズ終了時のメッセージ
        document.getElementById('question').innerText = message.message;
        document.getElementById('timer').innerText = "";  // タイマーをクリア
    } else if (message.type === 'score') {
        // スコアの表示
        document.getElementById('score').innerText = `スコア: ${message.score}`;
    } else if (message.type === 'waiting') {
        // 正解したプレイヤーに対してだけ表示される待機メッセージ
        document.getElementById('waitingMessage').innerText = message.message;
    }
};

// クイズ開始ボタンの処理
document.getElementById('startBtn').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'start' }));  // サーバーに「start」メッセージを送信
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "クイズ中...";
});

// 回答入力処理
document.getElementById('answerBtn').addEventListener('click', () => {
    const answer = document.getElementById('answerInput').value;
    ws.send(JSON.stringify({ type: 'answer', answer: answer }));  // サーバーに回答を送信
});