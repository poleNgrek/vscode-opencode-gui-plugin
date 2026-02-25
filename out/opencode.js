"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenCodeClient = void 0;
const cp = __importStar(require("child_process"));
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class OpenCodeClient {
    constructor() {
        this.currentProcess = null;
        const config = vscode.workspace.getConfiguration("opencode");
        this.cliPath = config.get("cliPath") || "opencode";
        this.workspaceRoot =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    }
    /**
     * Send a message to opencode CLI and stream the response.
     * Calls onChunk with each chunk of text as it arrives,
     * and onDone when the process exits.
     */
    async send(prompt, contextFiles, onChunk, onDone, onError) {
        // Kill any running process
        this.abort();
        const config = vscode.workspace.getConfiguration("opencode");
        const model = config.get("model") || "";
        // Build args
        // opencode run --print-messages "<prompt>" [--model <model>]
        const args = ["run", "--print-messages"];
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
            this.currentProcess.stdout?.on("data", (data) => {
                onChunk(data.toString());
            });
            this.currentProcess.stderr?.on("data", (data) => {
                stderr += data.toString();
            });
            this.currentProcess.on("error", (err) => {
                if (err.message.includes("ENOENT")) {
                    onError(`opencode CLI not found at "${this.cliPath}". ` +
                        `Install it or set opencode.cliPath in settings.`);
                }
                else {
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
        }
        catch (err) {
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
exports.OpenCodeClient = OpenCodeClient;
//# sourceMappingURL=opencode.js.map