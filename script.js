const socket = new WebSocket("ws://localhost:3000");

socket.onopen = () => {
  console.log("WebSocket connected!");
};

socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "info") {
    document.getElementById("status").innerText = msg.message;
  }

  if (msg.type === "waiting") {
    document.getElementById("status").innerText = msg.message;
  }

  if (msg.type === "question") {
    document.getElementById("status").innerText = "問題: " + msg.question;
  }

  if (msg.type === "end") {
    document.getElementById("status").innerText = msg.message;
  }
};

function startGame() {
  socket.send(JSON.stringify({ type: "start" }));
}

