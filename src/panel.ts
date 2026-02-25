import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { OpenCodeClient, Session, Message } from "./opencode";

type WebviewMessage =
  | { type: "send"; text: string }
  | { type: "newSession" }
  | { type: "abort" }
  | { type: "removeFile"; filePath: string }
  | { type: "pickFiles" }
  | { type: "ready" };

export class OpenCodePanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private client: OpenCodeClient;
  private session: Session;
  private isStreaming = false;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.client = new OpenCodeClient();
    this.session = this.makeSession();
  }

  private makeSession(): Session {
    return {
      id: Date.now().toString(),
      messages: [],
      contextFiles: [],
    };
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      switch (msg.type) {
        case "ready":
          this.syncState();
          break;
        case "send":
          this.handleSend(msg.text);
          break;
        case "newSession":
          this.newSession();
          break;
        case "abort":
          this.client.abort();
          this.isStreaming = false;
          this.post({ type: "streamEnd" });
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

  private post(msg: unknown) {
    this.view?.webview.postMessage(msg);
  }

  private syncState() {
    this.post({
      type: "restore",
      session: this.session,
      isStreaming: this.isStreaming,
    });
  }

  newSession() {
    this.client.abort();
    this.isStreaming = false;
    this.session = this.makeSession();
    this.post({ type: "newSession" });
  }

  addFileContext(filePath: string) {
    if (!this.session.contextFiles.includes(filePath)) {
      this.session.contextFiles.push(filePath);
      this.post({ type: "updateFiles", files: this.session.contextFiles });
    }
    // Focus the sidebar
    vscode.commands.executeCommand("opencode.chatView.focus");
  }

  private removeFileContext(filePath: string) {
    this.session.contextFiles = this.session.contextFiles.filter(
      (f) => f !== filePath
    );
    this.post({ type: "updateFiles", files: this.session.contextFiles });
  }

  private async pickFiles() {
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

  private async handleSend(text: string) {
    if (this.isStreaming || !text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    this.session.messages.push(userMsg);
    this.post({ type: "userMessage", message: userMsg });

    this.isStreaming = true;
    const assistantId = (Date.now() + 1).toString();
    this.post({ type: "streamStart", id: assistantId });

    let fullContent = "";

    await this.client.send(
      text,
      this.session.contextFiles,
      (chunk) => {
        fullContent += chunk;
        this.post({ type: "streamChunk", id: assistantId, chunk });
      },
      (exitCode) => {
        this.isStreaming = false;
        const assistantMsg: Message = {
          id: assistantId,
          role: "assistant",
          content: fullContent,
          timestamp: Date.now(),
        };
        this.session.messages.push(assistantMsg);
        this.post({ type: "streamEnd", id: assistantId, exitCode });
      },
      (err) => {
        this.isStreaming = false;
        this.post({ type: "error", message: err });
      }
    );
  }

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
             style-src 'unsafe-inline';
             font-src https://fonts.gstatic.com;
             connect-src https://fonts.googleapis.com https://fonts.gstatic.com;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OpenCode</title>
  <style>
    /* ── Reset & base ── */
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

    /* ── Layout ── */
    #app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

    /* ── Header ── */
    #header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 8px;
      border-bottom: 1px solid var(--border);
      background: var(--bg);
      flex-shrink: 0;
    }
    #header-title {
      font-size: 11px; font-weight: 700; letter-spacing: .12em;
      text-transform: uppercase; color: var(--accent-hi);
    }
    #btn-new {
      background: none; border: 1px solid var(--border); color: var(--fg-muted);
      border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer;
      display: flex; align-items: center; gap: 5px; transition: all .15s;
    }
    #btn-new:hover { border-color: var(--accent); color: var(--accent-hi); }

    /* ── Context files ── */
    #context-bar {
      padding: 6px 10px; border-bottom: 1px solid var(--border);
      display: flex; flex-wrap: wrap; gap: 5px; align-items: center;
      flex-shrink: 0; min-height: 36px;
    }
    #context-bar.empty { display: none; }
    .file-chip {
      display: flex; align-items: center; gap: 4px;
      background: #1e2433; border: 1px solid #2d3a55;
      border-radius: 5px; padding: 2px 7px; font-size: 11px;
      color: #93b4e8; max-width: 180px;
    }
    .file-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-chip .remove {
      cursor: pointer; color: #5a6a8a; font-size: 13px; line-height: 1;
      flex-shrink: 0; transition: color .1s;
    }
    .file-chip .remove:hover { color: #ef4444; }

    #btn-pick {
      background: none; border: 1px dashed var(--border); color: var(--fg-muted);
      border-radius: 5px; padding: 2px 8px; font-size: 11px; cursor: pointer;
      transition: all .15s;
    }
    #btn-pick:hover { border-color: var(--accent); color: var(--accent); }

    /* ── Messages ── */
    #messages {
      flex: 1; overflow-y: auto; padding: 14px 10px;
      display: flex; flex-direction: column; gap: 12px;
      scroll-behavior: smooth;
    }
    #messages::-webkit-scrollbar { width: 4px; }
    #messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

    .message { display: flex; flex-direction: column; gap: 4px; animation: fadeUp .2s ease; }
    @keyframes fadeUp { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: none; } }

    .message.user { align-items: flex-end; }
    .message.assistant { align-items: flex-start; }

    .bubble {
      max-width: 90%; padding: 9px 13px; border-radius: var(--radius);
      font-size: 13px; line-height: 1.65; word-break: break-word;
      white-space: pre-wrap;
    }
    .user .bubble {
      background: var(--user-bg); border: 1px solid #2d3a55;
      border-bottom-right-radius: 3px; color: #c8d8f5;
    }
    .assistant .bubble {
      background: var(--ai-bg); border: 1px solid var(--border);
      border-bottom-left-radius: 3px; color: var(--fg);
    }
    .assistant .bubble code {
      font-family: var(--font-mono); font-size: 12px;
      background: #0d0d0f; padding: 1px 5px; border-radius: 4px;
    }
    .assistant .bubble pre {
      background: #0d0d0f; border: 1px solid var(--border);
      border-radius: 7px; padding: 10px 12px; overflow-x: auto;
      margin: 8px 0; font-family: var(--font-mono); font-size: 12px; line-height: 1.5;
    }
    .assistant .bubble pre code { background: none; padding: 0; }

    .role-label {
      font-size: 10px; font-weight: 700; letter-spacing: .08em;
      text-transform: uppercase; color: var(--fg-muted); padding: 0 3px;
    }
    .user .role-label { color: #4e6fa0; }
    .assistant .role-label { color: #3b6e3b; }

    /* Typing cursor */
    .streaming-cursor::after {
      content: '▋';
      animation: blink .8s step-end infinite;
      color: var(--accent);
    }
    @keyframes blink { 50% { opacity: 0; } }

    /* Empty state */
    #empty {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 10px; color: var(--fg-muted); text-align: center; padding: 20px;
    }
    #empty svg { opacity: .3; }
    #empty h3 { font-size: 14px; font-weight: 600; color: var(--fg); opacity: .7; }
    #empty p { font-size: 12px; max-width: 200px; line-height: 1.5; }

    /* Error */
    .error-msg {
      background: #2d1212; border: 1px solid #5a2020; color: #f87171;
      border-radius: var(--radius); padding: 9px 13px; font-size: 12px;
      align-self: stretch;
    }

    /* ── Input area ── */
    #input-area {
      flex-shrink: 0; padding: 10px;
      border-top: 1px solid var(--border); background: var(--bg);
    }
    #input-row {
      display: flex; gap: 8px; align-items: flex-end;
      background: var(--input-bg); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 8px 10px;
      transition: border-color .2s;
    }
    #input-row:focus-within { border-color: var(--accent); }

    #input {
      flex: 1; background: none; border: none; outline: none;
      color: var(--fg); font-family: inherit; font-size: 13px;
      resize: none; line-height: 1.5; max-height: 160px;
      overflow-y: auto; min-height: 22px;
    }
    #input::placeholder { color: var(--fg-muted); }

    #input-actions { display: flex; gap: 6px; align-items: center; }

    #btn-context {
      background: none; border: none; cursor: pointer;
      color: var(--fg-muted); padding: 2px 4px; border-radius: 5px;
      font-size: 16px; line-height: 1; transition: color .15s;
    }
    #btn-context:hover { color: var(--accent-hi); }

    #btn-send, #btn-stop {
      border: none; border-radius: 7px; cursor: pointer;
      width: 30px; height: 30px; display: flex; align-items: center;
      justify-content: center; transition: all .15s; flex-shrink: 0;
    }
    #btn-send { background: var(--accent); color: #fff; }
    #btn-send:hover { background: var(--accent-hi); }
    #btn-send:disabled { opacity: .35; cursor: default; }
    #btn-stop { background: #3d1515; color: #f87171; border: 1px solid #5a2020; display: none; }
    #btn-stop:hover { background: #5a1f1f; }

    #hint { font-size: 10px; color: var(--fg-muted); text-align: right; padding: 4px 2px 0; }
  </style>
</head>
<body>
<div id="app">
  <!-- Header -->
  <div id="header">
    <span id="header-title">⬡ OpenCode</span>
    <button id="btn-new" title="New session">
      <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM7 5h2v2h2v2H9v2H7v-2H5V7h2V5z"/>
      </svg>
      New
    </button>
  </div>

  <!-- Context bar -->
  <div id="context-bar" class="empty">
    <button id="btn-pick" title="Add files to context">+ Add files</button>
  </div>

  <!-- Messages -->
  <div id="messages">
    <div id="empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      <h3>OpenCode</h3>
      <p>Ask anything about your code. Add files for context.</p>
    </div>
  </div>

  <!-- Input area -->
  <div id="input-area">
    <div id="input-row">
      <textarea id="input" placeholder="Ask opencode…" rows="1"></textarea>
      <div id="input-actions">
        <button id="btn-context" title="Add file context">📎</button>
        <button id="btn-send" title="Send (Enter)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 13.5l12-5.5-12-5.5v4l8 1.5-8 1.5v4z"/>
          </svg>
        </button>
        <button id="btn-stop" title="Stop generation">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
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
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
