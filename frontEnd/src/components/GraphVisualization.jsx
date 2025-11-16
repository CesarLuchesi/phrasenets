import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { getAnalysisText } from '../utils/api';
import './GraphVisualization.css';

function GraphVisualization({ data, loading, error, successMessage }) {
  const svgRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [analysisText, setAnalysisText] = useState(null);
  const [loadingText, setLoadingText] = useState(false);
  const [showTextPanel, setShowTextPanel] = useState(false);

  useEffect(() => {
    if (data && !loading && successMessage) {
      fetchAnalysisText();
    }
  }, [data, loading, successMessage]);

  const fetchAnalysisText = async () => {
    setLoadingText(true);
    try {
      const result = await getAnalysisText();
      setAnalysisText(result.text);
    } catch (err) {
      console.error('Erro ao buscar texto:', err);
    } finally {
      setLoadingText(false);
    }
  };

  useEffect(() => {
    if (!data || !data.nodes || !data.edges) return;

    const svg = d3.select(svgRef.current);
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;

    svg.selectAll("*").remove();

    const g = svg.append('g');

    const zoomBehavior = d3.zoom().on('zoom', (event) => {
      g.attr('transform', event.transform);
      setZoom(event.transform.k);
    });

    svg.call(zoomBehavior);

    // 🆕 PREPARAR DADOS COM CÁLCULO CORRETO
    const nodes = data.nodes.map((n, i) => {
      const inDegree = Math.max(1, n.inDegree || 1);
      const outDegree = n.outDegree || 0;
      const ratio = outDegree / inDegree;
      
      return {
        ...n,
        id: n.id || `node-${i}`,
        x: Math.random() * width,
        y: Math.random() * height,
        inDegree,
        outDegree,
        ratio,
      };
    });

    const edges = data.edges || [];

    // Criar simulação
    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(edges)
        .id((d) => d.id)
        .distance((d) => {
          const weight = d.weight || 1;
          return 80 + weight * 20;
        })
        .strength(0.5)
      )
      .force('charge', d3.forceManyBody().strength(-250))
      .force('collide', d3.forceCollide().radius(40))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // 🆕 DEFINIR ESCALA DE CORES AZUL (como no artigo)
    const colorScale = d3.scaleLinear()
      .domain([0, 1, 3])
      .range(['#99CCFF', '#3366CC', '#003366'])
      .clamp(true);

    // Adicionar marcadores de seta (MENORES)
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('refX', 8)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 8 3, 0 6')
      .attr('fill', '#999999');

    svg.append('defs').append('marker')
      .attr('id', 'arrowhead-hover')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('refX', 8)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 8 3, 0 6')
      .attr('fill', '#333333');

    // Desenhar arestas (ESPESSURA REDUZIDA)
    const edgeElements = g
      .selectAll('line.edge')
      .data(edges)
      .enter()
      .append('line')
      .attr('class', 'edge')
      .attr('stroke', '#cccccc')
      .attr('stroke-width', (d) => {
        const weight = Math.max(1, d.weight || 1);
        return Math.max(0.5, Math.min(3, weight * 0.5));
      })
      .attr('marker-end', 'url(#arrowhead)')
      .attr('opacity', 0.6)
      .on('mouseenter', function (event, d) {
        setHoveredEdge(d);
        d3.select(this)
          .attr('stroke', '#333333')
          .attr('stroke-width', (d) => {
            const weight = Math.max(1, d.weight || 1);
            return Math.max(1, Math.min(4, weight * 0.7));
          })
          .attr('marker-end', 'url(#arrowhead-hover)')
          .attr('opacity', 1);
      })
      .on('mouseleave', function () {
        setHoveredEdge(null);
        d3.select(this)
          .attr('stroke', '#cccccc')
          .attr('stroke-width', (d) => {
            const weight = Math.max(1, d.weight || 1);
            return Math.max(0.5, Math.min(3, weight * 0.5));
          })
          .attr('marker-end', 'url(#arrowhead)')
          .attr('opacity', 0.6);
      });

    // Desenhar nós
    const nodeElements = g
      .selectAll('g.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded)
      );

    // 🆕 RENDERIZAR TEXTO COM ESCALA DE TONS
    nodeElements
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('dy', '0.35em')
      .text((d) => d.label || d.id)
      .attr('font-size', (d) => {
        const freq = Math.max(1, d.frequency || 3);
        return Math.max(11, Math.min(42, freq * 1.8));
      })
      .attr('font-weight', 900)
      .attr('letter-spacing', '-0.5px')
      .attr('fill', (d) => {
        const color = colorScale(Math.log(d.ratio + 1));
        return color;
      })
      .attr('pointer-events', 'none')
      .attr('text-rendering', 'geometricPrecision')
      .on('mouseenter', function (event, d) {
        setHoveredNode(d);
        d3.select(this)
          .attr('font-size', (d) => {
            const freq = Math.max(1, d.frequency || 3);
            return Math.max(13, Math.min(48, freq * 2.0));
          })
          .attr('fill', '#000000')
          .attr('font-weight', 900)
          .attr('filter', 'drop-shadow(0px 0px 4px rgba(51, 102, 204, 0.5))');
      })
      .on('mouseleave', function (event, d) {
        setHoveredNode(null);
        d3.select(this)
          .attr('font-size', (d) => {
            const freq = Math.max(1, d.frequency || 3);
            return Math.max(11, Math.min(42, freq * 1.8));
          })
          .attr('fill', (d) => {
            const color = colorScale(Math.log(d.ratio + 1));
            return color;
          })
          .attr('font-weight', 900)
          .attr('filter', 'none');
      })
      .on('click', function (event, d) {
        event.stopPropagation();
        setSelectedNode(d.id === selectedNode ? null : d.id);
      });

    // Atualizar posições
    simulation.on('tick', () => {
      edgeElements
        .attr('x1', (d) => d.source.x || 0)
        .attr('y1', (d) => d.source.y || 0)
        .attr('x2', (d) => d.target.x || 0)
        .attr('y2', (d) => d.target.y || 0);

      nodeElements
        .attr('transform', (d) => `translate(${d.x},${d.y})`)
        .style('pointer-events', 'auto');
    });

    function dragStarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [data, selectedNode]);

  return (
    <div className="graph-visualization">
      <div className="graph-header">
        <div className="header-content">
          <h2>📊 Visualização de Rede</h2>
          <div className="color-legend">
            <span className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#99CCFF' }}></span>
              Entrada
            </span>
            <span className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#3366CC' }}></span>
              Balanceado
            </span>
            <span className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#003366' }}></span>
              Saída
            </span>
          </div>
        </div>
        {data && (
          <button 
            className="btn-show-text"
            onClick={() => setShowTextPanel(!showTextPanel)}
          >
            {showTextPanel ? '🔼 Ocultar Texto' : '📄 Ver Texto'}
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {successMessage && !error && (
        <div className="success-message">
          ✅ {successMessage}
        </div>
      )}

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Processando análise...</p>
        </div>
      )}

      {!data && !loading && !error && (
        <div className="empty-state">
          <p>👈 Cole um texto ou upload um arquivo para começar</p>
        </div>
      )}

      {data && !loading && (
        <>
          <svg 
            ref={svgRef} 
            className="graph-svg"
            style={{
              width: '100%',
              height: '100%'
            }}
          ></svg>
          
          <div className="graph-stats">
            <div className="stat">
              <strong>Nós:</strong> {data.node_count || 0}
            </div>
            <div className="stat">
              <strong>Arestas:</strong> {data.edge_count || 0}
            </div>
          </div>

          {showTextPanel && (
            <div className="text-panel">
              <div className="text-panel-header">
                <h3>📝 Texto Analisado</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowTextPanel(false)}
                >
                  ✕
                </button>
              </div>
              <div className="text-content">
                {loadingText ? (
                  <p className="loading-text">Carregando texto...</p>
                ) : analysisText ? (
                  <p>{analysisText}</p>
                ) : (
                  <p className="no-text">Texto não disponível</p>
                )}
              </div>
            </div>
          )}

          {hoveredNode && (
            <div className="tooltip">
              <strong>{hoveredNode.label || hoveredNode.id}</strong>
              <div>Frequência: {hoveredNode.frequency || 'N/A'}</div>
              <div>In-degree: {hoveredNode.inDegree || 0}</div>
              <div>Out-degree: {hoveredNode.outDegree || 0}</div>
              <div>Razão: {(hoveredNode.ratio || 0).toFixed(2)}</div>
            </div>
          )}

          {hoveredEdge && (
            <div className="tooltip edge-tooltip">
              <strong>Peso: {hoveredEdge.weight || 1}</strong>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default GraphVisualization;
