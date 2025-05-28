/**
 * FlowModelDropdown Tests
 * 
 * Tests for the FlowModelDropdown component
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { FlowModelDropdown, useFlowModelDropdown, type FlowModelDropdownProps } from '../FlowModelDropdown'
import { renderHook } from '@testing-library/react'
import type { ModelOption } from '../useFlowModelFetcher'

// Mock VSCode components
jest.mock('@vscode/webview-ui-toolkit/react', () => ({
	VSCodeDropdown: ({ children, onChange, value, disabled, ...props }: any) => (
		<select 
			data-testid="vscode-dropdown" 
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
	VSCodeProgressRing: () => <div data-testid="progress-ring">Loading...</div>
}))

describe('FlowModelDropdown', () => {
	const mockModels: ModelOption[] = [
		{
			value: 'gpt-4o',
			label: 'azure-openai - gpt-4o (Context: 128,000 tokens)',
			provider: 'azure-openai'
		},
		{
			value: 'gpt-4o-mini',
			label: 'azure-openai - gpt-4o-mini (Context: 128,000 tokens)',
			provider: 'azure-openai'
		},
		{
			value: 'anthropic.claude-3-sonnet',
			label: 'amazon-bedrock - anthropic.claude-3-sonnet (Context: 200,000 tokens)',
			provider: 'amazon-bedrock'
		},
		{
			value: 'text-embedding-ada-002',
			label: 'azure-openai - text-embedding-ada-002 (hardcoded)',
			provider: 'azure-openai'
		}
	]

	const defaultProps: FlowModelDropdownProps = {
		selectedModel: '',
		models: mockModels,
		isLoading: false,
		disabled: false,
		isConfigComplete: true,
		isUsingCache: false,
		onModelChange: jest.fn(),
		placeholder: 'Select a model...'
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe('Rendering', () => {
		it('should render dropdown with models', () => {
			render(<FlowModelDropdown {...defaultProps} />)
			
			expect(screen.getByTestId('vscode-dropdown')).toBeInTheDocument()
			expect(screen.getByText('Select a model...')).toBeInTheDocument()
			expect(screen.getByText('azure-openai - gpt-4o (Context: 128,000 tokens)')).toBeInTheDocument()
		})

		it('should render label and help text', () => {
			render(<FlowModelDropdown {...defaultProps} />)
			
			expect(screen.getByText('Modelo')).toBeInTheDocument()
			expect(screen.getByText('(Selecione o modelo a ser usado)')).toBeInTheDocument()
			expect(screen.getByText(/Os modelos são agrupados por provider/)).toBeInTheDocument()
		})

		it('should show loading indicator when loading', () => {
			render(<FlowModelDropdown {...defaultProps} isLoading={true} />)
			
			expect(screen.getByTestId('progress-ring')).toBeInTheDocument()
		})

		it('should show cache indicator when using cache', () => {
			render(<FlowModelDropdown {...defaultProps} isUsingCache={true} isLoading={true} />)
			
			expect(screen.getByText('(cache)')).toBeInTheDocument()
		})

		it('should group models by provider', () => {
			render(<FlowModelDropdown {...defaultProps} />)
			
			// Should have azure-openai models first (non-hardcoded), then hardcoded
			const options = screen.getAllByRole('option')
			const modelOptions = options.slice(1) // Skip placeholder
			
			expect(modelOptions[0]).toHaveTextContent('gpt-4o')
			expect(modelOptions[1]).toHaveTextContent('gpt-4o-mini')
			// Hardcoded should come after non-hardcoded
			expect(modelOptions[2]).toHaveTextContent('text-embedding-ada-002')
		})
	})

	describe('Interaction', () => {
		it('should call onModelChange when model is selected', () => {
			const mockOnModelChange = jest.fn()
			render(<FlowModelDropdown {...defaultProps} onModelChange={mockOnModelChange} />)
			
			const dropdown = screen.getByTestId('vscode-dropdown')
			fireEvent.change(dropdown, { target: { value: 'gpt-4o' } })
			
			expect(mockOnModelChange).toHaveBeenCalledWith('gpt-4o')
		})

		it('should not call onModelChange when disabled', () => {
			const mockOnModelChange = jest.fn()
			render(<FlowModelDropdown {...defaultProps} disabled={true} onModelChange={mockOnModelChange} />)
			
			const dropdown = screen.getByTestId('vscode-dropdown')
			expect(dropdown).toBeDisabled()
		})

		it('should be disabled when config is incomplete', () => {
			render(<FlowModelDropdown {...defaultProps} isConfigComplete={false} />)
			
			const dropdown = screen.getByTestId('vscode-dropdown')
			expect(dropdown).toBeDisabled()
		})

		it('should be disabled when loading', () => {
			render(<FlowModelDropdown {...defaultProps} isLoading={true} />)
			
			const dropdown = screen.getByTestId('vscode-dropdown')
			expect(dropdown).toBeDisabled()
		})
	})

	describe('Selected Model', () => {
		it('should show selected model', () => {
			render(<FlowModelDropdown {...defaultProps} selectedModel="gpt-4o" />)
			
			const dropdown = screen.getByTestId('vscode-dropdown')
			expect(dropdown).toHaveValue('gpt-4o')
		})

		it('should handle empty selected model', () => {
			render(<FlowModelDropdown {...defaultProps} selectedModel="" />)
			
			const dropdown = screen.getByTestId('vscode-dropdown')
			expect(dropdown).toHaveValue('')
		})

		it('should handle undefined selected model', () => {
			render(<FlowModelDropdown {...defaultProps} selectedModel={undefined} />)
			
			const dropdown = screen.getByTestId('vscode-dropdown')
			expect(dropdown).toHaveValue('')
		})
	})

	describe('Accessibility', () => {
		it('should have proper accessibility attributes', () => {
			render(<FlowModelDropdown {...defaultProps} />)
			
			const dropdown = screen.getByTestId('vscode-dropdown')
			expect(dropdown).toHaveAttribute('aria-label', 'Seleção de modelo Flow')
			expect(dropdown).toHaveAttribute('aria-describedby', 'model-dropdown-help')
		})

		it('should mark as invalid when no model selected and models available', () => {
			render(<FlowModelDropdown {...defaultProps} selectedModel="" />)
			
			const dropdown = screen.getByTestId('vscode-dropdown')
			expect(dropdown).toHaveAttribute('aria-invalid', 'true')
		})

		it('should not mark as invalid when model is selected', () => {
			render(<FlowModelDropdown {...defaultProps} selectedModel="gpt-4o" />)
			
			const dropdown = screen.getByTestId('vscode-dropdown')
			expect(dropdown).toHaveAttribute('aria-invalid', 'false')
		})
	})

	describe('Empty States', () => {
		it('should handle empty models list', () => {
			render(<FlowModelDropdown {...defaultProps} models={[]} />)
			
			expect(screen.getByTestId('vscode-dropdown')).toBeInTheDocument()
			expect(screen.getByText('Select a model...')).toBeInTheDocument()
		})

		it('should use custom placeholder', () => {
			render(<FlowModelDropdown {...defaultProps} placeholder="Custom placeholder" />)
			
			expect(screen.getByText('Custom placeholder')).toBeInTheDocument()
		})
	})
})

describe('useFlowModelDropdown hook', () => {
	const mockModels: ModelOption[] = [
		{
			value: 'gpt-4o',
			label: 'azure-openai - gpt-4o (Context: 128,000 tokens)',
			provider: 'azure-openai'
		},
		{
			value: 'text-embedding-ada-002',
			label: 'azure-openai - text-embedding-ada-002 (hardcoded)',
			provider: 'azure-openai'
		},
		{
			value: 'anthropic.claude-3-sonnet',
			label: 'amazon-bedrock - anthropic.claude-3-sonnet (Context: 200,000 tokens)',
			provider: 'amazon-bedrock'
		}
	]

	it('should return model statistics', () => {
		const { result } = renderHook(() => useFlowModelDropdown(mockModels, 'gpt-4o'))
		
		expect(result.current.modelStats.totalModels).toBe(3)
		expect(result.current.modelStats.providers).toContain('azure-openai')
		expect(result.current.modelStats.providers).toContain('amazon-bedrock')
		expect(result.current.modelStats.hardcodedCount).toBe(1)
		expect(result.current.modelStats.apiCount).toBe(2)
	})

	it('should validate selected model', () => {
		const { result } = renderHook(() => useFlowModelDropdown(mockModels, 'gpt-4o'))
		
		expect(result.current.isSelectedModelValid).toBe(true)
		expect(result.current.selectedModelDetails).toEqual(mockModels[0])
	})

	it('should handle invalid selected model', () => {
		const { result } = renderHook(() => useFlowModelDropdown(mockModels, 'invalid-model'))
		
		expect(result.current.isSelectedModelValid).toBe(false)
		expect(result.current.selectedModelDetails).toBeNull()
	})

	it('should filter models by provider', () => {
		const { result } = renderHook(() => useFlowModelDropdown(mockModels))
		
		const azureModels = result.current.getModelsByProvider('azure-openai')
		expect(azureModels).toHaveLength(2)
		expect(azureModels.every(m => m.provider === 'azure-openai')).toBe(true)
	})

	it('should separate hardcoded and non-hardcoded models', () => {
		const { result } = renderHook(() => useFlowModelDropdown(mockModels))
		
		const nonHardcoded = result.current.getNonHardcodedModels()
		const hardcoded = result.current.getHardcodedModels()
		
		expect(nonHardcoded).toHaveLength(2)
		expect(hardcoded).toHaveLength(1)
		expect(hardcoded[0].value).toBe('text-embedding-ada-002')
	})

	it('should handle empty models list', () => {
		const { result } = renderHook(() => useFlowModelDropdown([]))
		
		expect(result.current.modelStats.totalModels).toBe(0)
		expect(result.current.modelStats.providers).toHaveLength(0)
		expect(result.current.isSelectedModelValid).toBe(false)
	})
})
