import * as vscode from "vscode";
import { OpenCodeClient, RemoteSession } from "./opencode";

type WebviewMessage =
    | { type: "ready" }
    | { type: "send"; text: string }
    | { type: "abort" }
    | { type: "newSession" }
    | { type: "switchSession"; id: string }
    | { type: "deleteSession"; id: string }
    | { type: "removeFile"; filePath: string }
    | { type: "pickFiles" };

export class OpenCodePanel implements vscode.WebviewViewProvider, vscode.Disposable {
    private view?: vscode.WebviewView;
    private client: OpenCodeClient;

    // The opencode server session ID currently active in the chat
    private remoteSessionId: string | null = null;
    // File context is stored here (not in a local Session object)
    private contextFiles: string[] = [];
    private isStreaming = false;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.client = new OpenCodeClient();
        // Whenever the background watcher sees a session change, push a fresh list
        this.client.onSessionsChanged = () => {
            this.pushSessionList().catch(() => {});
        };
    }

    // ── WebviewViewProvider ───────────────────────────────────────────────────

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => {
            switch (msg.type) {
                case "ready":
                    this.onReady();
                    break;
                case "send":
                    this.handleSend(msg.text);
                    break;
                case "abort":
                    this.handleAbort();
                    break;
                case "newSession":
                    this.newSession();
                    break;
                case "switchSession":
                    this.switchSession(msg.id);
                    break;
                case "deleteSession":
                    this.deleteSession(msg.id);
                    break;
                case "removeFile":
                    this.removeFileContext(msg.filePath);
                    break;
                case "pickFiles":
                    this.pickFiles();
                    break;
            }
        });
    }

    private post(msg: unknown): void {
        this.view?.webview.postMessage(msg);
    }

    // ── Initialisation ────────────────────────────────────────────────────────

    private async onReady(): Promise<void> {
        // Restore file context chips if webview was hidden and re-shown
        this.post({ type: "updateFiles", files: this.contextFiles });

        // Load sessions from server (also triggers server connection)
        await this.pushSessionList();

        // Start background SSE watcher for live session list updates
        this.client.startBackgroundWatch().catch(() => {});

        // If there was an active session, reload its messages
        if (this.remoteSessionId) {
            await this.loadAndShowMessages(this.remoteSessionId);
        }
    }

    // ── Session list ──────────────────────────────────────────────────────────

    private async pushSessionList(): Promise<void> {
        try {
            this.post({ type: "status", text: "Loading sessions…" });
            const sessions = await this.client.listSessions();
            this.post({ type: "sessionList", sessions, activeId: this.remoteSessionId });
            this.post({ type: "status", text: "" });
        } catch (err) {
            this.post({ type: "status", text: "" });
            this.post({ type: "error", message: `Could not reach opencode server: ${err}` });
        }
    }

    private async loadAndShowMessages(sessionId: string): Promise<void> {
        try {
            const messages = await this.client.loadMessages(sessionId);
            this.post({ type: "loadMessages", messages });
        } catch (err) {
            this.post({ type: "error", message: `Could not load messages: ${err}` });
        }
    }

    // ── Session management ────────────────────────────────────────────────────

    async newSession(): Promise<void> {
        this.handleAbort();
        try {
            this.post({ type: "status", text: "Creating session…" });
            const session: RemoteSession = await this.client.createSession();
            this.remoteSessionId = session.id;
            this.post({ type: "status", text: "" });
            this.post({ type: "newSession" }); // clears chat UI
            // Refresh list so the new session appears immediately
            await this.pushSessionList();
        } catch (err) {
            this.post({ type: "status", text: "" });
            this.post({ type: "error", message: String(err) });
        }
    }

    private async switchSession(id: string): Promise<void> {
        this.handleAbort();
        this.remoteSessionId = id;
        this.post({ type: "switchSession", id });
        await this.loadAndShowMessages(id);
    }

    private async deleteSession(id: string): Promise<void> {
        try {
            await this.client.deleteSession(id);
            if (this.remoteSessionId === id) {
                this.remoteSessionId = null;
                this.post({ type: "newSession" }); // clear chat
            }
            await this.pushSessionList();
        } catch (err) {
            this.post({ type: "error", message: `Delete failed: ${err}` });
        }
    }

    // ── File context ──────────────────────────────────────────────────────────

    addFileContext(filePath: string): void {
        if (!this.contextFiles.includes(filePath)) {
            this.contextFiles.push(filePath);
            this.post({ type: "updateFiles", files: this.contextFiles });
        }
        vscode.commands.executeCommand("opencode.chatView.focus");
    }

    private removeFileContext(filePath: string): void {
        this.contextFiles = this.contextFiles.filter((f) => f !== filePath);
        this.post({ type: "updateFiles", files: this.contextFiles });
    }

    private async pickFiles(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: "Add to context",
            filters: { "All files": ["*"] },
            defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
        });
        if (!uris) return;
        for (const uri of uris) {
            this.addFileContext(uri.fsPath);
        }
    }

    // ── Abort ─────────────────────────────────────────────────────────────────

    private handleAbort(): void {
        if (this.remoteSessionId) {
            this.client.abortSession(this.remoteSessionId).catch(() => {});
        } else {
            this.client.abort();
        }
        this.isStreaming = false;
        this.post({ type: "streamEnd" });
    }

    // ── Send + stream ─────────────────────────────────────────────────────────

    private async handleSend(text: string): Promise<void> {
        if (this.isStreaming || !text.trim()) return;

        // Eagerly create a session if none exists yet
        if (!this.remoteSessionId) {
            try {
                this.post({ type: "status", text: "Connecting to opencode server…" });
                const session: RemoteSession = await this.client.createSession();
                this.remoteSessionId = session.id;
                this.post({ type: "status", text: "" });
                await this.pushSessionList();
            } catch (err) {
                this.post({ type: "status", text: "" });
                this.post({ type: "error", message: String(err) });
                return;
            }
        }

        // Show user bubble immediately (optimistic)
        this.post({ type: "userMessage", text, timestamp: Date.now() });

        this.isStreaming = true;
        const assistantId = String(Date.now() + 1);
        this.post({ type: "streamStart", id: assistantId });

        await this.client.send(
            this.remoteSessionId,
            text,
            this.contextFiles,
            (chunk) => {
                this.post({ type: "streamChunk", id: assistantId, chunk });
            },
            () => {
                this.isStreaming = false;
                this.post({ type: "streamEnd", id: assistantId });
                // Server may have auto-updated the session title — refresh list
                this.pushSessionList().catch(() => {});
            },
            (err) => {
                this.isStreaming = false;
                this.post({ type: "error", message: err });
                this.post({ type: "streamEnd", id: assistantId });
            }
        );
    }

    // ── Dispose ───────────────────────────────────────────────────────────────

    dispose(): void {
        this.client.dispose();
    }

    // ── HTML ──────────────────────────────────────────────────────────────────

    private getHtml(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, "media", "main.js")
        );
        const nonce = getNonce();

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             script-src 'nonce-${nonce}';
             style-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OpenCode</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:        var(--vscode-sideBar-background, #0f0f10);
      --surface:   var(--vscode-editor-background, #151517);
      --border:    var(--vscode-panel-border, #2a2a2d);
      --accent:    #3b82f6;
      --accent-hi: #60a5fa;
      --fg:        var(--vscode-foreground, #e2e2e5);
      --fg-muted:  var(--vscode-descriptionForeground, #888893);
      --user-bg:   #1e2433;
      --ai-bg:     var(--surface);
      --input-bg:  var(--vscode-input-background, #1a1a1d);
      --radius:    10px;
      --font-mono: var(--vscode-editor-font-family, 'JetBrains Mono', 'Fira Code', monospace);
    }

    html, body { height: 100%; background: var(--bg); color: var(--fg); font-family: var(--vscode-font-family, system-ui); font-size: 13px; line-height: 1.6; }
    #app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

    /* ── Header ── */
    #header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-bottom: 1px solid var(--border);
      background: var(--bg); flex-shrink: 0;
    }
    #header-left { display: flex; align-items: center; gap: 7px; }
    #header-title { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--accent-hi); }
    #status-dot { width: 7px; height: 7px; border-radius: 50%; display: none; flex-shrink: 0; }
    #status-dot.connecting { background: #f59e0b; display: block; animation: pulse 1s ease-in-out infinite; }
    #status-dot.connected  { background: #22c55e; display: block; }
    #status-dot.error      { background: #ef4444; display: block; }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.3} }
    #btn-new {
      background: none; border: 1px solid var(--border); color: var(--fg-muted);
      border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer;
      display: flex; align-items: center; gap: 4px; transition: all .15s;
    }
    #btn-new:hover { border-color: var(--accent); color: var(--accent-hi); }

    /* ── Status bar ── */
    #status-bar { font-size: 11px; color: var(--fg-muted); padding: 3px 12px; background: var(--bg); border-bottom: 1px solid var(--border); display: none; flex-shrink: 0; }
    #status-bar.visible { display: block; }

    /* ── Session list ── */
    #session-section { flex-shrink: 0; border-bottom: 1px solid var(--border); }
    #session-toggle {
      display: flex; align-items: center; justify-content: space-between;
      padding: 5px 12px; cursor: pointer; user-select: none;
      background: var(--bg); font-size: 10px; font-weight: 700;
      letter-spacing: .1em; text-transform: uppercase; color: var(--fg-muted);
      transition: color .15s;
    }
    #session-toggle:hover { color: var(--fg); }
    #session-toggle-icon { font-size: 9px; transition: transform .2s; }
    #session-toggle-icon.open { transform: rotate(90deg); }
    #session-list-wrap { max-height: 180px; overflow-y: auto; display: none; }
    #session-list-wrap.open { display: block; }
    #session-list-wrap::-webkit-scrollbar { width: 3px; }
    #session-list-wrap::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
    .session-item {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 12px; cursor: pointer; transition: background .1s;
      border-left: 2px solid transparent;
    }
    .session-item:hover { background: rgba(255,255,255,.04); }
    .session-item.active { border-left-color: var(--accent); background: rgba(59,130,246,.08); }
    .session-item-body { flex: 1; min-width: 0; }
    .session-title { font-size: 12px; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .session-time { font-size: 10px; color: var(--fg-muted); }
    .session-delete {
      opacity: 0; background: none; border: none; cursor: pointer;
      color: var(--fg-muted); padding: 2px 4px; border-radius: 4px;
      font-size: 13px; line-height: 1; transition: all .1s; flex-shrink: 0;
    }
    .session-item:hover .session-delete { opacity: 1; }
    .session-delete:hover { color: #ef4444; background: rgba(239,68,68,.1); }
    #session-empty { padding: 10px 12px; font-size: 11px; color: var(--fg-muted); }

    /* ── Context bar ── */
    #context-bar {
      padding: 5px 10px; border-bottom: 1px solid var(--border);
      display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
      flex-shrink: 0; min-height: 34px;
    }
    #context-bar.empty { display: none; }
    .file-chip {
      display: flex; align-items: center; gap: 3px;
      background: #1e2433; border: 1px solid #2d3a55;
      border-radius: 4px; padding: 1px 6px; font-size: 11px; color: #93b4e8; max-width: 160px;
    }
    .file-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-chip .remove { cursor: pointer; color: #5a6a8a; font-size: 13px; line-height: 1; flex-shrink: 0; transition: color .1s; }
    .file-chip .remove:hover { color: #ef4444; }
    #btn-pick { background: none; border: 1px dashed var(--border); color: var(--fg-muted); border-radius: 4px; padding: 1px 7px; font-size: 11px; cursor: pointer; transition: all .15s; }
    #btn-pick:hover { border-color: var(--accent); color: var(--accent); }

    /* ── Messages ── */
    #messages { flex: 1; overflow-y: auto; padding: 12px 10px; display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth; }
    #messages::-webkit-scrollbar { width: 4px; }
    #messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
    .message { display: flex; flex-direction: column; gap: 3px; animation: fadeUp .18s ease; }
    @keyframes fadeUp { from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none} }
    .message.user { align-items: flex-end; }
    .message.assistant { align-items: flex-start; }
    .bubble { max-width: 90%; padding: 8px 12px; border-radius: var(--radius); font-size: 13px; line-height: 1.65; word-break: break-word; white-space: pre-wrap; }
    .user .bubble { background: var(--user-bg); border: 1px solid #2d3a55; border-bottom-right-radius: 3px; color: #c8d8f5; }
    .assistant .bubble { background: var(--ai-bg); border: 1px solid var(--border); border-bottom-left-radius: 3px; color: var(--fg); }
    .assistant .bubble code { font-family: var(--font-mono); font-size: 12px; background: #0d0d0f; padding: 1px 5px; border-radius: 4px; }
    .assistant .bubble pre { background: #0d0d0f; border: 1px solid var(--border); border-radius: 7px; padding: 10px 12px; overflow-x: auto; margin: 6px 0; font-family: var(--font-mono); font-size: 12px; line-height: 1.5; }
    .assistant .bubble pre code { background: none; padding: 0; }
    .role-label { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 0 3px; }
    .user .role-label { color: #4e6fa0; }
    .assistant .role-label { color: #3b6e3b; }
    .streaming-cursor::after { content: '▋'; animation: blink .8s step-end infinite; color: var(--accent); }
    @keyframes blink { 50%{opacity:0} }
    #empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--fg-muted); text-align: center; padding: 20px; }
    #empty svg { opacity: .25; }
    #empty h3 { font-size: 14px; font-weight: 600; color: var(--fg); opacity: .6; }
    #empty p { font-size: 12px; max-width: 200px; line-height: 1.5; }
    .error-msg { background: #2d1212; border: 1px solid #5a2020; color: #f87171; border-radius: var(--radius); padding: 8px 12px; font-size: 12px; align-self: stretch; }

    /* ── Input ── */
    #input-area { flex-shrink: 0; padding: 8px 10px 10px; border-top: 1px solid var(--border); background: var(--bg); }
    #input-row { display: flex; gap: 7px; align-items: flex-end; background: var(--input-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 7px 9px; transition: border-color .2s; }
    #input-row:focus-within { border-color: var(--accent); }
    #input { flex: 1; background: none; border: none; outline: none; color: var(--fg); font-family: inherit; font-size: 13px; resize: none; line-height: 1.5; max-height: 140px; overflow-y: auto; min-height: 20px; }
    #input::placeholder { color: var(--fg-muted); }
    #input-actions { display: flex; gap: 5px; align-items: center; }
    #btn-context { background: none; border: none; cursor: pointer; color: var(--fg-muted); padding: 2px 3px; border-radius: 4px; font-size: 15px; line-height: 1; transition: color .15s; }
    #btn-context:hover { color: var(--accent-hi); }
    #btn-send, #btn-stop { border: none; border-radius: 7px; cursor: pointer; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; transition: all .15s; flex-shrink: 0; }
    #btn-send { background: var(--accent); color: #fff; }
    #btn-send:hover { background: var(--accent-hi); }
    #btn-send:disabled { opacity: .35; cursor: default; }
    #btn-stop { background: #3d1515; color: #f87171; border: 1px solid #5a2020; display: none; }
    #btn-stop:hover { background: #5a1f1f; }
    #hint { font-size: 10px; color: var(--fg-muted); text-align: right; padding: 3px 1px 0; }
  </style>
</head>
<body>
<div id="app">

  <!-- Header -->
  <div id="header">
    <div id="header-left">
      <div id="status-dot"></div>
      <span id="header-title">⬡ OpenCode</span>
    </div>
    <button id="btn-new" title="New session">
      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM7 5h2v2h2v2H9v2H7v-2H5V7h2V5z"/>
      </svg>
      New
    </button>
  </div>

  <!-- Status bar -->
  <div id="status-bar"></div>

  <!-- Session list -->
  <div id="session-section">
    <div id="session-toggle">
      <span>Sessions</span>
      <span id="session-toggle-icon">▶</span>
    </div>
    <div id="session-list-wrap">
      <div id="session-list"></div>
      <div id="session-empty" style="display:none">No sessions yet</div>
    </div>
  </div>

  <!-- Context bar -->
  <div id="context-bar" class="empty">
    <button id="btn-pick">+ Add files</button>
  </div>

  <!-- Messages -->
  <div id="messages">
    <div id="empty">
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      <h3>OpenCode</h3>
      <p>Select a session or create a new one to start chatting.</p>
    </div>
  </div>

  <!-- Input -->
  <div id="input-area">
    <div id="input-row">
      <textarea id="input" placeholder="Ask opencode…" rows="1"></textarea>
      <div id="input-actions">
        <button id="btn-context" title="Add file context">📎</button>
        <button id="btn-send" title="Send (Enter)">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 13.5l12-5.5-12-5.5v4l8 1.5-8 1.5v4z"/>
          </svg>
        </button>
        <button id="btn-stop" title="Stop">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="3" width="10" height="10" rx="1"/>
          </svg>
        </button>
      </div>
    </div>
    <div id="hint">Enter to send · Shift+Enter for newline</div>
  </div>

</div>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}