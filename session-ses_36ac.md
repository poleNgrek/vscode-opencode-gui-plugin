# OpenCode plugin integration refactor

**Session ID:** ses_36ac2cf05ffe90Y3g5jKMH2ToJ
**Created:** 2/25/2026, 3:39:01 PM
**Updated:** 2/25/2026, 4:05:18 PM

---

## User

The plugin is fundamentally broken because it uses the wrong integration approach. Here's what's happening:

opencode run --format json requires a session to already exist — it's not a standalone command that creates its own session. It fails with Session not found and exits with code 1.
The OpenCode.app is already running its own server (port 63127, PID 61467) which has the SQLite DB locked. When your plugin spawns opencode run, it tries to start its own embedded server, which fails (ERROR: service=server error= failed), and then has no session to work with.
Even when --session is provided, opencode run still produces zero stdout output — it silently does nothing observable via the subprocess stdout pipe.
The correct approach (as documented in the opencode SDK docs) is to:

Spawn opencode serve as a background process
Use the HTTP API directly to: create a session, send prompts, and stream events via SSE

Can you help me rewrite it?


---

## Assistant (Build · eu.anthropic.claude-sonnet-4-6 · 114.8s)

Let me start by exploring the codebase to understand the current structure before rewriting it.

**Tool: task**

**Input:**
```json
{
  "description": "Explore codebase structure",
  "prompt": "Explore the codebase at /Users/biniam.palaiologos/projects/personal-dev/vscode-opencode-gui-plugin and provide a comprehensive overview of:\n1. The directory structure\n2. Key source files and their purposes\n3. How the current opencode integration works (look for any process spawning, session management, etc.)\n4. The main extension entry point\n5. Any configuration files (package.json, tsconfig.json, etc.)\n\nBe thorough and return the full file contents of the most important files (especially the main extension file and any opencode-related code).",
  "subagent_type": "explore"
}
```

**Output:**
```
task_id: ses_36ac2a070ffe97NUVeQnJRw6ev (for resuming to continue this task if needed)

<task_result>
I now have a complete picture of the entire codebase. Here is the comprehensive overview:

---

## Codebase Overview: `vscode-opencode-gui-plugin`

---

### 1. Directory Structure

```
vscode-opencode-gui-plugin/
├── src/                        ← TypeScript source (compiled to out/)
│   ├── extension.ts            ← Extension entry point / activation
│   ├── panel.ts                ← WebviewViewProvider (sidebar panel UI host)
│   └── opencode.ts             ← CLI subprocess client with streaming
├── media/                      ← Static assets served to the webview
│   ├── main.js                 ← Vanilla JS webview UI (runs inside the panel)
│   └── icon.png                ← Activity Bar icon
├── out/                        ← Compiled JS output (gitignored but present locally)
│   ├── extension.js / .map
│   ├── panel.js / .map
│   └── opencode.js / .map
├── package.json                ← Extension manifest + scripts + dependencies
├── tsconfig.json               ← TypeScript compiler config
├── README.md                   ← User docs + architecture notes
├── LICENSE.md
├── .gitignore
└── vscode-opencode-gui-plugin-0.1.0.vsix   ← Packaged extension (gitignored but present)
```

**3 source files + 1 webview JS file** make up the entire functional codebase — it is intentionally minimal.

---

### 2. Key Source Files and Their Purposes

| File | Role |
|---|---|
| `src/extension.ts` | VS Code activation hook. Instantiates `OpenCodePanel`, registers all commands and the webview view provider. |
| `src/panel.ts` | `WebviewViewProvider` implementation. Owns session state, renders the HTML/CSS sidebar panel, routes messages between the webview UI and the CLI client. |
| `src/opencode.ts` | Thin wrapper around Node's `child_process.spawn`. Calls the `opencode` CLI binary, streams JSON events back, and exposes `send()` / `abort()`. |
| `media/main.js` | Vanilla JS that runs inside the sandboxed webview iframe. Handles all DOM rendering, user input, and message passing with the extension host via `vscode.postMessage` / `window.addEventListener("message", ...)`. |

---

### 3. How the opencode Integration Works

#### Process Spawning (`src/opencode.ts`)

The `OpenCodeClient` class manages a single persistent child process at a time:

```ts
this.currentProcess = cp.spawn(this.cliPath, args, {
    cwd: this.workspaceRoot,
    shell: false,
    env: { ...process.env, FORCE_COLOR: "0" },
});
```

**CLI invocation:**
```
opencode run --format json [--model <model>] [-f <file>] ... "<prompt>"
```

- `this.cliPath` defaults to `"opencode"` (from `opencode.cliPath` config setting)
- `--format json` puts the CLI into newline-delimited JSON event streaming mode
- `-f <file>` flags are appended for each context file in the session
- The prompt is the final positional argument
- `FORCE_COLOR: "0"` suppresses ANSI escape codes in output

#### Streaming Response Parsing

Output arrives on `stdout` as newline-delimited JSON events. Each line is parsed individually:

```ts
const event = JSON.parse(trimmed);
const text = extractText(event);   // looks for { type: "text", part: { text: "..." } }
if (text) onChunk(text);
```

If a line is not valid JSON (e.g., a status line), it falls back to plain text after stripping ANSI codes via `stripAnsi()`.

The `extractText()` function handles the primary opencode event shape:
```ts
// { type: "text", part: { type: "text", text: "..." } }
if (e.type === "text") {
    if (typeof part?.text === "string") return part.text;
    if (typeof e.text === "string")     return e.text;
}
```

#### Abort

`abort()` simply calls `this.currentProcess.kill()`. There is only ever one active process; starting a new `send()` automatically calls `abort()` first.

#### Session Management (`src/panel.ts`)

Sessions are **in-memory only** — nothing is persisted to disk. A session object looks like:

```ts
interface Session {
    id: string;           // timestamp string
    messages: Message[];  // full conversation history
    contextFiles: string[]; // absolute paths of attached files
}
```

- **New session**: `newSession()` aborts the current process, creates a fresh `Session`, and posts `{ type: "newSession" }` to the webview to clear the UI.
- **State restoration**: When the webview panel is revealed after being hidden, it fires a `"ready"` message; the extension responds with a `"restore"` message containing the full session and streaming state, so the UI is rebuilt from scratch without losing history.
- **Streaming lifecycle**:
  1. `handleSend()` posts `{ type: "streamStart", id }` → webview creates a streaming bubble with blinking cursor.
  2. Each `onChunk` callback posts `{ type: "streamChunk", id, chunk }` → webview appends to the bubble.
  3. `onDone` callback posts `{ type: "streamEnd", id, exitCode }` → webview removes cursor, re-enables input.

#### Message Protocol (Extension ↔ Webview)

**Webview → Extension:**
| Message | Trigger |
|---|---|
| `{ type: "ready" }` | Webview loaded |
| `{ type: "send", text }` | User hits Enter or Send |
| `{ type: "abort" }` | Stop button clicked |
| `{ type: "newSession" }` | New button clicked |
| `{ type: "removeFile", filePath }` | File chip × clicked |
| `{ type: "pickFiles" }` | Paperclip or "+ Add files" clicked |

**Extension → Webview:**
| Message | Meaning |
|---|---|
| `{ type: "restore", session, isStreaming }` | Rebuild UI from saved state |
| `{ type: "userMessage", message }` | Render user bubble immediately |
| `{ type: "streamStart", id }` | Create assistant streaming bubble |
| `{ type: "streamChunk", id, chunk }` | Append text to bubble |
| `{ type: "streamEnd", id, exitCode }` | Finalize bubble, re-enable input |
| `{ type: "newSession" }` | Clear the entire UI |
| `{ type: "updateFiles", files }` | Re-render context file chips |
| `{ type: "error", message }` | Show red error banner |

---

### 4. Main Extension Entry Point (`src/extension.ts`)

Full file (40 lines):

```ts
import * as vscode from "vscode";
import { OpenCodePanel } from "./panel";

export function activate(context: vscode.ExtensionContext) {
  const provider = new OpenCodePanel(context);

  // Register sidebar webview view
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("opencode.chatView", provider, {
      webviewOptions: { retainContextWhenHidden: true },  // ← preserves webview state on hide
    })
  );

  // "opencode.newSession" command
  context.subscriptions.push(
    vscode.commands.registerCommand("opencode.newSession", () => {
      provider.newSession();
    })
  );

  // "opencode.addCurrentFile" command (from editor context or command palette)
  context.subscriptions.push(
    vscode.commands.registerCommand("opencode.addCurrentFile", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active file to add.");
        return;
      }
      provider.addFileContext(editor.document.uri.fsPath);
    })
  );

  // "opencode.focus" command → Cmd/Ctrl+Shift+O
  context.subscriptions.push(
    vscode.commands.registerCommand("opencode.focus", () => {
      vscode.commands.executeCommand("opencode.chatView.focus");
    })
  );
}

export function deactivate() {}
```

Key notes:
- Activation event is `"onStartupFinished"` — the extension loads as soon as VS Code finishes starting.
- `retainContextWhenHidden: true` is critical — it prevents the webview from being destroyed when the sidebar is collapsed, preserving conversation history.
- The `deactivate()` hook is a no-op (cleanup is handled via `context.subscriptions`).

---

### 5. Configuration Files

#### `package.json` (Extension Manifest)
- **Publisher:** `poleNgrek`
- **Engine:** VS Code `^1.85.0`
- **Activation:** `onStartupFinished`
- **Entry point:** `./out/extension.js`
- **Contributes:**
  - Activity Bar container: `opencode` (id), with `icon.png`
  - Webview view: `opencode.chatView` (type `"webview"`)
  - 3 commands: `opencode.newSession`, `opencode.addCurrentFile`, `opencode.focus`
  - Keybinding: `Cmd/Ctrl+Shift+O` → `opencode.focus`
  - Configuration:
    - `opencode.cliPath` (default: `"opencode"`) — path to binary
    - `opencode.model` (default: `""`) — model override
- **Dev dependencies only:** `@types/node`, `@types/vscode`, `typescript`, `@vscode/vsce` — no runtime npm dependencies at all.

#### `tsconfig.json`
- **Module:** CommonJS
- **Target:** ES2020
- **Output:** `./out/`
- **Source:** `./src/`
- **Strict mode** enabled, `esModuleInterop` enabled, source maps enabled.

---

### Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│  VS Code Extension Host (Node.js)                   │
│                                                     │
│  extension.ts  ──instantiates──►  panel.ts          │
│                                      │              │
│                                  OpenCodePanel      │
│                                  (WebviewViewProvider)
│                                      │              │
│                                  opencode.ts        │
│                                  (OpenCodeClient)   │
│                                      │              │
│                              cp.spawn("opencode")   │
│                              stdout JSON stream     │
└──────────────────┬──────────────────────────────────┘
      postMessage  │  window.message events
┌──────────────────▼──────────────────────────────────┐
│  Webview (sandboxed browser context)                │
│                                                     │
│  media/main.js  — vanilla JS, no framework          │
│  ├── DOM rendering (messages, chips, streaming)     │
│  ├── Auto-resizing textarea                         │
│  └── acquireVsCodeApi() for bidirectional messaging │
└─────────────────────────────────────────────────────┘
```

The design is deliberately lean: **zero runtime npm dependencies**, a single CLI subprocess per prompt, in-memory-only session state, and a plain HTML/CSS/JS webview with no build step required for the frontend.
</task_result>
```

---

## Assistant (Build · eu.anthropic.claude-sonnet-4-6 · 4.9s)

Now let me look at the current source files in detail and also check the opencode SDK docs:

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/biniam.palaiologos/projects/personal-dev/vscode-opencode-gui-plugin/src/opencode.ts"
}
```

