let options = {
  appId: "c183e2e9fd8b4036bc8466b240a066ce",
  channel: "demo_channel_name",
  userName: null,
};
window.onload = async function () {
  initializeRTCClient();
  initializeRTMClient();
};

// RTC
let rtc = {
  token: null,
  userName: null,
  client: null,
  videoStream: null,
  screenStream: null,
};

const VIDEO_STREAM = "VIDEO_STREAM";
const SCREEN_STREAM = "SCREEN_STREAM";
const NO_STREAM = "NO_STREAM";
let LOCAL_AUDIO_STREAM = true;
let LOCAL_VIDEO_STREAM = true;
let STREAM_TYPE = NO_STREAM;

const initializeRTCClient = () => {
  rtc.client = AgoraRTC.createClient({
    mode: "live",
    codec: "vp8",
  });
  rtc.client.init(options.appId);

  rtc.client.on("stream-added", function (evt) {
    console.log(1);
    rtc.client.subscribe(evt.stream, handleError);
  });
  rtc.client.on("stream-subscribed", function (evt) {
    console.log(2);
    let stream = evt.stream;
    let streamId = String(stream.getId());
    addVideoStream(streamId);
    stream.play(streamId);
  });
  rtc.client.on("stream-removed", function (evt) {
    console.log(3);
    let stream = evt.stream;
    let streamId = String(stream.getId());
    stream.close();
    removeVideoStream(streamId);
  });
  rtc.client.on("peer-leave", function (evt) {
    console.log(4);
    let stream = evt.stream;
    let streamId = String(stream.getId());
    stream.close();
    removeVideoStream(streamId);
  });
};

const getTokens = async (role) => {
  let response = await fetch(
    `https://agorawarp.herokuapp.com/rtctoken?channel=${options.channel}`
  );
  let data = await response.json();
  rtc.token = data.token;

  if (role === "host" && options.userName) {
    response = await fetch(
      `https://agorawarp.herokuapp.com/rtmtoken?user=${options.userName}`
    );
    data = await response.json();
    rtm.token = data.token;
    rtmClientLogin();
  }
};

export const joinCall = async (role) => {
  rtc.client.setClientRole(role);
  if (role === "host") {
    var url = new URL(window.location.href);
    options.userName = url.searchParams.get("user");
  }
  await getTokens(role);
  rtc.client.join(
    rtc.token,
    options.channel,
    options.userName,
    (uid) => {
      if (role === "host") publishVideoStream();
    },
    handleError
  );
};

const leaveCall = async () => {
  await rtc.videoStream.stop();
  await rtc.videoStream.close();
  await rtc.client.leave();
  STREAM_TYPE = NO_STREAM;
  document.getElementById("remote-container").innerHTML = "";
  console.log("Left");
};

const toggleAudio = () => {
  if (STREAM_TYPE !== NO_STREAM) {
    if (STREAM_TYPE === VIDEO_STREAM) {
      if (LOCAL_AUDIO_STREAM) rtc.videoStream.muteAudio();
      else rtc.videoStream.unmuteAudio();
    } else if (STREAM_TYPE === SCREEN_STREAM) {
      if (LOCAL_AUDIO_STREAM) rtc.screenStream.muteAudio();
      else rtc.screenStream.unmuteAudio();
    }
    LOCAL_AUDIO_STREAM = !LOCAL_AUDIO_STREAM;
    renameBtns();
  }
};
const toggleVideo = () => {
  if (STREAM_TYPE !== NO_STREAM) {
    if (STREAM_TYPE === VIDEO_STREAM) {
      if (LOCAL_VIDEO_STREAM) rtc.videoStream.muteVideo();
      else rtc.videoStream.unmuteVideo();
    } else if (STREAM_TYPE === SCREEN_STREAM) {
      if (LOCAL_VIDEO_STREAM) rtc.screenStream.muteVideo();
      else rtc.screenStream.unmuteVideo();
    }
    LOCAL_VIDEO_STREAM = !LOCAL_VIDEO_STREAM;
    renameBtns();
  }
};

const renameBtns = () => {
  let audioText = "",
    videoText = "";
  if (LOCAL_AUDIO_STREAM) audioText = "Mute Audio";
  else audioText = "Unmute Audio";
  if (LOCAL_VIDEO_STREAM) videoText = "Mute Video";
  else videoText = "Unmute Video";
  document.getElementById("audioBtn").innerText = audioText;
  document.getElementById("videoBtn").innerText = videoText;
};

const shareScreen = async () => {
  if (navigator.mediaDevices.getDisplayMedia) {
    await rtc.client.unpublish(rtc.videoStream, handleError);
    await rtc.videoStream.stop();
    await rtc.videoStream.close();
    publishScreenStream();
  }
};

const stopShareScreen = async () => {
  await rtc.client.unpublish(rtc.screenStream, handleError);
  await rtc.screenStream.stop();
  await rtc.screenStream.close();
  publishVideoStream();
};

const publishVideoStream = () => {
  rtc.videoStream = AgoraRTC.createStream({
    audio: true,
    video: true,
  });
  rtc.videoStream.init(() => {
    rtc.videoStream.play("me");
    rtc.client.publish(rtc.videoStream, handleError);
    STREAM_TYPE = VIDEO_STREAM;
  }, handleError);
};

const publishScreenStream = () => {
  const streamSpec = {
    audio: true,
    video: false,
    screen: true,
  };
  rtc.screenStream = AgoraRTC.createStream(streamSpec);
  rtc.screenStream.init(function () {
    rtc.screenStream.play("me");
    rtc.client.publish(rtc.screenStream, handleError);
    STREAM_TYPE = SCREEN_STREAM;
  }, handleError);
};

const handleError = (err) => {
  console.error("Error: ", err);
};

const addVideoStream = (elementId) => {
  let remoteContainer = document.getElementById("remote-container");
  let streamDiv = document.createElement("div");
  streamDiv.id = elementId;
  // streamDiv.style.transform = "rotateY(180deg)";
  let streamName = document.createElement("h1");
  streamName.innerText = elementId;
  streamName.classList.add("streamName");
  streamDiv.style.position = "relative";
  streamDiv.appendChild(streamName);
  remoteContainer.appendChild(streamDiv);
};

const removeVideoStream = (elementId) => {
  let remoteDiv = document.getElementById(elementId);
  if (remoteDiv) remoteDiv.parentNode.removeChild(remoteDiv);
};

// RTM

let rtm = {
  token: null,
  userName: null,
  client: null,
  channel: null,
};

const initializeRTMClient = () => {
  rtm.client = AgoraRTM.createInstance(options.appId);
  rtm.channel = rtm.client.createChannel(options.channel);

  rtm.client.on("ConnectionStateChanged", (newState, reason) => {
    console.log(
      "on connection state changed to " + newState + " reason: " + reason
    );
  });

  rtm.channel.on("ChannelMessage", ({ text }, senderId) => {
    addChat(text, senderId);
  });
};

const rtmClientLogin = async () => {
  await rtm.client.login({ token: rtm.token, uid: options.userName });
  await rtm.channel.join();
};

const sendChannelMessage = async () => {
  const text = prompt("Enter your message", "");
  addChat(text, options.userName);
  await rtm.channel.sendMessage({ text });
};

const addChat = (msg, sender) => {
  let chatP = document.createElement("p");
  chatP.innerText = `${sender}: ${msg}`;
  document.getElementById("chat").appendChild(chatP);
};
