import * as cp from "child_process";
import * as net from "net";
import * as vscode from "vscode";

// ─── Re-export types used by panel.ts ────────────────────────────────────────

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

// ─── Lazy SDK import (SDK uses fetch; available in Node 18+) ─────────────────

// We import the SDK types lazily so VS Code's extension host can load the
// module without crashing if the package is not yet installed.
type SDKClient = Awaited<ReturnType<typeof import("@opencode-ai/sdk")["createOpencodeClient"]>>;

// ─── OpenCodeClient ──────────────────────────────────────────────────────────

export class OpenCodeClient implements vscode.Disposable {
    private serverProcess: cp.ChildProcess | null = null;
    private sdkClient: SDKClient | null = null;
    private baseUrl = "";

    // Abort controller for the in-flight prompt + event stream
    private promptAbort: AbortController | null = null;

    constructor() {}

    // ── Server discovery / spawn ─────────────────────────────────────────────

    /**
     * Returns a connected SDK client, discovering or spawning the server first.
     * Strategy:
     *   1. Explicit opencode.serverUrl setting → use it directly.
     *   2. Probe opencode.port (default 4096) and opencode.probePorts.
     *   3. Spawn `opencode serve` ourselves and wait for it to be ready.
     */
    async getClient(): Promise<SDKClient> {
        if (this.sdkClient) return this.sdkClient;

        const config = vscode.workspace.getConfiguration("opencode");
        const explicitUrl = config.get<string>("serverUrl") || "";
        const primaryPort = config.get<number>("port") || 4096;
        const extraPorts = config.get<number[]>("probePorts") || [];
        const cliPath = config.get<string>("cliPath") || "opencode";

        // Build probe list
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
                this.baseUrl = url;
                this.sdkClient = await this.makeClient(url);
                return this.sdkClient;
            }
        }

        // Nothing reachable — spawn our own server
        const spawnPort = primaryPort;
        await this.spawnServer(cliPath, spawnPort);
        this.baseUrl = `http://127.0.0.1:${spawnPort}`;
        this.sdkClient = await this.makeClient(this.baseUrl);
        return this.sdkClient;
    }

    private async makeClient(baseUrl: string): Promise<SDKClient> {
        // Dynamic import so the extension doesn't crash if SDK isn't installed yet
        let createOpencodeClient: typeof import("@opencode-ai/sdk")["createOpencodeClient"];
        try {
            ({ createOpencodeClient } = await import("@opencode-ai/sdk"));
        } catch {
            throw new Error(
                'The @opencode-ai/sdk package is not installed.\n' +
                'Run: npm install @opencode-ai/sdk  in your extension directory.'
            );
        }
        return createOpencodeClient({ baseUrl });
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
                reject(
                    new Error(
                        `Failed to start opencode server: ${err.message}. ` +
                        `Make sure opencode is installed or configure opencode.cliPath.`
                    )
                );
            });

            // Poll TCP until the port accepts connections
            const target = `http://127.0.0.1:${port}`;
            let attempts = 0;
            const poll = setInterval(async () => {
                attempts++;
                if (await this.isReachable(target)) {
                    clearInterval(poll);
                    resolve();
                } else if (attempts > 40) {
                    clearInterval(poll);
                    reject(new Error(`opencode server did not start after 20s on port ${port}.`));
                }
            }, 500);
        });
    }

    // ── Session creation ─────────────────────────────────────────────────────

    async createSession(): Promise<string> {
        const client = await this.getClient();
        const result = await client.session.create({ body: {} });
        const session = (result as { data?: { id?: string } }).data ?? result;
        const id = (session as { id?: string }).id;
        if (!id) throw new Error("opencode server did not return a session ID.");
        return id;
    }

    // ── Prompt + streaming ───────────────────────────────────────────────────

    /**
     * Send a prompt in a session and stream text back via onChunk.
     *
     * Flow:
     *   1. Subscribe to the global event stream (SSE).
     *   2. Fire session.prompt() — this blocks on the server until the reply
     *      is complete, but SSE delivers chunks in real time.
     *   3. Filter events to this session and extract text parts.
     *   4. When prompt() resolves, call onDone.
     */
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

        // Build parts: text prompt + any file context injected as text parts
        const parts: Array<{ type: string; text: string }> = [];

        // Inject file contents as context parts
        if (contextFiles.length > 0) {
            const fs = await import("fs");
            for (const filePath of contextFiles) {
                try {
                    const content = fs.readFileSync(filePath, "utf8");
                    const relPath = vscode.workspace.asRelativePath(filePath);
                    parts.push({
                        type: "text",
                        text: `<file path="${relPath}">\n${content}\n</file>`,
                    });
                } catch {
                    // Skip unreadable files silently
                }
            }
        }

        parts.push({ type: "text", text: prompt });

        // Subscribe to events BEFORE sending the prompt so we don't miss chunks
        let eventStream: AsyncIterable<{ type?: string; sessionID?: string; part?: { type?: string; text?: string } }> | null = null;
        try {
            const eventsResult = await (client as {
                event: {
                    subscribe: (opts?: { signal?: AbortSignal }) => Promise<{ stream: AsyncIterable<unknown> }>;
                };
            }).event.subscribe({ signal: abort.signal });
            eventStream = eventsResult.stream as AsyncIterable<{ type?: string; sessionID?: string; part?: { type?: string; text?: string } }>;
        } catch (err) {
            // If event stream fails, fall back to non-streaming (prompt only)
            console.warn("opencode: event stream unavailable, falling back to blocking prompt", err);
        }

        // Start consuming the event stream in parallel
        let streamDone = false;
        const consumeStream = async () => {
            if (!eventStream) return;
            try {
                for await (const event of eventStream) {
                    if (abort.signal.aborted) break;
                    if (
                        event?.sessionID === sessionId &&
                        event?.type === "text" &&
                        event?.part?.type === "text" &&
                        typeof event?.part?.text === "string"
                    ) {
                        onChunk(event.part.text);
                    }
                }
            } catch (err) {
                if (!abort.signal.aborted) {
                    console.warn("opencode: event stream error", err);
                }
            }
            streamDone = true;
        };

        if (eventStream) {
            consumeStream(); // fire-and-forget, prompt call will gate completion
        }

        // Send the prompt (blocking — resolves when the full reply is ready)
        try {
            await (client as {
                session: {
                    prompt: (opts: {
                        path: { id: string };
                        body: { parts: unknown[] };
                        signal?: AbortSignal;
                    }) => Promise<unknown>;
                };
            }).session.prompt({
                path: { id: sessionId },
                body: { parts },
                signal: abort.signal,
            });
        } catch (err) {
            if (!abort.signal.aborted) {
                onError(String(err));
            }
        }

        // Abort the event stream now that the prompt is done
        abort.abort();
        this.promptAbort = null;
        onDone();
    }

    // ── Abort ────────────────────────────────────────────────────────────────

    abort() {
        if (this.promptAbort) {
            this.promptAbort.abort();
            this.promptAbort = null;
        }
    }

    // ── Also abort the session on the server side ────────────────────────────

    async abortSession(sessionId: string): Promise<void> {
        this.abort();
        try {
            const client = await this.getClient();
            await (client as {
                session: { abort: (opts: { path: { id: string } }) => Promise<unknown> };
            }).session.abort({ path: { id: sessionId } });
        } catch {
            // Best effort
        }
    }

    // ── Dispose ──────────────────────────────────────────────────────────────

    dispose() {
        this.abort();
        if (this.serverProcess) {
            this.serverProcess.kill();
            this.serverProcess = null;
        }
        this.sdkClient = null;
    }
}