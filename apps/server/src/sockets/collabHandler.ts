import type { Server, Socket } from "socket.io";

import type {
	ClientToServerEvents,
	CollabOperationPayload,
	CursorPayload,
	InterServerEvents,
	ServerToClientEvents,
	SocketData,
} from "./events.js";

export function registerCollabHandlers(
	io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
	socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
	projectId: string,
) {
	socket.on("collab:op", (payload: CollabOperationPayload) => {
		socket.to(projectId).emit("collab:op", {
			from: socket.id,
			...payload,
		});
	});

	socket.on("collab:cursor", (payload: CursorPayload) => {
		socket.to(projectId).emit("collab:cursor", {
			from: socket.id,
			...payload,
		});
	});

	socket.on("collab:ping", () => {
		io.to(projectId).emit("collab:pong", {
			from: socket.id,
			at: new Date().toISOString(),
		});
	});
}
