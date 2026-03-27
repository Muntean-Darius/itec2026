export type AiGenerateInput = {
language: string;
prompt: string;
context?: string;
};

export type AiGenerateResult = {
proposal: string;
summary?: string;
};

export type AiSmartMergeInput = {
language: string;
originalCode: string;
mine: string;
theirs: string;
};

export type AiSmartMergeResult = {
status: "merged" | "conflict";
mergedCode?: string;
reason?: string;
};

type GeminiConfig = {
apiKey: string;
model: string;
baseUrl: string;
temperature: number;
};

function getGeminiConfig(): GeminiConfig {
const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
throw new Error("Missing required environment variable: GEMINI_API_KEY");
}

const temperature = Number(process.env.GEMINI_TEMPERATURE ?? "0.2");
if (Number.isNaN(temperature) || temperature < 0 || temperature > 2) {
throw new Error("GEMINI_TEMPERATURE must be a valid number between 0 and 2.");
}

return {
apiKey,
model: process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash",
baseUrl: process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com",
temperature,
};
}

async function parseError(response: Response): Promise<string> {
const text = await response.text();
return text ? `${response.status} ${response.statusText}: ${text}` : `${response.status} ${response.statusText}`;
}

function extractGeminiText(json: unknown): string {
if (typeof json !== "object" || !json) {
return "";
}

const candidates = (json as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
if (!Array.isArray(candidates) || candidates.length === 0) {
return "";
}

const parts = candidates[0]?.content?.parts;
if (!Array.isArray(parts)) {
return "";
}

return parts
.map((part) => (typeof part?.text === "string" ? part.text : ""))
.join("")
.trim();
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
const config = getGeminiConfig();
const endpoint = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

const response = await fetch(endpoint, {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
systemInstruction: {
parts: [{ text: systemPrompt }],
},
contents: [{ role: "user", parts: [{ text: userPrompt }] }],
generationConfig: {
temperature: config.temperature,
},
}),
});

if (!response.ok) {
throw new Error(`Gemini request failed: ${await parseError(response)}`);
}

const json = (await response.json()) as unknown;
const content = extractGeminiText(json);
if (!content) {
throw new Error("Gemini response did not include text content.");
}

return content;
}

function stripCodeFences(value: string): string {
const trimmed = value.trim();
if (!trimmed.startsWith("```")) {
return trimmed;
}

const lines = trimmed.split("\n");
const start = lines[0].startsWith("```") ? 1 : 0;
const end = lines[lines.length - 1].startsWith("```") ? lines.length - 1 : lines.length;
return lines.slice(start, end).join("\n").trim();
}

function parseMergeResponse(raw: string): AiSmartMergeResult {
const parsed = JSON.parse(stripCodeFences(raw)) as {
status?: unknown;
mergedCode?: unknown;
reason?: unknown;
};

if (parsed.status !== "merged" && parsed.status !== "conflict") {
throw new Error("Smart merge response must include status: 'merged' | 'conflict'.");
}

if (parsed.status === "merged" && typeof parsed.mergedCode !== "string") {
throw new Error("Smart merge 'merged' status must include mergedCode.");
}

return {
status: parsed.status,
mergedCode: typeof parsed.mergedCode === "string" ? parsed.mergedCode : undefined,
reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
};
}

export async function generateAiProposal(input: AiGenerateInput): Promise<AiGenerateResult> {
const systemPrompt =
"You are a senior software engineer. Return only code relevant to the user's request, plus an optional one-line summary.";

const userPrompt = [
`Language: ${input.language}`,
"",
"Task:",
input.prompt,
input.context ? "\nContext:\n" + input.context : "",
"",
"Output format:",
"First line: SUMMARY: <single short sentence>",
"Then code only.",
].join("\n");

const response = await callGemini(systemPrompt, userPrompt);
const lines = response.split("\n");
const firstLine = lines[0]?.trim() ?? "";
const hasSummary = firstLine.startsWith("SUMMARY:");

return {
summary: hasSummary ? firstLine.replace("SUMMARY:", "").trim() : undefined,
proposal: hasSummary ? lines.slice(1).join("\n").trim() : response.trim(),
};
}

export async function smartMergeAi(input: AiSmartMergeInput): Promise<AiSmartMergeResult> {
const systemPrompt =
"You resolve code collisions. Return JSON only with shape {\"status\":\"merged\"|\"conflict\",\"mergedCode\"?:string,\"reason\"?:string}.";

const userPrompt = [
`Language: ${input.language}`,
"",
"Original code:",
input.originalCode,
"",
"Proposal mine:",
input.mine,
"",
"Proposal theirs:",
input.theirs,
"",
"Return strict JSON only. If contradictory logic exists, use status='conflict' and provide reason.",
].join("\n");

const response = await callGemini(systemPrompt, userPrompt);
return parseMergeResponse(response);
}