**Output:**
```
<path>/Users/biniam.palaiologos/projects/personal-dev/vscode-opencode-gui-plugin/src/opencode.ts</path>
<type>file</type>
<content>1: import * as cp from "child_process";
2: import * as vscode from "vscode";
3: 
4: export interface Message {
5:     id: string;
6:     role: "user" | "assistant";
7:     content: string;
8:     timestamp: number;
9: }
10: 
11: export interface Session {
12:     id: string;
13:     messages: Message[];
14:     contextFiles: string[];
15: }
16: 
17: export class OpenCodeClient {
18:     private cliPath: string;
19:     private workspaceRoot: string;
20:     private currentProcess: cp.ChildProcess | null = null;
21: 
22:     constructor() {
23:         const config = vscode.workspace.getConfiguration("opencode");
24:         this.cliPath = config.get<string>("cliPath") || "opencode";
25:         this.workspaceRoot =
26:             vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
27:     }
28: 
29:     /**
30:      * Send a message to opencode CLI using --format json.
31:      * Parses the newline-delimited JSON event stream and extracts text chunks.
32:      */
33:     async send(
34:         prompt: string,
35:         contextFiles: string[],
36:         onChunk: (chunk: string) => void,
37:         onDone: (exitCode: number | null) => void,
38:         onError: (err: string) => void
39:     ): Promise<void> {
40:         this.abort();
41: 
42:         const config = vscode.workspace.getConfiguration("opencode");
43:         const model = config.get<string>("model") || "";
44: 
45:         const args: string[] = ["run", "--format", "json"];
46: 
47:         if (model) {
48:             args.push("--model", model);
49:         }
50: 
51:         for (const f of contextFiles) {
52:             args.push("-f", f);
53:         }
54: 
55:         args.push(prompt);
56: 
57:         try {
58:             this.currentProcess = cp.spawn(this.cliPath, args, {
59:                 cwd: this.workspaceRoot,
60:                 shell: false,
61:                 env: { ...process.env, FORCE_COLOR: "0" },
62:             });
63: 
64:             let buf = "";
65:             let stderr = "";
66: 
67:             this.currentProcess.stdout?.on("data", (data: Buffer) => {
68:                 buf += data.toString();
69:                 // JSON events are newline-delimited
70:                 const lines = buf.split("\n");
71:                 buf = lines.pop() ?? ""; // keep incomplete line in buffer
72: 
73:                 for (const line of lines) {
74:                     const trimmed = line.trim();
75:                     if (!trimmed) continue;
76:                     try {
77:                         const event = JSON.parse(trimmed);
78:                         const text = extractText(event);
79:                         if (text) {
80:                             onChunk(text);
81:                         }
82:                     } catch {
83:                         // Not JSON (e.g. a status line) — pass through as plain text
84:                         const clean = stripAnsi(trimmed);
85:                         if (clean) onChunk(clean + "\n");
86:                     }
87:                 }
88:             });
89: 
90:             this.currentProcess.stderr?.on("data", (data: Buffer) => {
91:                 stderr += data.toString();
92:             });
93: 
94:             this.currentProcess.on("error", (err) => {
95:                 if (err.message.includes("ENOENT")) {
96:                     onError(
97:                         `opencode CLI not found at "${this.cliPath}". ` +
98:                         `Install it or set opencode.cliPath in settings.`
99:                     );
100:                 } else {
101:                     onError(err.message);
102:                 }
103:                 onDone(null);
104:             });
105: 
106:             this.currentProcess.on("close", (code) => {
107:                 this.currentProcess = null;
108:                 // Flush any remaining buffer
109:                 if (buf.trim()) {
110:                     try {
111:                         const event = JSON.parse(buf.trim());
112:                         const text = extractText(event);
113:                         if (text) onChunk(text);
114:                     } catch {
115:                         const clean = stripAnsi(buf.trim());
116:                         if (clean) onChunk(clean);
117:                     }
118:                 }
119:                 if (code !== 0 && stderr) {
120:                     onError(stderr);
121:                 }
122:                 onDone(code);
123:             });
124:         } catch (err) {
125:             onError(String(err));
126:             onDone(null);
127:         }
128:     }
129: 
130:     abort() {
131:         if (this.currentProcess) {
132:             this.currentProcess.kill();
133:             this.currentProcess = null;
134:         }
135:     }
136: }
137: 
138: /**
139:  * Extract readable text from an opencode JSON event.
140:  * Actual shape: { type: "text", part: { type: "text", text: "..." }, ... }
141:  */
142: function extractText(event: unknown): string {
143:     if (!event || typeof event !== "object") return "";
144:     const e = event as Record<string, unknown>;
145: 
146:     // Primary opencode format: { type: "text", part: { text: "..." } }
147:     if (e.type === "text") {
148:         const part = e.part as Record<string, unknown> | undefined;
149:         if (typeof part?.text === "string") {
150:             return part.text;
151:         }
152:         if (typeof e.text === "string") {
153:             return e.text;
154:         }
155:     }
156: 
157:     return "";
158: }
159: 
160: /** Strip ANSI escape codes from a string */
161: function stripAnsi(str: string): string {
162:     // eslint-disable-next-line no-control-regex
163:     return str.replace(/\x1B\[[0-9;]*[mGKHF]/g, "").replace(/\x1B\[[?][0-9]*[hl]/g, "");
164: }

(End of file - total 164 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/biniam.palaiologos/projects/personal-dev/vscode-opencode-gui-plugin/src/panel.ts"
}
```

