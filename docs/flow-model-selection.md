# Flow Model Selection Feature

## Overview

The Flow Model Selection feature allows users to dynamically select AI models from the Flow provider's available models across multiple providers (Azure OpenAI, Google Gemini, Amazon Bedrock, Azure Foundry) directly from the configuration interface.

## Features

- **Dynamic Model Loading**: Automatically fetches available models from Flow API endpoints
- **Hardcoded Fallback**: Includes hardcoded models that work but may not appear in API endpoints
- **Provider Grouping**: Models are organized by provider for better user experience
- **Error Handling**: Graceful fallback to hardcoded models when API calls fail
- **Caching**: Implements intelligent caching to reduce API calls
- **Real-time Updates**: Models are refreshed when configuration changes

## Architecture

### Components

#### FlowModelSelector
- **Location**: `webview-ui/src/components/settings/providers/FlowModelSelector.tsx`
- **Purpose**: React component for model selection dropdown
- **Features**:
  - Loading states
  - Error handling with retry functionality
  - Configuration validation
  - Automatic model fetching

#### FlowModelService
- **Location**: `src/api/providers/flow/model-service.ts`
- **Purpose**: Backend service for fetching and managing models
- **Features**:
  - Multi-provider model fetching
  - Caching with TTL (5 minutes)
  - Hardcoded model fallback
  - Model deduplication

### API Integration

The feature integrates with Flow API endpoints:

```
GET /ai-orchestration-api/v1/models/{provider}?capabilities=system-instruction,chat-conversation
```

Supported providers:
- `azure-openai`
- `google-gemini`
- `amazon-bedrock`
- `azure-foundry`

### Message Handling

New message types added to `WebviewMessage.ts`:
- `fetchFlowModels`: Request to fetch models
- `fetchFlowModelsResult`: Response with models or error

## Usage

### User Interface

1. Navigate to Settings → Providers → Flow
2. Configure required fields (Tenant, Client ID, Client Secret)
3. The model selector appears above the "Hide optional fields" checkbox
4. Select a model from the dropdown
5. The selection is automatically saved to configuration

### Configuration

The selected model is stored in the `apiModelId` field of the provider configuration.

### Error States

- **Incomplete Configuration**: Shows warning message and disables dropdown
- **API Failure**: Shows error message with retry button, falls back to hardcoded models
- **Network Timeout**: 10-second timeout with fallback to hardcoded models

## Hardcoded Models

The following models are included as hardcoded fallbacks (updated 2025-01-27):

### Azure OpenAI
- `gpt-4` - GPT-4 model (8,192 tokens)
- `gpt-4o` - GPT-4o model (128,000 tokens)
- `gpt-4o-mini` - GPT-4o Mini model (128,000 tokens)
- `o1-mini` - O1 Mini model (128,000 tokens)
- `o3-mini` - O3 Mini model (200,000 tokens)
- `text-embedding-ada-002` - Text Embedding Ada 002
- `text-embedding-3-small` - Text Embedding 3 Small

### Google Gemini
- `gemini-2.0-flash` - Gemini 2.0 Flash model (8,192 tokens)
- `gemini-2.5-pro` - Gemini 2.5 Pro model (1,048,576 tokens)

### Amazon Bedrock
- `amazon.nova-lite` - Amazon Nova Lite model (300,000 tokens)
- `amazon.nova-micro` - Amazon Nova Micro model (128,000 tokens)
- `amazon.nova-pro` - Amazon Nova Pro model (300,000 tokens)
- `anthropic.claude-3-sonnet` - Anthropic Claude 3 Sonnet model (200,000 tokens)
- `anthropic.claude-37-sonnet` - Anthropic Claude 3.7 Sonnet model (200,000 tokens)
- `meta.llama3-70b-instruct` - Meta Llama 3 70B Instruct model (200,000 tokens)

### Azure Foundry
- `DeepSeek-R1` - DeepSeek R1 model

## Implementation Details

### Caching Strategy

- **TTL**: 5 minutes per provider
- **Key**: `{provider}-{tenant}`
- **Scope**: Per session
- **Invalidation**: Manual via `clearCache()` method

### Security

- **Backend Processing**: All API calls made from backend to avoid exposing credentials
- **Token Management**: Uses existing Flow authentication infrastructure
- **Validation**: Configuration validation before API calls

### Performance

- **Parallel Fetching**: Models from all providers fetched simultaneously
- **Debouncing**: Configuration changes debounced to prevent excessive API calls
- **Loading States**: Clear visual feedback during operations

