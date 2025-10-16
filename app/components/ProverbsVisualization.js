"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

const proverbs = [
  {
    id: 1,
    text: "Ome ka omere, ọ ga-eme ya ọzọ.",
    translation: "As one acts, so shall it be done to them.",
    keywords: ["justice", "behavior"],
  },
  {
    id: 2,
    text: "Nwata kụrụ aka n’ọkpọ, ọkpọ akụrụ ya aka.",
    translation: "When a child claps for the spirit, the spirit claps back.",
    keywords: ["reciprocity", "behavior"],
  },
  {
    id: 3,
    text: "A na-amaghị ihe ọkụkụ ga-esi, a na-akụ ya.",
    translation: "You plant a crop without knowing how it will turn out.",
    keywords: ["patience", "faith"],
  },
  {
    id: 4,
    text: "Mmiri anaghị egbu ọkụ, ma ọ na-egbochi ya.",
    translation: "Water does not kill fire, but it restrains it.",
    keywords: ["balance", "nature"],
  },
  {
    id: 5,
    text: "E jiri mara nwa okorobịa bụ isi ike.",
    translation: "A young man is known by his strength.",
    keywords: ["strength", "youth"],
  },
];

export default function ProverbsVisualization() {
  const svgRef = useRef();

  useEffect(() => {
    const width = 900;
    const height = 600;
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("background", "#fafafa")
      .style("border-radius", "8px");

    svg.selectAll("*").remove();

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

    const color = d3.scaleOrdinal(d3.schemeTableau10);

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(edges).id((d) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg
      .append("g")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1.5)
      .selectAll("line")
      .data(edges)
      .join("line");

    const node = svg
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 10)
      .attr("fill", (d) => color(d.keywords[0]))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .call(
        d3
          .drag()
          .on("start", dragStarted)
          .on("drag", dragged)
          .on("end", dragEnded)
      );

    const label = svg
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) =>
        d.label.length > 28 ? d.label.slice(0, 25) + "…" : d.label
      )
      .attr("font-size", 10)
      .attr("dx", 14)
      .attr("dy", 4)
      .attr("fill", "#333")
      .attr("pointer-events", "none");

    const tooltip = d3
      .select("body")
      .append("div")
      .style("position", "absolute")
      .style("opacity", 0)
      .style("background", "white")
      .style("padding", "6px 10px")
      .style("border-radius", "6px")
      .style("border", "1px solid #ccc")
      .style("font-size", "12px");

    node
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${d.label}</strong><br/><em>${d.translation}</em><br/><small>${d.keywords.join(
              ", "
            )}</small>`
          );
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      label.attr("x", (d) => d.x).attr("y", (d) => d.y);
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

    return () => tooltip.remove();
  }, []);

  return <svg ref={svgRef}></svg>;
}
