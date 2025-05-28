/**
 * FlowModelSelector Integration Tests
 * 
 * Integration tests for the refactored FlowModelSelector component
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FlowModelSelector, useFlowModelSelector } from '../FlowModelSelector'
import { renderHook, act } from '@testing-library/react'
import type { FlowConfig } from '../FlowConfigValidator'

// Mock dependencies
jest.mock('@src/i18n/TranslationContext', () => ({
	useAppTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('@src/utils/flowModelCache', () => ({
	flowModelCache: {
		getCachedModels: jest.fn(() => null),
		cacheModels: jest.fn(),
		getCacheInfo: jest.fn(() => ({ age: 5, expiresIn: 55 }))
	}
}))

jest.mock('@src/utils/vscode', () => ({
	vscode: {
		postMessage: jest.fn()
	}
}))

// Mock VSCode components
jest.mock('@vscode/webview-ui-toolkit/react', () => ({
	VSCodeDropdown: ({ children, onChange, value, disabled, ...props }: any) => (
		<select 
			data-testid="model-dropdown" 
			onChange={onChange} 
			value={value} 
			disabled={disabled}
			{...props}
		>
			{children}
		</select>
	),
	VSCodeOption: ({ children, value }: any) => (
		<option value={value}>{children}</option>
	),
	VSCodeProgressRing: () => <div data-testid="progress-ring">Loading...</div>,
	VSCodeButton: ({ children, onClick, disabled, ...props }: any) => (
		<button onClick={onClick} disabled={disabled} {...props}>
			{children}
		</button>
	)
}))

// Mock extracted components
jest.mock('../FlowModelDropdown', () => ({
	FlowModelDropdown: ({ selectedModel, models, onModelChange, isLoading, disabled }: any) => (
		<div data-testid="flow-model-dropdown">
			<select 
				data-testid="model-dropdown"
				value={selectedModel || ''}
				onChange={(e) => onModelChange(e.target.value)}
				disabled={disabled || isLoading}
			>
				<option value="">Select a model...</option>
				{models.map((model: any) => (
					<option key={model.value} value={model.value}>
						{model.label}
					</option>
				))}
			</select>
		</div>
	)
}))

jest.mock('../FlowModelStatus', () => ({
	FlowModelStatus: ({ models, error, isLoading, onRetry, onRefresh }: any) => (
		<div data-testid="flow-model-status">
			{isLoading && <div data-testid="loading-status">Loading models...</div>}
			{error && <div data-testid="error-status">{error}</div>}
			{models.length > 0 && !error && (
				<div data-testid="success-status">{models.length} models loaded</div>
			)}
			{error && <button onClick={onRetry} data-testid="retry-button">Retry</button>}
			<button onClick={onRefresh} data-testid="refresh-button">Refresh</button>
		</div>
	)
}))

describe('FlowModelSelector Integration', () => {
	const validConfig: FlowConfig = {
		flowBaseUrl: 'https://flow.ciandt.com',
		flowTenant: 'test-tenant',
		flowClientId: 'test-client-id',
		flowClientSecret: 'test-client-secret',
		flowAuthBaseUrl: 'https://auth.flow.ciandt.com',
		flowAppToAccess: 'llm-api'
	}

	const incompleteConfig: FlowConfig = {
		flowTenant: 'test-tenant',
		flowClientId: 'test-client-id'
		// Missing flowClientSecret
	}

	const mockModels = [
		{
			value: 'gpt-4o',
			label: 'azure-openai - gpt-4o (Context: 128,000 tokens)',
			provider: 'azure-openai'
		},
		{
			value: 'anthropic.claude-3-sonnet',
			label: 'amazon-bedrock - anthropic.claude-3-sonnet (Context: 200,000 tokens)',
			provider: 'amazon-bedrock'
		}
	]

	const defaultProps = {
		selectedModel: '',
		onModelChange: jest.fn(),
		flowConfig: validConfig,
		disabled: false
	}

	beforeEach(() => {
		jest.clearAllMocks()
		
		// Mock successful model fetching
		const mockPostMessage = require('@src/utils/vscode').vscode.postMessage
		mockPostMessage.mockImplementation(() => {
			// Simulate async response
			setTimeout(() => {
				window.dispatchEvent(new MessageEvent('message', {
					data: {
						type: 'fetchFlowModelsResult',
						success: true,
						models: mockModels
					}
				}))
			}, 100)
		})
	})

	describe('Component Integration', () => {
		it('should render all sub-components', () => {
			render(<FlowModelSelector {...defaultProps} />)
			
			expect(screen.getByTestId('flow-model-dropdown')).toBeInTheDocument()
			expect(screen.getByTestId('flow-model-status')).toBeInTheDocument()
		})

		it('should show configuration warning for incomplete config', () => {
			render(<FlowModelSelector {...defaultProps} flowConfig={incompleteConfig} />)
			
			expect(screen.getByText(/Preencha o campo Client Secret/)).toBeInTheDocument()
		})

		it('should auto-load models on mount with complete config', async () => {
			const mockPostMessage = require('@src/utils/vscode').vscode.postMessage
			
			render(<FlowModelSelector {...defaultProps} />)
			
			await waitFor(() => {
				expect(mockPostMessage).toHaveBeenCalledWith({
					type: 'fetchFlowModels',
					config: expect.objectContaining({
						flowTenant: 'test-tenant',
						flowClientId: 'test-client-id',
						flowClientSecret: 'test-client-secret'
					})
				})
			})
		})

		it('should not auto-load models with incomplete config', () => {
			const mockPostMessage = require('@src/utils/vscode').vscode.postMessage
			
			render(<FlowModelSelector {...defaultProps} flowConfig={incompleteConfig} />)
			
			expect(mockPostMessage).not.toHaveBeenCalled()
		})
	})

	describe('Model Selection Flow', () => {
		it('should handle model selection', async () => {
			const mockOnModelChange = jest.fn()
			
			render(<FlowModelSelector {...defaultProps} onModelChange={mockOnModelChange} />)
			
			// Wait for models to load
			await waitFor(() => {
				expect(screen.getByTestId('success-status')).toBeInTheDocument()
			})
			
			// Select a model
			const dropdown = screen.getByTestId('model-dropdown')
			fireEvent.change(dropdown, { target: { value: 'gpt-4o' } })
			
			expect(mockOnModelChange).toHaveBeenCalledWith('gpt-4o')
		})

		it('should validate invalid Anthropic model and suggest Flow equivalent', async () => {
			const mockOnModelChange = jest.fn()
			
			render(
				<FlowModelSelector 
					{...defaultProps} 
					selectedModel="claude-3-5-sonnet-20241022"
					onModelChange={mockOnModelChange} 
				/>
			)
			
			// Wait for models to load and validation to occur
			await waitFor(() => {
				expect(mockOnModelChange).toHaveBeenCalledWith('anthropic.claude-3-sonnet')
			})
		})

		it('should respect user selection even for non-existing models', async () => {
			const mockOnModelChange = jest.fn()
			
			render(<FlowModelSelector {...defaultProps} onModelChange={mockOnModelChange} />)
			
			// Wait for models to load
			await waitFor(() => {
				expect(screen.getByTestId('success-status')).toBeInTheDocument()
			})
			
			// User selects a custom model
			const dropdown = screen.getByTestId('model-dropdown')
			fireEvent.change(dropdown, { target: { value: 'custom-model' } })
			
			expect(mockOnModelChange).toHaveBeenCalledWith('custom-model')
		})
	})

	describe('Error Handling', () => {
		it('should handle fetch errors gracefully', async () => {
			const mockPostMessage = require('@src/utils/vscode').vscode.postMessage
			mockPostMessage.mockImplementation(() => {
				setTimeout(() => {
					window.dispatchEvent(new MessageEvent('message', {
						data: {
							type: 'fetchFlowModelsResult',
							success: false,
							error: 'Network error'
						}
					}))
				}, 100)
			})
			
			render(<FlowModelSelector {...defaultProps} />)
			
			await waitFor(() => {
				expect(screen.getByTestId('error-status')).toHaveTextContent('Network error')
			})
		})

		it('should allow retry after error', async () => {
			const mockPostMessage = require('@src/utils/vscode').vscode.postMessage
			mockPostMessage.mockImplementation(() => {
				setTimeout(() => {
					window.dispatchEvent(new MessageEvent('message', {
						data: {
							type: 'fetchFlowModelsResult',
							success: false,
							error: 'Network error'
						}
					}))
				}, 100)
			})
			
			render(<FlowModelSelector {...defaultProps} />)
			
			await waitFor(() => {
				expect(screen.getByTestId('error-status')).toBeInTheDocument()
			})
			
			// Click retry
			const retryButton = screen.getByTestId('retry-button')
			fireEvent.click(retryButton)
			
			expect(mockPostMessage).toHaveBeenCalledTimes(2)
		})
	})

	describe('Configuration Changes', () => {
		it('should reset validation when configuration changes', async () => {
			const { rerender } = render(<FlowModelSelector {...defaultProps} />)
			
			// Wait for initial load
			await waitFor(() => {
				expect(screen.getByTestId('success-status')).toBeInTheDocument()
			})
			
			// Change configuration
			const newConfig = { ...validConfig, flowTenant: 'new-tenant' }
			rerender(<FlowModelSelector {...defaultProps} flowConfig={newConfig} />)
			
			// Should trigger new fetch
			await waitFor(() => {
				expect(require('@src/utils/vscode').vscode.postMessage).toHaveBeenCalledWith({
					type: 'fetchFlowModels',
					config: expect.objectContaining({
						flowTenant: 'new-tenant'
					})
				})
			})
		})
	})
})

describe('useFlowModelSelector hook', () => {
	const validConfig: FlowConfig = {
		flowTenant: 'test-tenant',
		flowClientId: 'test-client-id',
		flowClientSecret: 'test-client-secret'
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it('should provide selector state', () => {
		const { result } = renderHook(() => useFlowModelSelector(validConfig, 'gpt-4o'))
		
		expect(result.current.configValidator).toBeDefined()
		expect(result.current.modelFetcher).toBeDefined()
		expect(result.current.selectorState).toBeDefined()
		expect(typeof result.current.reloadModels).toBe('function')
		expect(typeof result.current.clearState).toBe('function')
	})

	it('should indicate readiness when config is complete and models are loaded', () => {
		const { result } = renderHook(() => useFlowModelSelector(validConfig))
		
		expect(result.current.selectorState.isReady).toBe(false) // No models loaded yet
		expect(result.current.selectorState.configIssues).toHaveLength(0)
	})

	it('should identify config issues', () => {
		const incompleteConfig: FlowConfig = { flowTenant: 'test-tenant' }
		const { result } = renderHook(() => useFlowModelSelector(incompleteConfig))
		
		expect(result.current.selectorState.configIssues.length).toBeGreaterThan(0)
		expect(result.current.selectorState.configIssues).toContain('flowClientId')
		expect(result.current.selectorState.configIssues).toContain('flowClientSecret')
	})

	it('should provide reload and clear functions', () => {
		const { result } = renderHook(() => useFlowModelSelector(validConfig))
		
		act(() => {
			result.current.reloadModels()
			result.current.clearState()
		})
		
		// Functions should execute without errors
		expect(result.current.reloadModels).toBeDefined()
		expect(result.current.clearState).toBeDefined()
	})
})
