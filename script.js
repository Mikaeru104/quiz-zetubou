const ws = new WebSocket('ws://localhost:8080');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'question') {
    document.getElementById('question').innerText = msg.question;
    document.getElementById('startBtn').style.display = "none";
  } else if (msg.type === 'gameTimer') {
    document.getElementById('gameTimer').innerText = `残り時間: ${msg.timeLeft}秒`;
  } else if (msg.type === 'score') {
    document.getElementById('score').innerText = `スコア: ${msg.score}`;
  } else if (msg.type === 'end') {
    document.getElementById('question').innerText = msg.message;
    document.getElementById('startBtn').style.display = "inline-block";
  }
};

document.getElementById('startBtn').addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'start' }));
  document.getElementById('startBtn').style.display = "none";
});

document.getElementById('answerBtn').addEventListener('click', () => {
  const answer = document.getElementById('answerInput').value;
  ws.send(JSON.stringify({ type: 'answer', answer }));
});
