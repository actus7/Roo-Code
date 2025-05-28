import { FlowStreamProcessor } from "../stream-processor"

// Mock the utils and model-utils modules
jest.mock("../utils", () => ({
	parseSSEChunk: jest.fn(),
}))

jest.mock("../model-utils", () => ({
	transformStreamChunk: jest.fn(),
}))

import { parseSSEChunk } from "../utils"
import { transformStreamChunk } from "../model-utils"

const mockParseSSEChunk = parseSSEChunk as jest.MockedFunction<typeof parseSSEChunk>
const mockTransformStreamChunk = transformStreamChunk as jest.MockedFunction<typeof transformStreamChunk>

describe("FlowStreamProcessor", () => {
	let processor: FlowStreamProcessor

	beforeEach(() => {
		processor = new FlowStreamProcessor()
		jest.clearAllMocks()

		// Suppress console logs during tests
		jest.spyOn(console, 'log').mockImplementation(() => {})
		jest.spyOn(console, 'error').mockImplementation(() => {})
		jest.spyOn(console, 'warn').mockImplementation(() => {})
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	describe("extractCompleteChunks", () => {
		it("should extract complete SSE chunks", () => {
			const buffer = "data: {\"test\": \"value1\"}\n\ndata: {\"test\": \"value2\"}\n\ndata: incomplete"

			const result = processor.extractCompleteChunks(buffer)

			expect(result.processedChunks).toHaveLength(2)
			expect(result.processedChunks[0]).toBe("data: {\"test\": \"value1\"}\n\n")
			expect(result.processedChunks[1]).toBe("data: {\"test\": \"value2\"}\n\n")
			expect(result.remainingBuffer).toBe("data: incomplete")
		})

		it("should handle buffer with no complete chunks", () => {
			const buffer = "data: incomplete chunk"

			const result = processor.extractCompleteChunks(buffer)

			expect(result.processedChunks).toHaveLength(0)
			expect(result.remainingBuffer).toBe(buffer)
		})

		it("should handle empty buffer", () => {
			const buffer = ""

			const result = processor.extractCompleteChunks(buffer)

			expect(result.processedChunks).toHaveLength(0)
			expect(result.remainingBuffer).toBe("")
		})

		it("should handle line-based chunks when no SSE pattern", () => {
			const buffer = "data: test1\n\ndata: test2\nincomplete"

			const result = processor.extractCompleteChunks(buffer)

			expect(result.processedChunks.length).toBeGreaterThan(0)
			expect(result.remainingBuffer).toContain("test2")
			expect(result.remainingBuffer).toContain("incomplete")
		})
	})

	describe("processBufferedChunks", () => {
		it("should process valid buffered content", async () => {
			const buffer = "data: {\"choices\": [{\"delta\": {\"content\": \"test\"}}]}"
			const provider = "azure-openai"

			mockParseSSEChunk.mockReturnValue({
				choices: [{ delta: { content: "test" } }]
			})

			mockTransformStreamChunk.mockReturnValue({
				choices: [{ delta: { content: "test" } }]
			})

			const results = []
			for await (const chunk of processor.processBufferedChunks(buffer, provider)) {
				results.push(chunk)
			}

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				type: "text",
				text: "test"
			})
			expect(mockParseSSEChunk).toHaveBeenCalledWith(buffer)
			expect(mockTransformStreamChunk).toHaveBeenCalledWith(provider, expect.any(Object))
		})

		it("should handle invalid buffered content gracefully", async () => {
			const buffer = "invalid content"
			const provider = "azure-openai"

			mockParseSSEChunk.mockReturnValue(null)

			const results = []
			for await (const chunk of processor.processBufferedChunks(buffer, provider)) {
				results.push(chunk)
			}

			expect(results).toHaveLength(0)
			expect(mockParseSSEChunk).toHaveBeenCalledWith(buffer)
		})

		it("should handle parsing errors gracefully", async () => {
			const buffer = "data: invalid json"
			const provider = "azure-openai"

			mockParseSSEChunk.mockImplementation(() => {
				throw new Error("Parse error")
			})

			const results = []
			for await (const chunk of processor.processBufferedChunks(buffer, provider)) {
				results.push(chunk)
			}

			expect(results).toHaveLength(0)
		})
	})

	describe("createStreamFromString", () => {
		it("should create a readable stream from string data", async () => {
			const data = "data: chunk1\n\ndata: chunk2\n\n"

			const stream = processor.createStreamFromString(data)
			const reader = stream.getReader()
			const decoder = new TextDecoder()

			const chunks = []
			let done = false

			while (!done) {
				const result = await reader.read()
				done = result.done
				if (!done) {
					chunks.push(decoder.decode(result.value))
				}
			}

			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks.join("")).toContain("chunk1")
			expect(chunks.join("")).toContain("chunk2")
		})
	})

	describe("isValidSSEChunk", () => {
		it("should validate correct SSE chunks", () => {
			expect(processor.isValidSSEChunk("data: test\n\n")).toBe(true)
			expect(processor.isValidSSEChunk("data: test\n")).toBe(true)
		})

		it("should reject invalid SSE chunks", () => {
			expect(processor.isValidSSEChunk("invalid chunk")).toBe(false)
			expect(processor.isValidSSEChunk("")).toBe(false)
		})
	})

	describe("normalizeChunk", () => {
		it("should normalize line endings", () => {
			expect(processor.normalizeChunk("test\r\ndata")).toBe("test\ndata")
			expect(processor.normalizeChunk("test\rdata")).toBe("test\ndata")
			expect(processor.normalizeChunk("  test  ")).toBe("test")
		})
	})

	describe("processStreamingResponse", () => {
		it("should process a simple stream", async () => {
			const testData = "data: {\"choices\": [{\"delta\": {\"content\": \"hello\"}}]}\n\n"
			const stream = processor.createStreamFromString(testData)
			const provider = "azure-openai"

			mockParseSSEChunk.mockReturnValue({
				choices: [{ delta: { content: "hello" } }]
			})

			mockTransformStreamChunk.mockReturnValue({
				choices: [{ delta: { content: "hello" } }]
			})

			const results = []
			for await (const chunk of processor.processStreamingResponse(stream, provider)) {
				results.push(chunk)
			}

			expect(results.length).toBeGreaterThan(0)
			expect(results[0]).toEqual({
				type: "text",
				text: "hello"
			})
		})

		it("should handle empty stream", async () => {
			const stream = processor.createStreamFromString("")
			const provider = "azure-openai"

			const results = []
			for await (const chunk of processor.processStreamingResponse(stream, provider)) {
				results.push(chunk)
			}

			expect(results).toHaveLength(0)
		})
	})
})
