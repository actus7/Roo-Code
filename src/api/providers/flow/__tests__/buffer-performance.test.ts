/**
 * Performance Tests for Buffer Management
 *
 * This test suite focuses on performance aspects of buffer management
 * in the Flow provider, particularly for streaming operations.
 */

import { FlowStreamProcessor } from '../stream-processor'

describe('Buffer Management Performance Tests', () => {
	let processor: FlowStreamProcessor

	beforeEach(() => {
		processor = new FlowStreamProcessor()
		jest.useFakeTimers()
	})

	afterEach(() => {
		jest.useRealTimers()
	})

	describe('Large Buffer Handling', () => {
		it('should handle large buffers efficiently', () => {
			const startTime = performance.now()

			// Create a large buffer (1MB of data)
			const largeChunk = 'data: ' + 'x'.repeat(1024 * 1024) + '\n\n'

			const result = processor.extractCompleteChunks(largeChunk)

			const endTime = performance.now()
			const processingTime = endTime - startTime

			// Should process within reasonable time (< 100ms for 1MB)
			expect(processingTime).toBeLessThan(100)
			expect(result.processedChunks).toHaveLength(1)
			expect(result.remainingBuffer).toBe('')
		})

		it('should handle multiple large chunks without memory leaks', () => {
			const initialMemory = process.memoryUsage().heapUsed

			// Process 100 chunks of 10KB each
			for (let i = 0; i < 100; i++) {
				const chunk = 'data: ' + 'x'.repeat(10 * 1024) + '\n\n'
				processor.extractCompleteChunks(chunk)
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc()
			}

			const finalMemory = process.memoryUsage().heapUsed
			const memoryIncrease = finalMemory - initialMemory

			// Memory increase should be reasonable (< 50MB)
			expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
		})

		it('should handle fragmented large buffers efficiently', () => {
			const startTime = performance.now()

			// Create fragmented data that spans multiple chunks
			const totalSize = 1024 * 1024 // 1MB
			const chunkSize = 1024 // 1KB chunks
			const numChunks = totalSize / chunkSize

			let buffer = ''
			for (let i = 0; i < numChunks; i++) {
				const chunk = 'x'.repeat(chunkSize)
				buffer += chunk

				// Process every 10 chunks to simulate streaming
				if (i % 10 === 0) {
					processor.extractCompleteChunks(buffer)
					buffer = ''
				}
			}

			const endTime = performance.now()
			const processingTime = endTime - startTime

			// Should process fragmented data efficiently (< 200ms)
			expect(processingTime).toBeLessThan(200)
		})
	})

	describe('Buffer Accumulation Performance', () => {
		it('should handle rapid buffer accumulation without performance degradation', () => {
			const measurements: number[] = []

			// Simulate rapid streaming with increasing buffer sizes
			for (let i = 1; i <= 100; i++) {
				const startTime = performance.now()

				// Create progressively larger incomplete chunks
				const incompleteChunk = 'data: ' + 'x'.repeat(i * 100)
				processor.extractCompleteChunks(incompleteChunk)

				const endTime = performance.now()
				measurements.push(endTime - startTime)
			}

			// Performance should not degrade significantly
			const firstTenAvg = measurements.slice(0, 10).reduce((a, b) => a + b, 0) / 10
			const lastTenAvg = measurements.slice(-10).reduce((a, b) => a + b, 0) / 10

			// Last measurements should not be more than 10x slower than first (more lenient)
			if (firstTenAvg > 0) {
				expect(lastTenAvg).toBeLessThan(firstTenAvg * 10)
			}
		})

		it('should efficiently handle buffer cleanup', () => {
			const startTime = performance.now()

			// Create a realistic scenario with incomplete data at the end
			let buffer = ''
			// Add some complete chunks
			for (let i = 0; i < 5; i++) {
				buffer += `data: complete chunk ${i}\n\n`
			}
			// Add incomplete data that would remain in buffer (no final \n\n)
			buffer += 'data: incomplete chunk without terminator'

			const result = processor.extractCompleteChunks(buffer)

			const endTime = performance.now()
			const processingTime = endTime - startTime

			// Should clean up efficiently (< 50ms)
			expect(processingTime).toBeLessThan(50)
			// Should extract the complete chunks (5 total)
			expect(result.processedChunks.length).toBe(5)
			// Should have the incomplete chunk remaining in buffer
			expect(result.remainingBuffer).toContain('incomplete chunk without terminator')
			expect(result.remainingBuffer.length).toBeGreaterThan(0)
		})
	})

	describe('Regex Performance', () => {
		it('should handle regex matching efficiently on large texts', () => {
			const startTime = performance.now()

			// Create text with many potential matches
			const largeText = Array.from({ length: 10000 }, (_, i) =>
				`data: chunk${i}\n\n`
			).join('')

			const result = processor.extractCompleteChunks(largeText)

			const endTime = performance.now()
			const processingTime = endTime - startTime

			// Should handle regex efficiently (< 100ms for 10k matches)
			expect(processingTime).toBeLessThan(100)
			expect(result.processedChunks).toHaveLength(10000)
		})

		it('should handle pathological regex cases', () => {
			const startTime = performance.now()

			// Create text that could cause regex backtracking
			const pathologicalText = 'data: ' + 'a'.repeat(10000) + 'b\n\n'

			const result = processor.extractCompleteChunks(pathologicalText)

			const endTime = performance.now()
			const processingTime = endTime - startTime

			// Should not cause excessive backtracking (< 50ms)
			expect(processingTime).toBeLessThan(50)
			expect(result.processedChunks).toHaveLength(1)
		})
	})

	describe('Memory Efficiency', () => {
		it('should not create excessive intermediate objects', () => {
			const initialMemory = process.memoryUsage().heapUsed

			// Process many small chunks
			for (let i = 0; i < 10000; i++) {
				const chunk = `data: message${i}\n\n`
				processor.extractCompleteChunks(chunk)
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc()
			}

			const finalMemory = process.memoryUsage().heapUsed
			const memoryIncrease = finalMemory - initialMemory

			// Memory increase should be reasonable (< 20MB for 10k small chunks)
			expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024)
		})

		it('should handle string concatenation efficiently', () => {
			const startTime = performance.now()

			// Test string concatenation performance
			let buffer = ''
			for (let i = 0; i < 1000; i++) {
				buffer += `data: chunk${i}\n`

				// Process every 100 iterations
				if (i % 100 === 0) {
					processor.extractCompleteChunks(buffer + '\n')
					buffer = ''
				}
			}

			const endTime = performance.now()
			const processingTime = endTime - startTime

			// String operations should be efficient (< 50ms)
			expect(processingTime).toBeLessThan(50)
		})
	})

	describe('Concurrent Processing Performance', () => {
		it('should handle concurrent buffer processing efficiently', async () => {
			const startTime = performance.now()

			// Create multiple processors to simulate concurrent usage
			const processors = Array.from({ length: 10 }, () => new FlowStreamProcessor())

			// Process data concurrently
			const promises = processors.map(async (proc, index) => {
				for (let i = 0; i < 100; i++) {
					const chunk = `data: processor${index}_chunk${i}\n\n`
					proc.extractCompleteChunks(chunk)
				}
			})

			await Promise.all(promises)

			const endTime = performance.now()
			const processingTime = endTime - startTime

			// Concurrent processing should be efficient (< 200ms)
			expect(processingTime).toBeLessThan(200)
		})

		it('should maintain performance under high throughput', () => {
			const startTime = performance.now()
			const throughputMeasurements: number[] = []

			// Simulate high throughput scenario
			for (let batch = 0; batch < 10; batch++) {
				const batchStart = performance.now()

				// Process 1000 chunks in this batch
				for (let i = 0; i < 1000; i++) {
					const chunk = `data: batch${batch}_chunk${i}\n\n`
					processor.extractCompleteChunks(chunk)
				}

				const batchEnd = performance.now()
				throughputMeasurements.push(batchEnd - batchStart)
			}

			const endTime = performance.now()
			const totalTime = endTime - startTime

			// Total processing should be efficient (< 500ms for 10k chunks)
			expect(totalTime).toBeLessThan(500)

			// Throughput should remain consistent across batches
			const avgThroughput = throughputMeasurements.reduce((a, b) => a + b, 0) / throughputMeasurements.length
			const maxThroughput = Math.max(...throughputMeasurements)

			// Max batch time should not be more than 5x average (more lenient)
			if (avgThroughput > 0) {
				expect(maxThroughput).toBeLessThan(avgThroughput * 5)
			}
		})
	})

	describe('Edge Case Performance', () => {
		it('should handle empty buffers efficiently', () => {
			const startTime = performance.now()

			// Process many empty buffers
			for (let i = 0; i < 10000; i++) {
				processor.extractCompleteChunks('')
			}

			const endTime = performance.now()
			const processingTime = endTime - startTime

			// Empty buffer processing should be very fast (< 10ms)
			expect(processingTime).toBeLessThan(10)
		})

		it('should handle single character buffers efficiently', () => {
			const startTime = performance.now()

			// Process many single character buffers
			for (let i = 0; i < 10000; i++) {
				processor.extractCompleteChunks('x')
			}

			const endTime = performance.now()
			const processingTime = endTime - startTime

			// Single character processing should be fast (< 20ms)
			expect(processingTime).toBeLessThan(20)
		})

		it('should handle malformed chunks efficiently', () => {
			const startTime = performance.now()

			// Process many malformed chunks
			const malformedChunks = [
				'data: incomplete',
				'invalid: format\n\n',
				'data:\n',
				'\n\ndata: empty_prefix',
				'data: no_newline',
				'data: \n\n\n\n', // extra newlines
			]

			for (let i = 0; i < 1000; i++) {
				const chunk = malformedChunks[i % malformedChunks.length]
				processor.extractCompleteChunks(chunk)
			}

			const endTime = performance.now()
			const processingTime = endTime - startTime

			// Malformed chunk processing should be efficient (< 50ms)
			expect(processingTime).toBeLessThan(50)
		})
	})

	describe('Performance Benchmarks', () => {
		it('should meet throughput benchmarks', () => {
			const startTime = performance.now()
			const chunkCount = 50000

			// Process a large number of standard chunks
			for (let i = 0; i < chunkCount; i++) {
				const chunk = `data: {"id": ${i}, "message": "test message ${i}"}\n\n`
				processor.extractCompleteChunks(chunk)
			}

			const endTime = performance.now()
			const processingTime = endTime - startTime

			// Calculate throughput (chunks per second)
			const throughput = (chunkCount / processingTime) * 1000

			// Should process at least 10,000 chunks per second
			expect(throughput).toBeGreaterThan(10000)

			// Total time should be reasonable (< 5 seconds for 50k chunks)
			expect(processingTime).toBeLessThan(5000)
		})

		it('should meet memory efficiency benchmarks', () => {
			const initialMemory = process.memoryUsage().heapUsed

			// Process a large dataset
			const largeDataset = Array.from({ length: 10000 }, (_, i) =>
				`data: {"index": ${i}, "payload": "${'x'.repeat(100)}"}\n\n`
			).join('')

			processor.extractCompleteChunks(largeDataset)

			// Force garbage collection if available
			if (global.gc) {
				global.gc()
			}

			const finalMemory = process.memoryUsage().heapUsed
			const memoryIncrease = finalMemory - initialMemory

			// Memory increase should be proportional to data size
			const dataSize = largeDataset.length
			const memoryEfficiency = memoryIncrease / dataSize

			// Memory overhead should be less than 10x the data size (more lenient)
			expect(memoryEfficiency).toBeLessThan(10)
		})
	})
})
