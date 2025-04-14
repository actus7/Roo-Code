/**
 * Módulo de Processamento Semântico Unificado
 *
 * Este módulo exporta a arquitetura unificada de processamento semântico,
 * que combina técnicas de parsing estático com inferência dinâmica para
 * fornecer uma compreensão profunda do código e do contexto de desenvolvimento.
 */

// Exportar gerenciador principal
export { SemanticProcessingManager } from './SemanticProcessingManager';

// Exportar tipos
export * from './types';

// Exportar componentes individuais para uso avançado
export { HybridAnalysisEngine } from './hybrid-analysis/HybridAnalysisEngine';
export { TemporalCorrelationEngine } from './temporal-correlation/TemporalCorrelationEngine';
export { DependencyGraphManager } from './dependency-graph/DependencyGraphManager';
export { AdaptiveContextWeightingEngine } from './context-weighting/AdaptiveContextWeightingEngine';
export { SemanticNormalizationService } from './semantic-normalization/SemanticNormalizationService';
export { BehaviorModelingEngine } from './behavior-modeling/BehaviorModelingEngine';
export { EcosystemConnectivityManager } from './ecosystem-connectivity/EcosystemConnectivityManager';
export { ContinuousValidationEngine } from './validation/ContinuousValidationEngine';

// Exportar integração com o Cline
export { ClineSemanticIntegration } from './integration/ClineSemanticIntegration';

// Exportar visualizações
export * from './views';
