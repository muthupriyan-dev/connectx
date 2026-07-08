/**
 * chat.js
 * Handles the live text chat panel: sending/receiving messages,
 * rendering message bubbles with timestamps, typing indicator,
 * and auto-scrolling behavior.
 */

const Chat = (() => {
  const messagesContainer = document.getElementById('messages-container');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const typingIndicator = document.getElementById('typing-indicator');

  let typingTimeout = null;

  function formatTime(ts) {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /** Renders a single chat message bubble. Text content is set via
   *  textContent (never innerHTML) to avoid any XSS risk client-side,
   *  even though the server already sanitizes/escapes messages. */
  function renderMessage({ message, sender, timestamp, self }) {
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${self ? 'self' : 'partner'}`;

    const textEl = document.createElement('span');
    textEl.textContent = message;

    const timeEl = document.createElement('span');
    timeEl.className = 'message-time';
    timeEl.textContent = self ? `You · ${formatTime(timestamp)}` : `${sender} · ${formatTime(timestamp)}`;

    bubble.appendChild(textEl);
    bubble.appendChild(timeEl);
    messagesContainer.appendChild(bubble);
    scrollToBottom();
  }

  function renderSystemMessage(text) {
    const el = document.createElement('div');
    el.className = 'system-message';
    el.textContent = text;
    messagesContainer.appendChild(el);
    scrollToBottom();
  }

  function clearMessages() {
    messagesContainer.innerHTML = '';
  }

  function showTyping() {
    typingIndicator.hidden = false;
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      typingIndicator.hidden = true;
    }, 2000);
  }

  function init() {
    SocketClient.on('chat-message', (payload) => renderMessage(payload));
    SocketClient.on('typing', () => showTyping());

    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      SocketClient.emit('chat-message', { message: text });
      chatInput.value = '';
    });

    let lastTypingEmit = 0;
    chatInput.addEventListener('input', () => {
      const now = Date.now();
      if (now - lastTypingEmit > 800) {
        SocketClient.emit('typing');
        lastTypingEmit = now;
      }
    });

    // Enter key submits (default form behavior already covers this,
    // but explicit handling avoids issues with virtual keyboards on mobile)
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.requestSubmit();
      }
    });
  }

  return {
    init,
    renderMessage,
    renderSystemMessage,
    clearMessages,
  };
})();
