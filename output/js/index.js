let localVideo;
let container;
let remoteVideos = [];

// ---- for multi party -----
const peerConnections = [];
let mini_peer;

window.onload = () => {
  localVideo = document.getElementById("local_video");
  container = document.getElementById("container");

  // --- prefix -----
  navigator.getUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;
  RTCPeerConnection =
    window.RTCPeerConnection ||
    window.webkitRTCPeerConnection ||
    window.mozRTCPeerConnection;
  RTCSessionDescription =
    window.RTCSessionDescription ||
    window.webkitRTCSessionDescription ||
    window.mozRTCSessionDescription;

    mini_peer = new Peer("id", "audio", "video", true);
};

// ----- use socket.io ---
let room = getRoomName();
socket.on("connect", function (evt) {
  console.log("socket.io connected. enter room=" + room);
  socket.emit("enter", room);
});
socket.on("message", function (message) {
  console.log("message:", message);
  let fromId = message.from;

  if (message.type === "offer") {
    // -- got offer ---
    console.log("Received offer ...");
    let offer = new RTCSessionDescription(message);
    setOffer(fromId, offer);
  } else if (message.type === "answer") {
    // --- got answer ---
    console.log("Received answer ...");
    let answer = new RTCSessionDescription(message);
    setAnswer(fromId, answer);
  } else if (message.type === "candidate") {
    // --- got ICE candidate ---
    console.log("Received ICE candidate ...");
    let candidate = new RTCIceCandidate(message.ice);
    console.log(candidate);
    addIceCandidate(fromId, candidate);
  } else if (message.type === "call me") {
    if (!mini_peer.isReadyToConnect()) {
      console.log("Not ready to connect, so ignore");
      return;
    } else if (!mini_peer.canConnectMore()) {
      console.warn("TOO MANY connections, so ignore");
      return;
    }

    if (isConnectedWith(fromId)) {
      // already connnected, so skip
      console.log("already connected, so ignore");
      return;
    } else {
      // connect new party
      makeOffer(fromId);
    }
  } else if (message.type === "bye") {
    if (isConnectedWith(fromId)) {
      stopConnection(fromId);
    }
  }
});
socket.on("user disconnected", function (evt) {
  console.log("====user disconnected==== evt:", evt);
  let id = evt.id;
  if (isConnectedWith(id)) {
    stopConnection(id);
  }
});

// --- broadcast message to all members in room
function emitRoom(msg) {
  socket.emit("message", msg);
}

function emitTo(id, msg) {
  msg.sendto = id;
  socket.emit("message", msg);
}

// -- room蜷阪ｒ蜿門ｾ� --
function getRoomName() {
  // 縺溘→縺医�縲� URL縺ｫ  ?roomname  縺ｨ縺吶ｋ
  let url = document.location.href;
  let args = url.split("?");
  if (args.length > 1) {
    let room = args[1];
    if (room != "") {
      return room;
    }
  }
  return "_testroom";
}

function isConnectedWith(id) {
  if (peerConnections[id]) {
    return true;
  } else {
    return false;
  }
}

function addConnection(id, peer) {
  peerConnections[id] = peer;
}

function getConnection(id) {
  let peer = peerConnections[id];

  return peer;
}

function deleteConnection(id) {
  delete peerConnections[id];
}

function stopConnection(id) {
  detachVideo(id);

  if (isConnectedWith(id)) {
    let peer = getConnection(id);
    peer.close();
    deleteConnection(id);
  }
}

function stopAllConnection() {
  for (let id in peerConnections) {
    stopConnection(id);
  }
}

// --- video elements ---
function attachVideo(id, stream) {
  let video = addRemoteVideoElement(id);
  playVideo(video, stream);
  video.volume = 1.0;
}

function detachVideo(id) {
  let video = getRemoteVideoElement(id);
  pauseVideo(video);
  deleteRemoteVideoElement(id);
}

function isRemoteVideoAttached(id) {
  if (remoteVideos[id]) {
    return true;
  } else {
    return false;
  }
}

function addRemoteVideoElement(id) {
  let video = createVideoElement("remote_video_" + id);
  remoteVideos[id] = video;
  return video;
}