**Output:**
```
<path>/Users/biniam.palaiologos/projects/personal-dev/vscode-opencode-gui-plugin/src/panel.ts</path>
<type>file</type>
<content>1: import * as vscode from "vscode";
2: import * as path from "path";
3: import * as fs from "fs";
4: import { OpenCodeClient, Session, Message } from "./opencode";
5: 
6: type WebviewMessage =
7:   | { type: "send"; text: string }
8:   | { type: "newSession" }
9:   | { type: "abort" }
10:   | { type: "removeFile"; filePath: string }
11:   | { type: "pickFiles" }
12:   | { type: "ready" };
13: 
14: export class OpenCodePanel implements vscode.WebviewViewProvider {
15:   private view?: vscode.WebviewView;
16:   private client: OpenCodeClient;
17:   private session: Session;
18:   private isStreaming = false;
19: 
20:   constructor(private readonly context: vscode.ExtensionContext) {
21:     this.client = new OpenCodeClient();
22:     this.session = this.makeSession();
23:   }
24: 
25:   private makeSession(): Session {
26:     return {
27:       id: Date.now().toString(),
28:       messages: [],
29:       contextFiles: [],
30:     };
31:   }
32: 
33:   resolveWebviewView(webviewView: vscode.WebviewView) {
34:     this.view = webviewView;
35: 
36:     webviewView.webview.options = {
37:       enableScripts: true,
38:       localResourceRoots: [this.context.extensionUri],
39:     };
40: 
41:     webviewView.webview.html = this.getHtml(webviewView.webview);
42: 
43:     webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => {
44:       switch (msg.type) {
45:         case "ready":
46:           this.syncState();
47:           break;
48:         case "send":
49:           this.handleSend(msg.text);
50:           break;
51:         case "newSession":
52:           this.newSession();
53:           break;
54:         case "abort":
55:           this.client.abort();
56:           this.isStreaming = false;
57:           this.post({ type: "streamEnd" });
58:           break;
59:         case "removeFile":
60:           this.removeFileContext(msg.filePath);
61:           break;
62:         case "pickFiles":
63:           this.pickFiles();
64:           break;
65:       }
66:     });
67:   }
68: 
69:   private post(msg: unknown) {
70:     this.view?.webview.postMessage(msg);
71:   }
72: 
73:   private syncState() {
74:     this.post({
75:       type: "restore",
76:       session: this.session,
77:       isStreaming: this.isStreaming,
78:     });
79:   }
80: 
81:   newSession() {
82:     this.client.abort();
83:     this.isStreaming = false;
84:     this.session = this.makeSession();
85:     this.post({ type: "newSession" });
86:   }
87: 
88:   addFileContext(filePath: string) {
89:     if (!this.session.contextFiles.includes(filePath)) {
90:       this.session.contextFiles.push(filePath);
91:       this.post({ type: "updateFiles", files: this.session.contextFiles });
92:     }
93:     // Focus the sidebar
94:     vscode.commands.executeCommand("opencode.chatView.focus");
95:   }
96: 
97:   private removeFileContext(filePath: string) {
98:     this.session.contextFiles = this.session.contextFiles.filter(
99:       (f) => f !== filePath
100:     );
101:     this.post({ type: "updateFiles", files: this.session.contextFiles });
102:   }
103: 
104:   private async pickFiles() {
105:     const uris = await vscode.window.showOpenDialog({
106:       canSelectMany: true,
107:       openLabel: "Add to context",
108:       filters: { "All files": ["*"] },
109:       defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
110:     });
111:     if (!uris) return;
112:     for (const uri of uris) {
113:       this.addFileContext(uri.fsPath);
114:     }
115:   }
116: 
117:   private async handleSend(text: string) {
118:     if (this.isStreaming || !text.trim()) return;
119: 
120:     const userMsg: Message = {
121:       id: Date.now().toString(),
122:       role: "user",
123:       content: text,
124:       timestamp: Date.now(),
125:     };
126:     this.session.messages.push(userMsg);
127:     this.post({ type: "userMessage", message: userMsg });
128: 
129:     this.isStreaming = true;
130:     const assistantId = (Date.now() + 1).toString();
131:     this.post({ type: "streamStart", id: assistantId });
132: 
133:     let fullContent = "";
134: 
135:     await this.client.send(
136:       text,
137:       this.session.contextFiles,
138:       (chunk) => {
139:         fullContent += chunk;
140:         this.post({ type: "streamChunk", id: assistantId, chunk });
141:       },
142:       (exitCode) => {
143:         this.isStreaming = false;
144:         const assistantMsg: Message = {
145:           id: assistantId,
146:           role: "assistant",
147:           content: fullContent,
148:           timestamp: Date.now(),
149:         };
150:         this.session.messages.push(assistantMsg);
151:         this.post({ type: "streamEnd", id: assistantId, exitCode });
152:       },
153:       (err) => {
154:         this.isStreaming = false;
155:         this.post({ type: "error", message: err });
156:       }
157:     );
158:   }
159: 
160:   private getHtml(webview: vscode.Webview): string {
161:     const scriptUri = webview.asWebviewUri(
162:       vscode.Uri.joinPath(this.context.extensionUri, "media", "main.js")
163:     );
164:     const nonce = getNonce();
165: 
166:     return /* html */ `<!DOCTYPE html>
167: <html lang="en">
168: <head>
169:   <meta charset="UTF-8" />
170:   <meta http-equiv="Content-Security-Policy"
171:     content="default-src 'none';
172:              script-src 'nonce-${nonce}';
173:              style-src 'unsafe-inline';
174:              font-src https://fonts.gstatic.com;
175:              connect-src https://fonts.googleapis.com https://fonts.gstatic.com;" />
176:   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
177:   <title>OpenCode</title>
178:   <style>
179:     /* ── Reset & base ── */
180:     *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
181: 
182:     :root {
183:       --bg:        var(--vscode-sideBar-background, #0f0f10);
184:       --surface:   var(--vscode-editor-background, #151517);
185:       --border:    var(--vscode-panel-border, #2a2a2d);
186:       --accent:    #3b82f6;
187:       --accent-hi: #60a5fa;
188:       --fg:        var(--vscode-foreground, #e2e2e5);
189:       --fg-muted:  var(--vscode-descriptionForeground, #888893);
190:       --user-bg:   #1e2433;
191:       --ai-bg:     var(--surface);
192:       --input-bg:  var(--vscode-input-background, #1a1a1d);
193:       --radius:    10px;
194:       --font-mono: var(--vscode-editor-font-family, 'JetBrains Mono', 'Fira Code', monospace);
195:     }
196: 
197:     html, body { height: 100%; background: var(--bg); color: var(--fg); font-family: var(--vscode-font-family, system-ui); font-size: 13px; line-height: 1.6; }
198: 
199:     /* ── Layout ── */
200:     #app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
201: 
202:     /* ── Header ── */
203:     #header {
204:       display: flex; align-items: center; justify-content: space-between;
205:       padding: 10px 14px 8px;
206:       border-bottom: 1px solid var(--border);
207:       background: var(--bg);
208:       flex-shrink: 0;
209:     }
210:     #header-title {
211:       font-size: 11px; font-weight: 700; letter-spacing: .12em;
212:       text-transform: uppercase; color: var(--accent-hi);
213:     }
214:     #btn-new {
215:       background: none; border: 1px solid var(--border); color: var(--fg-muted);
216:       border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer;
217:       display: flex; align-items: center; gap: 5px; transition: all .15s;
218:     }
219:     #btn-new:hover { border-color: var(--accent); color: var(--accent-hi); }
220: 
221:     /* ── Context files ── */
222:     #context-bar {
223:       padding: 6px 10px; border-bottom: 1px solid var(--border);
224:       display: flex; flex-wrap: wrap; gap: 5px; align-items: center;
225:       flex-shrink: 0; min-height: 36px;
226:     }
227:     #context-bar.empty { display: none; }
228:     .file-chip {
229:       display: flex; align-items: center; gap: 4px;
230:       background: #1e2433; border: 1px solid #2d3a55;
231:       border-radius: 5px; padding: 2px 7px; font-size: 11px;
232:       color: #93b4e8; max-width: 180px;
233:     }
234:     .file-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
235:     .file-chip .remove {
236:       cursor: pointer; color: #5a6a8a; font-size: 13px; line-height: 1;
237:       flex-shrink: 0; transition: color .1s;
238:     }
239:     .file-chip .remove:hover { color: #ef4444; }
240: 
241:     #btn-pick {
242:       background: none; border: 1px dashed var(--border); color: var(--fg-muted);
243:       border-radius: 5px; padding: 2px 8px; font-size: 11px; cursor: pointer;
244:       transition: all .15s;
245:     }
246:     #btn-pick:hover { border-color: var(--accent); color: var(--accent); }
247: 
248:     /* ── Messages ── */
249:     #messages {
250:       flex: 1; overflow-y: auto; padding: 14px 10px;
251:       display: flex; flex-direction: column; gap: 12px;
252:       scroll-behavior: smooth;
253:     }
254:     #messages::-webkit-scrollbar { width: 4px; }
255:     #messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
256: 
257:     .message { display: flex; flex-direction: column; gap: 4px; animation: fadeUp .2s ease; }
258:     @keyframes fadeUp { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: none; } }
259: 
260:     .message.user { align-items: flex-end; }
261:     .message.assistant { align-items: flex-start; }
262: 
263:     .bubble {
264:       max-width: 90%; padding: 9px 13px; border-radius: var(--radius);
265:       font-size: 13px; line-height: 1.65; word-break: break-word;
266:       white-space: pre-wrap;
267:     }
268:     .user .bubble {
269:       background: var(--user-bg); border: 1px solid #2d3a55;
270:       border-bottom-right-radius: 3px; color: #c8d8f5;
271:     }
272:     .assistant .bubble {
273:       background: var(--ai-bg); border: 1px solid var(--border);
274:       border-bottom-left-radius: 3px; color: var(--fg);
275:     }
276:     .assistant .bubble code {
277:       font-family: var(--font-mono); font-size: 12px;
278:       background: #0d0d0f; padding: 1px 5px; border-radius: 4px;
279:     }
280:     .assistant .bubble pre {
281:       background: #0d0d0f; border: 1px solid var(--border);
282:       border-radius: 7px; padding: 10px 12px; overflow-x: auto;
283:       margin: 8px 0; font-family: var(--font-mono); font-size: 12px; line-height: 1.5;
284:     }
285:     .assistant .bubble pre code { background: none; padding: 0; }
286: 
287:     .role-label {
288:       font-size: 10px; font-weight: 700; letter-spacing: .08em;
289:       text-transform: uppercase; color: var(--fg-muted); padding: 0 3px;
290:     }
291:     .user .role-label { color: #4e6fa0; }
292:     .assistant .role-label { color: #3b6e3b; }
293: 
294:     /* Typing cursor */
295:     .streaming-cursor::after {
296:       content: '▋';
297:       animation: blink .8s step-end infinite;
298:       color: var(--accent);
299:     }
300:     @keyframes blink { 50% { opacity: 0; } }
301: 
302:     /* Empty state */
303:     #empty {
304:       flex: 1; display: flex; flex-direction: column;
305:       align-items: center; justify-content: center;
306:       gap: 10px; color: var(--fg-muted); text-align: center; padding: 20px;
307:     }
308:     #empty svg { opacity: .3; }
309:     #empty h3 { font-size: 14px; font-weight: 600; color: var(--fg); opacity: .7; }
310:     #empty p { font-size: 12px; max-width: 200px; line-height: 1.5; }
311: 
312:     /* Error */
313:     .error-msg {
314:       background: #2d1212; border: 1px solid #5a2020; color: #f87171;
315:       border-radius: var(--radius); padding: 9px 13px; font-size: 12px;
316:       align-self: stretch;
317:     }
318: 
319:     /* ── Input area ── */
320:     #input-area {
321:       flex-shrink: 0; padding: 10px;
322:       border-top: 1px solid var(--border); background: var(--bg);
323:     }
324:     #input-row {
325:       display: flex; gap: 8px; align-items: flex-end;
326:       background: var(--input-bg); border: 1px solid var(--border);
327:       border-radius: var(--radius); padding: 8px 10px;
328:       transition: border-color .2s;
329:     }
330:     #input-row:focus-within { border-color: var(--accent); }
331: 
332:     #input {
333:       flex: 1; background: none; border: none; outline: none;
334:       color: var(--fg); font-family: inherit; font-size: 13px;
335:       resize: none; line-height: 1.5; max-height: 160px;
336:       overflow-y: auto; min-height: 22px;
337:     }
338:     #input::placeholder { color: var(--fg-muted); }
339: 
340:     #input-actions { display: flex; gap: 6px; align-items: center; }
341: 
342:     #btn-context {
343:       background: none; border: none; cursor: pointer;
344:       color: var(--fg-muted); padding: 2px 4px; border-radius: 5px;
345:       font-size: 16px; line-height: 1; transition: color .15s;
346:     }
347:     #btn-context:hover { color: var(--accent-hi); }
348: 
349:     #btn-send, #btn-stop {
350:       border: none; border-radius: 7px; cursor: pointer;
351:       width: 30px; height: 30px; display: flex; align-items: center;
352:       justify-content: center; transition: all .15s; flex-shrink: 0;
353:     }
354:     #btn-send { background: var(--accent); color: #fff; }
355:     #btn-send:hover { background: var(--accent-hi); }
356:     #btn-send:disabled { opacity: .35; cursor: default; }
357:     #btn-stop { background: #3d1515; color: #f87171; border: 1px solid #5a2020; display: none; }
358:     #btn-stop:hover { background: #5a1f1f; }
359: 
360:     #hint { font-size: 10px; color: var(--fg-muted); text-align: right; padding: 4px 2px 0; }
361:   </style>
362: </head>
363: <body>
364: <div id="app">
365:   <!-- Header -->
366:   <div id="header">
367:     <span id="header-title">⬡ OpenCode</span>
368:     <button id="btn-new" title="New session">
369:       <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
370:         <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM7 5h2v2h2v2H9v2H7v-2H5V7h2V5z"/>
371:       </svg>
372:       New
373:     </button>
374:   </div>
375: 
376:   <!-- Context bar -->
377:   <div id="context-bar" class="empty">
378:     <button id="btn-pick" title="Add files to context">+ Add files</button>
379:   </div>
380: 
381:   <!-- Messages -->
382:   <div id="messages">
383:     <div id="empty">
384:       <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
385:         <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
386:       </svg>
387:       <h3>OpenCode</h3>
388:       <p>Ask anything about your code. Add files for context.</p>
389:     </div>
390:   </div>
391: 
392:   <!-- Input area -->
393:   <div id="input-area">
394:     <div id="input-row">
395:       <textarea id="input" placeholder="Ask opencode…" rows="1"></textarea>
396:       <div id="input-actions">
397:         <button id="btn-context" title="Add file context">📎</button>
398:         <button id="btn-send" title="Send (Enter)">
399:           <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
400:             <path d="M2 13.5l12-5.5-12-5.5v4l8 1.5-8 1.5v4z"/>
401:           </svg>
402:         </button>
403:         <button id="btn-stop" title="Stop generation">
404:           <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
405:             <rect x="3" y="3" width="10" height="10" rx="1"/>
406:           </svg>
407:         </button>
408:       </div>
409:     </div>
410:     <div id="hint">Enter to send · Shift+Enter for newline</div>
411:   </div>
412: </div>
413: 
414: <script nonce="${nonce}" src="${scriptUri}"></script>
415: </body>
416: </html>`;
417:   }
418: }
419: 
420: function getNonce(): string {
421:   let text = "";
422:   const possible =
423:     "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
424:   for (let i = 0; i < 32; i++) {
425:     text += possible.charAt(Math.floor(Math.random() * possible.length));
426:   }
427:   return text;
428: }

(End of file - total 428 lines)
</content>
```

**Tool: webfetch**

**Input:**
```json
{
  "url": "https://opencode.ai/docs",
  "format": "markdown"
}
```

