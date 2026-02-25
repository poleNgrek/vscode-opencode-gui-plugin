import * as cp from "child_process";
import * as vscode from "vscode";
import * as path from "path";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  messages: Message[];
  contextFiles: string[];
}

export class OpenCodeClient {
  private cliPath: string;
  private workspaceRoot: string;
  private currentProcess: cp.ChildProcess | null = null;

  constructor() {
    const config = vscode.workspace.getConfiguration("opencode");
    this.cliPath = config.get<string>("cliPath") || "opencode";
    this.workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
  }

  /**
   * Send a message to opencode CLI and stream the response.
   * Calls onChunk with each chunk of text as it arrives,
   * and onDone when the process exits.
   */
  async send(
    prompt: string,
    contextFiles: string[],
    onChunk: (chunk: string) => void,
    onDone: (exitCode: number | null) => void,
    onError: (err: string) => void
  ): Promise<void> {
    // Kill any running process
    this.abort();

    const config = vscode.workspace.getConfiguration("opencode");
    const model = config.get<string>("model") || "";

    // Build args
    // opencode run --print-messages "<prompt>" [--model <model>]
    const args: string[] = ["run", "--print-messages"];

    if (model) {
      args.push("--model", model);
    }

    // Append file context as part of the prompt if any
    let fullPrompt = prompt;
    if (contextFiles.length > 0) {
      const fileList = contextFiles
        .map((f) => path.relative(this.workspaceRoot, f))
        .join(", ");
      fullPrompt = `[Context files: ${fileList}]\n\n${prompt}`;
    }

    args.push(fullPrompt);

    try {
      this.currentProcess = cp.spawn(this.cliPath, args, {
        cwd: this.workspaceRoot,
        shell: false,
      });

      let stderr = "";

      this.currentProcess.stdout?.on("data", (data: Buffer) => {
        onChunk(data.toString());
      });

      this.currentProcess.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      this.currentProcess.on("error", (err) => {
        if (err.message.includes("ENOENT")) {
          onError(
            `opencode CLI not found at "${this.cliPath}". ` +
              `Install it or set opencode.cliPath in settings.`
          );
        } else {
          onError(err.message);
        }
        onDone(null);
      });

      this.currentProcess.on("close", (code) => {
        this.currentProcess = null;
        if (code !== 0 && stderr) {
          onError(stderr);
        }
        onDone(code);
      });
    } catch (err) {
      onError(String(err));
      onDone(null);
    }
  }

  abort() {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
  }
}
