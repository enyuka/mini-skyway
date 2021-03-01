var srv = require("http").Server();
var io = require("socket.io")(srv, {
  cors: {
    origin: "https://nishiguchi-onboarding.tk/",
    methods: ["GET", "POST"]
  }
});
var port = 3002;
srv.listen(port);
console.log("signaling server started on port:" + port);

// This callback function is called every time a socket
// tries to connect to the server
io.on("connection", function (socket) {
  // ---- multi room ----
  socket.on("enter", function (roomname) {
    socket.join(roomname);
    console.log("id=" + socket.id + " enter room=" + roomname);
    setRoomname(roomname);
  });

  function setRoomname(room) {
    socket.roomname = room;
  }

  function getRoomname() {
    var room = socket.roomname;
    return room;
  }

  function emitMessage(type, message) {
    // ----- multi room ----
    var roomname = getRoomname();

    if (roomname) {
      console.log("===== message broadcast to room -->" + roomname);
      socket.broadcast.to(roomname).emit(type, message);
    } else {
      console.log("===== message broadcast all");
      socket.broadcast.emit(type, message);
    }
  }

  // When a user send a SDP message
  // broadcast to all users in the room
  socket.on("message", function (message) {
    var date = new Date();
    message.from = socket.id;
    console.log(
      date + "id=" + socket.id + " Received Message: " + JSON.stringify(message)
    );

    // get send target
    var target = message.sendto;
    if (target) {
      console.log("===== message emit to -->" + target);
      socket.to(target).emit("message", message);
      return;
    }

    // broadcast in room
    emitMessage("message", message);
  });

  // When the user hangs up
  // broadcast bye signal to all users in the room
  socket.on("disconnect", function () {
    // close user connection
    console.log(new Date() + " Peer disconnected. id=" + socket.id);

    // --- emit ----
    emitMessage("user disconnected", { id: socket.id });

    // --- leave room --
    var roomname = getRoomname();
    if (roomname) {
      socket.leave(roomname);
    }
  });
});
