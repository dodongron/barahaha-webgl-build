// create Agora client
var client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

var localTracks = {
  videoTrack: null,
  audioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null,
  playerName: null,
};

// the demo can auto join channel with params in url
$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  options.playerName = urlParams.get("userName");
  if (options.appid && options.channel) {
    $("#appid").val(options.appid);
    $("#token").val(options.token);
    $("#channel").val(options.channel);
    $("#playerName").val(options.playerName);
    $("#join-form").submit();
  }
})

$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  
  try {
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    options.channel = $("#channel").val();
    options.playerName = $("#playerName").val();

    await join();
    if(options.token) {
      $("#success-alert-with-token").css("display", "block");
    } else {
      $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
      $("#success-alert").css("display", "block");

      var leaveButton = document.getElementById("leave");
      leaveButton.hidden = false;
    }
  } catch (error) {
    console.error(error);
  } finally {

    // $("#join").attr("hidden", true);
  }
});

$("#leave").click(function (e) {
  e.preventDefault();
  leave();
})

async function handleJoinChannel(appid, channel, playerName) {
  // console.log("Joining Channel with the following parameters:");
  // console.log("App ID:", appid);
  // console.log("Channel:", channel);

  options.appid = appid;
  options.channel = channel;
  options.playerName = playerName;
  await join();
}


async function join() {
  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  var currentDate = new Date();
  var formattedDate = currentDate.toISOString().slice(0, 19).replace("T", " "); // Format: "YYYY-MM-DD HH:mm:ss"

  options.playerName = options.playerName + formattedDate;

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [ options.uid, localTracks.audioTrack, localTracks.videoTrack ] = await Promise.all([
    client.join(options.appid, "Channel1", options.token || null, options.playerName),
    AgoraRTC.createMicrophoneAudioTrack(),
    AgoraRTC.createCameraVideoTrack()
  ]);
  // console.log("************************************");
  // console.log("options.uid: "+options.uid);
  // console.log("************************************");
  // play local video track
  localTracks.videoTrack.play("local-player");
  // $("#local-player-name").text(`localVideo(${options.uid})`);
  $("#local-player-name").text(`${options.uid}`);

  // publish local tracks to channel
  await client.publish(Object.values(localTracks));

  $("#leave").attr("hidden", false);
  $("#leave").attr("disabled", false);
  // $("#join").attr("hidden", true);

  console.log("********************************");
  console.log("New User: "+options.uid);
  console.log("********************************");
  
}

async function leave() {
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if(track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await client.leave();

  $("#local-player-name").text("");

  $("#leave").attr("hidden", true);
  $("#leave").attr("disabled", true);
  // $("#join").attr("hidden", false);
  $("#join").attr("disabled", false);

  console.log("client leaves channel success");
}

async function subscribe(user, mediaType) {
  console.log("***********************************");
  console.log("User: "+JSON.stringify(user));
  console.log("***********************************");
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  
  console.log("subscribe success");
  if (mediaType === 'video') {
    const playerWrapper  = $(`
      <div id="player-wrapper-${uid}">
        <p class="player-name">RemoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
    $("#remote-playerlist").append(playerWrapper);
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
}

function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

function handleUserUnpublished(user) {
  const id = user.uid;
  console.log("***********************************");
  console.log("User ID: "+id);
  console.log("***********************************");
  delete remoteUsers[id];
  $(`#player-wrapper-${id}`).remove();
}