import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";

import type {
	ClientToServerEvents,
	InterServerEvents,
	ServerToClientEvents,
	SocketData,
} from "./sockets/events.js";
import { registerCollabHandlers } from "./sockets/collabHandler.js";
import { registerRunnerHandlers } from "./sockets/runnerHandler.js";
import { registerAiHandlers } from "./sockets/aiHandler.js";

function getProjectId(value: unknown): string {
	if (typeof value === "string") {
		return value.trim();
	}

	if (Array.isArray(value) && typeof value[0] === "string") {
		return value[0].trim();
	}

	return "";
}

const app = express();
const httpServer = http.createServer(app);

const port = Number(process.env.PORT ?? 4000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "*";

app.use(
	cors({
		origin: clientOrigin,
		credentials: true,
	}),
);

app.use(express.json());

app.get("/health", (_req, res) => {
	res.status(200).json({ ok: true, service: "server" });
});

const io = new Server<
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData
>(httpServer, {
	cors: {
		origin: clientOrigin,
		credentials: true,
	},
});

io.use((socket, next) => {
	const projectId =
		getProjectId(socket.handshake.auth?.projectId) ||
		getProjectId(socket.handshake.query?.projectId);

	if (!projectId) {
		next(new Error("Missing required projectId in socket auth/query."));
		return;
	}

	socket.data.projectId = projectId;
	next();
});

io.on("connection", (socket) => {
	const { projectId } = socket.data;

	socket.join(projectId);

	registerCollabHandlers(io, socket, projectId);
	registerRunnerHandlers(io, socket, projectId);
	registerAiHandlers(io, socket, projectId);

	socket.emit("connection:ready", {
		socketId: socket.id,
		projectId,
	});
});

httpServer.listen(port, () => {
	console.log(`Server listening on http://localhost:${port}`);
});