**Output:**
```
Intro | AI coding agent built for the terminalIntro | OpenCode     [Skip to content](#_top)

  [![](/docs/_astro/logo-dark.DOStV66V.svg) ![](/docs/_astro/logo-light.B0yzR0O5.svg) OpenCode](/docs/)

[app.header.home](/)[app.header.docs](/docs/)

[](https://github.com/anomalyco/opencode)[](https://opencode.ai/discord)

Search CtrlK

Cancel

-   [Intro](/docs/)
-   [Config](/docs/config/)
-   [Providers](/docs/providers/)
-   [Network](/docs/network/)
-   [Enterprise](/docs/enterprise/)
-   [Troubleshooting](/docs/troubleshooting/)
-   [Windows](/docs/windows-wsl)
-   Usage
    
    -   [TUI](/docs/tui/)
    -   [CLI](/docs/cli/)
    -   [Web](/docs/web/)
    -   [IDE](/docs/ide/)
    -   [Zen](/docs/zen/)
    -   [Share](/docs/share/)
    -   [GitHub](/docs/github/)
    -   [GitLab](/docs/gitlab/)
    
-   Configure
    
    -   [Tools](/docs/tools/)
    -   [Rules](/docs/rules/)
    -   [Agents](/docs/agents/)
    -   [Models](/docs/models/)
    -   [Themes](/docs/themes/)
    -   [Keybinds](/docs/keybinds/)
    -   [Commands](/docs/commands/)
    -   [Formatters](/docs/formatters/)
    -   [Permissions](/docs/permissions/)
    -   [LSP Servers](/docs/lsp/)
    -   [MCP servers](/docs/mcp-servers/)
    -   [ACP Support](/docs/acp/)
    -   [Agent Skills](/docs/skills/)
    -   [Custom Tools](/docs/custom-tools/)
    
-   Develop
    
    -   [SDK](/docs/sdk/)
    -   [Server](/docs/server/)
    -   [Plugins](/docs/plugins/)
    -   [Ecosystem](/docs/ecosystem/)
    

[GitHub](https://github.com/anomalyco/opencode)[Discord](https://opencode.ai/discord)

Select theme DarkLightAuto   Select language EnglishالعربيةBosanskiDanskDeutschEspañolFrançaisItaliano日本語한국어Norsk BokmålPolskiPortuguês (Brasil)РусскийไทยTürkçe简体中文繁體中文

On this page

-   [Overview](#_top)
-   [Install](#install)
-   [Configure](#configure)
-   [Initialize](#initialize)
-   [Usage](#usage)
    -   [Ask questions](#ask-questions)
    -   [Add features](#add-features)
    -   [Make changes](#make-changes)
    -   [Undo changes](#undo-changes)
-   [Share](#share)
-   [Customize](#customize)

## On this page

-   [Overview](#_top)
-   [Install](#install)
-   [Configure](#configure)
-   [Initialize](#initialize)
-   [Usage](#usage)
    -   [Ask questions](#ask-questions)
    -   [Add features](#add-features)
    -   [Make changes](#make-changes)
    -   [Undo changes](#undo-changes)
-   [Share](#share)
-   [Customize](#customize)

# Intro

Get started with OpenCode.

[**OpenCode**](/) is an open source AI coding agent. It’s available as a terminal-based interface, desktop app, or IDE extension.

![OpenCode TUI with the opencode theme](/docs/_astro/screenshot.CQjBbRyJ_1dLadc.webp)

Let’s get started.

---

#### [Prerequisites](#prerequisites)

To use OpenCode in your terminal, you’ll need:

1.  A modern terminal emulator like:
    
    -   [WezTerm](https://wezterm.org), cross-platform
    -   [Alacritty](https://alacritty.org), cross-platform
    -   [Ghostty](https://ghostty.org), Linux and macOS
    -   [Kitty](https://sw.kovidgoyal.net/kitty/), Linux and macOS
2.  API keys for the LLM providers you want to use.
    

---

## [Install](#install)

The easiest way to install OpenCode is through the install script.

Terminal window

```
curl -fsSL https://opencode.ai/install | bash
```

You can also install it with the following commands:

-   **Using Node.js**
    
    -   [npm](#tab-panel-0)
    -   [Bun](#tab-panel-1)
    -   [pnpm](#tab-panel-2)
    -   [Yarn](#tab-panel-3)
    
    Terminal window
    
    ```
    npm install -g opencode-ai
    ```
    
    Terminal window
    
    ```
    bun install -g opencode-ai
    ```
    
    Terminal window
    
    ```
    pnpm install -g opencode-ai
    ```
    
    Terminal window
    
    ```
    yarn global add opencode-ai
    ```
    
-   **Using Homebrew on macOS and Linux**
    
    Terminal window
    
    ```
    brew install anomalyco/tap/opencode
    ```
    
    > We recommend using the OpenCode tap for the most up to date releases. The official `brew install opencode` formula is maintained by the Homebrew team and is updated less frequently.
    
-   **Installing on Arch Linux**
    
    Terminal window
    
    ```
    sudo pacman -S opencode           # Arch Linux (Stable)paru -S opencode-bin              # Arch Linux (Latest from AUR)
    ```
    

#### [Windows](#windows)

Recommended: Use WSL

For the best experience on Windows, we recommend using [Windows Subsystem for Linux (WSL)](/docs/windows-wsl). It provides better performance and full compatibility with OpenCode’s features.

-   **Using Chocolatey**
    
    Terminal window
    
    ```
    choco install opencode
    ```
    
-   **Using Scoop**
    
    Terminal window
    
    ```
    scoop install opencode
    ```
    
-   **Using NPM**
    
    Terminal window
    
    ```
    npm install -g opencode-ai
    ```
    
-   **Using Mise**
    
    Terminal window
    
    ```
    mise use -g github:anomalyco/opencode
    ```
    
-   **Using Docker**
    
    Terminal window
    
    ```
    docker run -it --rm ghcr.io/anomalyco/opencode
    ```
    

Support for installing OpenCode on Windows using Bun is currently in progress.

You can also grab the binary from the [Releases](https://github.com/anomalyco/opencode/releases).

---

## [Configure](#configure)

With OpenCode you can use any LLM provider by configuring their API keys.

If you are new to using LLM providers, we recommend using [OpenCode Zen](/docs/zen). It’s a curated list of models that have been tested and verified by the OpenCode team.

1.  Run the `/connect` command in the TUI, select opencode, and head to [opencode.ai/auth](https://opencode.ai/auth).
    
    ```
    /connect
    ```
    
2.  Sign in, add your billing details, and copy your API key.
    
3.  Paste your API key.
    
    ```
    ┌ API key││└ enter
    ```
    

Alternatively, you can select one of the other providers. [Learn more](/docs/providers#directory).

---

## [Initialize](#initialize)

Now that you’ve configured a provider, you can navigate to a project that you want to work on.

Terminal window

```
cd /path/to/project
```

And run OpenCode.

Terminal window

```
opencode
```

Next, initialize OpenCode for the project by running the following command.

```
/init
```

This will get OpenCode to analyze your project and create an `AGENTS.md` file in the project root.

Tip

You should commit your project’s `AGENTS.md` file to Git.

This helps OpenCode understand the project structure and the coding patterns used.

---

## [Usage](#usage)

You are now ready to use OpenCode to work on your project. Feel free to ask it anything!

If you are new to using an AI coding agent, here are some examples that might help.

---

### [Ask questions](#ask-questions)

You can ask OpenCode to explain the codebase to you.

Tip

Use the `@` key to fuzzy search for files in the project.

```
How is authentication handled in @packages/functions/src/api/index.ts
```

This is helpful if there’s a part of the codebase that you didn’t work on.

---

### [Add features](#add-features)

You can ask OpenCode to add new features to your project. Though we first recommend asking it to create a plan.

1.  **Create a plan**
    
    OpenCode has a *Plan mode* that disables its ability to make changes and instead suggest *how* it’ll implement the feature.
    
    Switch to it using the **Tab** key. You’ll see an indicator for this in the lower right corner.
    
    ```
    <TAB>
    ```
    
    Now let’s describe what we want it to do.
    
    ```
    When a user deletes a note, we'd like to flag it as deleted in the database.Then create a screen that shows all the recently deleted notes.From this screen, the user can undelete a note or permanently delete it.
    ```
    
    You want to give OpenCode enough details to understand what you want. It helps to talk to it like you are talking to a junior developer on your team.
    
    Tip
    
    Give OpenCode plenty of context and examples to help it understand what you want.
    
2.  **Iterate on the plan**
    
    Once it gives you a plan, you can give it feedback or add more details.
    
    ```
    We'd like to design this new screen using a design I've used before.[Image #1] Take a look at this image and use it as a reference.
    ```
    
    Tip
    
    Drag and drop images into the terminal to add them to the prompt.
    
    OpenCode can scan any images you give it and add them to the prompt. You can do this by dragging and dropping an image into the terminal.
    
3.  **Build the feature**
    
    Once you feel comfortable with the plan, switch back to *Build mode* by hitting the **Tab** key again.
    
    ```
    <TAB>
    ```
    
    And asking it to make the changes.
    
    ```
    Sounds good! Go ahead and make the changes.
    ```
    

---

### [Make changes](#make-changes)

For more straightforward changes, you can ask OpenCode to directly build it without having to review the plan first.

```
We need to add authentication to the /settings route. Take a look at how this ishandled in the /notes route in @packages/functions/src/notes.ts and implementthe same logic in @packages/functions/src/settings.ts
```

You want to make sure you provide a good amount of detail so OpenCode makes the right changes.

---

### [Undo changes](#undo-changes)

Let’s say you ask OpenCode to make some changes.

```
Can you refactor the function in @packages/functions/src/api/index.ts?
```

But you realize that it is not what you wanted. You **can undo** the changes using the `/undo` command.

```
/undo
```

OpenCode will now revert the changes you made and show your original message again.

```
Can you refactor the function in @packages/functions/src/api/index.ts?
```

From here you can tweak the prompt and ask OpenCode to try again.

Tip

You can run `/undo` multiple times to undo multiple changes.

Or you **can redo** the changes using the `/redo` command.

```
/redo
```

---

## [Share](#share)

The conversations that you have with OpenCode can be [shared with your team](/docs/share).

```
/share
```

This will create a link to the current conversation and copy it to your clipboard.

Note

Conversations are not shared by default.

Here’s an [example conversation](https://opencode.ai/s/4XP1fce5) with OpenCode.

---

## [Customize](#customize)

And that’s it! You are now a pro at using OpenCode.

To make it your own, we recommend [picking a theme](/docs/themes), [customizing the keybinds](/docs/keybinds), [configuring code formatters](/docs/formatters), [creating custom commands](/docs/commands), or playing around with the [OpenCode config](/docs/config).

[Edit page](https://github.com/anomalyco/opencode/edit/dev/packages/web/src/content/docs/index.mdx)[Found a bug? Open an issue](https://github.com/anomalyco/opencode/issues/new)[Join our Discord community](https://opencode.ai/discord) Select language EnglishالعربيةBosanskiDanskDeutschEspañolFrançaisItaliano日本語한국어Norsk BokmålPolskiPortuguês (Brasil)РусскийไทยTürkçe简体中文繁體中文 

© [Anomaly](https://anoma.ly)

Last updated: Feb 25, 2026
```

---

## Assistant (Build · eu.anthropic.claude-sonnet-4-6 · 7.8s)

**Tool: webfetch**

**Input:**
```json
{
  "url": "https://opencode.ai/docs/sdk/",
  "format": "markdown"
}
```

**Output:**
```
SDK | OpenCode     [Skip to content](#_top)

  [![](/docs/_astro/logo-dark.DOStV66V.svg) ![](/docs/_astro/logo-light.B0yzR0O5.svg) OpenCode](/docs/)

[app.header.home](/)[app.header.docs](/docs/)

[](https://github.com/anomalyco/opencode)[](https://opencode.ai/discord)

Search CtrlK

Cancel

-   [Intro](/docs/)
-   [Config](/docs/config/)
-   [Providers](/docs/providers/)
-   [Network](/docs/network/)
-   [Enterprise](/docs/enterprise/)
-   [Troubleshooting](/docs/troubleshooting/)
-   [Windows](/docs/windows-wsl)
-   Usage
    
    -   [TUI](/docs/tui/)
    -   [CLI](/docs/cli/)
    -   [Web](/docs/web/)
    -   [IDE](/docs/ide/)
    -   [Zen](/docs/zen/)
    -   [Share](/docs/share/)
    -   [GitHub](/docs/github/)
    -   [GitLab](/docs/gitlab/)
    
-   Configure
    
    -   [Tools](/docs/tools/)
    -   [Rules](/docs/rules/)
    -   [Agents](/docs/agents/)
    -   [Models](/docs/models/)
    -   [Themes](/docs/themes/)
    -   [Keybinds](/docs/keybinds/)
    -   [Commands](/docs/commands/)
    -   [Formatters](/docs/formatters/)
    -   [Permissions](/docs/permissions/)
    -   [LSP Servers](/docs/lsp/)
    -   [MCP servers](/docs/mcp-servers/)
    -   [ACP Support](/docs/acp/)
    -   [Agent Skills](/docs/skills/)
    -   [Custom Tools](/docs/custom-tools/)
    
-   Develop
    
    -   [SDK](/docs/sdk/)
    -   [Server](/docs/server/)
    -   [Plugins](/docs/plugins/)
    -   [Ecosystem](/docs/ecosystem/)
    

[GitHub](https://github.com/anomalyco/opencode)[Discord](https://opencode.ai/discord)

Select theme DarkLightAuto   Select language EnglishالعربيةBosanskiDanskDeutschEspañolFrançaisItaliano日本語한국어Norsk BokmålPolskiPortuguês (Brasil)РусскийไทยTürkçe简体中文繁體中文

On this page

-   [Overview](#_top)
-   [Install](#install)
-   [Create client](#create-client)
-   [Config](#config)
-   [Client only](#client-only)
-   [Types](#types)
-   [Errors](#errors)
-   [Structured Output](#structured-output)
    -   [Basic Usage](#basic-usage)
    -   [Output Format Types](#output-format-types)
    -   [JSON Schema Format](#json-schema-format)
    -   [Error Handling](#error-handling)
    -   [Best Practices](#best-practices)
-   [APIs](#apis)
    -   [Global](#global)
    -   [App](#app)
    -   [Project](#project)
    -   [Path](#path)
    -   [Config](#config-1)
    -   [Sessions](#sessions)
    -   [Files](#files)
    -   [TUI](#tui)
    -   [Auth](#auth)
    -   [Events](#events)

## On this page

-   [Overview](#_top)
-   [Install](#install)
-   [Create client](#create-client)
-   [Config](#config)
-   [Client only](#client-only)
-   [Types](#types)
-   [Errors](#errors)
-   [Structured Output](#structured-output)
    -   [Basic Usage](#basic-usage)
    -   [Output Format Types](#output-format-types)
    -   [JSON Schema Format](#json-schema-format)
    -   [Error Handling](#error-handling)
    -   [Best Practices](#best-practices)
-   [APIs](#apis)
    -   [Global](#global)
    -   [App](#app)
    -   [Project](#project)
    -   [Path](#path)
    -   [Config](#config-1)
    -   [Sessions](#sessions)
    -   [Files](#files)
    -   [TUI](#tui)
    -   [Auth](#auth)
    -   [Events](#events)

# SDK

Type-safe JS client for opencode server.

The opencode JS/TS SDK provides a type-safe client for interacting with the server. Use it to build integrations and control opencode programmatically.

[Learn more](/docs/server) about how the server works. For examples, check out the [projects](/docs/ecosystem#projects) built by the community.

---

## [Install](#install)

Install the SDK from npm:

Terminal window

```
npm install @opencode-ai/sdk
```

---

## [Create client](#create-client)

Create an instance of opencode:

```
import { createOpencode } from "@opencode-ai/sdk"
const { client } = await createOpencode()
```

This starts both a server and a client

#### [Options](#options)

Option

Type

Description

Default

`hostname`

`string`

Server hostname

`127.0.0.1`

`port`

`number`

Server port

`4096`

`signal`

`AbortSignal`

Abort signal for cancellation

`undefined`

`timeout`

`number`

Timeout in ms for server start

`5000`

`config`

`Config`

Configuration object

`{}`

---

## [Config](#config)

You can pass a configuration object to customize behavior. The instance still picks up your `opencode.json`, but you can override or add configuration inline:

```
import { createOpencode } from "@opencode-ai/sdk"
const opencode = await createOpencode({  hostname: "127.0.0.1",  port: 4096,  config: {    model: "anthropic/claude-3-5-sonnet-20241022",  },})
console.log(`Server running at ${opencode.server.url}`)
opencode.server.close()
```

## [Client only](#client-only)

If you already have a running instance of opencode, you can create a client instance to connect to it:

```
import { createOpencodeClient } from "@opencode-ai/sdk"
const client = createOpencodeClient({  baseUrl: "http://localhost:4096",})
```

#### [Options](#options-1)

Option

Type

Description

Default

`baseUrl`

`string`

URL of the server

`http://localhost:4096`

`fetch`

`function`

Custom fetch implementation

`globalThis.fetch`

`parseAs`

`string`

Response parsing method

`auto`

`responseStyle`

`string`

Return style: `data` or `fields`

`fields`

`throwOnError`

`boolean`

Throw errors instead of return

`false`

---

## [Types](#types)

The SDK includes TypeScript definitions for all API types. Import them directly:

```
import type { Session, Message, Part } from "@opencode-ai/sdk"
```

All types are generated from the server’s OpenAPI specification and available in the [types file](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts).

---

## [Errors](#errors)

The SDK can throw errors that you can catch and handle:

```
try {  await client.session.get({ path: { id: "invalid-id" } })} catch (error) {  console.error("Failed to get session:", (error as Error).message)}
```

---

## [Structured Output](#structured-output)

You can request structured JSON output from the model by specifying an `format` with a JSON schema. The model will use a `StructuredOutput` tool to return validated JSON matching your schema.

### [Basic Usage](#basic-usage)

```
const result = await client.session.prompt({  path: { id: sessionId },  body: {    parts: [{ type: "text", text: "Research Anthropic and provide company info" }],    format: {      type: "json_schema",      schema: {        type: "object",        properties: {          company: { type: "string", description: "Company name" },          founded: { type: "number", description: "Year founded" },          products: {            type: "array",            items: { type: "string" },            description: "Main products",          },        },        required: ["company", "founded"],      },    },  },})
// Access the structured outputconsole.log(result.data.info.structured_output)// { company: "Anthropic", founded: 2021, products: ["Claude", "Claude API"] }
```

### [Output Format Types](#output-format-types)

Type

Description

`text`

Default. Standard text response (no structured output)

`json_schema`

Returns validated JSON matching the provided schema

### [JSON Schema Format](#json-schema-format)

When using `type: 'json_schema'`, provide:

Field

Type

Description

`type`

`'json_schema'`

Required. Specifies JSON schema mode

`schema`

`object`

Required. JSON Schema object defining the output structure

`retryCount`

`number`

Optional. Number of validation retries (default: 2)

### [Error Handling](#error-handling)

If the model fails to produce valid structured output after all retries, the response will include a `StructuredOutputError`:

```
if (result.data.info.error?.name === "StructuredOutputError") {  console.error("Failed to produce structured output:", result.data.info.error.message)  console.error("Attempts:", result.data.info.error.retries)}
```

### [Best Practices](#best-practices)

1.  **Provide clear descriptions** in your schema properties to help the model understand what data to extract
2.  **Use `required`** to specify which fields must be present
3.  **Keep schemas focused** - complex nested schemas may be harder for the model to fill correctly
4.  **Set appropriate `retryCount`** - increase for complex schemas, decrease for simple ones

---

## [APIs](#apis)

The SDK exposes all server APIs through a type-safe client.

---

### [Global](#global)

Method

Description

Response

`global.health()`

Check server health and version

`{ healthy: true, version: string }`

---

#### [Examples](#examples)

```
const health = await client.global.health()console.log(health.data.version)
```

---

### [App](#app)

Method

Description

Response

`app.log()`

Write a log entry

`boolean`

`app.agents()`

List all available agents

[`Agent[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

---

#### [Examples](#examples-1)

```
// Write a log entryawait client.app.log({  body: {    service: "my-app",    level: "info",    message: "Operation completed",  },})
// List available agentsconst agents = await client.app.agents()
```

---

### [Project](#project)

Method

Description

Response

`project.list()`

List all projects

[`Project[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`project.current()`

Get current project

[`Project`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

---

#### [Examples](#examples-2)

```
// List all projectsconst projects = await client.project.list()
// Get current projectconst currentProject = await client.project.current()
```

---

### [Path](#path)

Method

Description

Response

`path.get()`

Get current path

[`Path`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

---

#### [Examples](#examples-3)

```
// Get current path informationconst pathInfo = await client.path.get()
```

---

### [Config](#config-1)

Method

Description

Response

`config.get()`

Get config info

[`Config`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`config.providers()`

List providers and default models

`{ providers:` [`Provider[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`, default: { [key: string]: string } }`

---

#### [Examples](#examples-4)

```
const config = await client.config.get()
const { providers, default: defaults } = await client.config.providers()
```

---

### [Sessions](#sessions)

Method

Description

Notes

`session.list()`

List sessions

Returns [`Session[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`session.get({ path })`

Get session

Returns [`Session`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`session.children({ path })`

List child sessions

Returns [`Session[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`session.create({ body })`

Create session

Returns [`Session`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`session.delete({ path })`

Delete session

Returns `boolean`

`session.update({ path, body })`

Update session properties

Returns [`Session`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`session.init({ path, body })`

Analyze app and create `AGENTS.md`

Returns `boolean`

`session.abort({ path })`

Abort a running session

Returns `boolean`

`session.share({ path })`

Share session

Returns [`Session`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`session.unshare({ path })`

Unshare session

Returns [`Session`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`session.summarize({ path, body })`

Summarize session

Returns `boolean`

`session.messages({ path })`

List messages in a session

Returns `{ info:` [`Message`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`, parts:` [`Part[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`}[]`

`session.message({ path })`

Get message details

Returns `{ info:` [`Message`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`, parts:` [`Part[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`}`

`session.prompt({ path, body })`

Send prompt message

`body.noReply: true` returns UserMessage (context only). Default returns [`AssistantMessage`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts) with AI response. Supports `body.outputFormat` for [structured output](#structured-output)

`session.command({ path, body })`

Send command to session

Returns `{ info:` [`AssistantMessage`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`, parts:` [`Part[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`}`

`session.shell({ path, body })`

Run a shell command

Returns [`AssistantMessage`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`session.revert({ path, body })`

Revert a message

Returns [`Session`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`session.unrevert({ path })`

Restore reverted messages

Returns [`Session`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`postSessionByIdPermissionsByPermissionId({ path, body })`

Respond to a permission request

Returns `boolean`

---

#### [Examples](#examples-5)

```
// Create and manage sessionsconst session = await client.session.create({  body: { title: "My session" },})
const sessions = await client.session.list()
// Send a prompt messageconst result = await client.session.prompt({  path: { id: session.id },  body: {    model: { providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" },    parts: [{ type: "text", text: "Hello!" }],  },})
// Inject context without triggering AI response (useful for plugins)await client.session.prompt({  path: { id: session.id },  body: {    noReply: true,    parts: [{ type: "text", text: "You are a helpful assistant." }],  },})
```

---

### [Files](#files)

Method

Description

Response

`find.text({ query })`

Search for text in files

Array of match objects with `path`, `lines`, `line_number`, `absolute_offset`, `submatches`

`find.files({ query })`

Find files and directories by name

`string[]` (paths)

`find.symbols({ query })`

Find workspace symbols

[`Symbol[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`file.read({ query })`

Read a file

`{ type: "raw" | "patch", content: string }`

`file.status({ query? })`

Get status for tracked files

[`File[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`find.files` supports a few optional query fields:

-   `type`: `"file"` or `"directory"`
-   `directory`: override the project root for the search
-   `limit`: max results (1–200)

---

#### [Examples](#examples-6)

```
// Search and read filesconst textResults = await client.find.text({  query: { pattern: "function.*opencode" },})
const files = await client.find.files({  query: { query: "*.ts", type: "file" },})
const directories = await client.find.files({  query: { query: "packages", type: "directory", limit: 20 },})
const content = await client.file.read({  query: { path: "src/index.ts" },})
```

---

### [TUI](#tui)

Method

Description

Response

`tui.appendPrompt({ body })`

Append text to the prompt

`boolean`

`tui.openHelp()`

Open the help dialog

`boolean`

`tui.openSessions()`

Open the session selector

`boolean`

`tui.openThemes()`

Open the theme selector

`boolean`

`tui.openModels()`

Open the model selector

`boolean`

`tui.submitPrompt()`

Submit the current prompt

`boolean`

`tui.clearPrompt()`

Clear the prompt

`boolean`

`tui.executeCommand({ body })`

Execute a command

`boolean`

`tui.showToast({ body })`

Show toast notification

`boolean`

---

#### [Examples](#examples-7)

```
// Control TUI interfaceawait client.tui.appendPrompt({  body: { text: "Add this to prompt" },})
await client.tui.showToast({  body: { message: "Task completed", variant: "success" },})
```

---

### [Auth](#auth)

Method

Description

Response

`auth.set({ ... })`

Set authentication credentials

`boolean`

---

#### [Examples](#examples-8)

```
await client.auth.set({  path: { id: "anthropic" },  body: { type: "api", key: "your-api-key" },})
```

---

### [Events](#events)

Method

Description

Response

`event.subscribe()`

Server-sent events stream

Server-sent events stream

---

#### [Examples](#examples-9)

```
// Listen to real-time eventsconst events = await client.event.subscribe()for await (const event of events.stream) {  console.log("Event:", event.type, event.properties)}
```

[Edit page](https://github.com/anomalyco/opencode/edit/dev/packages/web/src/content/docs/sdk.mdx)[Found a bug? Open an issue](https://github.com/anomalyco/opencode/issues/new)[Join our Discord community](https://opencode.ai/discord) Select language EnglishالعربيةBosanskiDanskDeutschEspañolFrançaisItaliano日本語한국어Norsk BokmålPolskiPortuguês (Brasil)РусскийไทยTürkçe简体中文繁體中文 

© [Anomaly](https://anoma.ly)

Last updated: Feb 25, 2026
```

**Tool: webfetch**

**Input:**
```json
{
  "url": "https://opencode.ai/docs/server/",
  "format": "markdown"
}
```

**Output:**
```
Server | OpenCode     [Skip to content](#_top)

  [![](/docs/_astro/logo-dark.DOStV66V.svg) ![](/docs/_astro/logo-light.B0yzR0O5.svg) OpenCode](/docs/)

[app.header.home](/)[app.header.docs](/docs/)

[](https://github.com/anomalyco/opencode)[](https://opencode.ai/discord)

Search CtrlK

Cancel

-   [Intro](/docs/)
-   [Config](/docs/config/)
-   [Providers](/docs/providers/)
-   [Network](/docs/network/)
-   [Enterprise](/docs/enterprise/)
-   [Troubleshooting](/docs/troubleshooting/)
-   [Windows](/docs/windows-wsl)
-   Usage
    
    -   [TUI](/docs/tui/)
    -   [CLI](/docs/cli/)
    -   [Web](/docs/web/)
    -   [IDE](/docs/ide/)
    -   [Zen](/docs/zen/)
    -   [Share](/docs/share/)
    -   [GitHub](/docs/github/)
    -   [GitLab](/docs/gitlab/)
    
-   Configure
    
    -   [Tools](/docs/tools/)
    -   [Rules](/docs/rules/)
    -   [Agents](/docs/agents/)
    -   [Models](/docs/models/)
    -   [Themes](/docs/themes/)
    -   [Keybinds](/docs/keybinds/)
    -   [Commands](/docs/commands/)
    -   [Formatters](/docs/formatters/)
    -   [Permissions](/docs/permissions/)
    -   [LSP Servers](/docs/lsp/)
    -   [MCP servers](/docs/mcp-servers/)
    -   [ACP Support](/docs/acp/)
    -   [Agent Skills](/docs/skills/)
    -   [Custom Tools](/docs/custom-tools/)
    
-   Develop
    
    -   [SDK](/docs/sdk/)
    -   [Server](/docs/server/)
    -   [Plugins](/docs/plugins/)
    -   [Ecosystem](/docs/ecosystem/)
    

[GitHub](https://github.com/anomalyco/opencode)[Discord](https://opencode.ai/discord)

Select theme DarkLightAuto   Select language EnglishالعربيةBosanskiDanskDeutschEspañolFrançaisItaliano日本語한국어Norsk BokmålPolskiPortuguês (Brasil)РусскийไทยTürkçe简体中文繁體中文

On this page

-   [Overview](#_top)
    -   [Usage](#usage)
    -   [Authentication](#authentication)
    -   [How it works](#how-it-works)
-   [Spec](#spec)
-   [APIs](#apis)
    -   [Global](#global)
    -   [Project](#project)
    -   [Path & VCS](#path--vcs)
    -   [Instance](#instance)
    -   [Config](#config)
    -   [Provider](#provider)
    -   [Sessions](#sessions)
    -   [Messages](#messages)
    -   [Commands](#commands)
    -   [Files](#files)
    -   [Tools (Experimental)](#tools-experimental)
    -   [LSP, Formatters & MCP](#lsp-formatters--mcp)
    -   [Agents](#agents)
    -   [Logging](#logging)
    -   [TUI](#tui)
    -   [Auth](#auth)
    -   [Events](#events)
    -   [Docs](#docs)

## On this page

-   [Overview](#_top)
    -   [Usage](#usage)
    -   [Authentication](#authentication)
    -   [How it works](#how-it-works)
-   [Spec](#spec)
-   [APIs](#apis)
    -   [Global](#global)
    -   [Project](#project)
    -   [Path & VCS](#path--vcs)
    -   [Instance](#instance)
    -   [Config](#config)
    -   [Provider](#provider)
    -   [Sessions](#sessions)
    -   [Messages](#messages)
    -   [Commands](#commands)
    -   [Files](#files)
    -   [Tools (Experimental)](#tools-experimental)
    -   [LSP, Formatters & MCP](#lsp-formatters--mcp)
    -   [Agents](#agents)
    -   [Logging](#logging)
    -   [TUI](#tui)
    -   [Auth](#auth)
    -   [Events](#events)
    -   [Docs](#docs)

# Server

Interact with opencode server over HTTP.

The `opencode serve` command runs a headless HTTP server that exposes an OpenAPI endpoint that an opencode client can use.

---

### [Usage](#usage)

Terminal window

```
opencode serve [--port <number>] [--hostname <string>] [--cors <origin>]
```

#### [Options](#options)

Flag

Description

Default

`--port`

Port to listen on

`4096`

`--hostname`

Hostname to listen on

`127.0.0.1`

`--mdns`

Enable mDNS discovery

`false`

`--mdns-domain`

Custom domain name for mDNS service

`opencode.local`

`--cors`

Additional browser origins to allow

`[]`

`--cors` can be passed multiple times:

Terminal window

```
opencode serve --cors http://localhost:5173 --cors https://app.example.com
```

---

### [Authentication](#authentication)

Set `OPENCODE_SERVER_PASSWORD` to protect the server with HTTP basic auth. The username defaults to `opencode`, or set `OPENCODE_SERVER_USERNAME` to override it. This applies to both `opencode serve` and `opencode web`.

Terminal window

```
OPENCODE_SERVER_PASSWORD=your-password opencode serve
```

---

### [How it works](#how-it-works)

When you run `opencode` it starts a TUI and a server. Where the TUI is the client that talks to the server. The server exposes an OpenAPI 3.1 spec endpoint. This endpoint is also used to generate an [SDK](/docs/sdk).

Tip

Use the opencode server to interact with opencode programmatically.

This architecture lets opencode support multiple clients and allows you to interact with opencode programmatically.

You can run `opencode serve` to start a standalone server. If you have the opencode TUI running, `opencode serve` will start a new server.

---

#### [Connect to an existing server](#connect-to-an-existing-server)

When you start the TUI it randomly assigns a port and hostname. You can instead pass in the `--hostname` and `--port` [flags](/docs/cli). Then use this to connect to its server.

The [`/tui`](#tui) endpoint can be used to drive the TUI through the server. For example, you can prefill or run a prompt. This setup is used by the OpenCode [IDE](/docs/ide) plugins.

---

## [Spec](#spec)

The server publishes an OpenAPI 3.1 spec that can be viewed at:

```
http://<hostname>:<port>/doc
```

For example, `http://localhost:4096/doc`. Use the spec to generate clients or inspect request and response types. Or view it in a Swagger explorer.

---

## [APIs](#apis)

The opencode server exposes the following APIs.

---

### [Global](#global)

Method

Path

Description

Response

`GET`

`/global/health`

Get server health and version

`{ healthy: true, version: string }`

`GET`

`/global/event`

Get global events (SSE stream)

Event stream

---

### [Project](#project)

Method

Path

Description

Response

`GET`

`/project`

List all projects

[`Project[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`GET`

`/project/current`

Get the current project

[`Project`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

---

### [Path & VCS](#path--vcs)

Method

Path

Description

Response

`GET`

`/path`

Get the current path

[`Path`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`GET`

`/vcs`

Get VCS info for the current project

[`VcsInfo`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

---

### [Instance](#instance)

Method

Path

Description

Response

`POST`

`/instance/dispose`

Dispose the current instance

`boolean`

---

### [Config](#config)

Method

Path

Description

Response

`GET`

`/config`

Get config info

[`Config`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`PATCH`

`/config`

Update config

[`Config`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`GET`

`/config/providers`

List providers and default models

`{ providers:` [Provider\[\]](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`, default: { [key: string]: string } }`

---

### [Provider](#provider)

Method

Path

Description

Response

`GET`

`/provider`

List all providers

`{ all:` [Provider\[\]](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`, default: {...}, connected: string[] }`

`GET`

`/provider/auth`

Get provider authentication methods

`{ [providerID: string]:` [ProviderAuthMethod\[\]](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts) `}`

`POST`

`/provider/{id}/oauth/authorize`

Authorize a provider using OAuth

[`ProviderAuthAuthorization`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`POST`

`/provider/{id}/oauth/callback`

Handle OAuth callback for a provider

`boolean`

---

### [Sessions](#sessions)

Method

Path

Description

Notes

`GET`

`/session`

List all sessions

Returns [`Session[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`POST`

`/session`

Create a new session

body: `{ parentID?, title? }`, returns [`Session`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`GET`

`/session/status`

Get session status for all sessions

Returns `{ [sessionID: string]:` [SessionStatus](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts) `}`

`GET`

`/session/:id`

Get session details

Returns [`Session`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`DELETE`

`/session/:id`

Delete a session and all its data

Returns `boolean`

`PATCH`

`/session/:id`

Update session properties

body: `{ title? }`, returns [`Session`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`GET`

`/session/:id/children`

Get a session’s child sessions

Returns [`Session[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`GET`

`/session/:id/todo`

Get the todo list for a session

Returns [`Todo[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`POST`

`/session/:id/init`

Analyze app and create `AGENTS.md`

body: `{ messageID, providerID, modelID }`, returns `boolean`

`POST`

`/session/:id/fork`

Fork an existing session at a message

body: `{ messageID? }`, returns [`Session`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`POST`

`/session/:id/abort`

Abort a running session

Returns `boolean`

`POST`

`/session/:id/share`

Share a session

Returns [`Session`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`DELETE`

`/session/:id/share`

Unshare a session

Returns [`Session`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`GET`

`/session/:id/diff`

Get the diff for this session

query: `messageID?`, returns [`FileDiff[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`POST`

`/session/:id/summarize`

Summarize the session

body: `{ providerID, modelID }`, returns `boolean`

`POST`

`/session/:id/revert`

Revert a message

body: `{ messageID, partID? }`, returns `boolean`

`POST`

`/session/:id/unrevert`

Restore all reverted messages

Returns `boolean`

`POST`

`/session/:id/permissions/:permissionID`

Respond to a permission request

body: `{ response, remember? }`, returns `boolean`

---

### [Messages](#messages)

Method

Path

Description

Notes

`GET`

`/session/:id/message`

List messages in a session

query: `limit?`, returns `{ info:` [Message](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`, parts:` [Part\[\]](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`}[]`

`POST`

`/session/:id/message`

Send a message and wait for response

body: `{ messageID?, model?, agent?, noReply?, system?, tools?, parts }`, returns `{ info:` [Message](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`, parts:` [Part\[\]](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`}`

`GET`

`/session/:id/message/:messageID`

Get message details

Returns `{ info:` [Message](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`, parts:` [Part\[\]](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`}`

`POST`

`/session/:id/prompt_async`

Send a message asynchronously (no wait)

body: same as `/session/:id/message`, returns `204 No Content`

`POST`

`/session/:id/command`

Execute a slash command

body: `{ messageID?, agent?, model?, command, arguments }`, returns `{ info:` [Message](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`, parts:` [Part\[\]](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`}`

`POST`

`/session/:id/shell`

Run a shell command

body: `{ agent, model?, command }`, returns `{ info:` [Message](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`, parts:` [Part\[\]](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)`}`

---

### [Commands](#commands)

Method

Path

Description

Response

`GET`

`/command`

List all commands

[`Command[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

---

### [Files](#files)

Method

Path

Description

Response

`GET`

`/find?pattern=<pat>`

Search for text in files

Array of match objects with `path`, `lines`, `line_number`, `absolute_offset`, `submatches`

`GET`

`/find/file?query=<q>`

Find files and directories by name

`string[]` (paths)

`GET`

`/find/symbol?query=<q>`

Find workspace symbols

[`Symbol[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`GET`

`/file?path=<path>`

List files and directories

[`FileNode[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`GET`

`/file/content?path=<p>`

Read a file

[`FileContent`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`GET`

`/file/status`

Get status for tracked files

[`File[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

#### [`/find/file` query parameters](#findfile-query-parameters)

-   `query` (required) — search string (fuzzy match)
-   `type` (optional) — limit results to `"file"` or `"directory"`
-   `directory` (optional) — override the project root for the search
-   `limit` (optional) — max results (1–200)
-   `dirs` (optional) — legacy flag (`"false"` returns only files)

---

### [Tools (Experimental)](#tools-experimental)

Method

Path

Description

Response

`GET`

`/experimental/tool/ids`

List all tool IDs

[`ToolIDs`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`GET`

`/experimental/tool?provider=<p>&model=<m>`

List tools with JSON schemas for a model

[`ToolList`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

---

### [LSP, Formatters & MCP](#lsp-formatters--mcp)

Method

Path

Description

Response

`GET`

`/lsp`

Get LSP server status

[`LSPStatus[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`GET`

`/formatter`

Get formatter status

[`FormatterStatus[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

`GET`

`/mcp`

Get MCP server status

`{ [name: string]:` [MCPStatus](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts) `}`

`POST`

`/mcp`

Add MCP server dynamically

body: `{ name, config }`, returns MCP status object

---

### [Agents](#agents)

Method

Path

Description

Response

`GET`

`/agent`

List all available agents

[`Agent[]`](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

---

### [Logging](#logging)

Method

Path

Description

Response

`POST`

`/log`

Write log entry. Body: `{ service, level, message, extra? }`

`boolean`

---

### [TUI](#tui)

Method

Path

Description

Response

`POST`

`/tui/append-prompt`

Append text to the prompt

`boolean`

`POST`

`/tui/open-help`

Open the help dialog

`boolean`

`POST`

`/tui/open-sessions`

Open the session selector

`boolean`

`POST`

`/tui/open-themes`

Open the theme selector

`boolean`

`POST`

`/tui/open-models`

Open the model selector

`boolean`

`POST`

`/tui/submit-prompt`

Submit the current prompt

`boolean`

`POST`

`/tui/clear-prompt`

Clear the prompt

`boolean`

`POST`

`/tui/execute-command`

Execute a command (`{ command }`)

`boolean`

`POST`

`/tui/show-toast`

Show toast (`{ title?, message, variant }`)

`boolean`

`GET`

`/tui/control/next`

Wait for the next control request

Control request object

`POST`

`/tui/control/response`

Respond to a control request (`{ body }`)

`boolean`

---

### [Auth](#auth)

Method

Path

Description

Response

`PUT`

`/auth/:id`

Set authentication credentials. Body must match provider schema

`boolean`

---

### [Events](#events)

Method

Path

Description

Response

`GET`

`/event`

Server-sent events stream. First event is `server.connected`, then bus events

Server-sent events stream

---

### [Docs](#docs)

Method

Path

Description

Response

`GET`

`/doc`

OpenAPI 3.1 specification

HTML page with OpenAPI spec

[Edit page](https://github.com/anomalyco/opencode/edit/dev/packages/web/src/content/docs/server.mdx)[Found a bug? Open an issue](https://github.com/anomalyco/opencode/issues/new)[Join our Discord community](https://opencode.ai/discord) Select language EnglishالعربيةBosanskiDanskDeutschEspañolFrançaisItaliano日本語한국어Norsk BokmålPolskiPortuguês (Brasil)РусскийไทยTürkçe简体中文繁體中文 

© [Anomaly](https://anoma.ly)

Last updated: Feb 25, 2026
```

---

## Assistant (Build · eu.anthropic.claude-sonnet-4-6 · 6.5s)

Now I have a complete picture. Let me also check the package.json and read the media/main.js before planning the rewrite:

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/biniam.palaiologos/projects/personal-dev/vscode-opencode-gui-plugin/package.json"
}
```

**Output:**
```
<path>/Users/biniam.palaiologos/projects/personal-dev/vscode-opencode-gui-plugin/package.json</path>
<type>file</type>
<content>1: {
2:   "name": "vscode-opencode-gui-plugin",
3:   "publisher": "poleNgrek",
4:   "repository": "https://github.com/poleNgrek/vscode-opencode-gui-plugin",
5:   "displayName": "OpenCode Sidebar UI",
6:   "description": "AI coding assistant powered by opencode CLI",
7:   "version": "0.1.0",
8:   "engines": {
9:     "vscode": "^1.85.0"
10:   },
11:   "categories": ["AI", "Other"],
12:   "activationEvents": ["onStartupFinished"],
13:   "main": "./out/extension.js",
14:   "contributes": {
15:     "viewsContainers": {
16:       "activitybar": [
17:         {
18:           "id": "opencode",
19:           "title": "OpenCode",
20:           "icon": "media/icon.png"
21:         }
22:       ]
23:     },
24:     "views": {
25:       "opencode": [
26:         {
27:           "type": "webview",
28:           "id": "opencode.chatView",
29:           "name": "Chat"
30:         }
31:       ]
32:     },
33:     "commands": [
34:       {
35:         "command": "opencode.newSession",
36:         "title": "OpenCode: New Session"
37:       },
38:       {
39:         "command": "opencode.addCurrentFile",
40:         "title": "OpenCode: Add Current File to Context"
41:       },
42:       {
43:         "command": "opencode.focus",
44:         "title": "OpenCode: Focus Chat"
45:       }
46:     ],
47:     "keybindings": [
48:       {
49:         "command": "opencode.focus",
50:         "key": "ctrl+shift+o",
51:         "mac": "cmd+shift+o"
52:       }
53:     ],
54:     "configuration": {
55:       "title": "OpenCode",
56:       "properties": {
57:         "opencode.cliPath": {
58:           "type": "string",
59:           "default": "opencode",
60:           "description": "Path to the opencode CLI binary"
61:         },
62:         "opencode.model": {
63:           "type": "string",
64:           "default": "",
65:           "description": "Model to use (leave empty for opencode default)"
66:         }
67:       }
68:     }
69:   },
70:   "scripts": {
71:     "compile": "tsc -p ./",
72:     "watch": "tsc -watch -p ./",
73:     "package": "vsce package",
74:     "lint": "eslint src --ext ts"
75:   },
76:   "devDependencies": {
77:     "@types/node": "^20.0.0",
78:     "@types/vscode": "^1.85.0",
79:     "typescript": "^5.3.0",
80:     "@vscode/vsce": "^2.22.0"
81:   }
82: }

(End of file - total 82 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/biniam.palaiologos/projects/personal-dev/vscode-opencode-gui-plugin/media/main.js"
}
```

**Output:**
```
<path>/Users/biniam.palaiologos/projects/personal-dev/vscode-opencode-gui-plugin/media/main.js</path>
<type>file</type>
<content>1: // @ts-check
2: /// <reference lib="dom" />
3: (function () {
4:   const vscode = acquireVsCodeApi();
5: 
6:   // ── Elements ──────────────────────────────────────────────────────────────
7:   const messagesEl = /** @type {HTMLElement} */ (document.getElementById("messages"));
8:   const emptyEl = /** @type {HTMLElement} */ (document.getElementById("empty"));
9:   const inputEl = /** @type {HTMLTextAreaElement} */ (document.getElementById("input"));
10:   const btnSend = /** @type {HTMLButtonElement} */ (document.getElementById("btn-send"));
11:   const btnStop = /** @type {HTMLButtonElement} */ (document.getElementById("btn-stop"));
12:   const btnNew = /** @type {HTMLButtonElement} */ (document.getElementById("btn-new"));
13:   const btnContext = /** @type {HTMLButtonElement} */ (document.getElementById("btn-context"));
14:   const btnPick = /** @type {HTMLButtonElement} */ (document.getElementById("btn-pick"));
15:   const contextBar = /** @type {HTMLElement} */ (document.getElementById("context-bar"));
16: 
17:   // ── State ─────────────────────────────────────────────────────────────────
18:   let isStreaming = false;
19:   let currentStreamBubble = /** @type {HTMLElement|null} */ (null);
20:   let currentStreamId = /** @type {string|null} */ (null);
21:   let contextFiles = /** @type {string[]} */ ([]);
22: 
23:   // ── Auto-resize textarea ──────────────────────────────────────────────────
24:   function resizeInput() {
25:     inputEl.style.height = "auto";
26:     inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
27:   }
28:   inputEl.addEventListener("input", resizeInput);
29: 
30:   // ── Send on Enter ─────────────────────────────────────────────────────────
31:   inputEl.addEventListener("keydown", (e) => {
32:     if (e.key === "Enter" && !e.shiftKey) {
33:       e.preventDefault();
34:       sendMessage();
35:     }
36:   });
37: 
38:   btnSend.addEventListener("click", sendMessage);
39:   btnStop.addEventListener("click", () => vscode.postMessage({ type: "abort" }));
40:   btnNew.addEventListener("click", () => vscode.postMessage({ type: "newSession" }));
41:   btnContext.addEventListener("click", () => vscode.postMessage({ type: "pickFiles" }));
42:   btnPick.addEventListener("click", () => vscode.postMessage({ type: "pickFiles" }));
43: 
44:   function sendMessage() {
45:     const text = inputEl.value.trim();
46:     if (!text || isStreaming) return;
47:     vscode.postMessage({ type: "send", text });
48:     inputEl.value = "";
49:     resizeInput();
50:   }
51: 
52:   // ── Streaming state ───────────────────────────────────────────────────────
53:   function setStreaming(on) {
54:     isStreaming = on;
55:     btnSend.style.display = on ? "none" : "flex";
56:     btnStop.style.display = on ? "flex" : "none";
57:     btnSend.disabled = on;
58:     inputEl.disabled = on;
59:   }
60: 
61:   // ── Render helpers ────────────────────────────────────────────────────────
62:   function hideEmpty() {
63:     emptyEl.style.display = "none";
64:   }
65: 
66:   function renderMessage(msg) {
67:     hideEmpty();
68:     const wrapper = document.createElement("div");
69:     wrapper.className = `message ${msg.role}`;
70:     wrapper.dataset.id = msg.id;
71: 
72:     const label = document.createElement("div");
73:     label.className = "role-label";
74:     label.textContent = msg.role === "user" ? "You" : "OpenCode";
75: 
76:     const bubble = document.createElement("div");
77:     bubble.className = "bubble";
78:     bubble.innerHTML = formatContent(msg.content);
79: 
80:     wrapper.appendChild(label);
81:     wrapper.appendChild(bubble);
82:     messagesEl.appendChild(wrapper);
83:     scrollToBottom();
84:     return bubble;
85:   }
86: 
87:   function formatContent(text) {
88:     // Simple code block rendering (```...```)
89:     return text
90:       .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
91:       .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
92:         return `<pre><code class="language-${lang}">${code.trimEnd()}</code></pre>`;
93:       })
94:       .replace(/`([^`]+)`/g, "<code>$1</code>")
95:       .replace(/\n/g, "<br>");
96:   }
97: 
98:   function scrollToBottom() {
99:     messagesEl.scrollTop = messagesEl.scrollHeight;
100:   }
101: 
102:   function updateContextBar() {
103:     // Remove all chips except the pick button
104:     const chips = contextBar.querySelectorAll(".file-chip");
105:     chips.forEach(c => c.remove());
106: 
107:     if (contextFiles.length === 0) {
108:       contextBar.classList.add("empty");
109:     } else {
110:       contextBar.classList.remove("empty");
111:       // Insert chips before btn-pick
112:       contextFiles.forEach(fp => {
113:         const chip = document.createElement("div");
114:         chip.className = "file-chip";
115:         const name = fp.split(/[\\/]/).pop() || fp;
116:         chip.innerHTML = `<span title="${fp}">${name}</span><span class="remove" data-path="${fp}" title="Remove">×</span>`;
117:         chip.querySelector(".remove").addEventListener("click", (e) => {
118:           const filePath = /** @type {HTMLElement} */ (e.target).dataset.path;
119:           vscode.postMessage({ type: "removeFile", filePath });
120:         });
121:         contextBar.insertBefore(chip, btnPick);
122:       });
123:     }
124:   }
125: 
126:   // ── Message handler ───────────────────────────────────────────────────────
127:   window.addEventListener("message", (event) => {
128:     const msg = event.data;
129: 
130:     switch (msg.type) {
131:       case "restore": {
132:         // Rebuild from saved session
133:         messagesEl.innerHTML = "";
134:         messagesEl.appendChild(emptyEl);
135:         const session = msg.session;
136:         contextFiles = session.contextFiles || [];
137:         updateContextBar();
138:         if (session.messages.length === 0) {
139:           emptyEl.style.display = "";
140:         } else {
141:           hideEmpty();
142:           session.messages.forEach(m => renderMessage(m));
143:         }
144:         if (msg.isStreaming) setStreaming(true);
145:         break;
146:       }
147: 
148:       case "newSession": {
149:         messagesEl.innerHTML = "";
150:         messagesEl.appendChild(emptyEl);
151:         emptyEl.style.display = "";
152:         contextFiles = [];
153:         updateContextBar();
154:         setStreaming(false);
155:         currentStreamBubble = null;
156:         currentStreamId = null;
157:         break;
158:       }
159: 
160:       case "userMessage": {
161:         renderMessage(msg.message);
162:         break;
163:       }
164: 
165:       case "streamStart": {
166:         setStreaming(true);
167:         currentStreamId = msg.id;
168:         hideEmpty();
169:         const wrapper = document.createElement("div");
170:         wrapper.className = "message assistant";
171:         wrapper.dataset.id = msg.id;
172: 
173:         const label = document.createElement("div");
174:         label.className = "role-label";
175:         label.textContent = "OpenCode";
176: 
177:         const bubble = document.createElement("div");
178:         bubble.className = "bubble streaming-cursor";
179:         currentStreamBubble = bubble;
180: 
181:         wrapper.appendChild(label);
182:         wrapper.appendChild(bubble);
183:         messagesEl.appendChild(wrapper);
184:         scrollToBottom();
185:         break;
186:       }
187: 
188:       case "streamChunk": {
189:         if (currentStreamBubble && msg.id === currentStreamId) {
190:           // Accumulate raw text, re-render formatted
191:           currentStreamBubble.dataset.raw = (currentStreamBubble.dataset.raw || "") + msg.chunk;
192:           currentStreamBubble.innerHTML = formatContent(currentStreamBubble.dataset.raw);
193:           // Re-add cursor class
194:           currentStreamBubble.classList.add("streaming-cursor");
195:           scrollToBottom();
196:         }
197:         break;
198:       }
199: 
200:       case "streamEnd": {
201:         setStreaming(false);
202:         if (currentStreamBubble) {
203:           currentStreamBubble.classList.remove("streaming-cursor");
204:           currentStreamBubble = null;
205:           currentStreamId = null;
206:         }
207:         inputEl.focus();
208:         break;
209:       }
210: 
211:       case "updateFiles": {
212:         contextFiles = msg.files || [];
213:         updateContextBar();
214:         break;
215:       }
216: 
217:       case "error": {
218:         setStreaming(false);
219:         if (currentStreamBubble) {
220:           currentStreamBubble.classList.remove("streaming-cursor");
221:           currentStreamBubble = null;
222:         }
223:         const errDiv = document.createElement("div");
224:         errDiv.className = "error-msg";
225:         errDiv.textContent = "⚠ " + msg.message;
226:         messagesEl.appendChild(errDiv);
227:         scrollToBottom();
228:         break;
229:       }
230:     }
231:   });
232: 
233:   // Tell extension we're ready
234:   vscode.postMessage({ type: "ready" });
235:   inputEl.focus();
236: })();

(End of file - total 236 lines)
</content>
```

---

## Assistant (Build · eu.anthropic.claude-sonnet-4-6 · 6.2s)

Now I have everything I need. Let me plan and execute the rewrite:

**Tool: todowrite**

**Input:**
```json
{
  "todos": [
    {
      "content": "Rewrite src/opencode.ts — replace subprocess approach with HTTP client talking to opencode serve",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Update src/panel.ts — adapt to new client API (server lifecycle, SSE events, session IDs)",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Update package.json — add serverPort config setting, bump version",
      "status": "pending",
      "priority": "medium"
    },
    {
      "content": "Compile and verify no TypeScript errors",
      "status": "pending",
      "priority": "high"
    }
  ]
}
```

**Output:**
```
[
  {
    "content": "Rewrite src/opencode.ts — replace subprocess approach with HTTP client talking to opencode serve",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Update src/panel.ts — adapt to new client API (server lifecycle, SSE events, session IDs)",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Update package.json — add serverPort config setting, bump version",
    "status": "pending",
    "priority": "medium"
  },
  {
    "content": "Compile and verify no TypeScript errors",
    "status": "pending",
    "priority": "high"
  }
]
```

---

## Assistant (Build · eu.anthropic.claude-sonnet-4-6 · 15.1s)

Before writing, let me ask one key design question:

**Tool: question**

**Input:**
```json
{
  "todos": [
    {
      "content": "Rewrite src/opencode.ts — replace subprocess approach with HTTP client talking to opencode serve",
      "priority": "high",
      "status": "in_progress"
    },
    {
      "content": "Update src/panel.ts — adapt to new client API (server lifecycle, SSE events, session IDs)",
      "priority": "high",
      "status": "pending"
    },
    {
      "content": "Update package.json — add serverPort config setting, bump version",
      "priority": "medium",
      "status": "pending"
    },
    {
      "content": "Compile and verify no TypeScript errors",
      "priority": "high",
      "status": "pending"
    }
  ]
}
```

**Error:**
```
Error: The question tool was called with invalid arguments: [
  {
    "expected": "array",
    "code": "invalid_type",
    "path": [
      "questions"
    ],
    "message": "Invalid input: expected array, received undefined"
  }
].
Please rewrite the input so it satisfies the expected schema.
```

---

## Assistant (Build · eu.anthropic.claude-sonnet-4-6 · 32.8s)

**Tool: question**

**Input:**
```json
{
  "questions": [
    {
      "question": "When opencode serve is already running (e.g. the OpenCode.app is open), should the plugin connect to that existing server, or always spawn its own `opencode serve` process?",
      "header": "Server strategy",
      "options": [
        {
          "label": "Detect & connect to existing (Recommended)",
          "description": "Try a known/configured port first; if a server responds, use it. Only spawn a new `opencode serve` if nothing is running. This plays nicely with OpenCode.app."
        },
        {
          "label": "Always spawn own server",
          "description": "Always launch `opencode serve` on a fixed port. Fails if another server already has the port locked."
        },
        {
          "label": "Connect only — never spawn",
          "description": "Never spawn anything. Require the user to have `opencode serve` (or the app) already running. Pure HTTP client mode."
        }
      ]
    },
    {
      "question": "How should the plugin stream the AI response — in real-time via SSE events, or by polling after the prompt call completes?",
      "header": "Streaming approach",
      "options": [
        {
          "label": "SSE event stream (Recommended)",
          "description": "Subscribe to GET /event (SSE) and filter for message_part events to stream tokens in real-time as the model generates them."
        },
        {
          "label": "POST then wait",
          "description": "POST /session/:id/message and block until the full response returns. No streaming — the whole reply appears at once."
        }
      ]
    }
  ]
}
```

**Output:**
```
User has answered your questions: "When opencode serve is already running (e.g. the OpenCode.app is open), should the plugin connect to that existing server, or always spawn its own `opencode serve` process?"="Detect & connect to existing (Recommended)", "How should the plugin stream the AI response — in real-time via SSE events, or by polling after the prompt call completes?"="SSE event stream (Recommended)". You can now continue with the user's answers in mind.
```

---

## Assistant (Build · eu.anthropic.claude-sonnet-4-6 · 7.8s)

**Tool: todowrite**

**Input:**
```json
{
  "todos": [
    {
      "content": "Rewrite src/opencode.ts — replace subprocess approach with HTTP client talking to opencode serve",
      "priority": "high",
      "status": "in_progress"
    },
    {
      "content": "Update src/panel.ts — adapt to new client API (server lifecycle, SSE events, session IDs)",
      "priority": "high",
      "status": "pending"
    },
    {
      "content": "Update package.json — add serverPort config setting, bump version",
      "priority": "medium",
      "status": "pending"
    },
    {
      "content": "Compile and verify no TypeScript errors",
      "priority": "high",
      "status": "pending"
    }
  ]
}
```

**Output:**
```
[
  {
    "content": "Rewrite src/opencode.ts — replace subprocess approach with HTTP client talking to opencode serve",
    "priority": "high",
    "status": "in_progress"
  },
  {
    "content": "Update src/panel.ts — adapt to new client API (server lifecycle, SSE events, session IDs)",
    "priority": "high",
    "status": "pending"
  },
  {
    "content": "Update package.json — add serverPort config setting, bump version",
    "priority": "medium",
    "status": "pending"
  },
  {
    "content": "Compile and verify no TypeScript errors",
    "priority": "high",
    "status": "pending"
  }
]
```

---

## Assistant (Build · eu.anthropic.claude-sonnet-4-6 · 372.4s)



**Tool: write**

**Input:**
```json
{}
```

**Error:**
```
Tool execution aborted
```



**Tool: write**

**Input:**
```json
{}
```

**Error:**
```
Tool execution aborted
```



**Tool: write**

**Input:**
```json
{}
```

**Error:**
```
Tool execution aborted
```



**Tool: write**

**Input:**
```json
{}
```

**Error:**
```
Tool execution aborted
```





**Tool: write**

**Input:**
```json
{}
```

**Error:**
```
Tool execution aborted
```



**Tool: write**

**Input:**
```json
{}
```

**Error:**
```
Tool execution aborted
```



**Tool: write**

**Input:**
```json
{}
```

**Error:**
```
Tool execution aborted
```



**Tool: write**

**Input:**
```json
{}
```

**Error:**
```
Tool execution aborted
```

---

## User

---

## Assistant (Compaction · eu.anthropic.claude-sonnet-4-6 · 0.4s)

---

