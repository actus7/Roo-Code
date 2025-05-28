// Mock implementation of execa
const mockExeca = jest.fn().mockImplementation((command, args, options) => {
	const mockProcess = {
		stdout: '',
		stderr: '',
		exitCode: 0,
		killed: false,
		pid: 12345,
		command: `${command} ${args ? args.join(' ') : ''}`,
		escapedCommand: `${command} ${args ? args.join(' ') : ''}`,
		failed: false,
		timedOut: false,
		isCanceled: false,
		shortMessage: '',
		originalMessage: '',
		signal: undefined,
		signalDescription: undefined,
		cwd: process.cwd(),
		durationMs: 100,
		pipedFrom: undefined,
		all: undefined,
	}

	// Return a promise that resolves to the mock process
	return Promise.resolve(mockProcess)
})

// Mock ExecaError
class MockExecaError extends Error {
	constructor(message, result) {
		super(message)
		this.name = 'ExecaError'
		this.exitCode = result?.exitCode || 1
		this.stdout = result?.stdout || ''
		this.stderr = result?.stderr || ''
		this.failed = true
		this.killed = false
		this.signal = undefined
		this.command = result?.command || ''
		this.escapedCommand = result?.escapedCommand || ''
		this.timedOut = false
		this.isCanceled = false
		this.shortMessage = message
		this.originalMessage = message
		this.cwd = process.cwd()
		this.durationMs = 100
		this.pipedFrom = undefined
		this.all = undefined
	}
}

// Export the mock
module.exports = {
	execa: mockExeca,
	ExecaError: MockExecaError,
	__esModule: true,
	default: mockExeca,
}
