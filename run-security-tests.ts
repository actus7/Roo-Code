#!/usr/bin/env tsx

/**
 * Script para executar testes de segurança do Flow Provider
 */

import { runSecurityTests } from './src/api/providers/flow/security-tests'

async function main() {
	try {
		console.log('🚀 Iniciando testes de segurança do Flow Provider...\n')
		
		await runSecurityTests()
		
		console.log('\n✅ Testes de segurança concluídos com sucesso!')
		process.exit(0)
	} catch (error) {
		console.error('\n❌ Erro ao executar testes de segurança:', error)
		process.exit(1)
	}
}

main()
