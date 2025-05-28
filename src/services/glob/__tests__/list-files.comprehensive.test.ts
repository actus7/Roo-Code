/**
 * Comprehensive Tests for List Files Service
 *
 * This test suite provides extensive coverage for the list-files.ts module,
 * including all functions and edge cases.
 */

import os from "os"
import * as childProcess from "child_process"
import * as vscode from "vscode"

// Mock all external dependencies first
jest.mock("os")
jest.mock("fs/promises")
jest.mock("child_process")
jest.mock("vscode")
jest.mock("../../../utils/path")
jest.mock("../../../services/ripgrep")

import { listFiles } from '../list-files'
import { arePathsEqual } from '../../../utils/path'
import { getBinPath } from '../../../services/ripgrep'

describe('List Files Service', () => {
	// Mock instances
	const mockOs = os as jest.Mocked<typeof os>
	const mockChildProcess = childProcess as jest.Mocked<typeof childProcess>
	const mockVscode = vscode as jest.Mocked<typeof vscode>
	const mockArePathsEqual = arePathsEqual as jest.MockedFunction<typeof arePathsEqual>
	const mockGetBinPath = getBinPath as jest.MockedFunction<typeof getBinPath>

	// Mock process object
	const mockProcess = {
		stdout: {
			on: jest.fn()
		},
		stderr: {
			on: jest.fn()
		},
		on: jest.fn(),
		kill: jest.fn()
	}

	beforeEach(() => {
		jest.clearAllMocks()
		jest.useFakeTimers()

		// Setup default mocks
		mockOs.homedir.mockReturnValue('/home/user')
		mockVscode.env = { appRoot: '/vscode/app' } as any
		mockGetBinPath.mockResolvedValue('/usr/bin/rg')
		mockArePathsEqual.mockReturnValue(false)

		// Mock fs.promises
		const mockFsPromises = {
			access: jest.fn().mockResolvedValue(undefined),
			readFile: jest.fn().mockResolvedValue(''),
			readdir: jest.fn().mockResolvedValue([])
		}
		mockFs.promises = mockFsPromises as any

		// Mock child_process.spawn
		mockChildProcess.spawn.mockReturnValue(mockProcess as any)

		// Setup process event handlers
		mockProcess.stdout.on.mockImplementation((event, callback) => {
			if (event === 'data') {
				// Simulate some file output
				setTimeout(() => callback('file1.txt\nfile2.js\n'), 0)
			}
			return mockProcess.stdout as any
		})

		mockProcess.on.mockImplementation((event, callback) => {
			if (event === 'close') {
				setTimeout(() => callback(0), 10)
			} else if (event === 'error') {
				// Don't trigger error by default
			}
			return mockProcess as any
		})
	})

	afterEach(() => {
		jest.useRealTimers()
	})

	describe('listFiles main function', () => {
		describe('Special Directory Handling', () => {
			it('should handle root directory', async () => {
				mockArePathsEqual.mockReturnValueOnce(true) // isRoot = true

				const [files, limitReached] = await listFiles('/', false, 100)

				expect(files).toEqual(['/'])
				expect(limitReached).toBe(false)
			})

			it('should handle home directory', async () => {
				mockArePathsEqual
					.mockReturnValueOnce(false) // isRoot = false
					.mockReturnValueOnce(true)  // isHomeDir = true

				const [files, limitReached] = await listFiles('/home/user', false, 100)

				expect(files).toEqual(['/home/user'])
				expect(limitReached).toBe(false)
			})

			it('should handle Windows root directory', async () => {
				const originalPlatform = process.platform
				Object.defineProperty(process, 'platform', { value: 'win32' })

				mockArePathsEqual.mockReturnValueOnce(true) // isRoot = true

				const [files, limitReached] = await listFiles('C:\\', false, 100)

				expect(files).toEqual(['C:\\'])
				expect(limitReached).toBe(false)

				Object.defineProperty(process, 'platform', { value: originalPlatform })
			})
		})

		describe('Normal Directory Processing', () => {
			it('should list files in non-recursive mode', async () => {
				mockArePathsEqual.mockReturnValue(false) // Not special directory

				const [files, limitReached] = await listFiles('/test/dir', false, 100)

				expect(mockGetBinPath).toHaveBeenCalledWith('/vscode/app')
				expect(mockChildProcess.spawn).toHaveBeenCalledWith('/usr/bin/rg', expect.arrayContaining([
					'--files',
					'--hidden',
					'-g', '*',
					'--maxdepth', '1',
					'--no-ignore-vcs'
				]))
				expect(files).toContain('file1.txt')
				expect(files).toContain('file2.js')
			})

			it('should list files in recursive mode', async () => {
				mockArePathsEqual.mockReturnValue(false)

				const [files, limitReached] = await listFiles('/test/dir', true, 100)

				expect(mockChildProcess.spawn).toHaveBeenCalledWith('/usr/bin/rg', expect.arrayContaining([
					'--files',
					'--hidden',
					'-g', '!**/node_modules/**',
					'-g', '!**/__pycache__/**'
				]))
			})

			it('should respect file limit', async () => {
				mockArePathsEqual.mockReturnValue(false)

				// Mock large output
				mockProcess.stdout.on.mockImplementation((event, callback) => {
					if (event === 'data') {
						const largeOutput = Array.from({length: 150}, (_, i) => `file${i}.txt`).join('\n')
						setTimeout(() => callback(largeOutput), 0)
					}
					return mockProcess.stdout as any
				})

				const [files, limitReached] = await listFiles('/test/dir', false, 100)

				expect(files.length).toBeLessThanOrEqual(100)
				expect(limitReached).toBe(true)
			})
		})

		describe('Error Handling', () => {
			it('should handle ripgrep binary not found', async () => {
				mockArePathsEqual.mockReturnValue(false)
				mockGetBinPath.mockResolvedValue(null)

				await expect(listFiles('/test/dir', false, 100)).rejects.toThrow('Could not find ripgrep binary')
			})

			it('should handle ripgrep process errors', async () => {
				mockArePathsEqual.mockReturnValue(false)

				mockProcess.on.mockImplementation((event, callback) => {
					if (event === 'error') {
						setTimeout(() => callback(new Error('Process failed')), 0)
					}
					return mockProcess as any
				})

				await expect(listFiles('/test/dir', false, 100)).rejects.toThrow('ripgrep process error: Process failed')
			})

			it('should handle ripgrep timeout', async () => {
				mockArePathsEqual.mockReturnValue(false)

				// Don't trigger close event to simulate hanging process
				mockProcess.on.mockImplementation((event, callback) => {
					// Don't call callback for 'close' event
					return mockProcess as any
				})

				const promise = listFiles('/test/dir', false, 100)

				// Fast-forward time to trigger timeout
				jest.advanceTimersByTime(10000)

				const [files, limitReached] = await promise

				expect(mockProcess.kill).toHaveBeenCalled()
				expect(files).toEqual([])
			})
		})

		describe('Gitignore Integration', () => {
			it('should parse gitignore file in recursive mode', async () => {
				mockArePathsEqual.mockReturnValue(false)

				const gitignoreContent = 'node_modules/\n*.log\n# comment\n\nbuild/'

				// Mock fs.promises methods
				const fs = require('fs')
				jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined)
				jest.spyOn(fs.promises, 'readFile').mockResolvedValue(gitignoreContent)

				await listFiles('/test/dir', true, 100)

				expect(fs.promises.access).toHaveBeenCalledWith('/test/dir/.gitignore')
				expect(fs.promises.readFile).toHaveBeenCalledWith('/test/dir/.gitignore', 'utf8')
			})

			it('should handle missing gitignore file', async () => {
				mockArePathsEqual.mockReturnValue(false)

				// Mock fs.promises.access to reject
				const fs = require('fs')
				jest.spyOn(fs.promises, 'access').mockRejectedValue(new Error('File not found'))

				const [files] = await listFiles('/test/dir', true, 100)

				// Should not throw error, just continue without gitignore
				expect(files).toBeDefined()
			})

			it('should handle gitignore read errors', async () => {
				mockArePathsEqual.mockReturnValue(false)

				// Mock fs.promises.readFile to reject
				const fs = require('fs')
				jest.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('Permission denied'))

				const [files] = await listFiles('/test/dir', true, 100)

				// Should not throw error, just continue without gitignore
				expect(files).toBeDefined()
			})
		})

		describe('Directory Filtering', () => {
			it('should include and filter directories correctly', async () => {
				mockArePathsEqual.mockReturnValue(false)

				const mockDirEntries = [
					{ name: 'src', isDirectory: () => true },
					{ name: 'node_modules', isDirectory: () => true },
					{ name: '.git', isDirectory: () => true },
					{ name: 'file.txt', isDirectory: () => false },
					{ name: 'docs', isDirectory: () => true }
				]

				// Mock fs.promises.readdir
				const fs = require('fs')
				jest.spyOn(fs.promises, 'readdir').mockResolvedValue(mockDirEntries as any)

				const [files] = await listFiles('/test/dir', false, 100)

				// Should include src/ and docs/ but exclude node_modules and .git
				const directories = files.filter(f => f.endsWith('/'))
				expect(directories).toContain('/test/dir/src/')
				expect(directories).toContain('/test/dir/docs/')
				expect(directories).not.toContain('/test/dir/node_modules/')
				expect(directories).not.toContain('/test/dir/.git/')
			})

			it('should handle directory listing errors', async () => {
				mockArePathsEqual.mockReturnValue(false)

				// Mock fs.promises.readdir to reject
				const fs = require('fs')
				jest.spyOn(fs.promises, 'readdir').mockRejectedValue(new Error('Permission denied'))

				const [files, limitReached] = await listFiles('/test/dir', false, 100)

				// Should not throw error, just continue without directories
				expect(files).toBeDefined()
			})
		})
	})

	describe('Helper Functions', () => {
		// Import the module to access internal functions for testing
		const listFilesModule = require('../list-files')

		describe('buildRipgrepArgs', () => {
			it('should build recursive args correctly', () => {
				const args = listFilesModule.buildRipgrepArgs?.('/test/dir', true) || []

				expect(args).toContain('--files')
				expect(args).toContain('--hidden')
				expect(args).toContain('-g')
				expect(args).toContain('!**/node_modules/**')
				expect(args).toContain('/test/dir')
			})

			it('should build non-recursive args correctly', () => {
				const args = listFilesModule.buildRipgrepArgs?.('/test/dir', false) || []

				expect(args).toContain('--files')
				expect(args).toContain('--hidden')
				expect(args).toContain('-g')
				expect(args).toContain('*')
				expect(args).toContain('--maxdepth')
				expect(args).toContain('1')
				expect(args).toContain('--no-ignore-vcs')
			})
		})

		describe('shouldIncludeDirectory', () => {
			it('should exclude hidden directories when configured', () => {
				const shouldInclude = listFilesModule.shouldIncludeDirectory?.('.hidden', false, [])
				expect(shouldInclude).toBe(false)
			})

			it('should exclude explicitly ignored directories', () => {
				const shouldInclude = listFilesModule.shouldIncludeDirectory?.('node_modules', false, [])
				expect(shouldInclude).toBe(false)
			})

			it('should include normal directories', () => {
				const shouldInclude = listFilesModule.shouldIncludeDirectory?.('src', false, [])
				expect(shouldInclude).toBe(true)
			})

			it('should respect gitignore patterns in recursive mode', () => {
				const gitignorePatterns = ['build/', 'dist']
				const shouldIncludeBuild = listFilesModule.shouldIncludeDirectory?.('build', true, gitignorePatterns)
				const shouldIncludeDist = listFilesModule.shouldIncludeDirectory?.('dist', true, gitignorePatterns)
				const shouldIncludeSrc = listFilesModule.shouldIncludeDirectory?.('src', true, gitignorePatterns)

				expect(shouldIncludeBuild).toBe(false)
				expect(shouldIncludeDist).toBe(false)
				expect(shouldIncludeSrc).toBe(true)
			})
		})

		describe('isDirectoryExplicitlyIgnored', () => {
			it('should detect exact name matches', () => {
				const isIgnored = listFilesModule.isDirectoryExplicitlyIgnored?.('node_modules')
				expect(isIgnored).toBe(true)
			})

			it('should detect path pattern matches', () => {
				const isIgnored = listFilesModule.isDirectoryExplicitlyIgnored?.('target')
				expect(isIgnored).toBe(true) // matches "target/dependency"
			})

			it('should not match non-ignored directories', () => {
				const isIgnored = listFilesModule.isDirectoryExplicitlyIgnored?.('src')
				expect(isIgnored).toBe(false)
			})
		})

		describe('isIgnoredByGitignore', () => {
			it('should match directory patterns ending with /', () => {
				const patterns = ['build/', 'dist/']
				const isBuildIgnored = listFilesModule.isIgnoredByGitignore?.('build', patterns)
				const isDistIgnored = listFilesModule.isIgnoredByGitignore?.('dist', patterns)
				const isSrcIgnored = listFilesModule.isIgnoredByGitignore?.('src', patterns)

				expect(isBuildIgnored).toBe(true)
				expect(isDistIgnored).toBe(true)
				expect(isSrcIgnored).toBe(false)
			})

			it('should match simple name patterns', () => {
				const patterns = ['*.log', 'temp']
				const isTempIgnored = listFilesModule.isIgnoredByGitignore?.('temp', patterns)
				const isSrcIgnored = listFilesModule.isIgnoredByGitignore?.('src', patterns)

				expect(isTempIgnored).toBe(true)
				expect(isSrcIgnored).toBe(false)
			})

			it('should match wildcard patterns', () => {
				const patterns = ['test*', '*cache*']
				const isTestDirIgnored = listFilesModule.isIgnoredByGitignore?.('test-dir', patterns)
				const isCacheIgnored = listFilesModule.isIgnoredByGitignore?.('mycache', patterns)
				const isSrcIgnored = listFilesModule.isIgnoredByGitignore?.('src', patterns)

				expect(isTestDirIgnored).toBe(true)
				expect(isCacheIgnored).toBe(true)
				expect(isSrcIgnored).toBe(false)
			})

			it('should handle global patterns with **/', () => {
				const patterns = ['**/node_modules/']
				const isIgnored = listFilesModule.isIgnoredByGitignore?.('node_modules', patterns)

				expect(isIgnored).toBe(true)
			})
		})

		describe('formatAndCombineResults', () => {
			it('should combine and sort files and directories', () => {
				const files = ['/test/file1.txt', '/test/file2.js']
				const directories = ['/test/src/', '/test/docs/']

				const [result, limitReached] = listFilesModule.formatAndCombineResults?.(files, directories, 100) || [[], false]

				expect(result).toHaveLength(4)
				// Directories should come first
				expect(result[0]).toBe('/test/docs/')
				expect(result[1]).toBe('/test/src/')
				expect(result[2]).toBe('/test/file1.txt')
				expect(result[3]).toBe('/test/file2.js')
				expect(limitReached).toBe(false)
			})

			it('should deduplicate paths', () => {
				const files = ['/test/file1.txt', '/test/src/']
				const directories = ['/test/src/', '/test/docs/']

				const [result, limitReached] = listFilesModule.formatAndCombineResults?.(files, directories, 100) || [[], false]

				expect(result).toHaveLength(3)
				expect(result.filter(p => p === '/test/src/')).toHaveLength(1)
			})

			it('should respect limit and indicate when reached', () => {
				const files = ['/test/file1.txt', '/test/file2.js', '/test/file3.py']
				const directories = ['/test/src/', '/test/docs/']

				const [result, limitReached] = listFilesModule.formatAndCombineResults?.(files, directories, 3) || [[], false]

				expect(result).toHaveLength(3)
				expect(limitReached).toBe(true)
			})
		})

		describe('execRipgrep', () => {
			it('should process ripgrep output correctly', async () => {
				const rgPath = '/usr/bin/rg'
				const args = ['--files', '/test/dir']

				// Mock process to return specific output
				mockProcess.stdout.on.mockImplementation((event, callback) => {
					if (event === 'data') {
						setTimeout(() => callback('file1.txt\nfile2.js\nfile3.py\n'), 0)
					}
					return mockProcess.stdout as any
				})

				const files = await listFilesModule.execRipgrep?.(rgPath, args, 100) || []

				expect(files).toContain('file1.txt')
				expect(files).toContain('file2.js')
				expect(files).toContain('file3.py')
			})

			it('should handle partial output on timeout', async () => {
				const rgPath = '/usr/bin/rg'
				const args = ['--files', '/test/dir']

				// Mock process that doesn't close
				mockProcess.on.mockImplementation((event, callback) => {
					// Don't trigger close event
					return mockProcess as any
				})

				mockProcess.stdout.on.mockImplementation((event, callback) => {
					if (event === 'data') {
						setTimeout(() => callback('file1.txt\nfile2.js\n'), 0)
					}
					return mockProcess.stdout as any
				})

				const promise = listFilesModule.execRipgrep?.(rgPath, args, 100) || Promise.resolve([])

				// Fast-forward time to trigger timeout
				jest.advanceTimersByTime(10000)

				const files = await promise

				expect(mockProcess.kill).toHaveBeenCalled()
				expect(files).toContain('file1.txt')
				expect(files).toContain('file2.js')
			})

			it('should handle stderr output gracefully', async () => {
				const rgPath = '/usr/bin/rg'
				const args = ['--files', '/test/dir']

				// Mock stderr output
				mockProcess.stderr.on.mockImplementation((event, callback) => {
					if (event === 'data') {
						setTimeout(() => callback('Warning: some warning'), 0)
					}
					return mockProcess.stderr as any
				})

				const files = await listFilesModule.execRipgrep?.(rgPath, args, 100) || []

				// Should not throw error, just log warning
				expect(files).toBeDefined()
			})

			it('should handle non-zero exit codes gracefully', async () => {
				const rgPath = '/usr/bin/rg'
				const args = ['--files', '/test/dir']

				// Mock non-zero exit code
				mockProcess.on.mockImplementation((event, callback) => {
					if (event === 'close') {
						setTimeout(() => callback(1), 10) // Exit code 1
					}
					return mockProcess as any
				})

				const files = await listFilesModule.execRipgrep?.(rgPath, args, 100) || []

				// Should not throw error, just log warning and return results
				expect(files).toBeDefined()
			})

			it('should stop processing when limit is reached', async () => {
				const rgPath = '/usr/bin/rg'
				const args = ['--files', '/test/dir']

				// Mock large output
				mockProcess.stdout.on.mockImplementation((event, callback) => {
					if (event === 'data') {
						const largeOutput = Array.from({length: 150}, (_, i) => `file${i}.txt`).join('\n')
						setTimeout(() => callback(largeOutput), 0)
					}
					return mockProcess.stdout as any
				})

				const files = await listFilesModule.execRipgrep?.(rgPath, args, 50) || []

				expect(files.length).toBeLessThanOrEqual(50)
				expect(mockProcess.kill).toHaveBeenCalled()
			})
		})
	})
})
