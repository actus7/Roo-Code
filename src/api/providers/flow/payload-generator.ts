import { ModelInfo } from "../../../shared/api"
import { FlowMessage, FlowModelResponse, PayloadOptions, DEFAULT_FLOW_CONFIG, ensureTemperature } from "./types"

/**
 * Generates the request payload based on the model type and messages
 * @param modelId - Identifier of the model to use
 * @param messages - Array of messages to send
 * @param modelInfo - Model capabilities and configuration
 * @param options - Additional payload options
 * @returns Formatted payload for the specific model
 */
export function generatePayload(
  modelId: string,
  messages: FlowMessage[],
  modelInfo: ModelInfo,
  options: PayloadOptions
): Record<string, any> {
  // Common payload properties
  const basePayload = {
    stream: options.stream ?? true,
    max_tokens: options.max_tokens || modelInfo.maxTokens || 4096,
    temperature: ensureTemperature(options.temperature),
  }

  // GPT models (OpenAI format)
  if (modelId.startsWith("gpt-")) {
    return {
      ...basePayload,
      model: modelId,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content.map((c) => c.text).join("\n"),
      })),
    }
  }

  // Claude models (Anthropic format)
  if (modelId.startsWith("anthropic.claude-")) {
    return {
      ...basePayload,
      modelId: modelId,
      prompt: messages.map(msg => ({
        role: msg.role === "user" ? "human" : "assistant",
        content: msg.content.map((c) => c.text).join("\n"),
      })),
      responseFormat: {
        type: options.stream ? "text" : "json",
      },
    }
  }

  // Gemini models (Google format)
  if (modelId.startsWith("gemini-")) {
    return {
      ...basePayload,
      model: modelId,
      contents: messages.map(msg => ({
        role: msg.role === "user" ? "USER" : "ASSISTANT",
        parts: msg.content.map((c) => ({
          text: c.text,
        })),
      })),
      generationConfig: {
        maxOutputTokens: options.max_tokens,
        temperature: ensureTemperature(options.temperature),
      },
    }
  }

  // Default format if model is not recognized
  console.warn(`[Flow] Using default payload format for unknown model: ${modelId}`)
  return {
    ...basePayload,
    model: modelId,
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content.map((c) => c.text).join("\n"),
    })),
  }
}

/**
 * Extracts text content from model responses based on model type
 */
export function extractResponseContent(response: FlowModelResponse, modelId: string): string | undefined {
  if (modelId.startsWith("gpt-")) {
    return response.choices?.[0]?.delta?.content || 
           response.choices?.[0]?.message?.content || 
           undefined
  }

  if (modelId.startsWith("anthropic.claude-")) {
    return response.completion || undefined
  }

  if (modelId.startsWith("gemini-")) {
    return response.candidates?.[0]?.content?.parts?.[0]?.text || undefined
  }

  console.warn(`[Flow] Unknown model format for extracting response: ${modelId}`)
  return undefined
}
