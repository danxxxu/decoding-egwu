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
  const [showContribute, setShowContribute] = useState(false); // New state
  const [newProverb, setNewProverb] = useState({
    proverb: "",
    translation: "",
    keyword1: "",
    keyword2: "",
    keyword3: "",
    interpretation: "",
    source: "",
    reference: "",
    media: "",
    comments: "",
  });

  const panelWidth = selectedProverb ? 350 : 0;

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

  // --- Handle submitting a new proverb ---
  const handleSubmitProverb = (e) => {
    e.preventDefault();
    const id = data?.nodes.length
      ? (parseInt(data.nodes[data.nodes.length - 1].id) + 1).toString()
      : "0";
    const keywords = [
      newProverb.keyword1,
      newProverb.keyword2,
      newProverb.keyword3,
    ].filter(Boolean);
    const newNode = { id, keywords, ...newProverb };
    setData({
      nodes: [...data.nodes, newNode],
      edges: [...data.edges],
    });
    setShowContribute(false);
    setNewProverb({
      proverb: "",
      translation: "",
      keyword1: "",
      keyword2: "",
      keyword3: "",
      interpretation: "",
      source: "",
      reference: "",
      media: "",
      comments: "",
    });
  };

  useEffect(() => {
    d3.csv("/data/proverbs.csv").then((rows) => {
      if (!rows.length) return;

      // Skip the 2nd row (explanation row)
      const cleaned = rows.filter(
        (row, i) => i > 1 && row.id !== "" && row.id !== undefined
      );

      const nodes = cleaned.map((row, i) => {
        const keywords = ["keyword1", "keyword2", "keyword3"]
          .map((col) => (row[col] || "").trim())
          .filter((k) => k.length > 0);

        return {
          id: row.id || i.toString(),
          proverb: row.proverb || "",
          translation: row.translation || "",
          keyword1: row.keyword1 || "",
          keyword2: row.keyword2 || "",
          keyword3: row.keyword3 || "",
          interpretation: row.interpretation || "",
          source: row.source || "",
          reference: row.reference || "",
          media: row.media || "",
          comments: row.comments || "",
          relations: row["relations between proverbs"] || "",
          keywords,
        };
      });

      const edges = [];
      // connect nodes based on the second keyword
      // for (let i = 0; i < nodes.length; i++) {
      //   for (let j = i + 1; j < nodes.length; j++) {
      //     const kw1 = nodes[i].keywords[1];
      //     const kw2 = nodes[j].keywords[1];
      //     if (kw1 && kw2 && kw1 === kw2)
      //       edges.push({ source: nodes[i].id, target: nodes[j].id });
      //   }
      // }

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

    // --- Grid-based cluster positioning ---
    const numClusters = firstKeywords.length;
    const numCols = Math.ceil(Math.sqrt(numClusters)); // square-ish grid
    const numRows = Math.ceil(numClusters / numCols);
    const cellWidth = width / (numCols + 1);
    const cellHeight = height / (numRows + 1);

    const clusterCenters = {};
    firstKeywords.forEach((kw, i) => {
      const col = i % numCols;
      const row = Math.floor(i / numCols);
      clusterCenters[kw] = {
        x: (col + 1) * cellWidth,
        y: (row + 1) * cellHeight,
      };
    });

    const color = d3.scaleOrdinal(d3.schemeSet3).domain(firstKeywords);

    const clusterLabels = graphGroup
      .append("g")
      .selectAll("text")
      .data(firstKeywords)
      .join("text")
      .text((kw) => kw)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("fill", (kw) => color(kw))
      .attr("opacity", 0.6);

    // --- Force simulation ---
    const simulation = d3
      .forceSimulation(nodes)
      // .force(
      //   "link",
      //   d3
      //     .forceLink(edges)
      //     .id((d) => d.id)
      //     .distance(150)
      // )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40))
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
            d.vx += (cluster.x - d.x) * 0.4 * alpha;
            d.vy += (cluster.y - d.y) * 0.4 * alpha;
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
      .attr("opacity", 1)
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
              d.translation
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
        .attr("opacity", (n) => (relatedIds.has(n.id) ? 1 : 0.3));
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

      firstKeywords.forEach((kw) => {
        const members = nodes.filter((n) => n.keywords[0] === kw);
        if (members.length === 0) return;

        // Compute cluster center
        const avgX = d3.mean(members, (n) => n.x);
        const avgY = d3.mean(members, (n) => n.y);

        // Compute cluster radius with some padding
        const maxDist = Math.max(
          ...members.map((n) => Math.hypot(n.x - avgX, n.y - avgY))
        );
        const paddedRadius = maxDist + 20; // extra 20px padding

        // Font size scaled based on cluster radius, generally bigger
        const fontSize = d3
          .scalePow()
          .exponent(2) // >1 for exponential growth
          .domain([0, 200])
          .range([18, 40])(paddedRadius);

        // Offset label above cluster center
        const labelYOffset = paddedRadius * 0.5; // move label slightly above

        clusterLabels
          .filter((d) => d === kw)
          .attr("x", avgX)
          .attr("y", avgY - labelYOffset)
          .attr("font-size", fontSize);
      });
    });

    // --- Resize ---
    const handleResize = () => {
      const newWidth = window.innerWidth - panelWidth;
      const newHeight = window.innerHeight;
      svg.attr("width", newWidth).attr("height", newHeight);
      firstKeywords.forEach((kw) => {
        clusterLabels
          .filter((d) => d === kw)
          .attr("x", clusterCenters[kw].x)
          .attr("y", clusterCenters[kw].y - 60);
      });
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
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        position: "relative",
      }}
    >
      {/* D3 Visualization */}
      <div style={{ flex: 1, position: "relative" }}>
        <svg ref={svgRef} style={{ width: "100%", height: "100%" }}></svg>

        {/* Contribute Button */}
        <button
          onClick={() => setShowContribute(true)}
          style={{
            position: "fixed",
            bottom: 40,
            left: 50,
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: 5,
            cursor: "pointer",
            zIndex: 1000,
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            fontWeight: "bold",
            fontSize: "16px",
          }}
        >
          + Contribute
        </button>
      </div>

      {/* Side Panel Modal */}
      {selectedProverb && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: panelWidth,
            height: "100%",
            backgroundColor: "#111",
            color: "#fff",
            padding: "20px",
            boxShadow: "-2px 0 10px rgba(0,0,0,0.5)",
            zIndex: 1000,
            overflowY: "auto",
          }}
        >
          {/* Close Button */}
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

          {/* Title */}
          <h2 style={{ marginTop: 0 }}>{selectedProverb.proverb}</h2>

          <br />

          {/* AUTO-GENERATED FIELDS */}
          {Object.entries(selectedProverb).map(([key, value]) => {
            // Skip force-layout fields
            if (
              [
                "id",
                "proverb",
                "x",
                "y",
                "vx",
                "vy",
                "fx",
                "fy",
                "index",
              ].includes(key)
            )
              return null;

            // Skip keyword array (optional, already shown above)
            if (key === "keywords") return null;

            // Skip proverb itself (used as title)
            // if (key === "proverb") return null;

            // do not display empty fields && change html below into {value}
            // if (!value || value.trim() === "") return null;

            const displayValue = value ? value : "—";

            // Format label (capitalize words, remove underscores)
            const label = key
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());

            return (
              <div key={key} style={{ marginBottom: "12px" }}>
                <strong>{label}:</strong>
                <p style={{ margin: "4px 0 0 0" }}>{displayValue}</p>
              </div>
            );
          })}
        </div>
      )}
      {/* Contribute Modal */}
      {showContribute && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 350,
            height: "100%",
            backgroundColor: "#222",
            color: "#fff",
            padding: 20,
            borderRadius: 8,
            boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
            zIndex: 2000,
          }}
        >
          <button
            onClick={() => setShowContribute(false)}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "transparent",
              color: "#fff",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            &times;
          </button>

          <h3>Contribute a Proverb</h3>
          <marquee>not working right now</marquee>
          <form onSubmit={handleSubmitProverb}>
            {Object.keys(newProverb).map((field) => (
              <div key={field} style={{ marginBottom: 10 }}>
                <label style={{ display: "block", marginBottom: 4 }}>
                  {field
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                  :
                </label>
                <input
                  type="text"
                  value={newProverb[field]}
                  onChange={(e) =>
                    setNewProverb({ ...newProverb, [field]: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: 6,
                    borderRadius: 4,
                    border: "1px solid #ccc",
                  }}
                />
              </div>
            ))}
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                backgroundColor: "#28a745",
                color: "#fff",
                border: "none",
                borderRadius: 5,
                cursor: "pointer",
              }}
            >
              Submit
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
