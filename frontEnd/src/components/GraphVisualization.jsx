import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import "./GraphVisualization.css";
import { getAnalysisText } from "../utils/api";

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
      console.error("Erro ao buscar texto:", err);
    } finally {
      setLoadingText(false);
    }
  };

  useEffect(() => {
    if (!data || !data.nodes || !data.edges) return;

    const svg = d3.select(svgRef.current);
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;

    // Clear previous
    svg.selectAll("*").remove();

    // Create group for zoom/pan
    const g = svg.append("g");

    // Setup zoom behavior
    const zoomBehavior = d3.zoom().on("zoom", (event) => {
      g.attr("transform", event.transform);
      setZoom(event.transform.k);
    });

    svg.call(zoomBehavior);

    // Prepare data

    const nodes = data.nodes.map((n, i) => ({
      ...n,
      id: n.id || `node-${i}`,
      x: Math.random() * width,
      y: Math.random() * height,
    }));

    const edges = data.edges || [];

    // Create simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(edges)
          .id((d) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("collide", d3.forceCollide().radius(50))
      .force("center", d3.forceCenter(width / 2, height / 2));

    // Draw edges
    const edgeElements = g
      .selectAll("line")
      .data(edges)
      .enter()
      .append("line")
      .attr("class", (d) => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        return `edge edge-${sourceId}-${targetId}`;
      })
      .attr("stroke", "#ccc")
      .attr("stroke-width", (d) =>
        Math.max(1, Math.min(8, (d.weight || 1) * 2))
      )
      .attr("marker-end", "url(#arrowhead)")
      .on("mouseenter", function (event, d) {
        setHoveredEdge(d);
        d3.select(this)
          .attr("stroke", "#666")
          .attr("stroke-width", (d) =>
            Math.max(2, Math.min(10, (d.weight || 1) * 2))
          );
      })
      .on("mouseleave", function () {
        setHoveredEdge(null);
        d3.select(this)
          .attr("stroke", "#ccc")
          .attr("stroke-width", (d) =>
            Math.max(1, Math.min(8, (d.weight || 1) * 2))
          );
      });

    // Add arrowhead marker
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("markerWidth", 10)
      .attr("markerHeight", 10)
      .attr("refX", 9)
      .attr("refY", 3)
      .attr("orient", "auto")
      .append("polygon")
      .attr("points", "0 0, 10 3, 0 6")
      .attr("fill", "#ccc");

    // Draw nodes
    const nodeElements = g
      .selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .call(
        d3
          .drag()
          .on("start", dragStarted)
          .on("drag", dragged)
          .on("end", dragEnded)
      );

    nodeElements
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .text((d) => d.label || d.id)
      .attr("font-size", (d) => {
        const freq = d.frequency || 5;
        return Math.max(12, Math.min(48, freq * 2));
      })
      .attr("font-weight", "bold")
      .attr("letter-spacing", "-1px")
      .attr("fill", (d) => {
        const ratio = (d.outDegree || 0) / Math.max(1, d.inDegree || 1);
        const hsl = d3.hsl(210, 1, 0.5 - Math.log(ratio + 1) * 0.1);
        return hsl.toString();
      })
      .on("mouseenter", function (event, d) {
        setHoveredNode(d);
        d3.select(this)
          .attr("font-size", (d) =>
            Math.max(14, Math.min(50, (d.frequency || 5) * 2.2))
          )
          .attr("fill", "#003366");
      })
      .on("mouseleave", function (event, d) {
        setHoveredNode(null);
        d3.select(this)
          .attr("font-size", (d) =>
            Math.max(12, Math.min(48, (d.frequency || 5) * 2))
          )
          .attr("fill", (d) => {
            const ratio = (d.outDegree || 0) / Math.max(1, d.inDegree || 1);
            const hsl = d3.hsl(210, 1, 0.5 - Math.log(ratio + 1) * 0.1);
            return hsl.toString();
          });
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        setSelectedNode(d.id === selectedNode ? null : d.id);
      });

    // Update positions
    simulation.on("tick", () => {
      edgeElements
        .attr("x1", (d) => d.source.x || 0)
        .attr("y1", (d) => d.source.y || 0)
        .attr("x2", (d) => d.target.x || 0)
        .attr("y2", (d) => d.target.y || 0);

      nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);
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

    // Reset zoom button
    const resetZoom = () => {
      svg
        .transition()
        .duration(750)
        .call(zoomBehavior.transform, d3.zoomIdentity.translate(0, 0).scale(1));
      setZoom(1);
    };

    return () => {
      simulation.stop();
    };
  }, [data, selectedNode]);

  return (
    <div className="graph-visualization">
      <div className="graph-header">
        <h2>📊 Visualização de Rede</h2>
        {data && (
          <button
            className="btn-show-text"
            onClick={() => setShowTextPanel(!showTextPanel)}
          >
            {showTextPanel ? "🔼 Ocultar Texto" : "📄 Ver Texto"}
          </button>
        )}
      </div>

      {error && <div className="error-message">❌ {error}</div>}

      {successMessage && !error && (
        <div className="success-message">✅ {successMessage}</div>
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
              width: "100%",
              height: "100%",
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

          {/* 🆕 PAINEL DE TEXTO */}
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
              <div>Frequência: {hoveredNode.frequency || "N/A"}</div>
              <div>In-degree: {hoveredNode.inDegree || 0}</div>
              <div>Out-degree: {hoveredNode.outDegree || 0}</div>
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
