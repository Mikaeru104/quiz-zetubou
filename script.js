const socket = new WebSocket("ws://localhost:3000");

socket.onopen = () => {
  console.log("WebSocket connected!");
  document.getElementById("status").innerText = "接続完了！スタートボタンを押してください";
};

socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "info") {
    document.getElementById("status").innerText = msg.message;
  }

  if (msg.type === "waiting") {
    document.getElementById("status").innerText = msg.message;
  }

  if (msg.type === "stage") {
    // ステージ名をタイトルに反映
    document.getElementById("gameTitle").innerText = msg.name;
  }

  if (msg.type === "question") {
    document.getElementById("status").innerText = "問題: " + msg.question;
    document.getElementById("answerSection").style.display = "block";
  }

  if (msg.type === "end") {
    document.getElementById("status").innerText = msg.message;
    document.getElementById("startBtn").style.display = "block";
    document.getElementById("answerSection").style.display = "none";
  }
};

function startGame() {
  socket.send(JSON.stringify({ type: "start" }));
  document.getElementById("status").innerText = "準備中...";
  document.getElementById("startBtn").style.display = "none";
}

function sendAnswer() {
  const answer = document.getElementById("answerInput").value.trim();
  if (answer) {
    socket.send(JSON.stringify({ type: "answer", answer }));
    document.getElementById("answerInput").value = "";
  }
}


