// @ts-check
(function () {
    const vscode = acquireVsCodeApi();

    // ── Elements ──────────────────────────────────────────────────────────────
    const messagesEl        = /** @type {HTMLElement} */ (document.getElementById("messages"));
    const emptyEl           = /** @type {HTMLElement} */ (document.getElementById("empty"));
    const inputEl           = /** @type {HTMLTextAreaElement} */ (document.getElementById("input"));
    const btnSend           = /** @type {HTMLButtonElement} */ (document.getElementById("btn-send"));
    const btnStop           = /** @type {HTMLButtonElement} */ (document.getElementById("btn-stop"));
    const btnNew            = /** @type {HTMLButtonElement} */ (document.getElementById("btn-new"));
    const btnContext        = /** @type {HTMLButtonElement} */ (document.getElementById("btn-context"));
    const btnPick           = /** @type {HTMLButtonElement} */ (document.getElementById("btn-pick"));
    const contextBar        = /** @type {HTMLElement} */ (document.getElementById("context-bar"));
    const statusBar         = /** @type {HTMLElement} */ (document.getElementById("status-bar"));
    const statusDot         = /** @type {HTMLElement} */ (document.getElementById("status-dot"));
    const sessionListEl     = /** @type {HTMLElement} */ (document.getElementById("session-list"));
    const sessionEmptyEl    = /** @type {HTMLElement} */ (document.getElementById("session-empty"));
    const sessionListWrap   = /** @type {HTMLElement} */ (document.getElementById("session-list-wrap"));
    const sessionToggle     = /** @type {HTMLElement} */ (document.getElementById("session-toggle"));
    const sessionToggleIcon = /** @type {HTMLElement} */ (document.getElementById("session-toggle-icon"));

    // ── State ─────────────────────────────────────────────────────────────────
    let isStreaming = false;
    let activeSessionId = /** @type {string|null} */ (null);
    let contextFiles = /** @type {string[]} */ ([]);
    let currentStreamBubble = /** @type {HTMLElement|null} */ (null);
    let currentStreamRaw = "";

    // ── Session list toggle ───────────────────────────────────────────────────
    let sessionListOpen = true;
    sessionListWrap.classList.add("open");
    sessionToggleIcon.classList.add("open");

    sessionToggle.addEventListener("click", () => {
        sessionListOpen = !sessionListOpen;
        sessionListWrap.classList.toggle("open", sessionListOpen);
        sessionToggleIcon.classList.toggle("open", sessionListOpen);
    });

    // ── Input auto-resize ─────────────────────────────────────────────────────
    inputEl.addEventListener("input", resizeInput);
    function resizeInput() {
        inputEl.style.height = "auto";
        inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
    }

    // ── Keyboard ──────────────────────────────────────────────────────────────
    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // ── Button handlers ───────────────────────────────────────────────────────
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

    // ── Streaming state toggle ────────────────────────────────────────────────
    function setStreaming(on) {
        isStreaming = on;
        btnSend.style.display = on ? "none" : "flex";
        btnStop.style.display = on ? "flex" : "none";
        btnSend.disabled = on;
        inputEl.disabled = on;
    }

    // ── Session list ──────────────────────────────────────────────────────────
    /**
     * @param {Array<{id:string, title:string, updatedAt:number}>} sessions
     * @param {string|null} activeId
     */
    function renderSessionList(sessions, activeId) {
        sessionListEl.innerHTML = "";

        if (!sessions || sessions.length === 0) {
            sessionEmptyEl.style.display = "block";
            return;
        }
        sessionEmptyEl.style.display = "none";

        for (const s of sessions) {
            const item = document.createElement("div");
            item.className = "session-item" + (s.id === activeId ? " active" : "");
            item.dataset.id = s.id;

            const body = document.createElement("div");
            body.className = "session-item-body";

            const titleEl = document.createElement("div");
            titleEl.className = "session-title";
            titleEl.textContent = s.title || "Untitled";

            const timeEl = document.createElement("div");
            timeEl.className = "session-time";
            timeEl.textContent = formatRelativeTime(s.updatedAt);

            body.appendChild(titleEl);
            body.appendChild(timeEl);

            const delBtn = document.createElement("button");
            delBtn.className = "session-delete";
            delBtn.title = "Delete session";
            delBtn.textContent = "✕";
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                vscode.postMessage({ type: "deleteSession", id: s.id });
            });

            item.appendChild(body);
            item.appendChild(delBtn);

            item.addEventListener("click", () => {
                if (s.id === activeSessionId) return;
                vscode.postMessage({ type: "switchSession", id: s.id });
            });

            sessionListEl.appendChild(item);
        }
    }

    function formatRelativeTime(ms) {
        if (!ms) return "";
        const diff = Date.now() - ms;
        if (diff < 60_000)       return "just now";
        if (diff < 3_600_000)    return Math.floor(diff / 60_000) + "m ago";
        if (diff < 86_400_000)   return Math.floor(diff / 3_600_000) + "h ago";
        return new Date(ms).toLocaleDateString();
    }

    // ── Chat area helpers ─────────────────────────────────────────────────────
    function clearMessages() {
        messagesEl.innerHTML = "";
        messagesEl.appendChild(emptyEl);
        emptyEl.style.display = "";
    }

    function hideEmpty() {
        emptyEl.style.display = "none";
    }

    /**
     * @param {"user"|"assistant"} role
     * @param {string} text
     * @returns {HTMLElement} the bubble element
     */
    function appendMessage(role, text) {
        hideEmpty();
        const wrap = document.createElement("div");
        wrap.className = `message ${role}`;

        const label = document.createElement("div");
        label.className = "role-label";
        label.textContent = role === "user" ? "You" : "OpenCode";

        const bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.innerHTML = formatContent(text);

        wrap.appendChild(label);
        wrap.appendChild(bubble);
        messagesEl.appendChild(wrap);
        scrollToBottom();
        return bubble;
    }

    function formatContent(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
                `<pre><code class="language-${lang}">${code.trimEnd()}</code></pre>`)
            .replace(/`([^`\n]+)`/g, "<code>$1</code>")
            .replace(/\n/g, "<br>");
    }

    function scrollToBottom() {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // ── Context bar ───────────────────────────────────────────────────────────
    function updateContextBar(files) {
        contextFiles = files || [];
        contextBar.querySelectorAll(".file-chip").forEach((c) => c.remove());
        if (contextFiles.length === 0) {
            contextBar.classList.add("empty");
        } else {
            contextBar.classList.remove("empty");
            for (const fp of contextFiles) {
                const chip = document.createElement("div");
                chip.className = "file-chip";
                const name = fp.split(/[\\/]/).pop() || fp;
                chip.innerHTML = `<span title="${fp}">${name}</span><span class="remove" data-path="${fp}">×</span>`;
                chip.querySelector(".remove").addEventListener("click", (e) => {
                    const path = /** @type {HTMLElement} */ (e.target).dataset.path;
                    vscode.postMessage({ type: "removeFile", filePath: path });
                });
                contextBar.insertBefore(chip, btnPick);
            }
        }
    }

    // ── Status helpers ────────────────────────────────────────────────────────
    function setStatus(text) {
        if (text) {
            statusBar.textContent = text;
            statusBar.classList.add("visible");
            statusDot.className = "connecting";
        } else {
            statusBar.textContent = "";
            statusBar.classList.remove("visible");
            statusDot.className = "connected";
        }
    }

    // ── Message handler (extension → webview) ─────────────────────────────────
    window.addEventListener("message", (event) => {
        const msg = event.data;

        switch (msg.type) {

            // ── Session list refreshed ────────────────────────────────────────────
            case "sessionList": {
                activeSessionId = msg.activeId ?? activeSessionId;
                renderSessionList(msg.sessions, activeSessionId);
                break;
            }

            // ── Switch to a different session (clear chat, highlight item) ────────
            case "switchSession": {
                activeSessionId = msg.id;
                clearMessages();
                setStreaming(false);
                currentStreamBubble = null;
                currentStreamRaw = "";
                document.querySelectorAll(".session-item").forEach((el) => {
                    /** @type {HTMLElement} */ (el).classList.toggle("active", el.dataset.id === msg.id);
                });
                break;
            }

            // ── Full message history loaded from server ───────────────────────────
            case "loadMessages": {
                clearMessages();
                const msgs = /** @type {Array<{role:string, text:string, timestamp:number}>} */ (msg.messages || []);
                for (const m of msgs) {
                    if (m.text?.trim()) {
                        appendMessage(m.role === "user" ? "user" : "assistant", m.text);
                    }
                }
                break;
            }

            // ── New session created (clear UI, list will follow via sessionList) ──
            case "newSession": {
                activeSessionId = null;
                clearMessages();
                setStreaming(false);
                currentStreamBubble = null;
                currentStreamRaw = "";
                updateContextBar([]);
                document.querySelectorAll(".session-item").forEach((el) => {
                    el.classList.remove("active");
                });
                break;
            }

            // ── Optimistic user bubble ────────────────────────────────────────────
            case "userMessage": {
                appendMessage("user", msg.text);
                break;
            }

            // ── Streaming ─────────────────────────────────────────────────────────
            case "streamStart": {
                setStreaming(true);
                hideEmpty();
                currentStreamRaw = "";
                const wrap = document.createElement("div");
                wrap.className = "message assistant";
                wrap.dataset.streamId = msg.id;
                const label = document.createElement("div");
                label.className = "role-label";
                label.textContent = "OpenCode";
                const bubble = document.createElement("div");
                bubble.className = "bubble streaming-cursor";
                currentStreamBubble = bubble;
                wrap.appendChild(label);
                wrap.appendChild(bubble);
                messagesEl.appendChild(wrap);
                scrollToBottom();
                break;
            }

            case "streamChunk": {
                if (currentStreamBubble) {
                    currentStreamRaw += msg.chunk;
                    currentStreamBubble.innerHTML = formatContent(currentStreamRaw);
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
                    currentStreamRaw = "";
                }
                inputEl.focus();
                break;
            }

            // ── File context chips ────────────────────────────────────────────────
            case "updateFiles": {
                updateContextBar(msg.files);
                break;
            }

            // ── Status / connection indicator ─────────────────────────────────────
            case "status": {
                setStatus(msg.text);
                break;
            }

            // ── Error ─────────────────────────────────────────────────────────────
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

    // ── Boot ──────────────────────────────────────────────────────────────────
    vscode.postMessage({ type: "ready" });
    inputEl.focus();
})();