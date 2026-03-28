import type { Server, Socket } from "socket.io";

import { generateAiProposal, smartMergeAi } from "../services/aiService.js";
import type {
AiGenerateRequestPayload,
AiMergeResultPayload,
AiSmartMergeRequestPayload,
AiStatePayload,
ClientToServerEvents,
InterServerEvents,
ServerToClientEvents,
SocketData,
} from "./events.js";

function now(): string {
return new Date().toISOString();
}

function invalidPayloadError(message: string): Error {
return new Error(`Invalid AI payload: ${message}`);
}

function validateGeneratePayload(payload: AiGenerateRequestPayload): void {
if (!payload.requestId?.trim()) {
throw invalidPayloadError("requestId is required.");
}
if (!payload.language?.trim()) {
throw invalidPayloadError("language is required.");
}
if (!payload.prompt?.trim()) {
throw invalidPayloadError("prompt is required.");
}
}

function validateSmartMergePayload(payload: AiSmartMergeRequestPayload): void {
if (!payload.requestId?.trim()) {
throw invalidPayloadError("requestId is required.");
}
if (!payload.language?.trim()) {
throw invalidPayloadError("language is required.");
}
if (!payload.originalCode?.trim()) {
throw invalidPayloadError("originalCode is required.");
}
if (!payload.mine?.trim()) {
throw invalidPayloadError("mine is required.");
}
if (!payload.theirs?.trim()) {
throw invalidPayloadError("theirs is required.");
}
}

function emitAiState(
io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
projectId: string,
payload: Omit<AiStatePayload, "timestamp">,
): void {
io.to(projectId).emit("ai:state", {
...payload,
timestamp: now(),
});
}

function emitAiErrorState(
io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
projectId: string,
args: { requestId: string; from: string; kind: "generate" | "smart-merge"; error: unknown },
): void {
emitAiState(io, projectId, {
from: args.from,
requestId: args.requestId,
kind: args.kind,
state: "error",
message: args.error instanceof Error ? args.error.message : String(args.error),
});
}

export function registerAiHandlers(
	io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
	socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
	projectId: string,
): void {
	socket.on("ai:proposal-action", (payload) => {
		io.to(projectId).emit("ai:proposal-action", {
			from: socket.id,
			requestId: payload.requestId,
			action: payload.action,
			appliedCode: payload.appliedCode,
			timestamp: now(),
		});
	});

	socket.on("ai:generate", async (payload: AiGenerateRequestPayload) => {
try {
validateGeneratePayload(payload);
emitAiState(io, projectId, {
from: socket.id,
requestId: payload.requestId,
kind: "generate",
state: "queued",
});
emitAiState(io, projectId, {
from: socket.id,
requestId: payload.requestId,
kind: "generate",
state: "generating",
});

const result = await generateAiProposal({
language: payload.language,
prompt: payload.prompt,
context: payload.context,
});

io.to(projectId).emit("ai:proposal", {
from: socket.id,
requestId: payload.requestId,
language: payload.language,
filePath: payload.filePath,
proposal: result.proposal,
summary: result.summary,
timestamp: now(),
});

emitAiState(io, projectId, {
from: socket.id,
requestId: payload.requestId,
kind: "generate",
state: "done",
});
} catch (error) {
emitAiErrorState(io, projectId, {
requestId: payload.requestId,
from: socket.id,
kind: "generate",
error,
});
}
});

socket.on("ai:smart-merge", async (payload: AiSmartMergeRequestPayload) => {
try {
validateSmartMergePayload(payload);
emitAiState(io, projectId, {
from: socket.id,
requestId: payload.requestId,
kind: "smart-merge",
state: "queued",
});
emitAiState(io, projectId, {
from: socket.id,
requestId: payload.requestId,
kind: "smart-merge",
state: "generating",
});

const result = await smartMergeAi({
language: payload.language,
originalCode: payload.originalCode,
mine: payload.mine,
theirs: payload.theirs,
});

const mergePayload: AiMergeResultPayload = {
from: socket.id,
requestId: payload.requestId,
language: payload.language,
filePath: payload.filePath,
status: result.status,
mergedCode: result.mergedCode,
reason: result.reason,
timestamp: now(),
};

io.to(projectId).emit("ai:merge-result", mergePayload);

emitAiState(io, projectId, {
from: socket.id,
requestId: payload.requestId,
kind: "smart-merge",
state: result.status === "conflict" ? "conflict" : "done",
message: result.reason,
});
} catch (error) {
emitAiErrorState(io, projectId, {
requestId: payload.requestId,
from: socket.id,
kind: "smart-merge",
error,
});
}
});
}
