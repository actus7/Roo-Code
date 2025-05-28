/**
 * Script para testar a integração com o Flow
 */

// Carregar variáveis de ambiente
require('dotenv').config({ path: '../.env' });

const axios = require('axios');

// Configurações usando variáveis de ambiente
const FLOW_BASE_URL = process.env.FLOW_BASE_URL || "https://flow.ciandt.com";
const FLOW_TENANT = process.env.FLOW_TENANT || "cit";
const FLOW_CLIENT_ID = process.env.FLOW_CLIENT_ID;
const FLOW_CLIENT_SECRET = process.env.FLOW_CLIENT_SECRET;
const FLOW_APP_TO_ACCESS = process.env.FLOW_APP_TO_ACCESS || "llm-api";

// Verificar se as variáveis obrigatórias estão definidas
if (!FLOW_CLIENT_ID || !FLOW_CLIENT_SECRET) {
    console.error("Erro: FLOW_CLIENT_ID e FLOW_CLIENT_SECRET devem estar definidos no arquivo .env");
    process.exit(1);
}
const FLOW_AUTH_PATH = "/auth-engine-api/v1/api-key/token";
const FLOW_API_PATH = "/ai-orchestration-api/v1";

/**
 * Autenticar com a API Flow
 */
async function authenticate() {
    try {
        console.log(`Autenticando com a API Flow...`);
        const authUrl = `${FLOW_BASE_URL}${FLOW_AUTH_PATH}`;
        console.log(`URL de autenticação: ${authUrl}`);

        const payload = {
            clientId: FLOW_CLIENT_ID,
            clientSecret: FLOW_CLIENT_SECRET,
            appToAccess: FLOW_APP_TO_ACCESS
        };

        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "FlowTenant": FLOW_TENANT
        };

        console.log(`Headers de autenticação:`, headers);

        const response = await axios.post(authUrl, payload, { headers });

        if (!response.data || !response.data.access_token) {
            console.error("Resposta de autenticação sem access_token:", response.data);
            throw new Error("Falha na autenticação: access_token ausente na resposta");
        }

        console.log(`Autenticação bem-sucedida, token recebido`);
        return response.data.access_token;
    } catch (error) {
        console.error("Erro de autenticação:");
        if (error.response) {
            console.error(`  Status: ${error.response.status}`);
            console.error(`  Status Text: ${error.response.statusText}`);
            console.error(`  Data:`, error.response.data);
            console.error(`  Headers:`, error.response.headers);
        } else {
            console.error(error);
        }
        throw new Error(`Falha na autenticação: ${error.message || "Erro desconhecido"}`);
    }
}

/**
 * Buscar modelos de um provedor específico
 */
async function getProviderModels(token, providerId) {
    try {
        console.log(`Buscando modelos para o provedor ${providerId}...`);
        const url = `${FLOW_BASE_URL}${FLOW_API_PATH}/models/${providerId}?capabilities=system-instruction,chat-conversation`;
        console.log(`URL da requisição: ${url}`);

        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`,
            "FlowTenant": FLOW_TENANT
        };

        const response = await axios.get(url, { headers });

        if (!response.data) {
            console.warn(`Nenhum dado retornado para o provedor ${providerId}`);
            return [];
        }

        if (!Array.isArray(response.data)) {
            console.warn(`Dados de resposta não são um array para o provedor ${providerId}:`, response.data);
            return [];
        }

        if (response.data.length === 0) {
            console.warn(`Array vazio retornado para o provedor ${providerId}`);
            return [];
        }

        console.log(`Busca bem-sucedida: ${response.data.length} modelos para o provedor ${providerId}`);
        return response.data;
    } catch (error) {
        console.error(`Erro ao buscar modelos para o provedor ${providerId}:`);
        if (error.response) {
            console.error(`  Status: ${error.response.status}`);
            console.error(`  Status Text: ${error.response.statusText}`);
            console.error(`  Data:`, error.response.data);
            console.error(`  Headers:`, error.response.headers);
        } else {
            console.error(error);
        }
        return [];
    }
}

/**
 * Função principal
 */
async function main() {
    try {
        // Autenticar
        const token = await authenticate();

        // Buscar modelos de diferentes provedores
        const providers = ["azure-openai", "amazon-bedrock", "google-gemini", "azure-foundry"];
        const allModels = {};

        for (const provider of providers) {
            const models = await getProviderModels(token, provider);

            for (const model of models) {
                const modelId = model.name;
                allModels[modelId] = {
                    provider: model.provider,
                    capabilities: model.capabilities || [],
                    inputTokens: model.inputTokens || 0
                };
            }
        }

        // Exibir resultados
        console.log("\n=== Modelos encontrados ===");
        console.log(`Total de modelos: ${Object.keys(allModels).length}`);

        for (const [modelId, info] of Object.entries(allModels)) {
            console.log(`- ${modelId} (${info.provider})`);
            console.log(`  Capabilities: ${info.capabilities.join(", ")}`);
            console.log(`  Input Tokens: ${info.inputTokens}`);
        }
    } catch (error) {
        console.error("Erro na execução do script:", error);
    }
}

// Executar o script
main();
