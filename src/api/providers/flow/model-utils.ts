/**
 * API endpoints for different model providers
 */
export const ENDPOINTS = {
  OPENAI: "/openai/chat/completions",
  GOOGLE: "/google/generateContent",
  BEDROCK: "/bedrock/invoke",
  ANTHROPIC: "/anthropic/messages",
} as const;

/**
 * Supported model providers
 */
export type ModelProvider = "openai" | "google" | "bedrock" | "anthropic";

/**
 * Determines the appropriate API endpoint based on the model ID prefix
 * @param modelId - The model identifier (e.g., "gpt-4", "claude-2")
 * @returns The corresponding API endpoint path
 * @throws Error if modelId is not provided
 */
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

/**
 * Extracts the provider type from a model ID
 * @param modelId - The model identifier
 * @returns The corresponding model provider, defaults to "openai" if unrecognized
 */
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

/**
 * Checks if a given model ID matches any of the supported model patterns
 * @param modelId - The model identifier to check
 * @returns True if the model ID matches a supported pattern, false otherwise
 */
export function isModelSupported(modelId: string): boolean {
  return (
    modelId.startsWith("gpt-") ||
    modelId.startsWith("gemini-") ||
    modelId.startsWith("anthropic.claude-") ||
    modelId.startsWith("claude-")
  );
}
