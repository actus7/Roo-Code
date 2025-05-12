import { GitHubCopilotHandler } from '../handler';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { convertCopilotModelToModelInfo } from '../models';

describe('GitHubCopilotHandler', () => {
    let mockApi: any;
    let handler: GitHubCopilotHandler;

    beforeEach(() => {
        mockApi = {
            getModels: jest.fn(),
            sendChatRequestStream: jest.fn(),
        };
        handler = new GitHubCopilotHandler(mockApi);
    });

    describe('getModels', () => {
        it('should return converted models when API call succeeds', async () => {
            const mockModel = {
                id: 'test-model',
                capabilities: {
                    supports: { streaming: true },
                    limits: {
                        max_context_window_tokens: 16384,
                        max_output_tokens: 4096
                    }
                }
            };
            mockApi.getModels.mockResolvedValue([mockModel]);

            const result = await handler.getModels();
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(expect.objectContaining({
                modelId: 'test-model',
                provider: 'github-copilot'
            }));
        });

        it('should return default models when API call fails', async () => {
            mockApi.getModels.mockRejectedValue(new Error('API Error'));

            const result = await handler.getModels();
            expect(result).toHaveLength(1);
            expect(result[0].modelId).toBe('copilot-default');
        });
    });

    // Add more test cases...
});