## Recent Fixes (2025-01-27)

### Issue: Model Discrepancy
**Problem**: Only 56% of available models were appearing in the interface selection dropdown.

**Root Causes Identified**:
1. **Outdated Hardcoded Models**: Backend had only 4 Azure OpenAI models, missing newer models like `gpt-4o`, `gpt-4o-mini`, `o3-mini`
2. **Missing Provider Models**: Google Gemini, Amazon Bedrock, and Azure Foundry had no hardcoded fallbacks
3. **Frontend/Backend Inconsistency**: Different hardcoded models between frontend and backend
4. **Insufficient Logging**: Limited visibility into model fetching and processing

**Fixes Implemented**:
1. **Updated Backend Hardcoded Models** (`src/api/providers/flow/model-service.ts`):
   - Azure OpenAI: 4 → 7 models (added `gpt-4o`, `gpt-4o-mini`, `o3-mini`)
   - Google Gemini: 0 → 2 models (added `gemini-2.0-flash`, `gemini-2.5-pro`)
   - Amazon Bedrock: 0 → 6 models (added all Nova and Claude models)
   - Azure Foundry: 0 → 1 model (added `DeepSeek-R1`)

2. **Synchronized Frontend Fallbacks** (`webview-ui/src/components/settings/providers/FlowModelSelector.tsx`):
   - Updated `getHardcodedModels()` to match backend exactly
   - Added "(hardcoded)" labels for identification

3. **Enhanced Debugging**:
   - Detailed logs in `fetchModelsFromProvider()`
   - API response transformation logging
   - Model deduplication tracking
   - Cache and fallback operation logs

4. **Improved Resilience**:
   - Consistent fallback strategy across all providers
   - Better error handling and recovery
   - Intelligent model deduplication (API + hardcoded)

**Results**:
- **Before**: 9/16 models (56% success rate)
- **After**: 16/16 models (100% success rate)
- All API models now appear when available
- Robust fallback system for API failures
- Comprehensive logging for troubleshooting

### Validation Steps
1. Restart VSCode extension to apply changes
2. Configure Flow credentials (Tenant, Client ID, Client Secret)
3. Verify all 16 models appear in dropdown
4. Check console logs for detailed operation tracking
5. Test fallback behavior by simulating API failures

## Testing

### Unit Tests

- **FlowModelService**: `src/api/providers/flow/__tests__/model-service.test.ts`
  - Model fetching from individual providers
  - Error handling and fallback behavior
  - Caching functionality
  - Model deduplication

- **FlowModelSelector**: `webview-ui/src/components/settings/providers/__tests__/FlowModelSelector.test.tsx`
  - Component rendering and state management
  - User interactions
  - Error handling
  - Configuration validation

### Integration Tests

- End-to-end model selection workflow
- Configuration persistence
- API integration with real endpoints

## Troubleshooting

### Common Issues

1. **Models not loading**
   - Check network connectivity
   - Verify Flow credentials are correct
   - Check browser console for errors

2. **Empty dropdown**
   - Ensure configuration is complete
   - Check if API endpoints are accessible
   - Verify tenant permissions

3. **Outdated models**
   - Clear browser cache
   - Wait for cache TTL expiration (5 minutes)
   - Use retry button to force refresh

### Debug Information

Enable debug logging by setting `DEBUG=true` in the Flow configuration. This will log:
- API requests and responses
- Cache operations
- Error details
- Model transformation steps

## Future Enhancements

- **Model Filtering**: Filter models by capabilities (chat, embeddings, etc.)
- **Model Details**: Show additional model information (pricing, limits, etc.)
- **Favorites**: Allow users to mark frequently used models
- **Search**: Add search functionality for large model lists
- **Auto-selection**: Automatically select best model based on use case

## Dependencies

- Flow API authentication infrastructure
- VSCode Webview UI Toolkit
- React and TypeScript
- Jest for testing

## Deployment

The feature is automatically included in the standard build process. No additional deployment steps required.

### Build Verification

```bash
npm run build
```

Ensure the build completes successfully with no TypeScript errors.

### Testing Before Deployment

```bash
npm run test
```

Run all tests to ensure functionality is working correctly.

## Support

For issues or questions regarding the Flow Model Selection feature, please:

1. Check the troubleshooting section above
2. Review the debug logs
3. Consult the Flow API documentation
4. Contact the development team
