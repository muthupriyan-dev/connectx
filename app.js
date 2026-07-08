/**
 * app.js
 * Main application controller. Wires together UI, WebRTC, Chat,
 * and SocketClient modules, and drives the landing -> searching
 * -> chat screen flow.
 */

(function App() {
  const joinVideoBtn = document.getElementById('join-video-btn');
  const joinTextBtn = document.getElementById('join-text-btn');
  const cancelSearchBtn = document.getElementById('cancel-search-btn');
  const skipBtn = document.getElementById('skip-btn');
  const leaveBtn = document.getElementById('leave-btn');
  const toggleMicBtn = document.getElementById('toggle-mic-btn');
  const toggleCamBtn = document.getElementById('toggle-cam-btn');
  const switchCamBtn = document.getElementById('switch-cam-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const pipBtn = document.getElementById('pip-btn');
  const blockBtn = document.getElementById('block-btn');
  const roomIdText = document.getElementById('room-id-text');
  const partnerNameLabel = document.getElementById('partner-name-label');
  const localWrapper = document.getElementById('local-wrapper');

  let videoModeRequested = true; // true = video+audio, false = text-only (no camera)
  let currentRoomId = null;

  // ---------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------
  UI.initThemeToggle();
  UI.initSidebar();
  UI.initRoomIdCopy();
  UI.initReportModal((reason) => {
    SocketClient.emit('report-user', { reason });
    UI.showToast('Report submitted. Thank you for keeping ConnectX safe.', 'success');
  });
  Chat.init();
  WebRTC.loadIceConfig();

  UI.initKeyboardShortcuts({
    onSkip: () => { if (document.getElementById('chat-screen').classList.contains('active')) requestSkip(); },
    onLeave: () => { if (document.getElementById('chat-screen').classList.contains('active')) requestLeave(); },
    onToggleMic: () => handleToggleMic(),
    onToggleCam: () => handleToggleCam(),
  });

  // ---------------------------------------------------------------
  // Online counter
  // ---------------------------------------------------------------
  SocketClient.on('online-count', ({ count }) => {
    document.getElementById('online-count').textContent = count;
  });

  // ---------------------------------------------------------------
  // Landing screen actions
  // ---------------------------------------------------------------
  async function beginSearch(videoMode) {
    videoModeRequested = videoMode;

    if (videoMode) {
      const ok = await WebRTC.initLocalPreview();
      if (!ok) return;
      localWrapper.style.display = 'block';
    } else {
      localWrapper.style.display = 'none';
    }

    UI.showScreen('searching');
    SocketClient.emit('find-partner');
  }

  joinVideoBtn.addEventListener('click', () => beginSearch(true));
  joinTextBtn.addEventListener('click', () => beginSearch(false));

  cancelSearchBtn.addEventListener('click', () => {
    SocketClient.emit('leave-chat');
    WebRTC.stopAllTracks();
    UI.showScreen('landing');
  });

  // ---------------------------------------------------------------
  // Matchmaking events from server
  // ---------------------------------------------------------------
  SocketClient.on('searching', () => {
    UI.showScreen('searching');
  });

  SocketClient.on('matched', async ({ roomId, isInitiator, partnerName }) => {
    currentRoomId = roomId;
    roomIdText.textContent = roomId.slice(0, 8);
    partnerNameLabel.textContent = partnerName ? `· ${partnerName}` : '';
    Chat.clearMessages();
    Chat.renderSystemMessage(`You're now chatting with ${partnerName || 'a stranger'}. Say hi! 👋`);

    UI.showScreen('chat');
    UI.setConnectionStatus('connecting', 'Connecting…');

    if (videoModeRequested) {
      await WebRTC.startSession(isInitiator);
    }
  });

  SocketClient.on('signal', (payload) => {
    WebRTC.handleSignal(payload);
  });

  SocketClient.on('partner-left', () => {
    UI.showToast('Your partner has left. Searching for someone new…', 'info');
    WebRTC.endSession();
    UI.showScreen('searching');
    SocketClient.emit('find-partner');
  });

  SocketClient.on('error-message', ({ message }) => {
    UI.showToast(message, 'error');
  });

  SocketClient.on('report-received', () => {
    UI.showToast('Report received. Our moderation team will review it.', 'success');
  });

  // ---------------------------------------------------------------
  // In-chat controls
  // ---------------------------------------------------------------
  function requestSkip() {
    WebRTC.endSession();
    SocketClient.emit('skip-partner');
    UI.showScreen('searching');
  }

  function requestLeave() {
    WebRTC.endSession();
    WebRTC.stopAllTracks();
    SocketClient.emit('leave-chat');
    UI.showScreen('landing');
  }

  function handleToggleMic() {
    const enabled = WebRTC.toggleMic();
    toggleMicBtn.classList.toggle('active', enabled);
    toggleMicBtn.classList.toggle('muted-off', !enabled);
    toggleMicBtn.textContent = enabled ? '🎤' : '🔇';
  }

  function handleToggleCam() {
    const enabled = WebRTC.toggleCam();
    toggleCamBtn.classList.toggle('active', enabled);
    toggleCamBtn.classList.toggle('muted-off', !enabled);
    toggleCamBtn.textContent = enabled ? '📹' : '🚫';
  }

  skipBtn.addEventListener('click', requestSkip);
  leaveBtn.addEventListener('click', requestLeave);
  toggleMicBtn.addEventListener('click', handleToggleMic);
  toggleCamBtn.addEventListener('click', handleToggleCam);
  switchCamBtn.addEventListener('click', () => WebRTC.switchCamera());
  fullscreenBtn.addEventListener('click', () => WebRTC.toggleFullscreen());
  pipBtn.addEventListener('click', () => WebRTC.togglePiP());
  blockBtn.addEventListener('click', () => {
    SocketClient.emit('block-user');
    UI.showToast('User blocked. You will not be matched with them again.', 'success');
    requestSkip();
  });

  // Warn before leaving the tab mid-chat
  window.addEventListener('beforeunload', (e) => {
    if (document.getElementById('chat-screen').classList.contains('active')) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
})();
