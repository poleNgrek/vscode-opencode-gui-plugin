import * as cp from "child_process";
import * as net from "net";
import * as vscode from "vscode";
import { createOpencodeClient } from "@opencode-ai/sdk";

// ─── Public types ─────────────────────────────────────────────────────────────

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

export interface RemoteSession {
    id: string;
    title: string;
    updatedAt: number; // epoch ms
}

export interface RemoteMessage {
    role: "user" | "assistant";
    text: string;
    timestamp: number;
}

// ─── SDK client interface ─────────────────────────────────────────────────────
// Describes exactly the SDK surface we use, matching the real SDK shapes.

interface SDKClient {
    session: {
        create(opts: { body?: Record<string, unknown> }): Promise<{ data?: { id?: string; title?: string; time?: { updated?: number } } }>;
        list(): Promise<{ data?: Array<{ id: string; title?: string; time?: { updated?: number } }> }>;
        messages(opts: { path: { id: string } }): Promise<{
            data?: Array<{
                info: { role: string; time?: { created?: number } };
                parts: Array<{ type: string; text?: string }>;
            }>;
        }>;
        update(opts: { path: { id: string }; body: { title: string } }): Promise<unknown>;
        delete(opts: { path: { id: string } }): Promise<unknown>;
        prompt(opts: {
            path: { id: string };
            body: {
                parts: Array<{ type: string; text: string }>;
                model?: { providerID: string; modelID: string };
            };
        }): Promise<unknown>;
        abort(opts: { path: { id: string } }): Promise<unknown>;
    };
    config: {
        // Returns the server's merged config including the active model string
        get(): Promise<{ data?: { model?: string } }>;
        // Returns all known providers and the default modelID per providerID
        providers(): Promise<{ data?: { providers?: unknown[]; default?: Record<string, string> } }>;
    };
    event: {
        subscribe(opts?: { signal?: AbortSignal }): Promise<{
            stream: AsyncGenerator<{
                type?: string;
                properties?: {
                    // session.updated / session.created carry the session in properties
                    id?: string;
                    title?: string;
                    time?: { updated?: number };
                    // message.part.updated carries the part + delta
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

    // Cached server-default model, resolved once from config.providers()
    private cachedDefaultModel: { providerID: string; modelID: string } | null = null;

    // Background SSE watcher for live session list updates
    private bgAbort: AbortController | null = null;
    public onSessionsChanged?: () => void;

    // ── Server discovery ──────────────────────────────────────────────────────

    async getClient(): Promise<SDKClient> {
        if (this.sdkClient) return this.sdkClient;

        const config = vscode.workspace.getConfiguration("opencode");
        const explicitUrl = (config.get<string>("serverUrl") || "").replace(/\/$/, "");
        const primaryPort = config.get<number>("port") || 4096;
        const extraPorts = config.get<number[]>("probePorts") || [];
        const cliPath = config.get<string>("cliPath") || "opencode";

        const candidates: string[] = [];
        if (explicitUrl) {
            candidates.push(explicitUrl);
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

    // ── Session list ──────────────────────────────────────────────────────────

    async listSessions(): Promise<RemoteSession[]> {
        const client = await this.getClient();
        const result = await client.session.list();
        const raw = result?.data;
        if (!Array.isArray(raw)) return [];
        return raw
            .map((s) => ({
                id: s.id,
                title: s.title || "Untitled",
                updatedAt: s.time?.updated ?? Date.now(),
            }))
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async loadMessages(sessionId: string): Promise<RemoteMessage[]> {
        const client = await this.getClient();
        const result = await client.session.messages({ path: { id: sessionId } });
        const raw = result?.data;
        if (!Array.isArray(raw)) return [];
        return raw
            .map((m) => {
                const text = m.parts
                    .filter((p) => p.type === "text" && typeof p.text === "string")
                    .map((p) => p.text ?? "")
                    .join("");
                return {
                    role: (m.info.role === "user" ? "user" : "assistant") as "user" | "assistant",
                    text,
                    timestamp: m.info.time?.created ?? Date.now(),
                };
            })
            .filter((m) => m.text.length > 0);
    }

    async createSession(): Promise<RemoteSession> {
        const client = await this.getClient();
        const result = await client.session.create({ body: {} });
        const s = result?.data;
        if (!s?.id) throw new Error("opencode server did not return a session ID.");
        return {
            id: s.id,
            title: s.title || "New Session",
            updatedAt: s.time?.updated ?? Date.now(),
        };
    }

    async deleteSession(sessionId: string): Promise<void> {
        const client = await this.getClient();
        await client.session.delete({ path: { id: sessionId } });
    }

    async renameSession(sessionId: string, title: string): Promise<void> {
        const client = await this.getClient();
        await client.session.update({ path: { id: sessionId }, body: { title } });
    }

    // ── Background SSE watcher (live session list) ────────────────────────────

    async startBackgroundWatch(): Promise<void> {
        if (this.bgAbort) return; // already watching
        const abort = new AbortController();
        this.bgAbort = abort;

        try {
            const client = await this.getClient();
            const sub = await client.event.subscribe({ signal: abort.signal });
            void (async () => {
                try {
                    for await (const event of sub.stream) {
                        if (abort.signal.aborted) break;
                        const t = event?.type ?? "";
                        if (
                            t === "session.updated" ||
                            t === "session.created" ||
                            t === "session.deleted"
                        ) {
                            this.onSessionsChanged?.();
                        }
                    }
                } catch {
                    // stream ended or aborted — expected
                }
            })();
        } catch {
            // background watch is best-effort; server may not be up yet
        }
    }

    stopBackgroundWatch(): void {
        if (this.bgAbort) {
            this.bgAbort.abort();
            this.bgAbort = null;
        }
    }

    // ── Model resolution ──────────────────────────────────────────────────────

    /**
     * Returns the { providerID, modelID } to use for a prompt, or undefined to
     * let the server decide.
     *
     * Resolution order:
     *  1. opencode.model VS Code setting — supports two formats:
     *       "providerID/modelID"          e.g. "anthropic/claude-sonnet-4-5"
     *       flat model string             e.g. "eu.anthropic.claude-sonnet-4-6"
     *     For the flat format we resolve against config.providers() to get the
     *     correct split without guessing on dot positions.
     *  2. Server default from config.providers() — whatever opencode.json says.
     *  3. undefined — server uses its own built-in default.
     */
    private async resolveModel(
        client: SDKClient
    ): Promise<{ providerID: string; modelID: string } | undefined> {
        const vscodeSetting = (
            vscode.workspace.getConfiguration("opencode").get<string>("model") ?? ""
        ).trim();

        // ── VS Code setting takes priority ──────────────────────────────────────
        if (vscodeSetting) {
            // Slash format: "providerID/modelID"
            const slash = vscodeSetting.indexOf("/");
            if (slash > 0) {
                return {
                    providerID: vscodeSetting.slice(0, slash),
                    modelID: vscodeSetting.slice(slash + 1),
                };
            }

            // Flat format: look it up in the providers map to get the correct split.
            const split = await this.splitModelId(client, vscodeSetting);
            if (split) return split;
        }

        // ── Server default ──────────────────────────────────────────────────────
        if (this.cachedDefaultModel) return this.cachedDefaultModel;

        try {
            const result = await client.config.providers();
            const defaults = result?.data?.default ?? {};
            // defaults is { [providerID]: modelID }, e.g. { "eu.anthropic": "claude-sonnet-4-6" }
            const providerIDs = Object.keys(defaults);
            if (providerIDs.length > 0) {
                const providerID = providerIDs[0];
                const modelID = defaults[providerID];
                this.cachedDefaultModel = { providerID, modelID };
                return this.cachedDefaultModel;
            }
        } catch {
            // config.providers() unavailable — fall through to omitting model
        }

        // ── Nothing resolved — let the server decide ────────────────────────────
        return undefined;
    }

    /**
     * Given a flat model string like "eu.anthropic.claude-sonnet-4-6", look it
     * up in the server's providers list to find the matching { providerID, modelID }.
     * Falls back to last-dot split if the API call fails.
     */
    private async splitModelId(
        client: SDKClient,
        flatId: string
    ): Promise<{ providerID: string; modelID: string } | undefined> {
        try {
            const result = await client.config.providers();
            const providers = (result?.data?.providers ?? []) as Array<{
                id: string;
                models?: Array<{ id: string }>;
            }>;
            for (const provider of providers) {
                for (const model of provider.models ?? []) {
                    // The full model key in opencode.json is "providerID.modelID"
                    if (`${provider.id}.${model.id}` === flatId || model.id === flatId) {
                        return { providerID: provider.id, modelID: model.id };
                    }
                }
            }
        } catch {
            // providers API unavailable
        }

        // Last-resort: split on last dot (works for "eu.anthropic.claude-sonnet-4-6")
        const dot = flatId.lastIndexOf(".");
        if (dot > 0) {
            return {
                providerID: flatId.slice(0, dot),
                modelID: flatId.slice(dot + 1),
            };
        }

        return undefined;
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

        // Resolve which model to use for this prompt.
        // Priority:
        //   1. opencode.model VS Code setting (user explicit override)
        //   2. Server default from config.providers() (respects opencode.json)
        //   3. Omit model entirely (server picks its own default)
        const modelOpt = await this.resolveModel(client);

        // Subscribe to SSE BEFORE sending the prompt so we don't miss early chunks
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
            void (async () => {
                // The server emits message.part.updated for BOTH the user message and
                // the assistant reply. We must skip user parts to avoid echoing the prompt.
                // Strategy: capture the user messageID from the first message.updated
                // event with role "user", then skip any parts whose messageID matches it.
                let userMessageId: string | null = null;

                // For the fallback (no delta field): track chars emitted per part.
                const emittedLength = new Map<string, number>();

                try {
                    for await (const event of eventStream!) {
                        if (abort.signal.aborted) break;

                        const t = event?.type ?? "";
                        const props = event?.properties as Record<string, unknown> | undefined;

                        // Track the user message ID so we can exclude its parts below.
                        if (t === "message.updated") {
                            const info = props?.info as Record<string, unknown> | undefined;
                            if (info?.role === "user" && info?.sessionID === sessionId) {
                                userMessageId = info.id as string;
                            }
                        }

                        // Forward server-side model/generation errors to the UI.
                        if (t === "session.error" && props?.sessionID === sessionId) {
                            const err = props?.error as Record<string, unknown> | undefined;
                            const msg = (err?.data as Record<string, unknown>)?.message
                                ?? err?.name
                                ?? "Unknown server error";
                            onError(String(msg));
                        }

                        if (t === "message.part.updated") {
                            const part = props?.part as Record<string, unknown> | undefined;
                            if (
                                part?.sessionID === sessionId &&
                                part?.type === "text" &&
                                // Skip the user message's own parts — those are the echo.
                                part?.messageID !== userMessageId
                            ) {
                                const delta = props?.delta as string | undefined;
                                const partId = (part?.id as string) ?? "";

                                if (typeof delta === "string" && delta.length > 0) {
                                    // Server provided an explicit incremental delta — use it directly.
                                    onChunk(delta);
                                    if (partId) {
                                        emittedLength.set(partId, (emittedLength.get(partId) ?? 0) + delta.length);
                                    }
                                } else if (typeof part?.text === "string" && part.text.length > 0) {
                                    // No delta — compute the new slice from full accumulated text.
                                    const fullText = part.text as string;
                                    const already = emittedLength.get(partId) ?? 0;
                                    const newSlice = fullText.slice(already);
                                    if (newSlice.length > 0) {
                                        emittedLength.set(partId, fullText.length);
                                        onChunk(newSlice);
                                    }
                                }
                            }
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

    abort(): void {
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

    dispose(): void {
        this.abort();
        this.stopBackgroundWatch();
        if (this.serverProcess) {
            this.serverProcess.kill();
            this.serverProcess = null;
        }
        this.sdkClient = null;
        this.cachedDefaultModel = null;
    }
}