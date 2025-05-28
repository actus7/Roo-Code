# Technical Context: Roo-Code

## Technology Stack

### Core Technologies
- **Language**: TypeScript/JavaScript
- **Runtime**: Node.js
- **Architecture**: Provider-based modular system
- **Package Manager**: npm/yarn (to be determined from package.json)

### Development Environment
- **OS**: Linux
- **IDE**: VSCode
- **Shell**: bash
- **Version Control**: Git
- **Workspace**: `/home/alex/projetos/Roo-Code`

### Key Dependencies
- **HTTP Client**: fetch/axios (to be confirmed)
- **Logging**: Built-in logging system
- **Testing**: Jest/Mocha (to be confirmed)
- **Type Checking**: TypeScript compiler

## API Integration Details

### Flow API Endpoints
- **Base URL**: Configurable (production default)
- **Authentication**: `POST /auth-engine-api/v1/api-key/token`
- **Models**: 
  - `GET /ai-orchestration-api/v1/models/azure-openai`
  - `GET /ai-orchestration-api/v1/models/amazon-bedrock`
  - `GET /ai-orchestration-api/v1/models/gemini`
- **Completions**:
  - `POST /ai-orchestration-api/v1/openai/chat/completions`
  - `POST /ai-orchestration-api/v1/google/generateContent`
  - `POST /ai-orchestration-api/v1/bedrock/invoke`

### Authentication Requirements
- **Method**: Bearer Token
- **Credentials**: clientId, clientSecret, tenant
- **Token Lifecycle**: Automatic renewal based on expiry
- **Security**: Tokens stored in memory only

## Development Setup

### Project Structure
```
/home/alex/projetos/Roo-Code/
├── src/
│   ├── api/
│   │   ├── providers/
│   │   └── index.ts
│   ├── shared/
│   └── types/
├── memory-bank/
├── .cursor/
│   └── rules/
└── package.json
```

### Build Process
- **Compilation**: TypeScript → JavaScript
- **Type Checking**: Strict TypeScript configuration
- **Module System**: ES modules or CommonJS (to be confirmed)

### Testing Strategy
- **Unit Tests**: Individual component testing
- **Integration Tests**: Full API flow testing
- **Test Files**: Located alongside source files or in dedicated test directory
- **Coverage**: Aim for >80% code coverage

## Technical Constraints

### Performance Requirements
- **Response Time**: < 2s for model listing
- **Completion Time**: Dependent on provider, but minimize overhead
- **Cache TTL**: 60 minutes for model cache
- **Memory Usage**: Efficient token and model caching

### Security Constraints
- **Credential Storage**: Environment variables or secure config
- **Token Handling**: No logging of sensitive data
- **API Security**: Proper error handling without exposing internals
- **Input Validation**: Sanitize all user inputs

### Compatibility Requirements
- **Node.js Version**: Modern LTS version
- **TypeScript Version**: Recent stable version
- **Browser Support**: N/A (backend only)
- **API Versions**: Support current Flow API version

## Development Workflow

### Code Standards
- **Formatting**: Consistent with existing codebase
- **Naming**: Descriptive, following TypeScript conventions
- **Comments**: JSDoc for public APIs
- **Error Handling**: Comprehensive try-catch with proper logging

### Git Workflow
- **Branching**: Feature branches for development
- **Commits**: Descriptive commit messages
- **Testing**: Tests must pass before merge
- **Code Review**: Follow existing project practices

### Debugging Tools
- **Logging**: Structured logging with different levels
- **Development**: Hot reload for faster iteration
- **Testing**: Test files for API validation
- **Monitoring**: Error tracking and performance monitoring

## External Dependencies

### Flow API
- **Availability**: Production service
- **Rate Limits**: To be determined from API documentation
- **SLA**: External service dependency
- **Fallback**: Graceful degradation on API failures

### Provider APIs (via Flow)
- **Azure OpenAI**: Via Flow orchestration
- **Google Gemini**: Via Flow orchestration  
- **Amazon Bedrock**: Via Flow orchestration
- **Azure Foundry**: Via Flow orchestration

### Development Tools
- **Package Registry**: npm registry
- **CI/CD**: To be determined
- **Deployment**: To be determined
- **Monitoring**: To be determined
