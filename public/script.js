const socket = io();

const homeSection = document.getElementById('home');
const callSection = document.getElementById('call');
const connectBtn = document.getElementById('connectBtn');
const userList = document.getElementById('userList');
const localVideoElement = document.getElementById('localVideo');
const remoteVideoElement = document.getElementById('remoteVideo');
const endCallBtn = document.getElementById('endCallBtn');

let localStream;
let remoteStream;
let rtcPeerConnection;

// Show the home section
function showHomeSection() {
  homeSection.style.display = 'block';
  callSection.style.display = 'none';
}

// Show the call section
function showCallSection() {
  homeSection.style.display = 'none';
  callSection.style.display = 'block';
}

// Add user to the user list
function addUserToList(user) {
  const userItem = document.createElement('div');
  userItem.textContent = user.username;
  userList.appendChild(userItem);
}

// Remove user from the user list
function removeUserFromList(user) {
  const userItem = userList.querySelector(`div:contains("${user.username}")`);
  if (userItem) {
    userList.removeChild(userItem);
  }
}

// Start call with the selected user
function startCall(user) {
  showCallSection();

  const configuration = { iceServers: [{ urls: 'stun:stun.stunprotocol.org' }] };
  rtcPeerConnection = new RTCPeerConnection(configuration);

  rtcPeerConnection.addEventListener('icecandidate', handleICECandidate);
  rtcPeerConnection.addEventListener('track', handleTrack);

  localStream.getTracks().forEach((track) => {
    rtcPeerConnection.addTrack(track, localStream);
  });

  rtcPeerConnection.createOffer()
    .then((offer) => rtcPeerConnection.setLocalDescription(offer))
    .then(() => {
      socket.emit('startCall', user);
    })
    .catch((error) => {
      console.error('Error creating offer:', error);
    });
}

// End the ongoing call
function endCall() {
  rtcPeerConnection.close();
  localStream.getTracks().forEach((track) => {
    track.stop();
  });

  showHomeSection();
}

// Handle ICE candidate event
function handleICECandidate(event) {
  if (event.candidate) {
    socket.emit('iceCandidate', event.candidate);
  }
}

// Handle track event
function handleTrack(event) {
  remoteVideoElement.srcObject = event.streams[0];
  remoteStream = event.streams[0];
}

// Get user media and display local video
function getUserMedia() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
      localStream = stream;
      localVideoElement.srcObject = stream;
    })
    .catch((error) => {
      console.error('Error accessing media devices:', error);
    });
}

// Event listener for the connect button
connectBtn.addEventListener('click', () => {
  getUserMedia();
  socket.emit('connectUser');
});

// Event listener for the end call button
endCallBtn.addEventListener('click', () => {
  endCall();
});

// Socket event: connected
socket.on('connected', (user) => {
  console.log(`Connected as ${user.username}`);
});

// Socket event: userList
socket.on('userList', (users) => {
  userList.innerHTML = '';
  users.forEach((user) => {
    addUserToList(user);
  });
});

// Socket event: userConnected
socket.on('userConnected', (user) => {
  addUserToList(user);
});

// Socket event: userDisconnected
socket.on('userDisconnected', (user) => {
  removeUserFromList(user);
});

// Socket event: startCall
socket.on('startCall', (user) => {
  startCall(user);
});

// Socket event: iceCandidate
socket.on('iceCandidate', (candidate) => {
  rtcPeerConnection.addIceCandidate(candidate);
});
