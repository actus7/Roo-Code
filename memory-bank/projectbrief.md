# Project Brief: Roo-Code

## Project Overview
Roo-Code é um sistema de orquestração de IA que permite integração com múltiplos provedores de modelos de linguagem através de uma arquitetura de providers extensível. O projeto está focado na implementação de um novo provider chamado "Flow" para integração com a API de orquestração de IA da Flow.

## Core Requirements

### Primary Goal
Implementar um provider Flow completo que se integre ao sistema existente de providers, permitindo:
- Autenticação com a API Flow usando clientId, clientSecret e tenant
- Busca e seleção de modelos de diferentes provedores (Azure OpenAI, Azure Foundry, Google Gemini, Amazon Bedrock)
- Formatação correta de requisições para cada provedor suportado
- Processamento e normalização de respostas de diferentes provedores

### Technical Scope
- **Backend**: Implementação do FlowHandler em TypeScript
- **Integration**: Sistema de cache de modelos e autenticação
- **Architecture**: Seguir padrões existentes de BaseProvider e SingleCompletionHandler
- **Testing**: Testes unitários e de integração completos

### Success Criteria
1. Provider Flow funcional e integrado ao sistema existente
2. Suporte completo aos 4 provedores (Azure OpenAI, Azure Foundry, Google Gemini, Amazon Bedrock)
3. Sistema de autenticação robusto com renovação automática de tokens
4. Cache de modelos eficiente
5. Testes abrangentes com cobertura adequada

## Project Context
- **Developer**: Alex (prefere respostas em Português do Brasil)
- **Workspace**: /home/alex/projetos/Roo-Code
- **Environment**: Linux, VSCode, Git repository ativo
- **Language**: TypeScript/JavaScript
- **Architecture**: Provider-based system with extensible handlers

## Key Constraints
- Deve seguir padrões arquiteturais existentes
- Compatibilidade com sistema de cache atual
- Segurança na manipulação de credenciais
- Resilência a falhas temporárias da API
- Extensibilidade para futuros provedores

## Deliverables
1. Implementação completa do FlowHandler
2. Integração com sistema de cache de modelos
3. Testes unitários e de integração
4. Documentação técnica
5. Tratamento de erros e logging adequado