function getRemoteVideoElement(id) {
  let video = remoteVideos[id];

  return video;
}

function deleteRemoteVideoElement(id) {
  removeVideoElement("remote_video_" + id);
  delete remoteVideos[id];
}

function createVideoElement(elementId) {
  let video = document.createElement("video");
  video.width = "240";
  video.height = "180";
  video.id = elementId;

  video.style.border = "solid black 1px";
  video.style.margin = "2px";

  container.appendChild(video);

  return video;
}

function removeVideoElement(elementId) {
  let video = document.getElementById(elementId);

  container.removeChild(video);
  return video;
}

// ---------------------- media handling -----------------------
// start local video
function startVideo() {
  mini_peer.setLocalStreamToElement({ video: true, audio: true }, localVideo);
}

// stop local video
function stopVideo() {
  pauseVideo(localVideo);
  stopLocalStream(mini_peer.localStream);
  mini_peer.localStream = null;
}

function stopLocalStream(stream) {
  let tracks = stream.getTracks();
  if (!tracks) {
    console.warn("NO tracks");
    return;
  }

  for (let track of tracks) {
    track.stop();
  }
}

function getDeviceStream(option) {
  if ("getUserMedia" in navigator.mediaDevices) {
    console.log("navigator.mediaDevices.getUserMadia");
    return navigator.mediaDevices.getUserMedia(option);
  } else {
    console.log("wrap navigator.getUserMadia with Promise");
    return new Promise(function (resolve, reject) {
      navigator.getUserMedia(option, resolve, reject);
    });
  }
}

function playVideo(element, stream) {
  console.log(element);
  if ("srcObject" in element) {
    element.srcObject = stream;
  } else {
    element.src = window.URL.createObjectURL(stream);
  }
  element.play();
  element.volume = 0;
}

function pauseVideo(element) {
  element.pause();
  if ("srcObject" in element) {
    element.srcObject = null;
  } else {
    if (element.src && element.src !== "") {
      window.URL.revokeObjectURL(element.src);
    }
    element.src = "";
  }
}

function sendSdp(id, sessionDescription) {
  console.log("---sending sdp ---");

  let message = { type: sessionDescription.type, sdp: sessionDescription.sdp };
  console.log("sending SDP=" + message);
  emitTo(id, message);
}

function sendIceCandidate(id, candidate) {
  console.log("---sending ICE candidate ---");
  let obj = { type: "candidate", ice: candidate };

  if (isConnectedWith(id)) {
    emitTo(id, obj);
  } else {
    console.warn("connection NOT EXIST or ALREADY CLOSED. so skip candidate");
  }
}

// ---------------------- connection handling -----------------------
function prepareNewConnection(id) {
  let pc_config = { iceServers: [] };
  let peer = new RTCPeerConnection(pc_config);

  // --- on get remote stream ---
  if ("ontrack" in peer) {
    peer.ontrack = function (event) {
      let stream = event.streams[0];
      console.log("-- peer.ontrack() stream.id=" + stream.id);
      if (isRemoteVideoAttached(id)) {
        console.log("stream already attached, so ignore");
      } else {
        attachVideo(id, stream);
      }
    };
  } else {
    peer.onaddstream = function (event) {
      let stream = event.stream;
      console.log("-- peer.onaddstream() stream.id=" + stream.id);
      attachVideo(id, stream);
    };
  }

  // --- on get local ICE candidate
  peer.onicecandidate = function (evt) {
    if (evt.candidate) {
      console.log(evt.candidate);

      // Trickle ICE 縺ｮ蝣ｴ蜷医�縲！CE candidate繧堤嶌謇九↓騾√ｋ
      sendIceCandidate(id, evt.candidate);

      // Vanilla ICE 縺ｮ蝣ｴ蜷医↓縺ｯ縲∽ｽ輔ｂ縺励↑縺�
    } else {
      console.log("empty ice event");
    }
  };

  // --- when need to exchange SDP ---
  peer.onnegotiationneeded = function (evt) {
    console.log("-- onnegotiationneeded() ---");
  };

  // --- other events ----
  peer.onicecandidateerror = function (evt) {
    console.error("ICE candidate ERROR:", evt);
  };

  peer.onsignalingstatechange = function () {
    console.log("== signaling status=" + peer.signalingState);
  };

  peer.oniceconnectionstatechange = function () {
    console.log("== ice connection status=" + peer.iceConnectionState);
    if (peer.iceConnectionState === "disconnected") {
      console.log("-- disconnected --");
      stopConnection(id);
    }
  };

  peer.onicegatheringstatechange = function () {
    console.log("==***== ice gathering state=" + peer.iceGatheringState);
  };

  peer.onconnectionstatechange = function () {
    console.log("==***== connection state=" + peer.connectionState);
  };

  peer.onremovestream = function (event) {
    console.log("-- peer.onremovestream()");
    deleteRemoteStream(id);
    detachVideo(id);
  };

  // -- add local stream --
  if (mini_peer.localStream) {
    console.log("Adding local stream...");
    peer.addStream(mini_peer.localStream);
  } else {
    console.warn("no local stream, but continue.");
  }

  return peer;
}

