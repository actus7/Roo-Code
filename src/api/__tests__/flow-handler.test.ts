import { FlowHandler } from '../providers/flow'
import { ApiHandlerOptions, ModelInfo } from '../../shared/api'
import axios from 'axios'

jest.mock('axios')

describe('FlowHandler', () => {
  let flowHandler: FlowHandler
  const mockOptions: ApiHandlerOptions = {
    flowBaseUrl: 'https://test.flow.com',
    flowTenant: 'test-tenant',
    flowClientId: 'test-client-id',
    flowClientSecret: 'test-client-secret',
    flowAppToAccess: 'test-app'
  }

  beforeEach(() => {
    flowHandler = new FlowHandler(mockOptions)
    jest.clearAllMocks()
  })

  describe('getAvailableModels', () => {
    it('should fetch models from multiple providers', async () => {
      const mockAzureModels = [
        { id: 'azure-model-1', maxTokens: 4000, contextWindow: 8000 },
        { id: 'azure-model-2', maxTokens: 8000, contextWindow: 16000 }
      ]
      const mockBedrockModels = [
        { id: 'bedrock-model-1', maxTokens: 2000, contextWindow: 4000 },
        { id: 'bedrock-model-2', maxTokens: 4000, contextWindow: 8000 }
      ]

      // Mock the axios get method to return different responses for different providers
      ;(axios.create as jest.Mock).mockReturnValue({
        get: jest.fn().mockImplementation((url: string) => {
          if (url.includes('azure-openai')) {
            return Promise.resolve({ data: mockAzureModels });
          } else if (url.includes('amazon-bedrock')) {
            return Promise.resolve({ data: mockBedrockModels });
          } else {
            return Promise.resolve({ data: { models: [] } });
          }
        }),
        post: jest.fn().mockResolvedValue({ data: { access_token: 'mock-token' } }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      })

      const models = await flowHandler.getAvailableModels()

      expect(models).toHaveProperty('azure-model-1')
      expect(models).toHaveProperty('azure-model-2')
      expect(models).toHaveProperty('bedrock-model-1')
      expect(models).toHaveProperty('bedrock-model-2')
      expect(Object.keys(models).length).toBe(4)
    })

    it('should handle errors and return an empty object', async () => {
      ;(axios.create as jest.Mock).mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('API error')),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      })

      const models = await flowHandler.getAvailableModels()

      expect(models).toEqual({})
    })
  })

  describe('getModel', () => {
    it('should return the specified model if available', async () => {
      const mockModels: Record<string, ModelInfo> = {
        'test-model': {
          maxTokens: 4000,
          contextWindow: 8000,
          supportsImages: false,
          supportsComputerUse: false,
          supportsPromptCache: false,
          description: 'Test model'
        }
      }
      flowHandler['availableModels'] = mockModels
      flowHandler['options'].apiModelId = 'test-model'

      const model = flowHandler.getModel()

      expect(model).toEqual({ id: 'test-model', info: mockModels['test-model'] })
    })

    it('should return the first available model if specified model is not found', async () => {
      const mockModels: Record<string, ModelInfo> = {
        'available-model': {
          maxTokens: 4000,
          contextWindow: 8000,
          supportsImages: false,
          supportsComputerUse: false,
          supportsPromptCache: false,
          description: 'Available model'
        }
      }
      flowHandler['availableModels'] = mockModels
      flowHandler['options'].apiModelId = 'non-existent-model'

      const model = flowHandler.getModel()

      expect(model).toEqual({ id: 'available-model', info: mockModels['available-model'] })
    })
  })
})