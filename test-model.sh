#!/bin/bash

# Configurações
FLOW_BASE_URL="https://flow.ciandt.com"
FLOW_TENANT="seu-tenant"
FLOW_CLIENT_ID="seu-client-id"
FLOW_CLIENT_SECRET="seu-client-secret"
FLOW_APP_TO_ACCESS="llm-api"
MODEL_TO_TEST=$1
PROVIDER=${2:-"openai"}  # openai, gemini, bedrock
MODEL_TYPE=${3:-"chat"}  # chat, embedding

# Cores para saída
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$MODEL_TO_TEST" ]; then
    echo -e "${RED}Por favor, forneça o modelo para testar${NC}"
    echo "Uso: ./test-model.sh <nome-do-modelo> [provider] [type]"
    echo "Providers disponíveis: openai, gemini, bedrock"
    echo "Tipos disponíveis: chat, embedding"
    exit 1
fi

echo -e "${BLUE}Testando modelo: $MODEL_TO_TEST (Provider: $PROVIDER, Type: $MODEL_TYPE)${NC}"

# Autenticação
echo -e "\n${BLUE}Obtendo token...${NC}"
AUTH_RESPONSE=$(curl -s -X POST "${FLOW_BASE_URL}/auth-engine-api/v1/api-key/token" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "FlowTenant: ${FLOW_TENANT}" \
  -d "{\"clientId\":\"${FLOW_CLIENT_ID}\",\"clientSecret\":\"${FLOW_CLIENT_SECRET}\",\"appToAccess\":\"${FLOW_APP_TO_ACCESS}\"}")

TOKEN=$(echo $AUTH_RESPONSE | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Falha na autenticação${NC}"
    exit 1
fi

echo -e "${GREEN}Token obtido com sucesso${NC}"

# Preparar payload e URL baseado no provider e tipo
case $PROVIDER in
    "openai")
        if [ "$MODEL_TYPE" = "embedding" ]; then
            URL="${FLOW_BASE_URL}/ai-orchestration-api/v1/openai/embeddings"
            PAYLOAD=$(cat <<EOF
{
    "input": "What is the capital city of Brazil?",
    "user": "flow",
    "allowedModels": ["$MODEL_TO_TEST"]
}
EOF
)
        else
            URL="${FLOW_BASE_URL}/ai-orchestration-api/v1/openai/chat/completions"
            PAYLOAD=$(cat <<EOF
{
    "model": "$MODEL_TO_TEST",
    "messages": [
        {
            "content": "You are a helpful assistant.",
            "role": "assistant"
        },
        {
            "content": "What is the capital city of Brazil?",
            "role": "user"
        }
    ]
}
EOF
)
        fi
        ;;
    "gemini")
        if [ "$MODEL_TYPE" = "embedding" ]; then
            URL="${FLOW_BASE_URL}/ai-orchestration-api/v1/google/embeddings"
            PAYLOAD=$(cat <<EOF
{
    "model": "$MODEL_TO_TEST",
    "text": "What is the capital city of Brazil?"
}
EOF
)
        else
            URL="${FLOW_BASE_URL}/ai-orchestration-api/v1/google/generateContent"
            PAYLOAD=$(cat <<EOF
{
    "model": "$MODEL_TO_TEST",
    "contents": [
        {
            "parts": [
                {
                    "text": "You are a helpful assistant."
                }
            ],
            "role": "assistant"
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
}
EOF
)
        fi
        ;;
    "bedrock")
        if [ "$MODEL_TYPE" = "embedding" ]; then
            URL="${FLOW_BASE_URL}/ai-orchestration-api/v1/bedrock/embeddings"
            PAYLOAD=$(cat <<EOF
{
    "inputText": "What is the capital city of Brazil?",
    "model": "$MODEL_TO_TEST"
}
EOF
)
        else
            URL="${FLOW_BASE_URL}/ai-orchestration-api/v1/bedrock/invoke"
            PAYLOAD=$(cat <<EOF
{
    "allowedModels": ["$MODEL_TO_TEST"],
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
}
EOF
)
        fi
        ;;
    *)
        echo -e "${RED}Provider não suportado: $PROVIDER${NC}"
        exit 1
        ;;
esac

# Testar o modelo
echo -e "\n${BLUE}Testando modelo $MODEL_TO_TEST...${NC}"
echo -e "URL: $URL"
echo -e "Payload: $PAYLOAD"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "FlowTenant: ${FLOW_TENANT}" \
    -H "FlowAgent: chat" \
    -d "$PAYLOAD")

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ $STATUS == "200" ]]; then
    echo -e "${GREEN}Teste bem sucedido!${NC}"
    echo -e "${BLUE}Resposta:${NC}"
    echo "$BODY"
else
    echo -e "${RED}Falha no teste (Status: ${STATUS})${NC}"
    echo "$BODY"
fi
