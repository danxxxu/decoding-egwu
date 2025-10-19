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
      .style("background", "#fafafa");

    svg.selectAll("*").remove();

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

    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(firstKeywords);

    const clusterCounts = {};
    nodes.forEach((n) => {
      const kw = n.keywords[0];
      if (kw) clusterCounts[kw] = (clusterCounts[kw] || 0) + 1;
    });

    const maxCount = Math.max(...Object.values(clusterCounts), 1);
    const radiusScale = d3.scaleSqrt().domain([0, maxCount]).range([50, 150]);

    // --- Draw background bubbles ---
    const bubbles = svg
      .append("g")
      .selectAll("circle")
      .data(firstKeywords)
      .join("circle")
      .attr("cx", (kw) => clusterCenters[kw].x)
      .attr("cy", (kw) => clusterCenters[kw].y)
      .attr("r", (kw) => radiusScale(clusterCounts[kw] || 1))
      .attr("fill", (kw) => color(kw))
      .attr("opacity", 0.2);

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

    const link = svg
      .append("g")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1.5)
      .selectAll("line")
      .data(edges)
      .join("line");

    const node = svg
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.proverb)
      .attr("font-size", 12)
      .attr("font-weight", "bold")
      .attr("text-anchor", "middle")
      .attr("fill", "#000")
      .call(
        d3
          .drag()
          .on("start", dragStarted)
          .on("drag", dragged)
          .on("end", dragEnded)
      );

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
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.15)");

    node
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `<em>${d.interpretation}</em><br/><small>${d.keywords.join(
              ", "
            )}</small>`
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
      const relatedIds = new Set(
        edges
          .filter((e) => e.source.id === d.id || e.target.id === d.id)
          .flatMap((e) => [e.source.id, e.target.id])
      );
      relatedIds.add(d.id);

      node
        .transition()
        .duration(200)
        .attr("opacity", (n) => (relatedIds.has(n.id) ? 1 : 0.1));
      link
        .transition()
        .duration(200)
        .attr("stroke", (l) =>
          l.source.id === d.id || l.target.id === d.id ? "#555" : "#ddd"
        )
        .attr("stroke-width", (l) =>
          l.source.id === d.id || l.target.id === d.id ? 2 : 1
        );
    });

    svg.on("click", () => {
      node.transition().duration(200).attr("opacity", 1);
      link
        .transition()
        .duration(200)
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1.5);
    });

    // --- Animate bubbles based on cluster node positions ---
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("x", (d) => d.x).attr("y", (d) => d.y);

      // Update cluster bubbles to fit nodes
      firstKeywords.forEach((kw, i) => {
        const members = nodes.filter((n) => n.keywords[0] === kw);
        if (members.length === 0) return;

        // Center bubble on average position of nodes
        const avgX = d3.mean(members, (n) => n.x);
        const avgY = d3.mean(members, (n) => n.y);

        // Radius based on max distance from center
        const maxDist = Math.max(
          ...members.map((n) => Math.hypot(n.x - avgX, n.y - avgY))
        );
        const r = Math.max(maxDist + 40, 50); // min radius 50

        bubbles
          .filter((b) => b === kw)
          .attr("cx", avgX)
          .attr("cy", avgY)
          .attr("r", r);
      });
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

  return <svg ref={svgRef}></svg>;
}
