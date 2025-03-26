export const ENDPOINTS = {
  OPENAI: "/openai/chat/completions",
  GOOGLE: "/google/generateContent",
  BEDROCK: "/bedrock/invoke",
  ANTHROPIC: "/anthropic/messages",
} as const;

export type ModelProvider = "openai" | "google" | "bedrock" | "anthropic";

export function getEndpointForModel(modelId: string): string {
  if (!modelId) {
    throw new Error("Model ID is required");
  }
  
  if (modelId.startsWith("gpt-")) {
    return ENDPOINTS.OPENAI;
  } else if (modelId.startsWith("gemini-")) {
    return ENDPOINTS.GOOGLE;
  } else if (modelId.startsWith("anthropic.claude-")) {
    return ENDPOINTS.BEDROCK;
  } else if (modelId.startsWith("claude-")) {
    return ENDPOINTS.ANTHROPIC;
  }
  
  // Fallback para modelos não reconhecidos
  console.warn(`[Flow] Unrecognized model ID pattern: ${modelId}, defaulting to OpenAI endpoint`);
  return ENDPOINTS.OPENAI;
}

export function getProviderFromModelId(modelId: string): ModelProvider {
  if (modelId.startsWith("gpt-")) {
    return "openai";
  } else if (modelId.startsWith("gemini-")) {
    return "google";
  } else if (modelId.startsWith("anthropic.claude-")) {
    return "bedrock";
  } else if (modelId.startsWith("claude-")) {
    return "anthropic";
  }
  
  return "openai"; // Default
}

export function isModelSupported(modelId: string): boolean {
  return (
    modelId.startsWith("gpt-") ||
    modelId.startsWith("gemini-") ||
    modelId.startsWith("anthropic.claude-") ||
    modelId.startsWith("claude-")
  );
}
