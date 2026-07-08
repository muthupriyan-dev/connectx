/**
 * ui.js
 * Generic UI helpers shared across the app: screen switching,
 * toast notifications, theme toggling, sidebar open/close, and
 * the report modal. Kept free of Socket.IO/WebRTC logic.
 */

const UI = (() => {
  const screens = {
    landing: document.getElementById('landing-screen'),
    searching: document.getElementById('searching-screen'),
    chat: document.getElementById('chat-screen'),
  };

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
  }

  // ---- Toasts ----
  const toastContainer = document.getElementById('toast-container');

  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ---- Theme toggle ----
  function initThemeToggle() {
    const stored = null; // no localStorage in artifact context; default dark each load
    const body = document.body;
    const buttons = [
      document.getElementById('theme-toggle'),
      document.getElementById('theme-toggle-chat'),
    ].filter(Boolean);

    function applyIcon() {
      const isDark = body.getAttribute('data-theme') === 'dark';
      buttons.forEach((btn) => {
        btn.textContent = isDark ? '🌙' : '☀️';
      });
    }

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const current = body.getAttribute('data-theme');
        body.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
        applyIcon();
      });
    });

    applyIcon();
    if (stored) body.setAttribute('data-theme', stored);
  }

  // ---- Sidebar (mobile chat drawer) ----
  function initSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    const openBtn = document.getElementById('open-sidebar-btn');
    const closeBtn = document.getElementById('close-sidebar-btn');

    openBtn?.addEventListener('click', () => sidebar.classList.add('open'));
    closeBtn?.addEventListener('click', () => sidebar.classList.remove('open'));
  }

  // ---- Report modal ----
  function initReportModal(onSubmit) {
    const modal = document.getElementById('report-modal');
    const reportBtn = document.getElementById('report-btn');
    const cancelBtn = document.getElementById('report-cancel-btn');
    const submitBtn = document.getElementById('report-submit-btn');
    const textarea = document.getElementById('report-reason');

    reportBtn?.addEventListener('click', () => {
      modal.hidden = false;
      textarea.value = '';
      textarea.focus();
    });
    cancelBtn?.addEventListener('click', () => {
      modal.hidden = true;
    });
    submitBtn?.addEventListener('click', () => {
      const reason = textarea.value.trim();
      if (!reason) {
        showToast('Please describe the issue before submitting.', 'error');
        return;
      }
      onSubmit(reason);
      modal.hidden = true;
    });
  }

  // ---- Connection status ----
  function setConnectionStatus(state, text) {
    const dot = document.getElementById('connection-status-dot');
    const label = document.getElementById('connection-status-text');
    dot.className = `status-dot ${state}`; // connected | connecting | disconnected
    label.textContent = text;
  }

  // ---- Copy Room ID ----
  function initRoomIdCopy() {
    const chip = document.getElementById('room-id-chip');
    chip?.addEventListener('click', async () => {
      const roomId = document.getElementById('room-id-text').textContent;
      if (!roomId || roomId === '—') return;
      try {
        await navigator.clipboard.writeText(roomId);
        showToast('Room ID copied to clipboard', 'success', 2000);
      } catch (err) {
        showToast('Could not copy Room ID', 'error');
      }
    });
  }

  // ---- Keyboard shortcuts ----
  function initKeyboardShortcuts(handlers) {
    document.addEventListener('keydown', (e) => {
      // Ignore shortcuts while typing in the chat input
      if (document.activeElement && document.activeElement.id === 'chat-input') {
        if (e.key === 'Escape') document.activeElement.blur();
        return;
      }
      switch (e.key.toLowerCase()) {
        case 'n':
          handlers.onSkip?.();
          break;
        case 'escape':
          handlers.onLeave?.();
          break;
        case 'm':
          handlers.onToggleMic?.();
          break;
        case 'v':
          handlers.onToggleCam?.();
          break;
        default:
          break;
      }
    });
  }

  return {
    showScreen,
    showToast,
    initThemeToggle,
    initSidebar,
    initReportModal,
    setConnectionStatus,
    initRoomIdCopy,
    initKeyboardShortcuts,
  };
})();
