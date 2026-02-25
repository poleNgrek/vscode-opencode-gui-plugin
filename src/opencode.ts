import * as cp from "child_process";
import * as net from "net";
import * as vscode from "vscode";
import { createOpencodeClient } from "@opencode-ai/sdk";

// ─── Local types (mirrors @opencode-ai/sdk shapes we actually use) ────────────

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

// Minimal shape of the SDK client we rely on
interface SDKClient {
    session: {
        create(opts: { body?: Record<string, unknown> }): Promise<{ data?: { id?: string } }>;
        prompt(opts: {
            path: { id: string };
            body: {
                parts: Array<{ type: string; text: string }>;
                model?: { providerID: string; modelID: string };
            };
        }): Promise<unknown>;
        abort(opts: { path: { id: string } }): Promise<unknown>;
    };
    event: {
        subscribe(opts?: { signal?: AbortSignal }): Promise<{
            stream: AsyncGenerator<{
                // Real SDK event union — we only care about message.part.updated
                type?: string;
                properties?: {
                    part?: { type?: string; text?: string; sessionID?: string };
                    delta?: string;
                };
            }>;
        }>;
    };
}

// ─── OpenCodeClient ───────────────────────────────────────────────────────────

export class OpenCodeClient implements vscode.Disposable {
    private serverProcess: cp.ChildProcess | null = null;
    private sdkClient: SDKClient | null = null;
    private promptAbort: AbortController | null = null;

    // ── Server discovery ──────────────────────────────────────────────────────

    async getClient(): Promise<SDKClient> {
        if (this.sdkClient) return this.sdkClient;

        const config = vscode.workspace.getConfiguration("opencode");
        const explicitUrl = config.get<string>("serverUrl") || "";
        const primaryPort = config.get<number>("port") || 4096;
        const extraPorts = config.get<number[]>("probePorts") || [];
        const cliPath = config.get<string>("cliPath") || "opencode";

        const candidates: string[] = [];
        if (explicitUrl) {
            candidates.push(explicitUrl.replace(/\/$/, ""));
        } else {
            candidates.push(`http://127.0.0.1:${primaryPort}`);
            for (const p of extraPorts) {
                candidates.push(`http://127.0.0.1:${p}`);
            }
        }

        for (const url of candidates) {
            if (await this.isReachable(url)) {
                this.sdkClient = this.makeClient(url);
                return this.sdkClient;
            }
        }

        // Nothing reachable — spawn our own server
        await this.spawnServer(cliPath, primaryPort);
        this.sdkClient = this.makeClient(`http://127.0.0.1:${primaryPort}`);
        return this.sdkClient;
    }

    private makeClient(baseUrl: string): SDKClient {
        return createOpencodeClient({ baseUrl }) as unknown as SDKClient;
    }

