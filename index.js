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
    origin: ["http://localhost:3000"],
    credential: true,
  },
  handlePreflightRequest: (req, res) => {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "http://localhost:3000",
      "Access-Control-Allow-Methods": "GET,POST",
      "Access-Control-Allow-Credentials": true,
    });
    res.end();
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
    io.sockets
      .to(data.room)
      .emit("message", `${socket}.id}님이 입장하셨습니다.`);
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
    var msg = {
      name: name,
      text: text,
    };
    console.log("msg:" + msg);
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
server.listen(8001, function () {
  console.log("Started chatting server");
});