function makeOffer(id) {
  peerConnection = prepareNewConnection(id);
  addConnection(id, peerConnection);

  peerConnection
    .createOffer()
    .then(function (sessionDescription) {
      console.log("createOffer() succsess in promise");
      return peerConnection.setLocalDescription(sessionDescription);
    })
    .then(function () {
      console.log("setLocalDescription() succsess in promise");

      // -- Trickle ICE 縺ｮ蝣ｴ蜷医�縲∝�譛欖DP繧堤嶌謇九↓騾√ｋ --
      sendSdp(id, peerConnection.localDescription);

      // -- Vanilla ICE 縺ｮ蝣ｴ蜷医↓縺ｯ縲√∪縺�SDP縺ｯ騾√ｉ縺ｪ縺� --
    })
    .catch(function (err) {
      console.error(err);
    });
}

function setOffer(id, sessionDescription) {
  let peerConnection = prepareNewConnection(id);
  addConnection(id, peerConnection);

  peerConnection
    .setRemoteDescription(sessionDescription)
    .then(function () {
      console.log("setRemoteDescription(offer) succsess in promise");
      makeAnswer(id);
    })
    .catch(function (err) {
      console.error("setRemoteDescription(offer) ERROR: ", err);
    });
}

function makeAnswer(id) {
  console.log("sending Answer. Creating remote session description...");
  let peerConnection = getConnection(id);
  if (!peerConnection) {
    console.error("peerConnection NOT exist!");
    return;
  }

  peerConnection
    .createAnswer()
    .then(function (sessionDescription) {
      console.log("createAnswer() succsess in promise");
      return peerConnection.setLocalDescription(sessionDescription);
    })
    .then(function () {
      console.log("setLocalDescription() succsess in promise");

      // -- Trickle ICE 縺ｮ蝣ｴ蜷医�縲∝�譛欖DP繧堤嶌謇九↓騾√ｋ --
      sendSdp(id, peerConnection.localDescription);

      // -- Vanilla ICE 縺ｮ蝣ｴ蜷医↓縺ｯ縲√∪縺�SDP縺ｯ騾√ｉ縺ｪ縺� --
    })
    .catch(function (err) {
      console.error(err);
    });
}

function setAnswer(id, sessionDescription) {
  let peerConnection = getConnection(id);
  if (!peerConnection) {
    console.error("peerConnection NOT exist!");
    return;
  }

  peerConnection
    .setRemoteDescription(sessionDescription)
    .then(function () {
      console.log("setRemoteDescription(answer) succsess in promise");
    })
    .catch(function (err) {
      console.error("setRemoteDescription(answer) ERROR: ", err);
    });
}

// --- tricke ICE ---
function addIceCandidate(id, candidate) {
  if (!isConnectedWith(id)) {
    console.warn(
      "NOT CONNEDTED or ALREADY CLOSED with id=" + id + ", so ignore candidate"
    );
    return;
  }

  let peerConnection = getConnection(id);
  if (peerConnection) {
    peerConnection.addIceCandidate(candidate);
  } else {
    console.error("PeerConnection not exist!");
    return;
  }
}

// start PeerConnection
function connect() {
  mini_peer.connect();
}

// close PeerConnection
function hangUp() {
  emitRoom({ type: "bye" });
  stopAllConnection();
}