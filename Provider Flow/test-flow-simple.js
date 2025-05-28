#!/usr/bin/env node

/**
 * Teste simples da API Flow usando fetch (Node.js 18+)
 */

// Carregar variáveis de ambiente
require('dotenv').config({ path: '../.env' });

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

async function testFlowConnection() {
    console.log("🔍 Testando conexão com Flow API...");
    console.log(`URL: ${FLOW_BASE_URL}/auth-engine-api/v1/api-key/token`);
    console.log(`Tenant: ${FLOW_TENANT}`);
    console.log(`Client ID: ${FLOW_CLIENT_ID}`);
    console.log(`App: ${FLOW_APP_TO_ACCESS}`);
    console.log("---");

    try {
        const authUrl = `${FLOW_BASE_URL}/auth-engine-api/v1/api-key/token`;

        console.log("📤 Enviando requisição de autenticação...");

        const response = await fetch(authUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "FlowTenant": FLOW_TENANT,
            },
            body: JSON.stringify({
                clientId: FLOW_CLIENT_ID,
                clientSecret: FLOW_CLIENT_SECRET,
                appToAccess: FLOW_APP_TO_ACCESS,
            }),
        });

        console.log(`📡 Status: ${response.status} ${response.statusText}`);
        console.log("📋 Headers:", Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log("📄 Resposta:", responseText);

        if (response.ok) {
            try {
                const data = JSON.parse(responseText);
                if (data.access_token) {
                    console.log("✅ Sucesso! Token recebido.");
                    console.log(`🔑 Token: ${data.access_token.substring(0, 20)}...`);
                    return data.access_token;
                } else {
                    console.log("❌ Falha: Token não encontrado na resposta.");
                }
            } catch (e) {
                console.log("❌ Falha: Resposta não é JSON válido.");
            }
        } else {
            console.log(`❌ Falha: Status ${response.status}`);
        }
    } catch (error) {
        console.error("❌ Erro de conexão:", error.message);

        if (error.message.includes("fetch")) {
            console.log("💡 Dica: Problema de conectividade ou CORS.");
        }
    }
}

// Executar o teste
testFlowConnection();
