#!/bin/bash

# Carregar variáveis de ambiente do arquivo .env
if [ -f "../.env" ]; then
    set -a
    source ../.env
    set +a
elif [ -f ".env" ]; then
    set -a
    source .env
    set +a
else
    echo "Arquivo .env não encontrado. Certifique-se de que existe um arquivo .env no diretório raiz do projeto."
    exit 1
fi

# Configurações (agora usando variáveis de ambiente)
FLOW_BASE_URL="${FLOW_BASE_URL:-https://flow.ciandt.com}"
FLOW_TENANT="${FLOW_TENANT:-cit}"
FLOW_CLIENT_ID="${FLOW_CLIENT_ID}"
FLOW_CLIENT_SECRET="${FLOW_CLIENT_SECRET}"
FLOW_APP_TO_ACCESS="${FLOW_APP_TO_ACCESS:-llm-api}"

# Verificar se as variáveis obrigatórias estão definidas
if [ -z "$FLOW_CLIENT_ID" ] || [ -z "$FLOW_CLIENT_SECRET" ]; then
    echo "Erro: FLOW_CLIENT_ID e FLOW_CLIENT_SECRET devem estar definidos no arquivo .env"
    exit 1
fi

# Cores para saída
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se jq está instalado
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Erro: jq não está instalado${NC}"
    echo -e "Por favor, instale usando:"
    echo -e "${YELLOW}sudo apt-get install jq${NC} (Ubuntu/Debian)"
    echo -e "${YELLOW}brew install jq${NC} (macOS)"
    exit 1
fi

# Função para debug
debug() {
    if [[ "$DEBUG" == "true" ]]; then
        echo -e "${YELLOW}[DEBUG] $1${NC}"
    fi
}

# Habilitar debug se a variável DEBUG estiver definida
DEBUG=${DEBUG:-false}

echo -e "${BLUE}Testando API Flow - Chat${NC}"
echo -e "${BLUE}====================${NC}"

# Passo 1: Autenticação
echo -e "${BLUE}Passo 1: Autenticação${NC}"
AUTH_RESPONSE=$(curl -s -X POST "${FLOW_BASE_URL}/auth-engine-api/v1/api-key/token" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "FlowTenant: ${FLOW_TENANT}" \
  -d "{\"clientId\":\"${FLOW_CLIENT_ID}\",\"clientSecret\":\"${FLOW_CLIENT_SECRET}\",\"appToAccess\":\"${FLOW_APP_TO_ACCESS}\"}")

# Extrair token
TOKEN=$(echo $AUTH_RESPONSE | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}Falha na autenticação:${NC}"
  echo $AUTH_RESPONSE
  exit 1
else
  echo -e "${GREEN}Autenticação bem-sucedida!${NC}"
fi

# Função para testar chat
test_chat() {
    local url=$1
    local payload=$2
    local description=$3

    echo -e "\n${BLUE}Testando $description${NC}"
    debug "URL: $url"
    debug "Payload: $payload"

    local response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "FlowTenant: ${FLOW_TENANT}" \
        -H "FlowAgent: test-script" \
        -d "$payload")

    local status=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    debug "Código de status HTTP: $status"
    debug "Resposta completa: $body"

    if [[ $status == "200" ]]; then
        echo -e "${GREEN}Chat bem sucedido!${NC}"
        echo -e "${BLUE}Resposta:${NC}"
        echo "$body" | jq -r '.'
    else
        echo -e "${RED}Falha no chat (Status: ${status}):${NC}"
        echo "$body"
    fi
}

# Passo 2: Testar chat com diferentes provedores
echo -e "\n${BLUE}Passo 2: Testando chat por provider${NC}"

# Azure OpenAI
echo -e "\n${BLUE}=== Azure OpenAI ===${NC}"

# Testar gpt-4
AZURE_PAYLOAD_GPT4=$(jq -n '{
    "messages": [
        {
            "content": "You are a helpful assistant.",
            "role": "system"
        },
        {
            "role": "user",
            "content": "What is the capital city of Brazil?"
        }
    ],
    "allowedModels": ["gpt-4"]
}')
test_chat "${FLOW_BASE_URL}/ai-orchestration-api/v1/openai/chat/completions" "$AZURE_PAYLOAD_GPT4" "Azure OpenAI (gpt-4)"

