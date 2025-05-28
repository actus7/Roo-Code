#!/usr/bin/env node

/**
 * Script para testar a conexão com a API Flow
 * Execute: node test-flow-connection.js
 */

// Carregar variáveis de ambiente
require('dotenv').config({ path: '../.env' });

const https = require('https');

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

console.log("🔍 Testando conexão com Flow API...");
console.log(`URL: ${FLOW_BASE_URL}/auth-engine-api/v1/api-key/token`);
console.log(`Tenant: ${FLOW_TENANT}`);
console.log(`Client ID: ${FLOW_CLIENT_ID}`);
console.log(`App: ${FLOW_APP_TO_ACCESS}`);
console.log("---");

const postData = JSON.stringify({
    clientId: FLOW_CLIENT_ID,
    clientSecret: FLOW_CLIENT_SECRET,
    appToAccess: FLOW_APP_TO_ACCESS
});

const options = {
    hostname: 'flow.ciandt.com',
    port: 443,
    path: '/auth-engine-api/v1/api-key/token',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'FlowTenant': FLOW_TENANT,
        'Content-Length': Buffer.byteLength(postData)
    },
    timeout: 30000
};

const req = https.request(options, (res) => {
    console.log(`📡 Status: ${res.statusCode} ${res.statusMessage}`);
    console.log('📋 Headers:', res.headers);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('📄 Resposta:', data);

        if (res.statusCode === 200) {
            try {
                const jsonData = JSON.parse(data);
                if (jsonData.access_token) {
                    console.log('✅ Sucesso! Token recebido.');
                } else {
                    console.log('❌ Falha: Token não encontrado na resposta.');
                }
            } catch (e) {
                console.log('❌ Falha: Resposta não é JSON válido.');
            }
        } else {
            console.log(`❌ Falha: Status ${res.statusCode}`);
        }
    });
});

req.on('error', (e) => {
    console.error('❌ Erro de conexão:', e.message);

    if (e.code === 'ENOTFOUND') {
        console.log('💡 Dica: Verifique se você está conectado à internet e se o hostname está correto.');
    } else if (e.code === 'ECONNREFUSED') {
        console.log('💡 Dica: A conexão foi recusada. Verifique se o serviço está rodando.');
    } else if (e.code === 'ETIMEDOUT') {
        console.log('💡 Dica: Timeout. Verifique sua conexão de rede ou VPN.');
    }
});

req.on('timeout', () => {
    console.error('❌ Timeout: A conexão demorou mais de 30 segundos.');
    req.destroy();
});

console.log('📤 Enviando requisição...');
req.write(postData);
req.end();
