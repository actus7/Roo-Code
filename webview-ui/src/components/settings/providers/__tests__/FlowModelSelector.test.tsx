import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { FlowModelSelector } from "../FlowModelSelector"
import { vscode } from "@src/utils/vscode"

// Mock VSCode API
jest.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn()
	}
}))

// Mock VSCode UI Toolkit components
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeDropdown: ({ children, onChange, disabled, value, ...props }: any) => (
		<select
			data-testid="model-dropdown"
			onChange={(e) => onChange && onChange(e)}
			disabled={disabled}
			value={value || ""}
			{...props}
		>
			{children}
		</select>
	),
	VSCodeOption: ({ children, value, ...props }: any) => (
		<option value={value} {...props}>
			{children}
		</option>
	),
	VSCodeProgressRing: () => <div data-testid="loading-spinner">Loading...</div>
}))

// Mock translation context
jest.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key
	})
}))

// Mock flowModelCache
const mockFlowModelCache = {
	getCachedModels: jest.fn(),
	cacheModels: jest.fn(),
	clearCache: jest.fn(),
	getCacheInfo: jest.fn()
}

jest.mock("@src/utils/flowModelCache", () => ({
	flowModelCache: mockFlowModelCache,
	FlowModelCache: jest.fn().mockImplementation(() => mockFlowModelCache)
}))

const mockVscode = vscode as jest.Mocked<typeof vscode>

describe("FlowModelSelector", () => {
	const defaultProps = {
		selectedModel: "",
		onModelChange: jest.fn(),
		flowConfig: {
			flowTenant: "test-tenant",
			flowClientId: "test-client-id",
			flowClientSecret: "test-client-secret",
			flowBaseUrl: "https://test.flow.com"
		}
	}

	beforeEach(() => {
		jest.clearAllMocks()
		// Clear any existing event listeners
		window.removeEventListener = jest.fn()
		window.addEventListener = jest.fn()
		// Reset cache mock
		mockFlowModelCache.getCachedModels.mockReturnValue(null)
		mockFlowModelCache.getCacheInfo.mockReturnValue({
			hasCache: false,
			age: undefined,
			modelCount: undefined,
			expiresIn: undefined,
			configHash: undefined
		})
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	it("should render with default state", () => {
		render(<FlowModelSelector {...defaultProps} />)

		expect(screen.getByText("Modelo")).toBeInTheDocument()
		expect(screen.getByTestId("model-dropdown")).toBeInTheDocument()
		expect(screen.getByText("Selecione um modelo...")).toBeInTheDocument()
	})

	it("should show warning when configuration is incomplete", () => {
		const incompleteConfig = {
			...defaultProps,
			flowConfig: {
				flowTenant: "test-tenant",
				// Missing clientId and clientSecret
			}
		}

		render(<FlowModelSelector {...incompleteConfig} />)

		expect(screen.getByText(/Preencha os campos obrigatórios/)).toBeInTheDocument()
		expect(screen.getByTestId("model-dropdown")).toBeDisabled()
	})

	it("should fetch models when configuration is complete", async () => {
		render(<FlowModelSelector {...defaultProps} />)

		await waitFor(() => {
			expect(mockVscode.postMessage).toHaveBeenCalledWith({
				type: "fetchFlowModels",
				config: expect.objectContaining({
					flowTenant: "test-tenant",
					flowClientId: "test-client-id",
					flowClientSecret: "test-client-secret",
					flowBaseUrl: "https://test.flow.com"
				})
			})
		})
	})

	it("should be disabled when disabled prop is true", () => {
		const props = {
			...defaultProps,
			disabled: true
		}

		render(<FlowModelSelector {...props} />)

		expect(screen.getByTestId("model-dropdown")).toBeDisabled()
	})

	it("should not fetch models if configuration hasn't changed", () => {
		const { rerender } = render(<FlowModelSelector {...defaultProps} />)

		// Clear the initial call
		mockVscode.postMessage.mockClear()

		// Re-render with same config
		rerender(<FlowModelSelector {...defaultProps} />)

		// Should not make another API call
		expect(mockVscode.postMessage).not.toHaveBeenCalled()
	})

	it("should use cached models when available", async () => {
		const cachedModels = [
			{ value: "cached-model-1", label: "Cached Model 1", provider: "azure-openai" },
			{ value: "cached-model-2", label: "Cached Model 2", provider: "google-gemini" }
		]

		// Mock cache to return models
		mockFlowModelCache.getCachedModels.mockReturnValue(cachedModels)
		mockFlowModelCache.getCacheInfo.mockReturnValue({
			hasCache: true,
			age: 5,
			expiresIn: 55,
			modelCount: 2,
			configHash: "test-hash"
		})

		render(<FlowModelSelector {...defaultProps} />)

		// Should use cached models and not make API call
		expect(mockFlowModelCache.getCachedModels).toHaveBeenCalledWith(defaultProps.flowConfig)
		expect(mockVscode.postMessage).not.toHaveBeenCalled()

		// Should show cache indicator
		await waitFor(() => {
			expect(screen.getByText(/cache - 5min atrás/)).toBeInTheDocument()
			expect(screen.getByText(/Cache expira em 55min/)).toBeInTheDocument()
		})
	})

	it("should clear cache when configuration changes", async () => {
		const { rerender } = render(<FlowModelSelector {...defaultProps} />)

		// Change configuration
		const newProps = {
			...defaultProps,
			flowConfig: {
				...defaultProps.flowConfig,
				flowTenant: "new-tenant"
			}
		}

		rerender(<FlowModelSelector {...newProps} />)

		// Should clear cache when config changes
		await waitFor(() => {
			expect(mockFlowModelCache.clearCache).toHaveBeenCalled()
		})
	})
})
