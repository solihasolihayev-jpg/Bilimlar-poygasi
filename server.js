const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const rooms = new Map();
const MAX_PLAYERS = 40;
const DEFAULT_QUESTIONS = [
  { text: "Kompyuterning asosiy hisoblash qurilmasi qaysi?", options: ["Monitor", "Protsessor", "Klaviatura", "Sichqoncha"], correct: 1 },
  { text: "Internet sahifalarini ko‘rish uchun nima ishlatiladi?", options: ["Brauzer", "Kalkulyator", "Paint", "Bloknot"], correct: 0 },
  { text: "Algoritm nima?", options: ["Kompyuter qismi", "Rasm turi", "Masalani yechish ketma-ketligi", "Internet kabeli"], correct: 2 }
];

function cleanName(v) { return String(v || "Talaba").trim().slice(0, 24) || "Talaba"; }
function cleanRoom(v) { return String(v || "BILIM").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "BILIM"; }
function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { code, players: new Map(), questions: DEFAULT_QUESTIONS, questionIndex: -1, running: false, timer: null, questionEndsAt: 0, hostId: null });
  return rooms.get(code);
}
function playerList(room) {
  return [...room.players.values()].map(p => ({ id:p.id, name:p.name, avatar:p.avatar, score:p.score, position:p.position, answered:p.answered }))
    .sort((a,b) => b.score-a.score || b.position-a.position);
}
function emitState(room) {
  io.to(room.code).emit("state", { roomCode: room.code, players: playerList(room), running: room.running, hostId: room.hostId, questionIndex: room.questionIndex, totalQuestions: room.questions.length });
}
function publicQuestion(room) {
  const q = room.questions[room.questionIndex];
  if (!q) return null;
  return { index: room.questionIndex, total: room.questions.length, text: q.text, options: q.options, endsAt: room.questionEndsAt };
}
function endQuestion(room) {
  if (!room.running) return;
  clearTimeout(room.timer);
  room.timer = null;
  io.to(room.code).emit("questionEnded", { correct: room.questions[room.questionIndex]?.correct, players: playerList(room) });
  setTimeout(() => {
    if (!room.running) return;
    room.questionIndex++;
    if (room.questionIndex >= room.questions.length) {
      room.running = false;
      io.to(room.code).emit("gameOver", { players: playerList(room) });
      emitState(room);
      return;
    }
    sendQuestion(room);
  }, 2200);
}
function sendQuestion(room) {
  room.questionEndsAt = Date.now() + 20000;
  for (const p of room.players.values()) p.answered = false;
  io.to(room.code).emit("question", publicQuestion(room));
  emitState(room);
  room.timer = setTimeout(() => endQuestion(room), 20000);
}
function parseQuestions(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 30) throw new Error("Savollar soni 1 dan 30 tagacha bo‘lishi kerak.");
  return raw.map((q, i) => {
    const text = String(q.text || "").trim().slice(0, 300);
    const options = Array.isArray(q.options) ? q.options.slice(0,4).map(x => String(x || "").trim().slice(0,120)) : [];
    const correct = Number(q.correct);
    if (!text || options.length !== 4 || options.some(x => !x) || !Number.isInteger(correct) || correct < 0 || correct > 3) {
      throw new Error((i+1) + "-savolni tekshiring: savol, 4 ta variant va to‘g‘ri javob kerak.");
    }
    return { text, options, correct };
  });
}

io.on("connection", socket => {
  socket.on("joinRoom", ({ name, avatar, roomCode }) => {
    const code = cleanRoom(roomCode);
    const room = getRoom(code);
    if (room.players.size >= MAX_PLAYERS && !room.players.has(socket.id)) {
      socket.emit("notice", "Xona to‘la. Bir xonada 40 nafargacha ishtirokchi bo‘lishi mumkin."); return;
    }
    if (socket.data.roomCode) {
      const old = rooms.get(socket.data.roomCode);
      if (old) { old.players.delete(socket.id); if (old.hostId === socket.id) old.hostId = old.players.keys().next().value || null; emitState(old); }
      socket.leave(socket.data.roomCode);
    }
    const player = { id: socket.id, name: cleanName(name), avatar: String(avatar || "🧑‍🎓").slice(0,8), score: 0, position: 0, answered: false };
    room.players.set(socket.id, player);
    if (!room.hostId) room.hostId = socket.id;
    socket.data.roomCode = code;
    socket.join(code);
    socket.emit("joined", { roomCode: code, hostId: room.hostId, isHost: room.hostId === socket.id });
    emitState(room);
  });

  socket.on("setQuestions", raw => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id || room.running) return;
    try {
      room.questions = parseQuestions(raw);
      room.questionIndex = -1;
      io.to(room.code).emit("notice", room.questions.length + " ta savol saqlandi.");
      emitState(room);
    } catch (e) { socket.emit("notice", e.message); }
  });

  socket.on("startGame", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id || room.running || !room.players.size) return;
    room.running = true; room.questionIndex = 0;
    for (const p of room.players.values()) { p.score = 0; p.position = 0; p.answered = false; }
    sendQuestion(room);
  });

  socket.on("answer", choice => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.running || Date.now() > room.questionEndsAt) return;
    const p = room.players.get(socket.id);
    const q = room.questions[room.questionIndex];
    if (!p || p.answered || !q) return;
    p.answered = true;
    const elapsed = Math.max(0, 20000 - (room.questionEndsAt - Date.now()));
    const correct = Number(choice) === q.correct;
    if (correct) {
      const speedBonus = Math.round((20000 - elapsed) / 2000);
      const gained = 100 + speedBonus * 5;
      p.score += gained;
      p.position += 1 + speedBonus * 0.08;
      socket.emit("answerResult", { correct:true, gained, message:"To‘g‘ri! +" + gained + " ball" });
    } else {
      socket.emit("answerResult", { correct:false, gained:0, message:"Noto‘g‘ri javob. Keyingi savolda urinib ko‘ring." });
    }
    emitState(room);
    if ([...room.players.values()].every(x => x.answered)) endQuestion(room);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    room.players.delete(socket.id);
    if (room.hostId === socket.id) room.hostId = room.players.keys().next().value || null;
    if (!room.players.size) { clearTimeout(room.timer); rooms.delete(code); }
    else emitState(room);
  });
});

server.listen(PORT, () => console.log("Bilimlar poygasi serveri " + PORT + " portida ishga tushdi."));