# Testar o3-mini
AZURE_PAYLOAD_O3=$(jq -n '{
    "messages": [
        {
            "content": "You are a helpful assistant.",
            "role": "system"
        },
        {
            "role": "user",
            "content": "What is the capital city of Brazil?"
        }
    ],
    "allowedModels": ["o3-mini"]
}')
test_chat "${FLOW_BASE_URL}/ai-orchestration-api/v1/openai/chat/completions" "$AZURE_PAYLOAD_O3" "Azure OpenAI (o3-mini)"

# Google Gemini
echo -e "\n${BLUE}=== Google Gemini ===${NC}"

# Testar Gemini 2.5 Pro
GEMINI_PAYLOAD_25_PRO=$(jq -n '{
    "allowedModels": ["gemini-2.5-pro"],
    "contents": [
        {
            "parts": [
                {
                    "text": "You are a helpful assistant."
                }
            ],
            "role": "user"
        },
        {
            "parts": [
                {
                    "text": "What is the capital city of Brazil?"
                }
            ],
            "role": "user"
        }
    ]
}')
test_chat "${FLOW_BASE_URL}/ai-orchestration-api/v1/google/generateContent" "$GEMINI_PAYLOAD_25_PRO" "Google Gemini (gemini-2.5-pro)"

# Amazon Bedrock
echo -e "\n${BLUE}=== Amazon Bedrock ===${NC}"

# Testar Claude 3 Sonnet
BEDROCK_PAYLOAD_CLAUDE3=$(jq -n '{
    "allowedModels": ["anthropic.claude-3-sonnet"],
    "max_tokens": 8192,
    "anthropic_version": "bedrock-2023-05-31",
    "messages": [
        {
            "content": [
                {
                    "text": "What is the capital city of Brazil?",
                    "type": "text"
                }
            ],
            "role": "user"
        }
    ],
    "system": "You are a helpful assistant."
}')
test_chat "${FLOW_BASE_URL}/ai-orchestration-api/v1/bedrock/invoke" "$BEDROCK_PAYLOAD_CLAUDE3" "Amazon Bedrock (anthropic.claude-3-sonnet)"

# Testar Claude 3.7 Sonnet
BEDROCK_PAYLOAD_CLAUDE37=$(jq -n '{
    "allowedModels": ["anthropic.claude-37-sonnet"],
    "max_tokens": 8192,
    "anthropic_version": "bedrock-2023-05-31",
    "messages": [
        {
            "content": [
                {
                    "text": "What is the capital city of Brazil?",
                    "type": "text"
                }
            ],
            "role": "user"
        }
    ],
    "system": "You are a helpful assistant."
}')
test_chat "${FLOW_BASE_URL}/ai-orchestration-api/v1/bedrock/invoke" "$BEDROCK_PAYLOAD_CLAUDE37" "Amazon Bedrock (anthropic.claude-37-sonnet)"

# Azure Foundry
echo -e "\n${BLUE}=== Azure Foundry ===${NC}"

FOUNDRY_PAYLOAD=$(jq -n '{
    "model": "DeepSeek-R1",
    "messages": [
        {
            "content": "You are an AI programming assistant, utilizing the DeepSeek Coder model, developed by DeepSeek Company, and your role is to assist with questions related to computer science. For politically sensitive questions, security and privacy issues, and other non-computer science questions, you will not answer.\n### Instruction:\nYou are a helpful assistant.\nWhat is the capital city of Brazil?\n### Response:\n",
            "role": "user"
        }
    ]
}')
test_chat "${FLOW_BASE_URL}/ai-orchestration-api/v1/foundry/chat/completions" "$FOUNDRY_PAYLOAD" "Azure Foundry (DeepSeek-R1)"

echo -e "\n${BLUE}Teste de chat concluído!${NC}"
