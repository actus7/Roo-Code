import * as vscode from "vscode"
import * as path from "path"
import { DependencyNode, DependencyEdge } from "../types"

/**
 * Classe responsável por criar e gerenciar a visualização do grafo de dependências
 */
export class DependencyGraphView {
  /**
   * Cria e exibe uma visualização do grafo de dependências
   * 
   * @param filePath Caminho do arquivo
   * @param nodes Nós do grafo
   * @param edges Arestas do grafo
   */
  public static show(filePath: string, nodes: DependencyNode[], edges: DependencyEdge[]): void {
    // Criar um painel webview para exibir o grafo
    const panel = vscode.window.createWebviewPanel(
      'dependencyGraph',
      `Grafo de Dependências: ${path.basename(filePath)}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    
    // Criar HTML para o grafo usando vis.js
    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Grafo de Dependências</title>
        <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
        <style>
          body, html {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
            font-family: sans-serif;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          #graph {
            width: 100%;
            height: 100%;
          }
          .controls {
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 100;
            background-color: var(--vscode-editor-background);
            padding: 10px;
            border-radius: 5px;
            border: 1px solid var(--vscode-panel-border);
          }
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 5px 10px;
            margin: 2px;
            border-radius: 3px;
            cursor: pointer;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .legend {
            position: absolute;
            bottom: 10px;
            right: 10px;
            z-index: 100;
            background-color: var(--vscode-editor-background);
            padding: 10px;
            border-radius: 5px;
            border: 1px solid var(--vscode-panel-border);
          }
          .legend-item {
            display: flex;
            align-items: center;
            margin: 5px 0;
          }
          .legend-color {
            width: 15px;
            height: 15px;
            margin-right: 5px;
            border-radius: 50%;
          }
        </style>
      </head>
      <body>
        <div class="controls">
          <button id="zoomIn">Zoom In</button>
          <button id="zoomOut">Zoom Out</button>
          <button id="fit">Ajustar</button>
        </div>
        <div id="graph"></div>
        <div class="legend">
          <h3>Legenda</h3>
          <div class="legend-item"><div class="legend-color" style="background-color: #4CAF50;"></div> Arquivo</div>
          <div class="legend-item"><div class="legend-color" style="background-color: #2196F3;"></div> Função</div>
          <div class="legend-item"><div class="legend-color" style="background-color: #9C27B0;"></div> Classe</div>
          <div class="legend-item"><div class="legend-color" style="background-color: #FF9800;"></div> Variável</div>
          <div class="legend-item"><div class="legend-color" style="background-color: #607D8B;"></div> Import</div>
          <div class="legend-item"><div class="legend-color" style="background-color: #795548;"></div> Export</div>
          <div class="legend-item"><div class="legend-color" style="background-color: #E91E63;"></div> Componente</div>
          <div class="legend-item"><div class="legend-color" style="background-color: #00BCD4;"></div> Módulo</div>
        </div>
        <script>
          const nodes = ${JSON.stringify(nodes.map(node => ({
            id: node.id,
            label: node.name,
            group: node.type,
            title: `${node.name} (${node.type})`,
            value: (node.relevanceScore || 0.5) * 10
          })))};
          const edges = ${JSON.stringify(edges.map(edge => ({
            from: edge.source,
            to: edge.target,
            label: edge.type,
            arrows: 'to'
          })))};
          
          const container = document.getElementById('graph');
          const data = {
            nodes: new vis.DataSet(nodes),
            edges: new vis.DataSet(edges)
          };
          const options = {
            physics: {
              stabilization: true,
              barnesHut: {
                gravitationalConstant: -80000,
                springConstant: 0.001,
                springLength: 200
              }
            },
            nodes: {
              shape: 'dot',
              scaling: {
                min: 10,
                max: 30
              },
              font: {
                size: 12,
                color: 'var(--vscode-editor-foreground)'
              }
            },
            edges: {
              width: 0.15,
              color: { inherit: 'from' },
              smooth: {
                type: 'continuous'
              },
              font: {
                color: 'var(--vscode-editor-foreground)',
                size: 10
              }
            },
            groups: {
              file: { color: { background: '#4CAF50', border: '#388E3C' } },
              function: { color: { background: '#2196F3', border: '#1565C0' } },
              class: { color: { background: '#9C27B0', border: '#7B1FA2' } },
              variable: { color: { background: '#FF9800', border: '#F57C00' } },
              import: { color: { background: '#607D8B', border: '#455A64' } },
              export: { color: { background: '#795548', border: '#5D4037' } },
              component: { color: { background: '#E91E63', border: '#C2185B' } },
              module: { color: { background: '#00BCD4', border: '#0097A7' } }
            }
          };
          const network = new vis.Network(container, data, options);
          
          // Adicionar controles
          document.getElementById('zoomIn').addEventListener('click', () => {
            network.zoom(0.2);
          });
          
          document.getElementById('zoomOut').addEventListener('click', () => {
            network.zoom(-0.2);
          });
          
          document.getElementById('fit').addEventListener('click', () => {
            network.fit();
          });
        </script>
      </body>
      </html>
    `;
  }
}
