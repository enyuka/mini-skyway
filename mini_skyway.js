const socketServer = "https://nishiguchi-onboarding.tk";
const socket = io.connect(socketServer, {secure: true});
const MAX_CONNECTION_COUNT = 3;

class Peer {
  constructor(id, audioInput, videoInput, roomFlag) {
    this.id = id;
    this.audioInput = audioInput;
    this.videoInput = videoInput;
    this.roomFlag = roomFlag;

    this.localStream;
    this.remoteStreams = [];
    this.peerConnections = [];

    socket.emit("mini_construct", { message: "constructor" });
  }

  isReadyToConnect() {
    if (this.localStream) {
      return true;
    }
    return false;
  }

  canConnectMore() {
    return this.getConnectionCount() < MAX_CONNECTION_COUNT;
  }

  getConnectionCount() {
    return this.peerConnections.length;
  }

  connect(id) {
    if (!this.localStream) {
      return;
    }

    if (this.remoteStreams.length >= MAX_CONNECTION_COUNT) {
      return;
    }

    if (this.remoteStreams[id]) {
      return;
    }

    emitRoom({ type: "call me" });
  }

  disconnect() {
    // TODO
  }

  // ローカルマシンのストリームを特定の要素に紐付ける
  setLocalStreamToElement(constraints, element) {
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        element.srcObject = stream;
        this.localStream = stream;
        element.play();
      })
      .catch((error) => {
        // 失敗時にはエラーログを出力
        console.error("mediaDevice.getUserMedia() error:", error);
        return;
      });
  }

  // ローカルマシンのストリームを停止する
  stopLocalStream(element) {
    element.pause();
    element.srcObject = null;

    const tracks = this.localStream.getTracks();
    for (let track of tracks) {
      track.stop();
    }
  }
}
