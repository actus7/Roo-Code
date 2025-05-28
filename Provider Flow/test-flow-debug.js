#!/usr/bin/env node

// Teste para simular exatamente o que o FlowHandler está fazendo
// Baseado no código atual do FlowHandler

// Carregar variáveis de ambiente
require('dotenv').config({ path: '../.env' });

const https = require('https');

console.log("🔍 Simulando FlowHandler exato...");

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
    apiModelId: "gemini-2.5-pro",
    modelTemperature: 0
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

// Simular convertAnthropicMessages
function convertAnthropicMessages(systemPrompt, messages) {
    const flowMessages = [];

    // Add system message if provided
    if (systemPrompt) {
        flowMessages.push({
            role: "system",
            content: systemPrompt,
        });
    }

    // Convert Anthropic messages
    for (const message of messages) {
        const content = Array.isArray(message.content)
            ? message.content.map((block) => {
                if (block.type === "text") {
                    return block.text;
                }
                return "";
            }).join("")
            : message.content;

        flowMessages.push({
            role: message.role,
            content,
        });
    }

    return flowMessages;
}

// Simular determineProvider
function determineProvider(model) {
    if (model.startsWith('anthropic.')) {
        return 'amazon-bedrock';
    } else if (model.startsWith('gpt-') || model.startsWith('o3-')) {
        return 'azure-openai';
    } else if (model.startsWith('gemini-')) {
        return 'google-gemini';
    } else {
        return 'azure-openai';
    }
}

// Simular getProviderEndpoint
function getProviderEndpoint(provider) {
    const endpoints = {
        'azure-openai': '/ai-orchestration-api/v1/openai/chat/completions',
        'google-gemini': '/ai-orchestration-api/v1/google/generateContent',
        'amazon-bedrock': '/ai-orchestration-api/v1/bedrock/invoke',
        'azure-foundry': '/ai-orchestration-api/v1/foundry/chat/completions'
    };
    return endpoints[provider];
}

// Simular generateGeminiPayload (versão corrigida)
function generateGeminiPayload(options, config) {
    const contents = [];
    let systemMessage = "";

    // Extract system message first
    for (const msg of options.messages) {
        if (msg.role === "system") {
            systemMessage = typeof msg.content === "string" ? msg.content : msg.content[0]?.text || "";
        }
    }

    // Process non-system messages
    for (const msg of options.messages) {
        if (msg.role === "system") {
            continue; // Skip system messages as they're handled separately
        }

        // Gemini uses "model" role instead of "assistant"
        const role = msg.role === "assistant" ? "model" : "user";
        let content = typeof msg.content === "string" ? msg.content : msg.content[0]?.text || "";

        // If this is the first user message and we have a system message, prepend it
        if (role === "user" && contents.length === 0 && systemMessage) {
            content = `${systemMessage}\n\n${content}`;
        }

        contents.push({
            parts: [
                {
                    text: content,
                },
            ],
            role,
        });
    }

    const payload = {
        contents,
        generationConfig: {
            maxOutputTokens: options.maxTokens || config.modelMaxTokens,
            temperature: options.temperature ?? config.modelTemperature,
        },
        // Note: Google Gemini API does not support the 'stream' field
        // Streaming is handled at the HTTP level, not in the payload
    };

    // Use either specific model or allowedModels array
    if (options.model) {
        payload.model = options.model;
    } else if (config.apiModelId) {
        payload.allowedModels = [config.apiModelId];
    }

    return payload;
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
            return null;
        }
    } catch (error) {
        console.error("❌ Erro na autenticação:", error.message);
        return null;
    }
}

async function testFlowHandlerSimulation(token) {
    console.log("\n🎯 Simulando FlowHandler exato...");

    // Simular dados de entrada do Roo Code
    const systemPrompt = "Você é um assistente de programação útil.";
    const messages = [
        {
            role: "user",
            content: "Olá! Como você está?"
        }
    ];

    console.log("📝 System prompt:", systemPrompt.substring(0, 50) + "...");
    console.log("💬 Messages:", messages);

    // Simular convertAnthropicMessages
    const flowMessages = convertAnthropicMessages(systemPrompt, messages);
    console.log("🔄 Flow messages:", flowMessages);

    const model = config.apiModelId;
    console.log("🤖 Model:", model);

    const options = {
        model,
        messages: flowMessages,
        maxTokens: undefined,
        temperature: config.modelTemperature,
        stream: true,
    };

    console.log("⚙️ Options:", options);

    const provider = determineProvider(model);
    console.log("🏭 Provider:", provider);

    const endpoint = getProviderEndpoint(provider);
    console.log("🛤️ Endpoint:", endpoint);

    const payload = generateGeminiPayload(options, config);
    console.log("📦 Payload gerado:", JSON.stringify(payload, null, 2));

    const fullUrl = `${config.flowBaseUrl}${endpoint}`;
    console.log("🌐 URL completa:", fullUrl);

    // Headers para streaming
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',  // Para streaming
        'Authorization': `Bearer ${token}`,
        'FlowTenant': config.flowTenant,
        'FlowAgent': config.flowAgent
    };

    console.log("📋 Headers:", Object.keys(headers));

    const requestOptions = {
        method: 'POST',
        headers
    };

    try {
        const response = await makeRequest(fullUrl, requestOptions, payload);
        console.log("📊 Status:", response.status);

        if (response.status === 200) {
            console.log("✅ FlowHandler simulation funcionou!");
            console.log("🎉 Resposta recebida:", typeof response.data);
        } else {
            console.log("❌ Falha na simulação");
            console.log("📋 Resposta:", response.data);
        }
    } catch (error) {
        console.error("❌ Erro na simulação:", error.message);
    }
}

async function main() {
    try {
        const token = await testAuthentication();

        if (token) {
            await testFlowHandlerSimulation(token);
        } else {
            console.log("❌ Não foi possível obter token");
        }

    } catch (error) {
        console.error("❌ Erro geral:", error.message);
    }

    console.log("\n🏁 Teste concluído");
}

main();
