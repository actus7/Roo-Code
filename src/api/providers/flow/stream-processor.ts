import { parseSSEChunk } from "./utils"
import { transformStreamChunk } from "./model-utils"
import { IFlowStreamProcessor } from "./interfaces"

/**
 * Flow Stream Processor
 *
 * Responsible for processing streaming responses from Flow API.
 * Handles SSE chunk extraction, buffer management, and stream transformation.
 */
export class FlowStreamProcessor implements IFlowStreamProcessor {
	/**
	 * Process streaming response from Flow API with improved chunk handling
	 */
	async *processStreamingResponse(
		stream: ReadableStream<Uint8Array>,
		provider: string,
	): AsyncIterableIterator<any> {
		console.log("🌊 [processStreamingResponse] Iniciando processamento do stream para provider:", provider)

		const reader = stream.getReader()
		const decoder = new TextDecoder()
		let chunkCount = 0
		let totalContent = ""
		let buffer = "" // Buffer para chunks fragmentados

		try {
			while (true) {
				const { done, value } = await reader.read()
				if (done) {
					console.log("🏁 [processStreamingResponse] Stream finalizado:", {
						chunkCount,
						totalContentLength: totalContent.length,
						hasContent: totalContent.length > 0,
						bufferRemaining: buffer.length,
					})

					// Processar qualquer conteúdo restante no buffer
					if (buffer.trim()) {
						console.log("🔄 [processStreamingResponse] Processando buffer final:", {
							bufferLength: buffer.length,
							bufferPreview: buffer.substring(0, 200) + "...",
						})

						// Process buffer and yield any content found
						for await (const chunk of this.processBufferedChunks(buffer, provider)) {
							totalContent += chunk.text || ""
							yield chunk
						}
					}
					break
				}

				chunkCount++
				const chunk = decoder.decode(value, { stream: true }) // Use stream: true para chunks fragmentados
				buffer += chunk

				console.log("📦 [processStreamingResponse] Chunk recebido:", {
					chunkNumber: chunkCount,
					chunkLength: chunk.length,
					chunkPreview: chunk.substring(0, 200) + (chunk.length > 200 ? "..." : ""),
					bufferLength: buffer.length,
				})

				// Processar chunks completos do buffer
				const { processedChunks, remainingBuffer } = this.extractCompleteChunks(buffer)
				buffer = remainingBuffer

				console.log("🔍 [processStreamingResponse] Chunks extraídos:", {
					chunkNumber: chunkCount,
					processedCount: processedChunks.length,
					remainingBufferLength: buffer.length,
				})

				// Processar cada chunk completo
				for (const completeChunk of processedChunks) {
					const parsed = parseSSEChunk(completeChunk)

					console.log("🔍 [processStreamingResponse] Chunk parseado:", {
						chunkNumber: chunkCount,
						hasParsed: !!parsed,
						parsedKeys: parsed ? Object.keys(parsed) : [],
						parsedPreview: parsed ? JSON.stringify(parsed).substring(0, 300) + "..." : null,
					})

					if (parsed) {
						const transformed = transformStreamChunk(provider as any, parsed)
						const content = transformed.choices[0]?.delta?.content ?? ""
						totalContent += content

						console.log("✨ [processStreamingResponse] Chunk transformado:", {
							chunkNumber: chunkCount,
							hasTransformed: !!transformed,
							transformedKeys: transformed ? Object.keys(transformed) : [],
							choicesCount: transformed.choices?.length || 0,
							content: content,
							contentLength: content.length,
						})

						if (content) {
							yield {
								type: "text",
								text: content,
							}
						}
					}
				}
			}
		} catch (error) {
			console.error("❌ [processStreamingResponse] Erro no processamento:", {
				error: error instanceof Error ? error.message : String(error),
				chunkCount,
				totalContentLength: totalContent.length,
				bufferLength: buffer.length,
			})
			throw error
		} finally {
			reader.releaseLock()
			console.log("🔒 [processStreamingResponse] Reader liberado")
		}
	}

