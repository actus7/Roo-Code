import * as vscode from "vscode"
import { ValidationMetric } from "../types"

/**
 * Classe responsável por criar e gerenciar a visualização do relatório de validação
 */
export class ValidationReportView {
  /**
   * Cria e exibe uma visualização do relatório de validação
   * 
   * @param metrics Lista de métricas de validação
   */
  public static show(metrics: ValidationMetric[]): void {
    // Criar um painel webview para exibir o relatório
    const panel = vscode.window.createWebviewPanel(
      'validationReport',
      'Relatório de Validação',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    
    // Agrupar métricas por dimensão
    const accuracyMetrics = metrics.filter(m => m.dimension === 'accuracy');
    const speedMetrics = metrics.filter(m => m.dimension === 'speed');
    const qualityMetrics = metrics.filter(m => m.dimension === 'quality');
    const usabilityMetrics = metrics.filter(m => m.dimension === 'usability');
    
    // Calcular médias por dimensão
    const calculateAverage = (metrics: ValidationMetric[]) => {
      if (metrics.length === 0) return 0;
      return metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length;
    };
    
    const accuracyAvg = calculateAverage(accuracyMetrics);
    const speedAvg = calculateAverage(speedMetrics);
    const qualityAvg = calculateAverage(qualityMetrics);
    const usabilityAvg = calculateAverage(usabilityMetrics);
    const overallAvg = calculateAverage(metrics);
    
    // Criar HTML para o relatório
    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Relatório de Validação</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            margin: 0;
          }
          .report-header {
            margin-bottom: 30px;
          }
          .report-section {
            margin-bottom: 40px;
          }
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          .metric-card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            padding: 15px;
          }
          .metric-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .metric-value {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .metric-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }
          .chart-container {
            height: 300px;
            margin-bottom: 30px;
          }
          .dimension-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
          }
          .dimension-title {
            font-size: 18px;
            font-weight: bold;
          }
          .dimension-average {
            font-size: 16px;
            padding: 5px 10px;
            border-radius: 15px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
          }
          .overall-score {
            text-align: center;
            margin: 40px 0;
          }
          .overall-value {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .overall-label {
            font-size: 18px;
            color: var(--vscode-descriptionForeground);
          }
          .no-metrics {
            text-align: center;
            padding: 30px;
            color: var(--vscode-descriptionForeground);
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>Relatório de Validação</h1>
          <p>Gerado em: ${new Date().toLocaleString()}</p>
        </div>
        
        ${metrics.length > 0 ? `
          <div class="overall-score">
            <div class="overall-value">${Math.round(overallAvg * 100)}%</div>
            <div class="overall-label">Pontuação Geral</div>
          </div>
          
          <div class="chart-container">
            <canvas id="dimensionsChart"></canvas>
          </div>
          
          <div class="report-section">
            <div class="dimension-header">
              <div class="dimension-title">Precisão</div>
              <div class="dimension-average">${Math.round(accuracyAvg * 100)}%</div>
            </div>
            <div class="metrics-grid">
              ${accuracyMetrics.map(metric => `
                <div class="metric-card">
                  <div class="metric-title">${metric.name}</div>
                  <div class="metric-value">${Math.round(metric.value * 100)}%</div>
                  <div class="metric-info">ID: ${metric.id}</div>
                  <div class="metric-info">Atualizado: ${new Date(metric.timestamp).toLocaleString()}</div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="report-section">
            <div class="dimension-header">
              <div class="dimension-title">Velocidade</div>
              <div class="dimension-average">${Math.round(speedAvg * 100)}%</div>
            </div>
            <div class="metrics-grid">
              ${speedMetrics.map(metric => `
                <div class="metric-card">
                  <div class="metric-title">${metric.name}</div>
                  <div class="metric-value">${Math.round(metric.value * 100)}%</div>
                  <div class="metric-info">ID: ${metric.id}</div>
                  <div class="metric-info">Atualizado: ${new Date(metric.timestamp).toLocaleString()}</div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="report-section">
            <div class="dimension-header">
              <div class="dimension-title">Qualidade</div>
              <div class="dimension-average">${Math.round(qualityAvg * 100)}%</div>
            </div>
            <div class="metrics-grid">
              ${qualityMetrics.map(metric => `
                <div class="metric-card">
                  <div class="metric-title">${metric.name}</div>
                  <div class="metric-value">${Math.round(metric.value * 100)}%</div>
                  <div class="metric-info">ID: ${metric.id}</div>
                  <div class="metric-info">Atualizado: ${new Date(metric.timestamp).toLocaleString()}</div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="report-section">
            <div class="dimension-header">
              <div class="dimension-title">Usabilidade</div>
              <div class="dimension-average">${Math.round(usabilityAvg * 100)}%</div>
            </div>
            <div class="metrics-grid">
              ${usabilityMetrics.map(metric => `
                <div class="metric-card">
                  <div class="metric-title">${metric.name}</div>
                  <div class="metric-value">${Math.round(metric.value * 100)}%</div>
                  <div class="metric-info">ID: ${metric.id}</div>
                  <div class="metric-info">Atualizado: ${new Date(metric.timestamp).toLocaleString()}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : '<div class="no-metrics">Nenhuma métrica disponível para exibição.</div>'}
        
        <script>
          // Configurar gráfico de dimensões
          const ctx = document.getElementById('dimensionsChart').getContext('2d');
          
          // Definir cores com base no tema do VS Code
          const getComputedStyle = (property) => {
            return getComputedStyle(document.documentElement).getPropertyValue(property);
          };
          
          const chart = new Chart(ctx, {
            type: 'radar',
            data: {
              labels: ['Precisão', 'Velocidade', 'Qualidade', 'Usabilidade'],
              datasets: [{
                label: 'Pontuação por Dimensão',
                data: [
                  ${Math.round(accuracyAvg * 100)},
                  ${Math.round(speedAvg * 100)},
                  ${Math.round(qualityAvg * 100)},
                  ${Math.round(usabilityAvg * 100)}
                ],
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(75, 192, 192, 1)'
              }]
            },
            options: {
              scales: {
                r: {
                  angleLines: {
                    color: 'rgba(255, 255, 255, 0.1)'
                  },
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                  },
                  pointLabels: {
                    color: 'rgba(255, 255, 255, 0.7)'
                  },
                  ticks: {
                    backdropColor: 'transparent',
                    color: 'rgba(255, 255, 255, 0.7)'
                  },
                  suggestedMin: 0,
                  suggestedMax: 100
                }
              },
              plugins: {
                legend: {
                  labels: {
                    color: 'rgba(255, 255, 255, 0.7)'
                  }
                }
              }
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}
