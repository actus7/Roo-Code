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

echo -e "${BLUE}Testando API Flow${NC}"
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

# Incluir na listagem de modelos os seguintes modelos por provider:
# Azure OpenAI: gpt-4, text-embedding-ada-002, text-embedding-3-small

# Função para listar modelos
list_models() {
    local provider=$1
    echo -e "\n${BLUE}Listando modelos para provider: ${provider}${NC}"

    local url="${FLOW_BASE_URL}/ai-orchestration-api/v1/models/${provider}?capabilities=system-instruction,chat-conversation"
    debug "Fazendo requisição para: $url"

    local response=$(curl -s -w "\n%{http_code}" -X GET "$url" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "FlowTenant: ${FLOW_TENANT}" \
        -H "Accept: application/json")

    local status=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    debug "Código de status HTTP: $status"
    debug "Resposta recebida: $body"

    if [[ $status == "200" ]]; then
        if echo "$body" | jq empty > /dev/null 2>&1; then
            # Remover duplicatas antes de contar
            # Adicionar modelos específicos baseado no provider
            if [[ $provider == "azure-openai" ]]; then
                # Adiciona os modelos ao JSON existente
                local additional_models='[
                    {"name": "gpt-4", "capabilities": ["system-instruction", "chat-conversation", "streaming"]},
                    {"name": "text-embedding-ada-002", "capabilities": ["embeddings"]},
                    {"name": "text-embedding-3-small", "capabilities": ["embeddings"]}
                ]'
                local unique=$(echo "$body $additional_models" | jq -s '[ .[0][], .[1][] ] | unique_by(.name)')
            elif [[ $provider == "google-gemini" ]]; then
                local unique=$(echo "$body" | jq 'unique_by(.name)')
            else
                local unique=$(echo "$body" | jq 'unique_by(.name)')
            fi

            local count=$(echo "$unique" | jq '. | length')
            echo -e "${GREEN}Encontrados ${count} modelos únicos para ${provider}${NC}"

            echo -e "${BLUE}Detalhes dos modelos:${NC}"
            echo "$unique" | jq -r '. | sort_by(.name)[] | "\n🤖 Modelo: \(.name)\n📊 Contexto Máximo: \(.inputTokens // "N/A") tokens\n🛠️ Capacidades: \(.capabilities | join(", "))\n⚙️ Suporta Streaming: \(if (.capabilities | contains(["streaming"])) then "Sim" else "Não" end)\n➖➖➖"'
        else
            echo -e "${RED}Resposta inválida do servidor para ${provider}:${NC}"
            debug "Resposta não é um JSON válido"
            echo "$body"
        fi
    else
        echo -e "${RED}Falha ao listar modelos para ${provider} (Status: ${status}):${NC}"
        echo "$body"
    fi
}

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

# Passo 2: Testar cada provider
echo -e "\n${BLUE}Passo 2: Testando providers${NC}"

# Azure OpenAI
echo -e "\n${BLUE}=== Azure OpenAI ===${NC}"
list_models "azure-openai"

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

# Função para testar embeddings
test_embeddings() {
    local url=$1
    local payload=$2
    local description=$3

    echo -e "\n${BLUE}Testando $description${NC}"
    debug "URL: $url"
    debug "Payload: $payload"

    # Extrair o modelo do payload
    local model=$(echo "$payload" | jq -r '.allowedModels[0]')

    local response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "FlowTenant: ${FLOW_TENANT}" \
        -H "FlowAgent: test-script" \
        -H "x-ms-model-mesh-model-name: ${model}" \
        -d "$payload")

    local status=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    debug "Código de status HTTP: $status"
    debug "Resposta completa: $body"

    if [[ $status == "200" ]]; then
        echo -e "${GREEN}Embeddings gerados com sucesso!${NC}"
        # Extrair apenas informações relevantes usando jq
        echo -e "${BLUE}Metadados:${NC}"
        echo "$body" | jq -r '{
            model: .model,
            input_tokens: .usage.total_tokens,
            vector_size: (.data[0].embedding | length)
        }'
    else
        echo -e "${RED}Falha ao gerar embeddings (Status: ${status}):${NC}"
        echo "$body"
    fi
}

# Testar Azure OpenAI Embeddings com text-embedding-ada-002
EMBEDDINGS_PAYLOAD=$(jq -n '{
    "input": "What is the capital city of Brazil?",
    "user": "flow",
    "allowedModels": ["text-embedding-ada-002"]
}')
test_embeddings "${FLOW_BASE_URL}/ai-orchestration-api/v1/openai/embeddings" "$EMBEDDINGS_PAYLOAD" "Azure OpenAI Embeddings (text-embedding-ada-002)"

# Testar Azure OpenAI Embeddings com text-embedding-3-small
EMBEDDINGS_PAYLOAD=$(jq -n '{
    "input": "What is the capital city of Brazil?",
    "user": "flow",
    "allowedModels": ["text-embedding-3-small"]
}')
test_embeddings "${FLOW_BASE_URL}/ai-orchestration-api/v1/openai/embeddings" "$EMBEDDINGS_PAYLOAD" "Azure OpenAI Embeddings (text-embedding-3-small)"

# Google Gemini
echo -e "\n${BLUE}=== Google Gemini ===${NC}"
list_models "google-gemini"

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
list_models "amazon-bedrock"

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
list_models "azure-foundry"

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

echo -e "\n${BLUE}Teste concluído!${NC}"