	/**
	 * Extract complete SSE chunks from buffer
	 */
	extractCompleteChunks(buffer: string): { processedChunks: string[], remainingBuffer: string } {
		const chunks: string[] = []
		let remaining = buffer

		// Procurar por padrões SSE completos
		const ssePattern = /data: .*?\n\n/gs
		let match
		let lastIndex = 0

		while ((match = ssePattern.exec(buffer)) !== null) {
			chunks.push(match[0])
			lastIndex = match.index + match[0].length
		}

		// Se encontramos chunks completos, remover do buffer
		if (chunks.length > 0) {
			remaining = buffer.substring(lastIndex)
		}

		// Se não há padrão SSE, procurar por linhas completas
		if (chunks.length === 0) {
			const lines = buffer.split('\n')
			if (lines.length > 1) {
				// Manter a última linha no buffer (pode estar incompleta)
				const completeLines = lines.slice(0, -1)
				const lastLine = lines[lines.length - 1]

				// Agrupar linhas em chunks baseado em "data: " e linhas vazias
				let currentChunk = ""
				let i = 0

				while (i < completeLines.length) {
					const line = completeLines[i]

					if (line.startsWith("data: ")) {
						// Se já temos um chunk, adicionar à lista
						if (currentChunk.trim()) {
							chunks.push(currentChunk.trim())
							currentChunk = ""
						}

						// Iniciar novo chunk
						currentChunk = line + '\n'

						// Procurar pela linha vazia que termina o chunk
						i++
						while (i < completeLines.length && completeLines[i].trim() !== "") {
							currentChunk += completeLines[i] + '\n'
							i++
						}

						// Se encontrou linha vazia, adicionar o chunk completo
						if (i < completeLines.length && completeLines[i].trim() === "") {
							currentChunk += completeLines[i] + '\n'
							chunks.push(currentChunk.trim())
							currentChunk = ""
						}
						// Se não encontrou linha vazia, o chunk fica incompleto
					}
					i++
				}

				// Determinar o que fica no buffer
				if (currentChunk.trim()) {
					// Se temos um chunk incompleto, ele fica no buffer junto com a última linha
					remaining = currentChunk.trim() + '\n' + lastLine
				} else {
					// Apenas a última linha fica no buffer
					remaining = lastLine
				}
			}
		}

		console.log("🔧 [extractCompleteChunks] Extração completa:", {
			inputLength: buffer.length,
			chunksFound: chunks.length,
			remainingLength: remaining.length,
			chunkLengths: chunks.map(c => c.length),
		})

		return { processedChunks: chunks, remainingBuffer: remaining }
	}

	/**
	 * Process any remaining buffered content and yield results
	 */
	async *processBufferedChunks(buffer: string, provider: string): AsyncIterableIterator<any> {
		try {
			const parsed = parseSSEChunk(buffer)
			if (parsed) {
				console.log("🔄 [processBufferedChunks] Buffer final processado com sucesso:", {
					parsedKeys: Object.keys(parsed),
					hasChoices: !!parsed.choices,
					choicesCount: parsed.choices?.length || 0,
				})

				// Transform the complete response to stream format
				const transformed = transformStreamChunk(provider as any, parsed)
				const content = transformed.choices[0]?.delta?.content ?? ""

				console.log("✨ [processBufferedChunks] Conteúdo extraído do buffer:", {
					hasTransformed: !!transformed,
					transformedKeys: transformed ? Object.keys(transformed) : [],
					choicesCount: transformed.choices?.length || 0,
					content: content,
					contentLength: content.length,
				})

				if (content) {
					yield {
						type: "text",
						text: content,
					}
				}
			}
		} catch (error) {
			console.warn("⚠️ [processBufferedChunks] Erro ao processar buffer final:", {
				error: error instanceof Error ? error.message : String(error),
				bufferLength: buffer.length,
			})
		}
	}

	/**
	 * Create a readable stream from text data
	 */
	createStreamFromText(text: string): ReadableStream<Uint8Array> {
		return this.createStreamFromString(text)
	}

	/**
	 * Validate chunk format
	 */
	validateChunk(chunk: string): boolean {
		return this.isValidSSEChunk(chunk)
	}

	/**
	 * Parse SSE chunk
	 */
	parseSSEChunk(chunk: string): any {
		return parseSSEChunk(chunk)
	}

	/**
	 * Transform stream chunk for provider
	 */
	transformStreamChunk(chunk: any, provider: string): any {
		return transformStreamChunk(provider as any, chunk)
	}

	/**
	 * Create a readable stream from string data (for testing)
	 */
	createStreamFromString(data: string): ReadableStream<Uint8Array> {
		const encoder = new TextEncoder()
		const chunks = data.split('\n\n').filter(chunk => chunk.trim())

		return new ReadableStream({
			start(controller) {
				chunks.forEach(chunk => {
					controller.enqueue(encoder.encode(chunk + '\n\n'))
				})
				controller.close()
			}
		})
	}

	/**
	 * Validate stream chunk format
	 */
	isValidSSEChunk(chunk: string): boolean {
		return chunk.includes('data: ') && (chunk.includes('\n\n') || chunk.endsWith('\n'))
	}

	/**
	 * Clean and normalize chunk data
	 */
	normalizeChunk(chunk: string): string {
		return chunk
			.replace(/\r\n/g, '\n')  // Normalize line endings
			.replace(/\r/g, '\n')    // Handle old Mac line endings
			.trim()
	}
}
