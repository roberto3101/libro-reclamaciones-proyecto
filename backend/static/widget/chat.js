(function() {
  'use strict';

  // ─── CONFIG ──────────────────────────────────────────────────
  const script = document.currentScript;
  const API_KEY = script?.getAttribute('data-api-key') || '';
  const COLOR = script?.getAttribute('data-color') || '#1a56db';
  const POSITION = script?.getAttribute('data-position') || 'right';
  const API_BASE = script?.src ? new URL(script.src).origin : window.location.origin;
  const WIDGET_API = API_BASE + '/api/widget/v1';

  if (!API_KEY) {
    console.error('[LibroChat] data-api-key es obligatorio');
    return;
  }

  // ─── STATE ───────────────────────────────────────────────────
  let state = {
    open: false,
    view: 'login', // login | chat
    loading: false,
    config: null,   // { razon_social, color_primario, logo_url }
    reclamo: null,  // { id, codigo, estado, ... }
    email: '',
    mensajes: [],
    polling: null,
  };

  // ─── SHADOW DOM CONTAINER ────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'libro-chat-widget';
  const shadow = host.attachShadow({ mode: 'closed' });
  document.body.appendChild(host);

  // ─── STYLES ──────────────────────────────────────────────────
  const styles = document.createElement('style');
  styles.textContent = `
    :host { all: initial; }
    * { margin: 0; padding: 0; box-sizing: border-box; }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes dotPulse {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    .lc-fab {
      position: fixed;
      bottom: 24px;
      ${POSITION === 'left' ? 'left: 24px;' : 'right: 24px;'}
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${COLOR};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 28px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 2147483646;
      animation: fadeIn 0.4s ease-out;
    }
    .lc-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 8px 36px rgba(0,0,0,0.28);
    }
    .lc-fab svg { width: 28px; height: 28px; fill: white; transition: transform 0.3s; }
    .lc-fab.open svg { transform: rotate(90deg); }

    .lc-panel {
      position: fixed;
      bottom: 100px;
      ${POSITION === 'left' ? 'left: 24px;' : 'right: 24px;'}
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 520px;
      max-height: calc(100vh - 140px);
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 2147483647;
      animation: slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .lc-panel.hidden { display: none; }

    /* Header */
    .lc-header {
      background: ${COLOR};
      padding: 18px 20px;
      color: white;
      flex-shrink: 0;
    }
    .lc-header-title {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.2px;
    }
    .lc-header-sub {
      font-size: 12px;
      opacity: 0.85;
      margin-top: 3px;
      font-weight: 400;
    }

    /* Body */
    .lc-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      background: #f8fafc;
    }
    .lc-body::-webkit-scrollbar { width: 4px; }
    .lc-body::-webkit-scrollbar-track { background: transparent; }
    .lc-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

    /* Login Form */
    .lc-login { display: flex; flex-direction: column; gap: 16px; }
    .lc-login-intro {
      font-size: 14px;
      color: #475569;
      line-height: 1.6;
      text-align: center;
      padding: 8px 0;
    }
    .lc-input-group { display: flex; flex-direction: column; gap: 5px; }
    .lc-label {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .lc-input {
      width: 100%;
      padding: 11px 14px;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      font-size: 14px;
      font-family: inherit;
      color: #1e293b;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: #ffffff;
    }
    .lc-input:focus {
      border-color: ${COLOR};
      box-shadow: 0 0 0 3px ${COLOR}22;
    }
    .lc-input::placeholder { color: #94a3b8; }

    .lc-btn {
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 10px;
      background: ${COLOR};
      color: white;
      font-size: 14px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
      letter-spacing: 0.2px;
    }
    .lc-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
    .lc-btn:active { transform: translateY(0); }
    .lc-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

    .lc-error {
      padding: 10px 14px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      color: #991b1b;
      font-size: 13px;
      animation: fadeIn 0.3s;
    }

    /* Estado Badge */
    .lc-estado {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .lc-estado-PENDIENTE { background: #fef3c7; color: #92400e; }
    .lc-estado-EN_PROCESO { background: #dbeafe; color: #1e40af; }
    .lc-estado-RESUELTO { background: #d1fae5; color: #065f46; }
    .lc-estado-CERRADO { background: #f3f4f6; color: #4b5563; }
    .lc-estado-RECHAZADO { background: #fee2e2; color: #991b1b; }

    /* Case Info */
    .lc-case-info {
      background: white;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 16px;
      border: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .lc-case-code {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }

    /* Messages */
    .lc-messages { display: flex; flex-direction: column; gap: 10px; }
    .lc-msg {
      max-width: 82%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 13.5px;
      line-height: 1.5;
      word-break: break-word;
      animation: fadeIn 0.25s ease-out;
    }
    .lc-msg-CLIENTE {
      align-self: flex-end;
      background: ${COLOR};
      color: white;
      border-bottom-right-radius: 4px;
    }
    .lc-msg-EMPRESA {
      align-self: flex-start;
      background: white;
      color: #1e293b;
      border: 1px solid #e2e8f0;
      border-bottom-left-radius: 4px;
    }
    .lc-msg-time {
      font-size: 10px;
      opacity: 0.65;
      margin-top: 4px;
      display: block;
    }
    .lc-msg-CLIENTE .lc-msg-time { text-align: right; }

    .lc-empty {
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
      padding: 40px 20px;
      line-height: 1.6;
    }

    /* Input Bar */
    .lc-input-bar {
      display: flex;
      gap: 8px;
      padding: 14px 16px;
      background: white;
      border-top: 1px solid #f1f5f9;
      flex-shrink: 0;
    }
    .lc-chat-input {
      flex: 1;
      padding: 10px 14px;
      border: 1.5px solid #e2e8f0;
      border-radius: 22px;
      font-size: 13.5px;
      font-family: inherit;
      color: #1e293b;
      outline: none;
      resize: none;
      max-height: 80px;
      transition: border-color 0.2s;
      background: #f8fafc;
    }
    .lc-chat-input:focus { border-color: ${COLOR}; background: white; }
    .lc-send-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: ${COLOR};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s;
    }
    .lc-send-btn:hover { filter: brightness(1.1); transform: scale(1.05); }
    .lc-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    .lc-send-btn svg { width: 18px; height: 18px; fill: white; }

    /* Spinner */
    .lc-spinner {
      width: 22px; height: 22px;
      border: 2.5px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      margin: 0 auto;
    }
    .lc-spinner-dark {
      border-color: #e2e8f0;
      border-top-color: ${COLOR};
    }

    /* Logout */
    .lc-logout {
      display: block;
      width: 100%;
      padding: 10px;
      background: transparent;
      border: none;
      border-top: 1px solid #f1f5f9;
      color: #94a3b8;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
      transition: color 0.2s;
      flex-shrink: 0;
    }
    .lc-logout:hover { color: #ef4444; }

    @media (max-width: 420px) {
      .lc-panel {
        width: calc(100vw - 16px);
        height: calc(100vh - 90px);
        bottom: 82px;
        left: 8px;
        right: 8px;
        border-radius: 14px;
      }
    }
  `;
  shadow.appendChild(styles);

  // ─── RENDER ──────────────────────────────────────────────────
  const container = document.createElement('div');
  shadow.appendChild(container);

  function render() {
    container.innerHTML = '';

    // FAB button
    const fab = el('button', { class: `lc-fab ${state.open ? 'open' : ''}`, onclick: togglePanel }, [
      state.open ? iconClose() : iconChat()
    ]);
    container.appendChild(fab);

    // Panel
    if (state.open) {
      const panel = el('div', { class: 'lc-panel' }, [
        renderHeader(),
        state.view === 'login' ? renderLogin() : renderChat(),
        state.view === 'chat' ? renderInputBar() : null,
        state.view === 'chat' ? el('button', { class: 'lc-logout', onclick: logout }, ['Cerrar sesion']) : null,
      ].filter(Boolean));
      container.appendChild(panel);
    }
  }

  function renderHeader() {
    const title = state.config?.razon_social || 'Soporte';
    const sub = state.view === 'chat' && state.reclamo
      ? `Caso ${state.reclamo.codigo}`
      : 'Consulta el estado de tu caso';
    return el('div', { class: 'lc-header' }, [
      el('div', { class: 'lc-header-title' }, [title]),
      el('div', { class: 'lc-header-sub' }, [sub]),
    ]);
  }

  function renderLogin() {
    const body = el('div', { class: 'lc-body' }, [
      el('div', { class: 'lc-login', id: 'lc-login-form' }, [
        el('p', { class: 'lc-login-intro' }, [
          'Ingresa tu codigo de seguimiento y email para ver el estado de tu caso y chatear con soporte.'
        ]),
        el('div', { class: 'lc-input-group' }, [
          el('label', { class: 'lc-label' }, ['Codigo de reclamo']),
          el('input', { class: 'lc-input', id: 'lc-code', type: 'text', placeholder: 'Ej: 2026-ABC-A3F5B2' }),
        ]),
        el('div', { class: 'lc-input-group' }, [
          el('label', { class: 'lc-label' }, ['Email registrado']),
          el('input', { class: 'lc-input', id: 'lc-email', type: 'email', placeholder: 'tu@email.com' }),
        ]),
        el('button', {
          class: 'lc-btn',
          id: 'lc-login-btn',
          onclick: handleLogin,
          disabled: state.loading,
        }, [state.loading ? el('div', { class: 'lc-spinner' }) : 'Consultar mi caso']),
      ]),
    ]);
    return body;
  }

  function renderChat() {
    const body = el('div', { class: 'lc-body', id: 'lc-chat-body' }, []);

    // Case info
    if (state.reclamo) {
      const estadoClass = `lc-estado lc-estado-${state.reclamo.estado.replace(' ', '_')}`;
      body.appendChild(el('div', { class: 'lc-case-info' }, [
        el('span', { class: 'lc-case-code' }, [state.reclamo.codigo]),
        el('span', { class: estadoClass }, [state.reclamo.estado.replace('_', ' ')]),
      ]));
    }

    // Messages
    const msgContainer = el('div', { class: 'lc-messages', id: 'lc-messages' });
    if (state.mensajes.length === 0) {
      msgContainer.appendChild(el('div', { class: 'lc-empty' }, [
        'No hay mensajes aun. Escribe para iniciar la conversacion con soporte.'
      ]));
    } else {
      state.mensajes.forEach(function(m) {
        const timeStr = formatTime(m.fecha);
        msgContainer.appendChild(el('div', { class: `lc-msg lc-msg-${m.tipo}` }, [
          m.texto,
          el('span', { class: 'lc-msg-time' }, [timeStr]),
        ]));
      });
    }
    body.appendChild(msgContainer);

    // Auto-scroll after render
    setTimeout(function() {
      body.scrollTop = body.scrollHeight;
    }, 50);

    return body;
  }

  function renderInputBar() {
    return el('div', { class: 'lc-input-bar' }, [
      el('input', {
        class: 'lc-chat-input',
        id: 'lc-msg-input',
        type: 'text',
        placeholder: 'Escribe un mensaje...',
        onkeydown: function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } },
      }),
      el('button', { class: 'lc-send-btn', onclick: sendMessage, disabled: state.loading }, [
        iconSend()
      ]),
    ]);
  }

  // ─── API CALLS ───────────────────────────────────────────────
  function apiCall(method, path, body) {
    var opts = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(WIDGET_API + path, opts).then(function(r) { return r.json(); });
  }

  function loadConfig() {
    apiCall('GET', '/config').then(function(data) {
      if (data.razon_social) {
        state.config = data;
        render();
      }
    }).catch(function() {});
  }

  function handleLogin() {
    var codeEl = shadow.getElementById('lc-code');
    var emailEl = shadow.getElementById('lc-email');
    if (!codeEl || !emailEl) return;

    var code = codeEl.value.trim();
    var email = emailEl.value.trim();
    if (!code || !email) return;

    state.loading = true;
    state.email = email;
    render();

    apiCall('POST', '/auth', { codigo: code, email: email })
      .then(function(data) {
        state.loading = false;
        if (data.error) {
          state.loading = false;
          render();
          // Show error
          var loginForm = shadow.getElementById('lc-login-form');
          if (loginForm) {
            var existing = loginForm.querySelector('.lc-error');
            if (existing) existing.remove();
            var errDiv = el('div', { class: 'lc-error' }, [data.error]);
            loginForm.insertBefore(errDiv, loginForm.firstChild);
          }
          return;
        }
        if (data.reclamo) {
          state.reclamo = data.reclamo;
          state.view = 'chat';
          render();
          loadMensajes();
          startPolling();
        }
      })
      .catch(function() {
        state.loading = false;
        render();
      });
  }

  function loadMensajes() {
    if (!state.reclamo) return;
    apiCall('GET', '/reclamos/' + state.reclamo.id + '/mensajes?email=' + encodeURIComponent(state.email))
      .then(function(data) {
        if (data.mensajes) {
          state.mensajes = data.mensajes;
          render();
        }
      })
      .catch(function() {});
  }

  function sendMessage() {
    var input = shadow.getElementById('lc-msg-input');
    if (!input) return;
    var texto = input.value.trim();
    if (!texto || !state.reclamo) return;

    // Optimistic: add immediately
    state.mensajes.push({
      id: 'temp-' + Date.now(),
      tipo: 'CLIENTE',
      texto: texto,
      fecha: new Date().toISOString(),
    });
    input.value = '';
    render();

    apiCall('POST', '/reclamos/' + state.reclamo.id + '/mensajes', {
      email: state.email,
      mensaje: texto,
    }).then(function(data) {
      if (data.error) {
        // Remove optimistic msg
        state.mensajes = state.mensajes.filter(function(m) { return m.id.toString().indexOf('temp-') !== 0; });
        render();
      }
    }).catch(function() {
      state.mensajes = state.mensajes.filter(function(m) { return m.id.toString().indexOf('temp-') !== 0; });
      render();
    });
  }

  function startPolling() {
    if (state.polling) clearInterval(state.polling);
    state.polling = setInterval(loadMensajes, 8000);
  }

  function stopPolling() {
    if (state.polling) { clearInterval(state.polling); state.polling = null; }
  }

  // ─── ACTIONS ─────────────────────────────────────────────────
  function togglePanel() {
    state.open = !state.open;
    if (state.open && !state.config) loadConfig();
    if (!state.open) stopPolling();
    if (state.open && state.view === 'chat') startPolling();
    render();
  }

  function logout() {
    stopPolling();
    state.view = 'login';
    state.reclamo = null;
    state.mensajes = [];
    state.email = '';
    render();
  }

  // ─── HELPERS ─────────────────────────────────────────────────
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function(key) {
        if (key.startsWith('on')) {
          node.addEventListener(key.slice(2), attrs[key]);
        } else if (key === 'disabled' && attrs[key]) {
          node.setAttribute('disabled', 'disabled');
        } else {
          node.setAttribute(key, attrs[key]);
        }
      });
    }
    if (children) {
      children.forEach(function(child) {
        if (!child) return;
        if (typeof child === 'string') {
          node.appendChild(document.createTextNode(child));
        } else {
          node.appendChild(child);
        }
      });
    }
    return node;
  }

  function formatTime(dateStr) {
    try {
      var d = new Date(dateStr);
      var now = new Date();
      var diff = now - d;
      if (diff < 60000) return 'Ahora';
      if (diff < 3600000) return Math.floor(diff / 60000) + ' min';
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) + ' ' +
             d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    } catch(e) { return ''; }
  }

  function iconChat() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>';
    return svg;
  }

  function iconClose() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>';
    return svg;
  }

  function iconSend() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = '<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>';
    return svg;
  }

  // ─── INIT ────────────────────────────────────────────────────
  render();
  loadConfig();

})();