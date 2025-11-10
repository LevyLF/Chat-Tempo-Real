const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));

const users = {}; // socket.id → { username, color, lastChangeTime }

function getRandomColor() {
  const colors = [
    "#ff6b6b",
    "#6bafff",
    "#51cf66",
    "#f3a21b",
    "#b197fc",
    "#ff922b",
    "#63e6be",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

io.on("connection", (socket) => {
  console.log("Novo usuário conectado:", socket.id);

  // Usuário escolhe o nome
  socket.on("set username", (username, callback) => {
    const nameTaken = Object.values(users).some(
      (u) => u.username === username
    );

    if (nameTaken) {
      callback({ success: false, message: "Esse nome já está em uso!" });
      return;
    }

    users[socket.id] = {
      username,
      color: getRandomColor(),
      lastChangeTime: null, // ainda não trocou
    };

    io.emit("chat message", {
      system: true,
      text: `${username} entrou no chat.`,
    });

    callback({ success: true, username, color: users[socket.id].color });
  });

  // Trocar nome de usuário
  socket.on("change username", (newName, callback) => {
    const user = users[socket.id];
    if (!user) return;

    const now = Date.now();

    // verificar se já existe alguém com o novo nome
    const nameTaken = Object.values(users).some(
      (u) => u.username === newName
    );
    if (nameTaken) {
      callback({ success: false, message: "Esse nome já está em uso!" });
      return;
    }

    // bloqueio de 10 minutos (só depois da primeira troca)
    if (user.lastChangeTime && now - user.lastChangeTime < 10 * 60 * 1000) {
      const remaining = Math.ceil(
        (10 * 60 * 1000 - (now - user.lastChangeTime)) / 1000 / 60
      );
      callback({
        success: false,
        message: `Espere ${remaining} minutos para trocar novamente.`,
      });
      return;
    }

    const oldName = user.username;
    user.username = newName;
    user.lastChangeTime = now;

    io.emit("chat message", {
      system: true,
      text: `${oldName} agora é ${newName}.`,
    });

    callback({ success: true, username: newName });
  });

  // Receber mensagens normais
  socket.on("chat message", (text) => {
    const user = users[socket.id];
    if (!user) return;

    io.emit("chat message", {
      username: user.username,
      color: user.color,
      text,
    });
  });

  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      io.emit("chat message", {
        system: true,
        text: `${user.username} saiu do chat.`,
      });
      delete users[socket.id];
    }
    console.log("Usuário desconectado:", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
