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
            document.getElementById('timer').innerText = message.timeLeft || "";
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
            document.getElementById('startBtn').style.display = "inline-block"; // 第一ステージ用
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

        case 'showStage2Start':
            document.getElementById('startBtnStage2').style.display = "inline-block";
            break;

        case 'showStage3Start':
            document.getElementById('startBtnStage3').style.display = "inline-block";
            break;

        case 'showStage4Start':
            document.getElementById('startBtnStage4').style.display = "inline-block";
            break;

        case 'showClearButton': // 第四ステージ専用
            clearBtn.style.display = "inline-block";
            break;
    }
};

// ==========================
// 第一ステージスタート
// ==========================
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

// ==========================
// 第二ステージスタート
// ==========================
document.getElementById('startBtnStage2').addEventListener('click', () => {
    console.log('第二ステージスタート押下');
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket未接続です');
        return;
    }
    ws.send(JSON.stringify({ type: 'start', stage: 2 }));
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "絵しりとり中...";
    document.getElementById('startBtnStage2').style.display = "none";
});

// ==========================
// 第三ステージスタート
// ==========================
document.getElementById('startBtnStage3').addEventListener('click', () => {
    console.log('第三ステージスタート押下');
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket未接続です');
        return;
    }
    ws.send(JSON.stringify({ type: 'start', stage: 3 }));
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "イライラ本クイズ中...";
    document.getElementById('startBtnStage3').style.display = "none";
});

// ==========================
// 第四ステージスタート
// ==========================
document.getElementById('startBtnStage4').addEventListener('click', () => {
    console.log('第四ステージスタート押下');
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket未接続です');
        return;
    }
    ws.send(JSON.stringify({ type: 'start', stage: 4 }));
    document.getElementById('waitingMessage').innerText = "準備中...";
    document.getElementById('question').innerText = "絶棒チャレンジ中...";
    document.getElementById('startBtnStage4').style.display = "none";
});

// ==========================
// 回答ボタン
// ==========================
document.getElementById('answerBtn').addEventListener('click', () => {
    const answer = document.getElementById('answerInput').value.trim();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket未接続です');
        return;
    }
    ws.send(JSON.stringify({ type: 'answer', answer }));
    document.getElementById('answerInput').value = ""; // 入力欄リセット
});

// ==========================
// 第四ステージ用 ゲームクリアボタン
// ==========================
const clearBtn = document.createElement("button");
clearBtn.innerText = "ゲームクリア";
clearBtn.style.display = "none";
clearBtn.style.backgroundColor = "#E91E63";
clearBtn.style.color = "white";
clearBtn.style.fontSize = "18px";
clearBtn.style.padding = "10px 20px";
clearBtn.style.marginTop = "20px";
clearBtn.style.border = "none";
clearBtn.style.borderRadius = "5px";
document.body.appendChild(clearBtn);

clearBtn.addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket未接続です');
        return;
    }
    ws.send(JSON.stringify({ type: 'answer', answer: "CLEAR" }));
    clearBtn.style.display = "none"; // 押したら消える
});
     
