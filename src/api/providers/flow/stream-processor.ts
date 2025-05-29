import { parseSSEChunk, createLogger } from "./utils"
import { transformStreamChunk } from "./model-utils"
import { IFlowStreamProcessor } from "./interfaces"
import { CircularStreamBuffer } from "./circular-buffer"

/**
 * Flow Stream Processor
 *
 * Responsible for processing streaming responses from Flow API.
 * Handles SSE chunk extraction, buffer management, and stream transformation.
 * Uses CircularStreamBuffer for optimized memory management.
 */
export class FlowStreamProcessor implements IFlowStreamProcessor {
	private readonly logger = createLogger('FlowStreamProcessor')
	/**
	 * Process streaming response from Flow API with improved chunk handling
	 */
	async *processStreamingResponse(
		stream: ReadableStream<Uint8Array>,
		provider: string,
	): AsyncIterableIterator<any> {
		this.logger.debug("Iniciando processamento do stream", { provider })

		const reader = stream.getReader()
		const decoder = new TextDecoder()
		const context = this.createStreamContext()
		const buffer = new CircularStreamBuffer()

		try {
			while (true) {
				const { done, value } = await reader.read()

				if (done) {
					yield* this.handleStreamEnd(buffer, provider, context)
					break
				}

				context.chunkCount++
				const chunk = decoder.decode(value, { stream: true })
				buffer.append(chunk)

				this.logChunkReceived(chunk, context, buffer)
				yield* this.processBufferChunks(buffer, provider, context)
			}
		} catch (error) {
			this.handleStreamError(error, context, buffer)
			throw error
		} finally {
			reader.releaseLock()
			this.logger.debug("Reader liberado")
		}
	}

	/**
	 * Create stream processing context
	 */
	private createStreamContext() {
		return {
			chunkCount: 0,
			totalContent: ""
		}
	}

	/**
	 * Handle stream end processing
	 */
	private async *handleStreamEnd(
		buffer: CircularStreamBuffer,
		provider: string,
		context: { chunkCount: number, totalContent: string }
	): AsyncIterableIterator<any> {
		const bufferStats = buffer.getStats()
		this.logger.debug("Stream finalizado", {
			chunkCount: context.chunkCount,
			totalContentLength: context.totalContent.length,
			hasContent: context.totalContent.length > 0,
			bufferStats,
		})

		if (buffer.hasContent()) {
			const remainingContent = buffer.getRemainingBuffer()
			this.logFinalBufferProcessing(remainingContent)

			for await (const chunk of this.processBufferedChunks(remainingContent, provider)) {
				context.totalContent += chunk.text ?? ""
				yield chunk
			}
		}
	}

	/**
	 * Log chunk received information
	 */
	private logChunkReceived(
		chunk: string,
		context: { chunkCount: number },
		buffer: CircularStreamBuffer
	): void {
		this.logger.debug("Chunk recebido", {
			chunkNumber: context.chunkCount,
			chunkLength: chunk.length,
			chunkPreview: chunk.substring(0, 200) + (chunk.length > 200 ? "..." : ""),
			bufferStats: buffer.getStats(),
		})
	}

	/**
	 * Log final buffer processing
	 */
	private logFinalBufferProcessing(remainingContent: string): void {
		this.logger.debug("Processando buffer final", {
			bufferLength: remainingContent.length,
			bufferPreview: remainingContent.substring(0, 200) + (remainingContent.length > 200 ? "..." : ""),
		})
	}

	/**
	 * Process chunks from buffer
	 */
	private async *processBufferChunks(
		buffer: CircularStreamBuffer,
		provider: string,
		context: { chunkCount: number, totalContent: string }
	): AsyncIterableIterator<any> {
		const { chunks } = buffer.extractCompleteChunks()

		this.logger.debug("Chunks extraídos", {
			chunkNumber: context.chunkCount,
			processedCount: chunks.length,
			bufferStats: buffer.getStats(),
		})

		for (const completeChunk of chunks) {
			yield* this.processIndividualChunk(completeChunk, provider, context)
		}
	}

	/**
	 * Process individual chunk
	 */
	private async *processIndividualChunk(
		completeChunk: string,
		provider: string,
		context: { chunkCount: number, totalContent: string }
	): AsyncIterableIterator<any> {
		const parsed = parseSSEChunk(completeChunk)

		this.logChunkParsed(parsed, context)

		if (parsed) {
			const transformed = transformStreamChunk(provider as any, parsed)
			const content = transformed.choices[0]?.delta?.content ?? ""
			context.totalContent += content

			this.logChunkTransformed(transformed, content, context)

			if (content) {
				yield {
					type: "text",
					text: content,
				}
			}
		}
	}

	/**
	 * Log chunk parsed information
	 */
	private logChunkParsed(parsed: any, context: { chunkCount: number }): void {
		this.logger.debug("Chunk parseado", {
			chunkNumber: context.chunkCount,
			hasParsed: !!parsed,
			parsedKeys: parsed ? Object.keys(parsed) : [],
			parsedPreview: parsed ? JSON.stringify(parsed).substring(0, 300) + "..." : null,
		})
	}

	/**
	 * Log chunk transformed information
	 */
	private logChunkTransformed(
		transformed: any,
		content: string,
		context: { chunkCount: number }
	): void {
		this.logger.debug("Chunk transformado", {
			chunkNumber: context.chunkCount,
			hasTransformed: !!transformed,
			transformedKeys: transformed ? Object.keys(transformed) : [],
			choicesCount: transformed.choices?.length ?? 0,
			content: content,
			contentLength: content.length,
		})
	}

