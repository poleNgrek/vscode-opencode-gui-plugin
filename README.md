# vscode-opencode

A VS Code sidebar extension for [opencode](https://opencode.ai) — a Cursor-style AI chat panel powered by the opencode CLI.

## Features

- 💬 **Chat panel** in the Activity Bar sidebar
- 📎 **File context picker** — attach files to your prompt
- 🕘 **Conversation history** preserved across panel hides
- 🔄 **Streaming responses** from opencode CLI
- ⌨️ `Cmd/Ctrl+Shift+O` to focus the chat instantly

## Requirements

- [opencode CLI](https://opencode.ai/docs/installation) installed and on your PATH
- VS Code 1.85+

## Getting Started

### 1. Install opencode CLI

```bash
npm install -g opencode-ai
# or follow https://opencode.ai/docs/installation
```

### 2. Build & install the extension

```bash
cd vscode-opencode
npm install
npm run compile
npm run package     # produces vscode-opencode-0.1.0.vsix
```

Then install it in VS Code:

```bash
code --install-extension vscode-opencode-0.1.0.vsix
```

Or drag the `.vsix` into the Extensions view.

### 3. Open the panel

Click the **⬡** icon in the Activity Bar, or press `Cmd+Shift+O`.

## Settings

| Setting | Default | Description |
|---|---|---|
| `opencode.cliPath` | `opencode` | Path to the opencode binary |
| `opencode.model` | _(empty)_ | Model override (e.g. `gpt-4o`) |

## Commands

| Command | Shortcut | Description |
|---|---|---|
| OpenCode: Focus Chat | `Cmd+Shift+O` | Open/focus the chat panel |
| OpenCode: New Session | — | Start a fresh conversation |
| OpenCode: Add Current File to Context | — | Add the active editor file |

## Architecture

```
src/
  extension.ts   — Activation, command registration
  panel.ts       — WebviewViewProvider (sidebar panel)
  opencode.ts    — CLI subprocess client with streaming
media/
  main.js        — Webview UI (vanilla JS, no framework)
  icon.svg       — Activity bar icon
```

## How it works

1. The extension spawns `opencode run --print-messages "<prompt>"` as a child process
2. stdout is streamed back to the webview in real time
3. Context files are prepended to the prompt automatically
4. Sessions are kept in memory; `New Session` clears everything
