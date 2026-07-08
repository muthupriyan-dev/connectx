/**
 * webrtc.js
 * Manages local media capture, RTCPeerConnection lifecycle, and
 * signaling relay via SocketClient. Exposes simple start/stop/skip
 * controls consumed by app.js.
 */

const WebRTC = (() => {
  let localStream = null;
  let peerConnection = null;
  let isInitiator = false;
  let currentFacingMode = 'user';
  let micEnabled = true;
  let camEnabled = true;

  const localVideo = document.getElementById('local-video');
  const remoteVideo = document.getElementById('remote-video');
  const landingPreview = document.getElementById('landing-preview');
  const remotePlaceholder = document.getElementById('remote-placeholder');

  let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]; // fallback until fetched

  /** Fetches ICE server config (STUN/TURN) from the backend. */
  async function loadIceConfig() {
    try {
      const res = await fetch('/api/ice-config');
      const data = await res.json();
      if (data.iceServers && data.iceServers.length) {
        iceServers = data.iceServers;
      }
    } catch (err) {
      console.warn('[ConnectX] Could not load ICE config, using default STUN.', err);
    }
  }

  /** Requests camera/mic access and attaches the stream to the landing preview. */
  async function initLocalPreview() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode },
        audio: true,
      });
      landingPreview.srcObject = localStream;
      localVideo.srcObject = localStream;
      document.getElementById('preview-hint').style.display = 'none';
      return true;
    } catch (err) {
      console.error('[ConnectX] getUserMedia failed:', err);
      UI.showToast('Camera/microphone access is required to start.', 'error');
      return false;
    }
  }

  /** Creates a fresh RTCPeerConnection wired to the signaling channel. */
  function createPeerConnection() {
    const pc = new RTCPeerConnection({ iceServers });

    localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        SocketClient.emit('signal', { type: 'ice-candidate', data: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
      remotePlaceholder.style.display = 'none';
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        UI.setConnectionStatus('connected', 'Connected');
      } else if (['disconnected', 'failed'].includes(pc.connectionState)) {
        UI.setConnectionStatus('disconnected', 'Connection lost');
      } else if (pc.connectionState === 'connecting') {
        UI.setConnectionStatus('connecting', 'Connecting…');
      }
    };

    return pc;
  }

  /** Starts a new WebRTC session as either the offer initiator or answerer. */
  async function startSession(initiatorFlag) {
    isInitiator = initiatorFlag;
    peerConnection = createPeerConnection();
    remotePlaceholder.style.display = 'flex';
    remoteVideo.srcObject = null;

    if (isInitiator) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      SocketClient.emit('signal', { type: 'offer', data: offer });
    }
  }

  /** Handles incoming signaling messages relayed by the server. */
  function handleSignal(payload) {
    if (!peerConnection) return;

    if (payload.type === 'offer') {
      peerConnection.setRemoteDescription(new RTCSessionDescription(payload.data))
        .then(() => peerConnection.createAnswer())
        .then((answer) => peerConnection.setLocalDescription(answer))
        .then(() => {
          SocketClient.emit('signal', { type: 'answer', data: peerConnection.localDescription });
        })
        .catch((err) => console.error('[ConnectX] Error handling offer:', err));
    } else if (payload.type === 'answer') {
      peerConnection.setRemoteDescription(new RTCSessionDescription(payload.data))
        .catch((err) => console.error('[ConnectX] Error handling answer:', err));
    } else if (payload.type === 'ice-candidate') {
      peerConnection.addIceCandidate(new RTCIceCandidate(payload.data))
        .catch((err) => console.error('[ConnectX] Error adding ICE candidate:', err));
    }
  }

  /** Tears down the current peer connection (on skip/leave/partner-left). */
  function endSession() {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    remoteVideo.srcObject = null;
    remotePlaceholder.style.display = 'flex';
  }

  /** Toggles the local microphone track on/off. Returns new state. */
  function toggleMic() {
    if (!localStream) return micEnabled;
    micEnabled = !micEnabled;
    localStream.getAudioTracks().forEach((track) => { track.enabled = micEnabled; });
    return micEnabled;
  }

  /** Toggles the local camera track on/off. Returns new state. */
  function toggleCam() {
    if (!localStream) return camEnabled;
    camEnabled = !camEnabled;
    localStream.getVideoTracks().forEach((track) => { track.enabled = camEnabled; });
    return camEnabled;
  }

  /** Switches between front/back camera on devices that support it. */
  async function switchCamera() {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode },
        audio: true,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStream.getVideoTracks()[0];

      if (peerConnection) {
        const sender = peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(newVideoTrack);
      }

      oldVideoTrack.stop();
      localStream.removeTrack(oldVideoTrack);
      localStream.addTrack(newVideoTrack);
      localVideo.srcObject = localStream;
    } catch (err) {
      console.warn('[ConnectX] Camera switch failed (device may not support it):', err);
      UI.showToast('Unable to switch camera on this device.', 'error');
    }
  }

  function toggleFullscreen() {
    const stage = document.querySelector('.video-stage');
    if (!document.fullscreenElement) {
      stage.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  async function togglePiP() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (remoteVideo.requestPictureInPicture) {
        await remoteVideo.requestPictureInPicture();
      }
    } catch (err) {
      UI.showToast('Picture-in-Picture is not supported here.', 'error');
    }
  }

  function stopAllTracks() {
    localStream?.getTracks().forEach((track) => track.stop());
  }

  return {
    loadIceConfig,
    initLocalPreview,
    startSession,
    handleSignal,
    endSession,
    toggleMic,
    toggleCam,
    switchCamera,
    toggleFullscreen,
    togglePiP,
    stopAllTracks,
    get localStream() { return localStream; },
  };
})();
