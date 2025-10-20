"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function ProverbsVisualization() {
  const svgRef = useRef();
  const [data, setData] = useState(null);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 800,
    height: typeof window !== "undefined" ? window.innerHeight : 600,
  });
  const [selectedProverb, setSelectedProverb] = useState(null);

  const resetVisualization = () => {
    const svg = d3.select(svgRef.current);

    // Reset node opacity
    svg.selectAll("circle").transition().duration(200).attr("opacity", 1);

    // Reset link opacity
    svg
      .selectAll("line")
      .transition()
      .duration(200)
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.2);

    // Close modal
    setSelectedProverb(null);
  };

  useEffect(() => {
    d3.csv("/data/proverbs.csv").then((rows) => {
      if (!rows.length) return;

      const allColumns = Object.keys(rows[0]);
      const metaColumns = ["id", "proverb", "interpretation"];
      const keywordColumns = allColumns.filter(
        (col) => !metaColumns.includes(col.toLowerCase())
      );

      const nodes = rows.map((row, i) => {
        const keywords = keywordColumns
          .map((col) => (row[col] || "").trim())
          .filter((k) => k.length > 0);

        return {
          id: row.id || i.toString(),
          proverb: row.proverb || "",
          interpretation: row.interpretation || "",
          keywords,
        };
      });

      const edges = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const kw1 = nodes[i].keywords[1];
          const kw2 = nodes[j].keywords[1];
          if (kw1 && kw2 && kw1 === kw2)
            edges.push({ source: nodes[i].id, target: nodes[j].id });
        }
      }

      setData({ nodes, edges });
    });
  }, []);

  useEffect(() => {
    if (!data) return;

    const { nodes, edges } = data;
    const width = dimensions.width;
    const height = dimensions.height;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("background", "#000");

    svg.selectAll("*").remove();

    // Create a group for all links and nodes
    const graphGroup = svg.append("g");

    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 5]) // min and max zoom
      .on("zoom", (event) => {
        graphGroup.attr("transform", event.transform);
      });

    svg.call(zoom);

    // --- Cluster by first keyword ---
    const firstKeywords = Array.from(
      new Set(nodes.map((n) => n.keywords[0]).filter(Boolean))
    );
    const clusterCenters = {};
    firstKeywords.forEach((kw, i) => {
      clusterCenters[kw] = {
        x: (i + 1) * (width / (firstKeywords.length + 1)),
        y: height / 2,
      };
    });

    const color = d3.scaleOrdinal(d3.schemeSet3).domain(firstKeywords);

    // --- Force simulation ---
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(edges)
          .id((d) => d.id)
          .distance(150)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(100))
      .force("bounding", () => {
        nodes.forEach((d) => {
          const padding = 50; // space from edges
          d.x = Math.max(padding, Math.min(width - padding, d.x));
          d.y = Math.max(padding, Math.min(height - padding, d.y));
        });
      })
      .force("cluster", (alpha) => {
        nodes.forEach((d) => {
          const cluster = clusterCenters[d.keywords[0]];
          if (cluster) {
            d.vx += (cluster.x - d.x) * 0.15 * alpha;
            d.vy += (cluster.y - d.y) * 0.15 * alpha;
          }
        });
      });

    const link = graphGroup
      .append("g")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1.5)
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("opacity", 0.2);

    const node = graphGroup
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 6)
      .attr("fill", (d) => color(d.keywords[0]))
      .attr("stroke", (d) => color(d.keywords[0]))
      .attr("stroke-width", 1)
      .attr("opacity", 0.9)
      .attr("filter", "url(#glow)")
      .style("cursor", "pointer")
      .call(
        d3
          .drag()
          .on("start", dragStarted)
          .on("drag", dragged)
          .on("end", dragEnded)
      );

    // --- Define glow filter ---
    const defs = svg.append("defs");
    const filter = defs
      .append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");

    filter
      .append("feGaussianBlur")
      .attr("stdDeviation", "5")
      .attr("result", "blur");

    filter
      .append("feMerge")
      .selectAll("feMergeNode")
      .data(["blur", "SourceGraphic"])
      .join("feMergeNode")
      .attr("in", (d) => d);

    const tooltip = d3
      .select("body")
      .append("div")
      .style("position", "absolute")
      .style("opacity", 0)
      .style("background", "white")
      .style("padding", "6px 10px")
      .style("border-radius", "6px")
      .style("border", "1px solid #ccc")
      .style("font-size", "12px")
      .style("color", "#111")
      .style("line-height", "1.4")
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.15)")
      .style("max-width", "400px") // or whatever width you prefer
      .style("word-wrap", "break-word"); // ensures long text wraps

    node
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${d.proverb}</strong><br/><em>${
              d.interpretation
            }</em><br/><small>${d.keywords.join(", ")}</small>`
          );
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY + 10 + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    // --- Click highlight ---
    node.on("click", (event, d) => {
      event.stopPropagation();
      setSelectedProverb(d); // show modal

      const relatedIds = new Set(
        edges
          .filter((e) => e.source.id === d.id || e.target.id === d.id)
          .flatMap((e) => [e.source.id, e.target.id])
      );
      relatedIds.add(d.id);

      node
        .transition()
        .duration(200)
        .attr("opacity", (n) => (relatedIds.has(n.id) ? 1 : 0.5));
      link
        .transition()
        .duration(200)
        .attr("opacity", (l) =>
          l.source.id === d.id || l.target.id === d.id ? 1 : 0.2
        );
    });

    svg.on("click", resetVisualization);

    // --- Animate bubbles based on cluster node positions ---
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
    });

    // --- Resize ---
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      svg.attr("width", newWidth).attr("height", newHeight);
      simulation
        .force("center", d3.forceCenter(newWidth / 2, newHeight / 2))
        .alpha(0.3)
        .restart();
      setDimensions({ width: newWidth, height: newHeight });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      tooltip.remove();
      simulation.stop();
    };

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
  }, [data, dimensions.width, dimensions.height]);

  return (
    <>
      {/* D3 Visualization */}
      <svg ref={svgRef}></svg>

      {/* Side Panel Modal */}
      {selectedProverb && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: "300px",
            height: "100%",
            backgroundColor: "#111",
            color: "#fff",
            padding: "20px",
            boxShadow: "-2px 0 10px rgba(0,0,0,0.5)",
            zIndex: 1000,
            overflowY: "auto",
          }}
        >
          <h2 style={{ marginTop: 0 }}>{selectedProverb.proverb}</h2>
          <br />
          <p>
            <strong>Interpretation:</strong> {selectedProverb.interpretation}
          </p>
          <br />
          {selectedProverb.keywords.length > 0 && (
            <p>
              <strong>Keywords:</strong> {selectedProverb.keywords.join(", ")}
            </p>
          )}
          <button
            onClick={resetVisualization}
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              background: "transparent",
              color: "#fff",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              lineHeight: "1",
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
      )}
    </>
  );
}
