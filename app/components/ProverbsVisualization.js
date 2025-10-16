"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

// === Example Igbo proverbs data ===
const proverbs = [
  {
    id: 1,
    text: "Nnụnụ benyere n'ọdụ igu na-achọ egwu ọ ga-agba.",
    translation: "The bird that perches on a fence is looking for a dance to dance.",
    keywords: ["dance", "nonhuman", "bird"],
  },
  {
    id: 2,
    text: "Nwa mgbada gbajiri ụkwụ ya n'egwu tupu oge eji agba egwu eruo.",
    translation: "The deer already dances itself to a broken waist before the time to dance arrives.",
    keywords: ["dance", "nonhuman", "deer"],
  },
  {
    id: 3,
    text: "A na-egwu egwu na ebisa aka na ikpu, ndị nwụrụ anwụ a na-alọ ụwa.",
    translation: "When you are playing with hands to the vagina: the spirits are returning to the world.",
    keywords: ["play", "sex"],
  },
  {
    id: 4,
    text: "Onwekwara egwu ezi na-agaghị agba?",
    translation: "Is there a music/dance that cannot be danced to?",
    keywords: ["dance", "music"],
  },
  {
    id: 5,
    text: "Atụrụ sị na a kụrụ egwu ruo na be ya, ọ bụrụ na ọ maghị agba, ọ wụliwe elu.",
    translation: "The sheep said that in as much as it does not know how to dance, if musicians pass in front of its fathers house and it does not know what to do, it will start jumping.",
    keywords: ["dance", "nonhuman", "sheep"],
  },
];

export default function ProverbsVisualization() {
  const svgRef = useRef();

  useEffect(() => {
    const width = window.innerWidth * 0.95;
    const height = 600;

    // Clear previous SVG content
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("background", "#fafafa")
      .style("border-radius", "8px");
    svg.selectAll("*").remove();

    // === Build edges based on shared keywords ===
    const edges = [];
    for (let i = 0; i < proverbs.length; i++) {
      for (let j = i + 1; j < proverbs.length; j++) {
        const shared = proverbs[i].keywords.filter((k) =>
          proverbs[j].keywords.includes(k)
        );
        if (shared.length > 0) {
          edges.push({
            source: proverbs[i].id,
            target: proverbs[j].id,
            keywords: shared,
          });
        }
      }
    }

    const nodes = proverbs.map((p) => ({
      id: p.id,
      label: p.text,
      translation: p.translation,
      keywords: p.keywords,
    }));

    // === Cluster setup ===
    const keywords = Array.from(
      new Set(proverbs.flatMap((p) => p.keywords))
    );
    const clusterCenters = {};
    keywords.forEach((kw, i) => {
      clusterCenters[kw] = {
        x: (i + 1) * (width / (keywords.length + 1)),
        y: height / 2,
      };
    });

    const color = d3.scaleOrdinal(d3.schemeTableau10);

    // === Force simulation ===
    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(edges).id((d) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(50)) // avoid overlap
      .force("cluster", (alpha) => {
        nodes.forEach((d) => {
          const cluster = clusterCenters[d.keywords[0]]; // first keyword
          d.vx += (cluster.x - d.x) * 0.05 * alpha;
          d.vy += (cluster.y - d.y) * 0.05 * alpha;
        });
      });

    // === Links ===
    const link = svg
      .append("g")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1.5)
      .selectAll("line")
      .data(edges)
      .join("line");

    // === Nodes as text ===
    const node = svg
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", 12)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => color(d.keywords[0]))
      .call(
        d3
          .drag()
          .on("start", dragStarted)
          .on("drag", dragged)
          .on("end", dragEnded)
      );

    // === Tooltip ===
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
      .style("color", "#535353ff"); 

    node
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `<em>${d.translation}</em><br/><small>${d.keywords.join(
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

    // === Simulation tick ===
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("x", (d) => d.x).attr("y", (d) => d.y);
    });

    // === Drag handlers ===
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

    // Cleanup tooltip on unmount
    return () => tooltip.remove();
  }, []);

  return <svg ref={svgRef}></svg>;
}
