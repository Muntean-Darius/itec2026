import type { Server as HttpServer, IncomingMessage } from "node:http";

import { setupWSConnection } from "@y/websocket-server/utils";
import { WebSocketServer } from "ws";

function normalizePath(value: string): string {
if (!value.startsWith("/")) {
return `/${value}`;
}

return value.endsWith("/") && value.length > 1 ? value.slice(0, -1) : value;
}

function extractDocName(req: IncomingMessage, basePath: string): string {
const host = req.headers.host ?? "localhost";
const url = new URL(req.url ?? "/", `http://${host}`);
const pathRemainder = url.pathname.slice(basePath.length).replace(/^\/+/, "");

if (pathRemainder) {
return decodeURIComponent(pathRemainder);
}

const fromQuery = url.searchParams.get("room") ?? url.searchParams.get("projectId");
return fromQuery?.trim() || "default";
}

export function attachYWebsocketServer(httpServer: HttpServer): string {
const ywsPath = normalizePath(process.env.Y_WEBSOCKET_PATH?.trim() || "/yjs");
const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (request, socket, head) => {
const host = request.headers.host ?? "localhost";
const url = new URL(request.url ?? "/", `http://${host}`);

if (!url.pathname.startsWith(ywsPath)) {
return;
}

const docName = extractDocName(request, ywsPath);

wss.handleUpgrade(request, socket, head, (conn) => {
setupWSConnection(conn, request, { docName, gc: true });
});
});

return ywsPath;
}
