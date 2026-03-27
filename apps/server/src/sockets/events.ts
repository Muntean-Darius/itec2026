export type CollabOperationPayload = {
	filePath: string;
	operation: unknown;
};

export type CursorPayload = {
	filePath: string;
	line: number;
	column: number;
};

export type RunnerStartPayload = {
	language: string;
	files: Array<{ path: string; content: string }>;
};

export type RunnerStdinPayload = {
	data: string;
};

export type RunCodeRequestPayload = {
	language: string;
	files: Array<{ path: string; content: string }>;
	timeout?: number;
};

export type TerminalOutputPayload = {
	runId?: string;
	stream: "stdout" | "stderr";
	data: string;
	timestamp: string;
};

export type TerminalBroadcastPayload = {
	command: string;
	timestamp: string;
};

export type RunnerStatusState =
	| "starting"
	| "running"
	| "stopped"
	| "completed"
	| "failed";

export type RunnerStatusPayload = {
	from: string;
	state: RunnerStatusState;
	runId?: string;
	language?: string;
	message?: string;
	timestamp: string;
};

export type AiState =
	| "queued"
	| "generating"
	| "done"
	| "conflict"
	| "error";

export type AiGenerateRequestPayload = {
	requestId: string;
	language: string;
	prompt: string;
	context?: string;
	filePath?: string;
};

export type AiSmartMergeRequestPayload = {
	requestId: string;
	language: string;
	filePath?: string;
	originalCode: string;
	mine: string;
	theirs: string;
};

export type AiStatePayload = {
	from: string;
	requestId: string;
	state: AiState;
	kind: "generate" | "smart-merge";
	message?: string;
	timestamp: string;
};

export type AiProposalPayload = {
	from: string;
	requestId: string;
	language: string;
	filePath?: string;
	proposal: string;
	summary?: string;
	timestamp: string;
};

export type AiMergeResultPayload = {
	from: string;
	requestId: string;
	language: string;
	filePath?: string;
	status: "merged" | "conflict";
	mergedCode?: string;
	reason?: string;
	timestamp: string;
};

export interface ClientToServerEvents {
	"collab:op": (payload: CollabOperationPayload) => void;
	"collab:cursor": (payload: CursorPayload) => void;
	"collab:ping": () => void;

	"runner:start": (payload: RunnerStartPayload) => void;
	"runner:stdin": (payload: RunnerStdinPayload) => void;
	"runner:stop": () => void;
	"run-code-request": (payload: RunCodeRequestPayload) => void;
	"terminal-input": (payload: TerminalBroadcastPayload) => void;
	"ai:generate": (payload: AiGenerateRequestPayload) => void;
	"ai:smart-merge": (payload: AiSmartMergeRequestPayload) => void;
}

export interface ServerToClientEvents {
	"connection:error": (payload: { message: string }) => void;
	"connection:ready": (payload: { socketId: string; projectId: string }) => void;

	"collab:op": (payload: { from: string } & CollabOperationPayload) => void;
	"collab:cursor": (payload: { from: string } & CursorPayload) => void;
	"collab:pong": (payload: { from: string; at: string }) => void;

	"runner:stdin": (payload: { from: string; data: string }) => void;
	"runner:status": (payload: RunnerStatusPayload) => void;

	"terminal-output": (payload: { from: string } & TerminalOutputPayload) => void;
	"terminal-broadcast": (payload: { from: string } & TerminalBroadcastPayload) => void;
	"ai:state": (payload: AiStatePayload) => void;
	"ai:proposal": (payload: AiProposalPayload) => void;
	"ai:merge-result": (payload: AiMergeResultPayload) => void;
}

export interface InterServerEvents {}

export interface SocketData {
	projectId: string;
}