    private isReachable(url: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const u = new URL(url);
                const port = parseInt(u.port || "80", 10);
                const sock = net.createConnection({ host: u.hostname, port }, () => {
                    sock.destroy();
                    resolve(true);
                });
                sock.setTimeout(1200);
                sock.on("timeout", () => { sock.destroy(); resolve(false); });
                sock.on("error", () => resolve(false));
            } catch {
                resolve(false);
            }
        });
    }

    private spawnServer(cliPath: string, port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const workspaceRoot =
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

            this.serverProcess = cp.spawn(
                cliPath,
                ["serve", "--port", String(port)],
                { cwd: workspaceRoot, shell: false, detached: false }
            );

            this.serverProcess.on("error", (err) => {
                reject(new Error(
                    `Failed to start opencode server: ${err.message}. ` +
                    `Make sure opencode is installed or configure opencode.cliPath.`
                ));
            });

            let attempts = 0;
            const poll = setInterval(async () => {
                attempts++;
                if (await this.isReachable(`http://127.0.0.1:${port}`)) {
                    clearInterval(poll);
                    resolve();
                } else if (attempts > 40) {
                    clearInterval(poll);
                    reject(new Error(`opencode server did not start after 20s on port ${port}.`));
                }
            }, 500);
        });
    }

    // ── Session ───────────────────────────────────────────────────────────────

    async createSession(): Promise<string> {
        const client = await this.getClient();
        const result = await client.session.create({ body: {} });
        const id = result?.data?.id;
        if (!id) throw new Error("opencode server did not return a session ID.");
        return id;
    }

    // ── Send + stream ─────────────────────────────────────────────────────────

    async send(
        sessionId: string,
        prompt: string,
        contextFiles: string[],
        onChunk: (chunk: string) => void,
        onDone: () => void,
        onError: (err: string) => void
    ): Promise<void> {
        this.abort();
        const abort = new AbortController();
        this.promptAbort = abort;

        let client: SDKClient;
        try {
            client = await this.getClient();
        } catch (err) {
            onError(String(err));
            onDone();
            return;
        }

        // Build parts — inject file contents as text context parts
        const parts: Array<{ type: string; text: string }> = [];

        if (contextFiles.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const fs = require("fs") as typeof import("fs");
            for (const filePath of contextFiles) {
                try {
                    const content = fs.readFileSync(filePath, "utf8");
                    const relPath = vscode.workspace.asRelativePath(filePath);
                    parts.push({ type: "text", text: `<file path="${relPath}">\n${content}\n</file>` });
                } catch {
                    // skip unreadable files
                }
            }
        }

        parts.push({ type: "text", text: prompt });

        // Resolve model from settings (format: "providerID/modelID")
        const config = vscode.workspace.getConfiguration("opencode");
        const modelSetting = config.get<string>("model") || "";
        let modelOpt: { providerID: string; modelID: string } | undefined;
        if (modelSetting) {
            const slash = modelSetting.indexOf("/");
            if (slash > 0) {
                modelOpt = {
                    providerID: modelSetting.slice(0, slash),
                    modelID: modelSetting.slice(slash + 1),
                };
            }
        }

        // Subscribe to the event stream BEFORE sending the prompt
        let eventStream: AsyncGenerator<{
            type?: string;
            properties?: {
                part?: { type?: string; text?: string; sessionID?: string };
                delta?: string;
            };
        }> | null = null;

        try {
            const sub = await client.event.subscribe({ signal: abort.signal });
            eventStream = sub.stream;
        } catch {
            // streaming unavailable — will still get the final answer from prompt()
        }

        // Consume SSE events in the background
        if (eventStream) {
            (async () => {
                try {
                    for await (const event of eventStream!) {
                        if (abort.signal.aborted) break;
                        // The SDK emits events shaped as:
                        //   { type: "message.part.updated", properties: { part: { sessionID, type, text }, delta } }
                        // `delta` is the incremental text chunk for streaming text parts.
                        if (
                            event?.type === "message.part.updated" &&
                            event?.properties?.part?.sessionID === sessionId &&
                            event?.properties?.part?.type === "text"
                        ) {
                            // Prefer delta (incremental chunk) over full text to avoid duplication
                            const chunk = event.properties.delta ?? event.properties.part.text ?? "";
                            if (chunk) onChunk(chunk);
                        }
                    }
                } catch {
                    // stream closed — expected when abort fires
                }
            })();
        }

        // Send the prompt (blocks until the model finishes)
        try {
            await client.session.prompt({
                path: { id: sessionId },
                body: { parts, ...(modelOpt ? { model: modelOpt } : {}) },
            });
        } catch (err) {
            if (!abort.signal.aborted) {
                onError(String(err));
            }
        }

        abort.abort();
        this.promptAbort = null;
        onDone();
    }

    // ── Abort ─────────────────────────────────────────────────────────────────

    abort() {
        if (this.promptAbort) {
            this.promptAbort.abort();
            this.promptAbort = null;
        }
    }

    async abortSession(sessionId: string): Promise<void> {
        this.abort();
        try {
            const client = await this.getClient();
            await client.session.abort({ path: { id: sessionId } });
        } catch {
            // best effort
        }
    }

    // ── Dispose ───────────────────────────────────────────────────────────────

    dispose() {
        this.abort();
        if (this.serverProcess) {
            this.serverProcess.kill();
            this.serverProcess = null;
        }
        this.sdkClient = null;
    }
}