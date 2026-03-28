import type { Server, Socket } from "socket.io";

import type {
	ClientToServerEvents,
	InterServerEvents,
	RunnerStartPayload,
	RunnerStdinPayload,
	RunnerStatusState,
	RunCodeRequestPayload,
	TerminalBroadcastPayload,
	ServerToClientEvents,
	SocketData,
} from "./events.js";

type RunnerHandlers = {
	onRunnerStart?: (args: {
		projectId: string;
		socketId: string;
		payload: RunnerStartPayload;
	}) => void;
	onRunCodeRequest?: (args: {
		projectId: string;
		socketId: string;
		payload: RunCodeRequestPayload;
	}) => void;
	onRunnerStop?: (args: { projectId: string; socketId: string }) => void;
	onRunnerStdin?: (args: {
		projectId: string;
		socketId: string;
		payload: RunnerStdinPayload;
	}) => void;
	onTerminalInput?: (args: {
		projectId: string;
		socketId: string;
		payload: TerminalBroadcastPayload;
	}) => void;
};

export function registerRunnerHandlers(
	io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
	socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
	projectId: string,
	handlers?: RunnerHandlers,
) {
	socket.on("runner:start", (payload: RunnerStartPayload) => {
		emitRunnerStatus(io, projectId, {
			from: socket.id,
			state: "starting",
			language: payload.language,
		});
		handlers?.onRunnerStart?.({ projectId, socketId: socket.id, payload });
	});

	socket.on("runner:stdin", (payload: RunnerStdinPayload) => {
		socket.to(projectId).emit("runner:stdin", {
			from: socket.id,
			data: payload.data,
		});
		handlers?.onRunnerStdin?.({ projectId, socketId: socket.id, payload });
	});

	socket.on("runner:stop", () => {
		emitRunnerStatus(io, projectId, { from: socket.id, state: "stopped" });
		handlers?.onRunnerStop?.({ projectId, socketId: socket.id });
	});

	socket.on("run-code-request", (payload: RunCodeRequestPayload) => {
		emitRunnerStatus(io, projectId, {
			from: socket.id,
			state: "starting",
			language: payload.language,
		});
		handlers?.onRunCodeRequest?.({ projectId, socketId: socket.id, payload });
	});

	socket.on("terminal-input", (payload: TerminalBroadcastPayload) => {
		io.to(projectId).emit("terminal-broadcast", {
			from: socket.id,
			command: payload.command,
			timestamp: payload.timestamp,
		});
		io.to(projectId).emit("runner:stdin", {
			from: socket.id,
			data: payload.command,
		});
		emitTerminalOutput(io, projectId, "stdout", `$ ${payload.command}`, {
			from: socket.id,
			timestamp: payload.timestamp,
		});
		handlers?.onTerminalInput?.({ projectId, socketId: socket.id, payload });
	});
}

export function emitTerminalOutput(
	io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
	projectId: string,
	stream: "stdout" | "stderr",
	data: string,
	options?: { runId?: string; from?: string; timestamp?: string },
) {
	io.to(projectId).emit("terminal-output", {
		from: options?.from ?? "execution-engine",
		runId: options?.runId,
		stream,
		data,
		timestamp: options?.timestamp ?? new Date().toISOString(),
	});
}

export function emitRunnerStatus(
	io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
	projectId: string,
	payload: {
		from: string;
		state: RunnerStatusState;
		language?: string;
		runId?: string;
		message?: string;
		timestamp?: string;
	},
) {
	io.to(projectId).emit("runner:status", {
		...payload,
		timestamp: payload.timestamp ?? new Date().toISOString(),
	});
}
