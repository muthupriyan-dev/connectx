/**
 * socket-client.js
 * Thin wrapper around the Socket.IO client connection. Centralizes
 * all `socket.emit`/`socket.on` calls so app.js, webrtc.js, and
 * chat.js interact with a single, clean interface.
 */

const SocketClient = (() => {
  const socket = io({
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
  });

  const listeners = {};

  function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
    socket.on(event, callback);
  }

  function emit(event, payload) {
    socket.emit(event, payload);
  }

  // ---- Connection lifecycle ----
  socket.on('connect', () => {
    console.log('[ConnectX] Connected to server:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('[ConnectX] Disconnected from server');
    UI.setConnectionStatus('disconnected', 'Disconnected');
    UI.showToast('Connection lost. Trying to reconnect…', 'error');
  });

  socket.on('connect_error', () => {
    UI.showToast('Unable to connect to server.', 'error');
  });

  socket.on('reconnect', () => {
    UI.showToast('Reconnected!', 'success', 2000);
  });

  return {
    socket,
    on,
    emit,
  };
})();
