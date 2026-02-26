# vscode-opencode

A VS Code sidebar extension for [opencode](https://opencode.ai) — a Cursor-style AI chat panel that integrates directly with the opencode HTTP server via the official `@opencode-ai/sdk`.

Sessions created in the VS Code plugin are fully shared with the OpenCode TUI, and vice versa.

## Features

- 💬 **Chat panel** in the Activity Bar sidebar with real-time streaming
- 📋 **Session list** — shows all sessions from the opencode server, including ones created in the TUI
- 🔄 **Live session updates** — list refreshes automatically via SSE when sessions change anywhere
- 🔀 **Session switching** — click any session to load its full message history from the server
- ➕ **Eager session creation** — new sessions appear in the list immediately (not lazily on first message)
- 🗑️ **Delete sessions** — trash icon on hover removes a session from the server
- 📎 **File context** — attach files; their contents are injected as `<file>` text parts in the prompt
- ⌨️ `Cmd/Ctrl+Shift+O` to focus the chat instantly

## Requirements

- [opencode](https://opencode.ai/docs/installation) installed (CLI or desktop app)
- VS Code 1.85+
- Node.js 20+

## Getting Started

### 1. Install opencode

```bash
npm install -g opencode-ai
# or see https://opencode.ai/docs/installation
```

### 2. Build and install

```bash
cd vscode-opencode
npm install          # installs @opencode-ai/sdk + esbuild
npm run compile      # bundles everything into dist/extension.js
npm run package      # produces vscode-opencode-gui-plugin-0.1.0.vsix
code --install-extension vscode-opencode-gui-plugin-0.1.0.vsix
```

### 3. Point the plugin at your running server

If OpenCode.app or the TUI is already running, add this to VS Code settings:

```json
"opencode.serverUrl": "http://localhost:63127"
```

Or leave it blank — the plugin will probe port 4096 and spawn its own server if nothing responds.

## Settings

| Setting | Default | Description |
|---|---|---|
| `opencode.serverUrl` | `""` | Explicit server URL — skips all probing when set |
| `opencode.port` | `4096` | Port to probe or spawn on |
| `opencode.probePorts` | `[]` | Extra ports to probe (e.g. `[63127]`) |
| `opencode.cliPath` | `opencode` | Path to the opencode binary |
| `opencode.model` | `""` | Model override. Leave blank to use the server's configured default from `opencode.json`. Accepts `providerID/modelID` (e.g. `anthropic/claude-sonnet-4-5`) or the flat model key format from `opencode.json` (e.g. `eu.anthropic.claude-sonnet-4-6`). |

## Commands

| Command | Shortcut | Description |
|---|---|---|
| OpenCode: Focus Chat | `Cmd/Ctrl+Shift+O` | Open / focus the chat panel |
| OpenCode: New Session | — | Create a new server-side session immediately |
| OpenCode: Add Current File to Context | — | Attach the active editor file |

## Architecture

```
VS Code Extension Host
│
├── src/extension.ts     Activation, command registration, dispose on exit
│
├── src/panel.ts         WebviewViewProvider
│   ├── onReady()        Loads session list, starts background watcher,
│   │                    reloads messages for active session
│   ├── handleSend()     Creates session if needed, posts userMessage,
│   │                    streams via client.send()
│   ├── switchSession()  Aborts stream, fetches messages from server
│   ├── newSession()     Eagerly creates remote session, refreshes list
│   └── deleteSession()  Deletes on server, clears chat if active
│
└── src/opencode.ts      @opencode-ai/sdk wrapper
    ├── getClient()      Discovers / spawns server, returns SDK client
    │                    via createOpencodeClient({ baseUrl })
    ├── listSessions()   session.list()
    ├── loadMessages()   session.messages({ path: { id } })
    ├── createSession()  session.create()  → RemoteSession
    ├── deleteSession()  session.delete()
    ├── renameSession()  session.update()
    ├── send()           event.subscribe() (SSE) + session.prompt()
    │                    Events: { type: "message.part.updated",
    │                              properties: { part, delta } }
    └── startBackground  Persistent event.subscribe() watching for
        Watch()          session.updated / session.created / session.deleted

Webview  (media/main.js)
├── sessionList message  Renders collapsible session list, click to switch
├── switchSession        Clears chat, highlights active session
├── loadMessages         Renders full history from server
├── userMessage          Optimistic user bubble
├── streamStart/Chunk/   Streaming assistant response with blinking cursor
│   End
└── updateFiles          File context chips
```

## How server discovery works

1. `opencode.serverUrl` is set → connect directly, no probing
2. TCP-probe `localhost:<opencode.port>` (default 4096)
3. TCP-probe each port in `opencode.probePorts`
4. Nothing responds → spawn `opencode serve --port <port>`, poll until ready

The plugin and OpenCode TUI connect to the same server process, so all sessions are shared between them in real time.

## How streaming works

The plugin uses the correct two-track pattern from the SDK:

1. **Subscribe first** — `client.event.subscribe()` opens an SSE stream before the prompt is sent, so no chunks are missed
2. **Send the prompt** — `client.session.prompt()` is the blocking call that triggers generation
3. **Filter events** — only `message.part.updated` events matching the current `sessionId` are forwarded; the `delta` field (incremental chunk) is used rather than the full accumulated `text` to avoid duplication
4. **Abort** — `promptAbort.abort()` cancels both the SSE stream and the prompt call together