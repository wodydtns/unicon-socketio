const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const fs = require("fs");
const server = http.createServer(
  {
    key: fs.readFileSync("./private.pem"),
    cert: fs.readFileSync("./public.pem"),
    requestCert: false,
    rejectUnauthroized: false,
  },
  app
);
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    credential: true,
  },
});
app.use(cors());
app.get("/room/:room", (req, res) => {
  console.log("오니");
});
let users = {};
let socketToRoom = {};
const maximum = process.env.MAXIMUM || 4;
io.on("connection", (socket) => {
  socket.on("join_room", (data) => {
    if (users[data.room]) {
      const length = users[data.room].length;
      if (length === maximum) {
        socket.to(socket.id).emit("room_full");
        return;
      }
      users[data.room].push({ id: socket.id, email: data.email });
    } else {
      users[data.room] = [{ id: socket.id, email: data.email }];
    }
    socketToRoom[socket.id] = data.room;

    socket.join(data.room);
    console.log(`[${socketToRoom[socket.id]}]: ${socket.id} enter`);

    const usersInThisRoom = users[data.room].filter(
      (user) => user.id !== socket.id
    );

    console.log(usersInThisRoom);

    io.sockets.to(socket.id).emit("all_users", usersInThisRoom);
  });

  socket.on("offer", (data) => {
    socket.to(data.offerReceiveID).emit("getOffer", {
      sdp: data.sdp,
      offerSendID: data.offerSendID,
      offerSendEmail: data.offerSendEmail,
    });
  });

  socket.on("answer", (data) => {
    socket
      .to(data.answerReceiveID)
      .emit("getAnswer", { sdp: data.sdp, answerSendID: data.answerSendID });
  });

  socket.on("candidate", (data) => {
    socket.to(data.candidateReceiveID).emit("getCandidate", {
      candidate: data.candidate,
      candidateSendID: data.candidateSendID,
    });
  });
  socket.on("message", function (name, text) {
    var msg = name + ":" + text;
    console.log(msg);
    io.emit("receive message", msg);
  });

  socket.on("disconnect", () => {
    console.log(`[${socketToRoom[socket.id]}]: ${socket.id} exit`);
    const roomID = socketToRoom[socket.id];
    let room = users[roomID];
    if (room) {
      room = room.filter((user) => user.id !== socket.id);
      users[roomID] = room;
      if (room.length === 0) {
        delete users[roomID];
        return;
      }
    }
    socket.to(roomID).emit("user_exit", { id: socket.id });
    console.log(users);
  });
});
server.listen(8000, function () {
  console.log("Started chatting server");
});
