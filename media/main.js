// @ts-check
/// <reference lib="dom" />
(function () {
  const vscode = acquireVsCodeApi();

  // ── Elements ──────────────────────────────────────────────────────────────
  const messagesEl = /** @type {HTMLElement} */ (document.getElementById("messages"));
  const emptyEl = /** @type {HTMLElement} */ (document.getElementById("empty"));
  const inputEl = /** @type {HTMLTextAreaElement} */ (document.getElementById("input"));
  const btnSend = /** @type {HTMLButtonElement} */ (document.getElementById("btn-send"));
  const btnStop = /** @type {HTMLButtonElement} */ (document.getElementById("btn-stop"));
  const btnNew = /** @type {HTMLButtonElement} */ (document.getElementById("btn-new"));
  const btnContext = /** @type {HTMLButtonElement} */ (document.getElementById("btn-context"));
  const btnPick = /** @type {HTMLButtonElement} */ (document.getElementById("btn-pick"));
  const contextBar = /** @type {HTMLElement} */ (document.getElementById("context-bar"));

  // ── State ─────────────────────────────────────────────────────────────────
  let isStreaming = false;
  let currentStreamBubble = /** @type {HTMLElement|null} */ (null);
  let currentStreamId = /** @type {string|null} */ (null);
  let contextFiles = /** @type {string[]} */ ([]);

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  function resizeInput() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
  }
  inputEl.addEventListener("input", resizeInput);

  // ── Send on Enter ─────────────────────────────────────────────────────────
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  btnSend.addEventListener("click", sendMessage);
  btnStop.addEventListener("click", () => vscode.postMessage({ type: "abort" }));
  btnNew.addEventListener("click", () => vscode.postMessage({ type: "newSession" }));
  btnContext.addEventListener("click", () => vscode.postMessage({ type: "pickFiles" }));
  btnPick.addEventListener("click", () => vscode.postMessage({ type: "pickFiles" }));

  function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isStreaming) return;
    vscode.postMessage({ type: "send", text });
    inputEl.value = "";
    resizeInput();
  }

  // ── Streaming state ───────────────────────────────────────────────────────
  function setStreaming(on) {
    isStreaming = on;
    btnSend.style.display = on ? "none" : "flex";
    btnStop.style.display = on ? "flex" : "none";
    btnSend.disabled = on;
    inputEl.disabled = on;
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function hideEmpty() {
    emptyEl.style.display = "none";
  }

  function renderMessage(msg) {
    hideEmpty();
    const wrapper = document.createElement("div");
    wrapper.className = `message ${msg.role}`;
    wrapper.dataset.id = msg.id;

    const label = document.createElement("div");
    label.className = "role-label";
    label.textContent = msg.role === "user" ? "You" : "OpenCode";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = formatContent(msg.content);

    wrapper.appendChild(label);
    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
    scrollToBottom();
    return bubble;
  }

  function formatContent(text) {
    // Simple code block rendering (```...```)
    return text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code class="language-${lang}">${code.trimEnd()}</code></pre>`;
      })
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function updateContextBar() {
    // Remove all chips except the pick button
    const chips = contextBar.querySelectorAll(".file-chip");
    chips.forEach(c => c.remove());

    if (contextFiles.length === 0) {
      contextBar.classList.add("empty");
    } else {
      contextBar.classList.remove("empty");
      // Insert chips before btn-pick
      contextFiles.forEach(fp => {
        const chip = document.createElement("div");
        chip.className = "file-chip";
        const name = fp.split(/[\\/]/).pop() || fp;
        chip.innerHTML = `<span title="${fp}">${name}</span><span class="remove" data-path="${fp}" title="Remove">×</span>`;
        chip.querySelector(".remove").addEventListener("click", (e) => {
          const filePath = /** @type {HTMLElement} */ (e.target).dataset.path;
          vscode.postMessage({ type: "removeFile", filePath });
        });
        contextBar.insertBefore(chip, btnPick);
      });
    }
  }

  // ── Message handler ───────────────────────────────────────────────────────
  window.addEventListener("message", (event) => {
    const msg = event.data;

    switch (msg.type) {
      case "restore": {
        // Rebuild from saved session
        messagesEl.innerHTML = "";
        messagesEl.appendChild(emptyEl);
        const session = msg.session;
        contextFiles = session.contextFiles || [];
        updateContextBar();
        if (session.messages.length === 0) {
          emptyEl.style.display = "";
        } else {
          hideEmpty();
          session.messages.forEach(m => renderMessage(m));
        }
        if (msg.isStreaming) setStreaming(true);
        break;
      }

      case "newSession": {
        messagesEl.innerHTML = "";
        messagesEl.appendChild(emptyEl);
        emptyEl.style.display = "";
        contextFiles = [];
        updateContextBar();
        setStreaming(false);
        currentStreamBubble = null;
        currentStreamId = null;
        break;
      }

      case "userMessage": {
        renderMessage(msg.message);
        break;
      }

      case "streamStart": {
        setStreaming(true);
        currentStreamId = msg.id;
        hideEmpty();
        const wrapper = document.createElement("div");
        wrapper.className = "message assistant";
        wrapper.dataset.id = msg.id;

        const label = document.createElement("div");
        label.className = "role-label";
        label.textContent = "OpenCode";

        const bubble = document.createElement("div");
        bubble.className = "bubble streaming-cursor";
        currentStreamBubble = bubble;

        wrapper.appendChild(label);
        wrapper.appendChild(bubble);
        messagesEl.appendChild(wrapper);
        scrollToBottom();
        break;
      }

      case "streamChunk": {
        if (currentStreamBubble && msg.id === currentStreamId) {
          // Accumulate raw text, re-render formatted
          currentStreamBubble.dataset.raw = (currentStreamBubble.dataset.raw || "") + msg.chunk;
          currentStreamBubble.innerHTML = formatContent(currentStreamBubble.dataset.raw);
          // Re-add cursor class
          currentStreamBubble.classList.add("streaming-cursor");
          scrollToBottom();
        }
        break;
      }

      case "streamEnd": {
        setStreaming(false);
        if (currentStreamBubble) {
          currentStreamBubble.classList.remove("streaming-cursor");
          currentStreamBubble = null;
          currentStreamId = null;
        }
        inputEl.focus();
        break;
      }

      case "updateFiles": {
        contextFiles = msg.files || [];
        updateContextBar();
        break;
      }

      case "error": {
        setStreaming(false);
        if (currentStreamBubble) {
          currentStreamBubble.classList.remove("streaming-cursor");
          currentStreamBubble = null;
        }
        const errDiv = document.createElement("div");
        errDiv.className = "error-msg";
        errDiv.textContent = "⚠ " + msg.message;
        messagesEl.appendChild(errDiv);
        scrollToBottom();
        break;
      }
    }
  });

  // Tell extension we're ready
  vscode.postMessage({ type: "ready" });
  inputEl.focus();
})();
