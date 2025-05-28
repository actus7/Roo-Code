/**
 * Comprehensive Tests for Execute Command Tool
 *
 * This test suite provides extensive coverage for the executeCommandTool.ts module,
 * including both the main tool function and the executeCommand function.
 */

import fs from "fs/promises"
import * as path from "path"
import delay from "delay"

// Mock all external dependencies first
jest.mock('fs/promises')
jest.mock('delay')
jest.mock('../../task/Task')
jest.mock('../../../integrations/terminal/TerminalRegistry')
jest.mock('../../../integrations/terminal/Terminal')
jest.mock('../../../services/telemetry/TelemetryService')
jest.mock('../../prompts/responses')
jest.mock('../../../utils/text-normalization')
jest.mock('../../../integrations/terminal/ExecaTerminal')
jest.mock('../../../integrations/terminal/ExecaTerminalProcess')

import { executeCommandTool, executeCommand, type ExecuteCommandOptions } from '../executeCommandTool'
import type { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from '../../../shared/tools'
import type { ExitCodeDetails, RooTerminalCallbacks, RooTerminalProcess } from '../../../integrations/terminal/types'

describe('Execute Command Tool', () => {
	// Mock instances
	const mockTask = {
		ask: jest.fn(),
		say: jest.fn(),
		sayAndCreateMissingParamError: jest.fn(),
		cwd: '/test/cwd',
		lastMessageTs: 123456789,
		consecutiveMistakeCount: 0,
		didRejectTool: false,
		terminalProcess: undefined,
		taskId: 'test-task-id',
		recordToolError: jest.fn(),
		providerRef: {
			deref: jest.fn()
		},
		rooIgnoreController: {
			validateCommand: jest.fn()
		}
	} as unknown as Task

	const mockProvider = {
		getState: jest.fn(),
		postMessageToWebview: jest.fn()
	}

	const mockTerminal = {
		terminal: { show: jest.fn() },
		getCurrentWorkingDirectory: jest.fn(),
		runCommand: jest.fn()
	}

	const mockProcess = Promise.resolve()

	// Mock functions
	const mockAskApproval = jest.fn() as AskApproval
	const mockHandleError = jest.fn() as HandleError
	const mockPushToolResult = jest.fn() as PushToolResult
	const mockRemoveClosingTag = jest.fn() as RemoveClosingTag

	// Mock modules
	const mockFs = fs as jest.Mocked<typeof fs>
	const mockDelay = delay as jest.MockedFunction<typeof delay>
	const mockTerminalRegistry = TerminalRegistry as jest.Mocked<typeof TerminalRegistry>
	const mockTerminalClass = Terminal as jest.MockedClass<typeof Terminal>
	const mockTelemetryService = telemetryService as jest.Mocked<typeof telemetryService>
	const mockFormatResponse = formatResponse as jest.Mocked<typeof formatResponse>
	const mockUnescapeHtmlEntities = unescapeHtmlEntities as jest.MockedFunction<typeof unescapeHtmlEntities>

	beforeEach(() => {
		jest.clearAllMocks()

		// Setup default mocks
		mockTask.providerRef.deref.mockResolvedValue(mockProvider)
		mockProvider.getState.mockResolvedValue({
			terminalOutputLineLimit: 500,
			terminalShellIntegrationDisabled: false
		})
		mockTerminalRegistry.getOrCreateTerminal.mockResolvedValue(mockTerminal as any)
		mockTerminal.getCurrentWorkingDirectory.mockReturnValue('/test/cwd')
		mockTerminal.runCommand.mockReturnValue(mockProcess as any)
		mockFs.access.mockResolvedValue(undefined)
		mockDelay.mockResolvedValue(undefined)
		mockUnescapeHtmlEntities.mockImplementation((str) => str)
		mockRemoveClosingTag.mockImplementation((tag, content) => content || '')
		mockFormatResponse.toolError.mockReturnValue('Tool error response')
		mockFormatResponse.toolResult.mockReturnValue('Tool result response')
		mockFormatResponse.rooIgnoreError.mockReturnValue('Roo ignore error')
	})

	describe('executeCommandTool function', () => {
		describe('Partial Commands', () => {
			it('should handle partial command blocks', async () => {
				const block: ToolUse = {
					tool: 'execute_command',
					params: { command: 'ls -la' },
					partial: true
				}

				await executeCommandTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

				expect(mockTask.ask).toHaveBeenCalledWith('command', 'ls -la', true)
				expect(mockPushToolResult).not.toHaveBeenCalled()
			})

			it('should handle partial command with ask error', async () => {
				const block: ToolUse = {
					tool: 'execute_command',
					params: { command: 'ls -la' },
					partial: true
				}

				mockTask.ask.mockRejectedValueOnce(new Error('Ask failed'))

				await executeCommandTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

				expect(mockTask.ask).toHaveBeenCalled()
				// Should not throw error, just catch and continue
			})
		})

		describe('Missing Parameters', () => {
			it('should handle missing command parameter', async () => {
				const block: ToolUse = {
					tool: 'execute_command',
					params: {},
					partial: false
				}

				mockTask.sayAndCreateMissingParamError.mockResolvedValue('Missing parameter error')

				await executeCommandTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

				expect(mockTask.consecutiveMistakeCount).toBe(1)
				expect(mockTask.recordToolError).toHaveBeenCalledWith('execute_command')
				expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith('execute_command', 'command')
				expect(mockPushToolResult).toHaveBeenCalledWith('Missing parameter error')
			})

			it('should handle empty command parameter', async () => {
				const block: ToolUse = {
					tool: 'execute_command',
					params: { command: '' },
					partial: false
				}

				mockTask.sayAndCreateMissingParamError.mockResolvedValue('Missing parameter error')

				await executeCommandTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

				expect(mockTask.consecutiveMistakeCount).toBe(1)
				expect(mockPushToolResult).toHaveBeenCalledWith('Missing parameter error')
			})
		})

		describe('Roo Ignore Validation', () => {
			it('should handle roo ignore violations', async () => {
				const block: ToolUse = {
					tool: 'execute_command',
					params: { command: 'cat secret.txt' },
					partial: false
				}

				const ignoredFile = 'secret.txt'
				mockTask.rooIgnoreController.validateCommand.mockReturnValue(ignoredFile)

				await executeCommandTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

				expect(mockTask.say).toHaveBeenCalledWith('rooignore_error', ignoredFile)
				expect(mockFormatResponse.rooIgnoreError).toHaveBeenCalledWith(ignoredFile)
				expect(mockPushToolResult).toHaveBeenCalledWith('Tool error response')
			})

			it('should proceed when no roo ignore violations', async () => {
				const block: ToolUse = {
					tool: 'execute_command',
					params: { command: 'ls -la' },
					partial: false
				}

				mockTask.rooIgnoreController.validateCommand.mockReturnValue(null)
				mockAskApproval.mockResolvedValue(true)

				await executeCommandTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

				expect(mockTask.consecutiveMistakeCount).toBe(0)
				expect(mockAskApproval).toHaveBeenCalledWith('command', 'ls -la')
			})
		})

		describe('User Approval', () => {
			it('should handle user approval rejection', async () => {
				const block: ToolUse = {
					tool: 'execute_command',
					params: { command: 'rm -rf /' },
					partial: false
				}

				mockAskApproval.mockResolvedValue(false)

				await executeCommandTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

				expect(mockAskApproval).toHaveBeenCalledWith('command', 'rm -rf /')
				expect(mockPushToolResult).not.toHaveBeenCalled()
			})

			it('should proceed with user approval', async () => {
				const block: ToolUse = {
					tool: 'execute_command',
					params: { command: 'echo hello' },
					partial: false
				}

				mockAskApproval.mockResolvedValue(true)

				await executeCommandTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

				expect(mockAskApproval).toHaveBeenCalledWith('command', 'echo hello')
				expect(mockPushToolResult).toHaveBeenCalled()
			})
		})

		describe('HTML Entity Unescaping', () => {
			it('should unescape HTML entities in command', async () => {
				const block: ToolUse = {
					tool: 'execute_command',
					params: { command: 'echo &quot;hello&quot;' },
					partial: false
				}

				mockUnescapeHtmlEntities.mockReturnValue('echo "hello"')
				mockAskApproval.mockResolvedValue(true)

				await executeCommandTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

				expect(mockUnescapeHtmlEntities).toHaveBeenCalledWith('echo &quot;hello&quot;')
				expect(mockAskApproval).toHaveBeenCalledWith('command', 'echo "hello"')
			})
		})

		describe('Shell Integration Error Handling', () => {
			it('should handle shell integration errors with fallback', async () => {
				const block: ToolUse = {
					tool: 'execute_command',
					params: { command: 'echo test' },
					partial: false
				}

				mockAskApproval.mockResolvedValue(true)

				// Mock executeCommand to throw ShellIntegrationError first, then succeed
				const executeCommandSpy = jest.spyOn(require('../executeCommandTool'), 'executeCommand')
				executeCommandSpy
					.mockRejectedValueOnce(new (class ShellIntegrationError extends Error {})('Shell integration failed'))
					.mockResolvedValueOnce([false, 'Command executed successfully'])

				await executeCommandTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

				expect(mockTask.say).toHaveBeenCalledWith('shell_integration_warning')
				expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
					type: 'commandExecutionStatus',
					text: expect.stringContaining('"status":"fallback"')
				})
				expect(mockPushToolResult).toHaveBeenCalledWith('Command executed successfully')

				executeCommandSpy.mockRestore()
			})

			it('should handle non-shell integration errors', async () => {
				const block: ToolUse = {
					tool: 'execute_command',
					params: { command: 'echo test' },
					partial: false
				}

				mockAskApproval.mockResolvedValue(true)

				const executeCommandSpy = jest.spyOn(require('../executeCommandTool'), 'executeCommand')
				executeCommandSpy.mockRejectedValueOnce(new Error('Generic error'))

				await executeCommandTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

				expect(mockPushToolResult).toHaveBeenCalledWith('Command failed to execute in terminal due to a shell integration error.')

				executeCommandSpy.mockRestore()
			})
		})

		describe('Error Handling', () => {
			it('should handle unexpected errors', async () => {
				const block: ToolUse = {
					tool: 'execute_command',
					params: { command: 'echo test' },
					partial: false
				}

				const error = new Error('Unexpected error')
				mockAskApproval.mockRejectedValue(error)

				await executeCommandTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

				expect(mockHandleError).toHaveBeenCalledWith('executing command', error)
			})
		})
	})

	describe('executeCommand function', () => {
		const defaultOptions: ExecuteCommandOptions = {
			executionId: 'test-execution-id',
			command: 'echo hello',
			terminalShellIntegrationDisabled: false,
			terminalOutputLineLimit: 500
		}

		describe('Working Directory Handling', () => {
			it('should use task cwd when no custom cwd provided', async () => {
				const [rejected, result] = await executeCommand(mockTask, defaultOptions)

				expect(mockFs.access).toHaveBeenCalledWith('/test/cwd')
				expect(mockTerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(
					'/test/cwd',
					false,
					'test-task-id',
					'vscode'
				)
			})

			it('should use absolute custom cwd when provided', async () => {
				const options = { ...defaultOptions, customCwd: '/custom/path' }

				const [rejected, result] = await executeCommand(mockTask, options)

				expect(mockFs.access).toHaveBeenCalledWith('/custom/path')
				expect(mockTerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(
					'/custom/path',
					true,
					'test-task-id',
					'vscode'
				)
			})

			it('should resolve relative custom cwd', async () => {
				const options = { ...defaultOptions, customCwd: 'relative/path' }

				const [rejected, result] = await executeCommand(mockTask, options)

				expect(mockFs.access).toHaveBeenCalledWith('/test/cwd/relative/path')
				expect(mockTerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(
					'/test/cwd/relative/path',
					true,
					'test-task-id',
					'vscode'
				)
			})

			it('should handle non-existent working directory', async () => {
				mockFs.access.mockRejectedValueOnce(new Error('Directory not found'))

				const [rejected, result] = await executeCommand(mockTask, defaultOptions)

				expect(rejected).toBe(false)
				expect(result).toBe("Working directory '/test/cwd' does not exist.")
			})
		})

		describe('Terminal Provider Selection', () => {
			it('should use vscode terminal when shell integration enabled', async () => {
				const options = { ...defaultOptions, terminalShellIntegrationDisabled: false }

				await executeCommand(mockTask, options)

				expect(mockTerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(
					expect.any(String),
					expect.any(Boolean),
					expect.any(String),
					'vscode'
				)
			})

			it('should use execa terminal when shell integration disabled', async () => {
				const options = { ...defaultOptions, terminalShellIntegrationDisabled: true }

				await executeCommand(mockTask, options)

				expect(mockTerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(
					expect.any(String),
					expect.any(Boolean),
					expect.any(String),
					'execa'
				)
			})
		})

		describe('Terminal Callbacks', () => {
			let capturedCallbacks: RooTerminalCallbacks

			beforeEach(() => {
				mockTerminal.runCommand.mockImplementation((command, callbacks) => {
					capturedCallbacks = callbacks
					return mockProcess as any
				})
			})

			it('should handle onLine callback with output accumulation', async () => {
				const executePromise = executeCommand(mockTask, defaultOptions)

				// Simulate onLine callback
				const mockProcess = { continue: jest.fn() } as any
				await capturedCallbacks.onLine?.('test output\n', mockProcess)

				expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
					type: 'commandExecutionStatus',
					text: expect.stringContaining('"status":"output"')
				})
			})

			it('should handle onCompleted callback', async () => {
				const executePromise = executeCommand(mockTask, defaultOptions)

				// Simulate onCompleted callback
				capturedCallbacks.onCompleted?.('Command completed successfully')

				expect(mockTask.say).toHaveBeenCalledWith('command_output', 'Command completed successfully')
			})

			it('should handle onShellExecutionStarted callback', async () => {
				const executePromise = executeCommand(mockTask, defaultOptions)

				// Simulate onShellExecutionStarted callback
				capturedCallbacks.onShellExecutionStarted?.(12345)

				expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
					type: 'commandExecutionStatus',
					text: expect.stringContaining('"status":"started"')
				})
			})

			it('should handle onShellExecutionComplete callback', async () => {
				const executePromise = executeCommand(mockTask, defaultOptions)

				const exitDetails: ExitCodeDetails = { exitCode: 0 }
				capturedCallbacks.onShellExecutionComplete?.(exitDetails)

				expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
					type: 'commandExecutionStatus',
					text: expect.stringContaining('"status":"exited"')
				})
			})

			it('should handle onNoShellIntegration callback for vscode terminal', async () => {
				const executePromise = executeCommand(mockTask, defaultOptions)

				// Simulate onNoShellIntegration callback
				await capturedCallbacks.onNoShellIntegration?.('Shell integration failed')

				expect(mockTelemetryService.captureShellIntegrationError).toHaveBeenCalledWith('test-task-id')
			})
		})

		describe('Command Execution Results', () => {
			it('should handle successful command completion', async () => {
				// Mock completed execution
				mockTerminal.runCommand.mockImplementation((command, callbacks) => {
					setTimeout(() => {
						callbacks.onCompleted?.('Command output')
						callbacks.onShellExecutionComplete?.({ exitCode: 0 })
					}, 0)
					return Promise.resolve()
				})

				const [rejected, result] = await executeCommand(mockTask, defaultOptions)

				expect(rejected).toBe(false)
				expect(result).toContain('Exit code: 0')
				expect(result).toContain('Command output')
			})

			it('should handle command with non-zero exit code', async () => {
				mockTerminal.runCommand.mockImplementation((command, callbacks) => {
					setTimeout(() => {
						callbacks.onCompleted?.('Error output')
						callbacks.onShellExecutionComplete?.({ exitCode: 1 })
					}, 0)
					return Promise.resolve()
				})

				const [rejected, result] = await executeCommand(mockTask, defaultOptions)

				expect(rejected).toBe(false)
				expect(result).toContain('Command execution was not successful')
				expect(result).toContain('Exit code: 1')
			})

			it('should handle command terminated by signal', async () => {
				mockTerminal.runCommand.mockImplementation((command, callbacks) => {
					setTimeout(() => {
						callbacks.onCompleted?.('Terminated')
						callbacks.onShellExecutionComplete?.({
							signalName: 'SIGTERM',
							coreDumpPossible: true
						})
					}, 0)
					return Promise.resolve()
				})

				const [rejected, result] = await executeCommand(mockTask, defaultOptions)

				expect(rejected).toBe(false)
				expect(result).toContain('Process terminated by signal SIGTERM')
				expect(result).toContain('core dump possible')
			})

			it('should handle undefined exit code', async () => {
				mockTerminal.runCommand.mockImplementation((command, callbacks) => {
					setTimeout(() => {
						callbacks.onCompleted?.('Unknown status')
						callbacks.onShellExecutionComplete?.({ exitCode: undefined })
					}, 0)
					return Promise.resolve()
				})

				const [rejected, result] = await executeCommand(mockTask, defaultOptions)

				expect(rejected).toBe(false)
				expect(result).toContain('Exit code: <undefined, notify user>')
			})
		})

		describe('Working Directory Changes', () => {
			it('should detect and report working directory changes', async () => {
				mockTerminal.getCurrentWorkingDirectory
					.mockReturnValueOnce('/test/cwd')  // Initial
					.mockReturnValueOnce('/new/cwd')   // After command

				mockTerminal.runCommand.mockImplementation((command, callbacks) => {
					setTimeout(() => {
						callbacks.onCompleted?.('Directory changed')
						callbacks.onShellExecutionComplete?.({ exitCode: 0 })
					}, 0)
					return Promise.resolve()
				})

				const [rejected, result] = await executeCommand(mockTask, defaultOptions)

				expect(result).toContain('NOTICE: Your command changed the working directory')
				expect(result).toContain('/new/cwd')
			})
		})

		describe('User Feedback Handling', () => {
			it('should handle user feedback during command execution', async () => {
				mockTask.ask.mockResolvedValueOnce({
					response: 'messageResponse',
					text: 'User feedback',
					images: ['image1.png']
				})

				mockTerminal.runCommand.mockImplementation((command, callbacks) => {
					setTimeout(async () => {
						await callbacks.onLine?.('Some output\n', { continue: jest.fn() } as any)
					}, 0)
					return Promise.resolve()
				})

				const [rejected, result] = await executeCommand(mockTask, defaultOptions)

				expect(rejected).toBe(true)
				expect(mockTask.say).toHaveBeenCalledWith('user_feedback', 'User feedback', ['image1.png'])
				expect(result).toContain('The user provided the following feedback')
			})
		})

		describe('Edge Cases', () => {
			it('should handle terminal process assignment', async () => {
				const mockProcessPromise = Promise.resolve()
				mockTerminal.runCommand.mockReturnValue(mockProcessPromise)

				const executePromise = executeCommand(mockTask, defaultOptions)

				// Verify process is assigned
				expect(mockTask.terminalProcess).toBe(mockProcessPromise)

				await executePromise

				// Verify process is cleared after completion
				expect(mockTask.terminalProcess).toBeUndefined()
			})

			it('should handle Terminal instance vs other terminal types', async () => {
				const terminalInstance = new Terminal({} as any, {} as any, {} as any)
				terminalInstance.terminal = { show: jest.fn() } as any
				terminalInstance.getCurrentWorkingDirectory = jest.fn().mockReturnValue('/terminal/cwd')

				mockTerminalRegistry.getOrCreateTerminal.mockResolvedValueOnce(terminalInstance as any)

				await executeCommand(mockTask, defaultOptions)

				expect(terminalInstance.terminal.show).toHaveBeenCalledWith(true)
			})
		})
	})
})