	/**
	 * Handle stream processing errors
	 */
	private handleStreamError(
		error: unknown,
		context: { chunkCount: number, totalContent: string },
		buffer: CircularStreamBuffer
	): void {
		const bufferStats = buffer.getStats()
		this.logger.error("Erro no processamento", {
			error: error instanceof Error ? error.message : String(error),
			chunkCount: context.chunkCount,
			totalContentLength: context.totalContent.length,
			bufferStats,
		})
	}

	/**
	 * Extract complete SSE chunks from buffer
	 */
	extractCompleteChunks(buffer: string): { processedChunks: string[], remainingBuffer: string } {
		// Try to extract SSE pattern chunks first
		const sseResult = this.extractSSEPatternChunks(buffer)
		if (sseResult.chunks.length > 0) {
			return {
				processedChunks: sseResult.chunks,
				remainingBuffer: sseResult.remaining
			}
		}

		// Fallback to line-based extraction
		const lineResult = this.extractLineBasedChunks(buffer)

		this.logExtractionResults(buffer, lineResult.chunks, lineResult.remaining)

		return {
			processedChunks: lineResult.chunks,
			remainingBuffer: lineResult.remaining
		}
	}

	/**
	 * Extract chunks using SSE pattern matching
	 */
	private extractSSEPatternChunks(buffer: string): { chunks: string[], remaining: string } {
		const chunks: string[] = []
		const ssePattern = /data: .*?\n\n/gs
		let match
		let lastIndex = 0

		while ((match = ssePattern.exec(buffer)) !== null) {
			chunks.push(match[0])
			lastIndex = match.index + match[0].length
		}

		const remaining = chunks.length > 0 ? buffer.substring(lastIndex) : buffer
		return { chunks, remaining }
	}

	/**
	 * Extract chunks using line-based processing
	 */
	private extractLineBasedChunks(buffer: string): { chunks: string[], remaining: string } {
		const lines = buffer.split('\n')
		if (lines.length <= 1) {
			return { chunks: [], remaining: buffer }
		}

		const completeLines = lines.slice(0, -1)
		const lastLine = lines[lines.length - 1]

		const { chunks, incompleteChunk } = this.processCompleteLines(completeLines)
		const remaining = this.determineRemainingBuffer(incompleteChunk, lastLine)

		return { chunks, remaining }
	}

	/**
	 * Process complete lines and group them into chunks
	 */
	private processCompleteLines(lines: string[]): { chunks: string[], incompleteChunk: string } {
		const chunks: string[] = []
		let currentChunk = ""
		let i = 0

		while (i < lines.length) {
			const line = lines[i]

			if (line.startsWith("data: ")) {
				const chunkResult = this.processDataLine(lines, i, currentChunk)

				if (chunkResult.completedChunk) {
					chunks.push(chunkResult.completedChunk)
				}

				currentChunk = chunkResult.newCurrentChunk
				i = chunkResult.nextIndex
			} else {
				i++
			}
		}

		return { chunks, incompleteChunk: currentChunk }
	}

	/**
	 * Process a data line and build chunk
	 */
	private processDataLine(
		lines: string[],
		startIndex: number,
		existingChunk: string
	): { completedChunk: string | null, newCurrentChunk: string, nextIndex: number } {
		// Start new chunk
		let currentChunk = lines[startIndex] + '\n'
		let i = startIndex + 1

		// Collect lines until empty line
		while (i < lines.length && lines[i].trim() !== "") {
			currentChunk += lines[i] + '\n'
			i++
		}

		// Check if chunk is complete (has empty line)
		if (i < lines.length && lines[i].trim() === "") {
			currentChunk += lines[i] + '\n'
			// Return existing chunk as completed if present, otherwise return current chunk
			const completedChunk = existingChunk.trim() || currentChunk.trim()
			return {
				completedChunk,
				newCurrentChunk: existingChunk.trim() ? currentChunk : "",
				nextIndex: i + 1
			}
		}

		// Chunk is incomplete
		return {
			completedChunk: existingChunk.trim() || null,
			newCurrentChunk: currentChunk,
			nextIndex: i
		}
	}

	/**
	 * Determine what remains in buffer after processing
	 */
	private determineRemainingBuffer(incompleteChunk: string, lastLine: string): string {
		if (incompleteChunk.trim()) {
			return incompleteChunk.trim() + '\n' + lastLine
		}
		return lastLine
	}

	/**
	 * Log extraction results for debugging
	 */
	private logExtractionResults(buffer: string, chunks: string[], remaining: string): void {
		console.log("🔧 [extractCompleteChunks] Extração completa:", {
			inputLength: buffer.length,
			chunksFound: chunks.length,
			remainingLength: remaining.length,
			chunkLengths: chunks.map(c => c.length),
		})
	}

	/**
	 * Process any remaining buffered content and yield results
	 */
	async *processBufferedChunks(buffer: string, provider: string): AsyncIterableIterator<any> {
		try {
			const parsed = parseSSEChunk(buffer)
			if (parsed) {
				this.logger.debug("Buffer final processado com sucesso", {
					parsedKeys: Object.keys(parsed),
					hasChoices: !!parsed.choices,
					choicesCount: parsed.choices?.length ?? 0,
				})

				// Transform the complete response to stream format
				const transformed = transformStreamChunk(provider as any, parsed)
				const content = transformed.choices[0]?.delta?.content ?? ""

				this.logger.debug("Conteúdo extraído do buffer", {
					hasTransformed: !!transformed,
					transformedKeys: transformed ? Object.keys(transformed) : [],
					choicesCount: transformed.choices?.length ?? 0,
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
			this.logger.warn("Erro ao processar buffer final", {
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
