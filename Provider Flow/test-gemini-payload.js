#!/usr/bin/env node

// Teste específico para verificar o payload do Google Gemini
// Baseado no erro anterior que mostrava problema com campo "stream"

// Carregar variáveis de ambiente
require('dotenv').config({ path: '../.env' });

const https = require('https');

console.log("🔍 Testando payload Google Gemini...");

// Verificar se as variáveis obrigatórias estão definidas
if (!process.env.FLOW_CLIENT_ID || !process.env.FLOW_CLIENT_SECRET) {
    console.error("Erro: FLOW_CLIENT_ID e FLOW_CLIENT_SECRET devem estar definidos no arquivo .env");
    process.exit(1);
}

const config = {
    flowBaseUrl: process.env.FLOW_BASE_URL || "https://flow.ciandt.com",
    flowTenant: process.env.FLOW_TENANT || "cit",
    flowClientId: process.env.FLOW_CLIENT_ID,
    flowClientSecret: process.env.FLOW_CLIENT_SECRET,
    flowAppToAccess: process.env.FLOW_APP_TO_ACCESS || "llm-api",
    flowAgent: "chat",
    apiModelId: "gemini-2.5-pro"
};

// Função para fazer requisição HTTP
function makeRequest(url, options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body, headers: res.headers });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function testAuthentication() {
    console.log("\n🔐 Testando autenticação...");

    const authUrl = `${config.flowBaseUrl}/auth-engine-api/v1/api-key/token`;

    const authPayload = {
        clientId: config.flowClientId,
        clientSecret: config.flowClientSecret,
        appToAccess: config.flowAppToAccess
    };

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'FlowTenant': config.flowTenant
        }
    };

    try {
        const response = await makeRequest(authUrl, options, authPayload);

        if (response.status === 200) {
            console.log("✅ Autenticação bem-sucedida!");
            return response.data.access_token;
        } else {
            console.log("❌ Falha na autenticação");
            console.log("📋 Resposta:", response.data);
            return null;
        }
    } catch (error) {
        console.error("❌ Erro na autenticação:", error.message);
        return null;
    }
}

async function testGeminiPayload(token) {
    console.log("\n💬 Testando payload Google Gemini...");

    const endpoint = '/ai-orchestration-api/v1/google/generateContent';
    const chatUrl = `${config.flowBaseUrl}${endpoint}`;

    console.log("🌐 URL:", chatUrl);

    // Payload CORRETO para Google Gemini (sem campo stream)
    const correctPayload = {
        contents: [
            {
                parts: [
                    {
                        text: "Você é um assistente útil."
                    }
                ],
                role: "user"
            },
            {
                parts: [
                    {
                        text: "Olá! Como você está?"
                    }
                ],
                role: "user"
            }
        ],
        generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0
        },
        model: "gemini-2.5-pro"
    };

    console.log("📤 Payload correto (sem stream):", JSON.stringify(correctPayload, null, 2));

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
            'FlowTenant': config.flowTenant,
            'FlowAgent': config.flowAgent
        }
    };

    try {
        const response = await makeRequest(chatUrl, options, correctPayload);
        console.log("📊 Status:", response.status);

        if (response.status === 200) {
            console.log("✅ Gemini payload correto funcionou!");
            console.log("💬 Resposta recebida:", typeof response.data === 'object' ? "JSON válido" : "Texto");

            // Mostrar parte da resposta
            if (response.data && response.data.candidates) {
                console.log("🎯 Conteúdo da resposta:", response.data.candidates[0]?.content?.parts?.[0]?.text?.substring(0, 100) + "...");
            }
        } else {
            console.log("❌ Falha no Gemini");
            console.log("📋 Status:", response.status);
            console.log("📋 Resposta:", response.data);
        }
    } catch (error) {
        console.error("❌ Erro no Gemini:", error.message);
    }
}

async function testGeminiStreaming(token) {
    console.log("\n🌊 Testando streaming Google Gemini...");

    const endpoint = '/ai-orchestration-api/v1/google/generateContent';
    const chatUrl = `${config.flowBaseUrl}${endpoint}`;

    // Payload para streaming (sem campo stream no JSON, mas com header Accept: text/event-stream)
    const streamingPayload = {
        contents: [
            {
                parts: [
                    {
                        text: "Você é um assistente útil."
                    }
                ],
                role: "user"
            },
            {
                parts: [
                    {
                        text: "Conte uma piada curta."
                    }
                ],
                role: "user"
            }
        ],
        generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7
        },
        model: "gemini-2.5-pro"
    };

    console.log("📤 Payload streaming:", JSON.stringify(streamingPayload, null, 2));

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',  // Header para streaming
            'Authorization': `Bearer ${token}`,
            'FlowTenant': config.flowTenant,
            'FlowAgent': config.flowAgent
        }
    };

    try {
        const response = await makeRequest(chatUrl, options, streamingPayload);
        console.log("📊 Status:", response.status);

        if (response.status === 200) {
            console.log("✅ Gemini streaming funcionou!");
            console.log("🌊 Tipo de resposta:", typeof response.data);

            // Para streaming, a resposta pode ser texto SSE
            if (typeof response.data === 'string') {
                console.log("📝 Primeiros 200 chars:", response.data.substring(0, 200));
            }
        } else {
            console.log("❌ Falha no streaming Gemini");
            console.log("📋 Status:", response.status);
            console.log("📋 Resposta:", response.data);
        }
    } catch (error) {
        console.error("❌ Erro no streaming Gemini:", error.message);
    }
}

async function main() {
    try {
        const token = await testAuthentication();

        if (token) {
            await testGeminiPayload(token);
            await testGeminiStreaming(token);
        } else {
            console.log("❌ Não foi possível obter token");
        }

    } catch (error) {
        console.error("❌ Erro geral:", error.message);
    }

    console.log("\n🏁 Teste concluído");
}

main();
