"use client";

import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";

if (typeof window !== "undefined") {
  cytoscape.use(coseBilkent);
}

export default function Graph() {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const tooltipRef = useRef(null); // Ref for the tooltip element
  const [data, setData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/graph");
        const json = await res.json();
        setData({ nodes: json.nodes, edges: json.edges });
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current || cyRef.current) return;

    cyRef.current = cytoscape({
      container: containerRef.current,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#555",
            shape: "ellipse",
            width: "mapData(degree, 0, 10, 40, 120)",
            height: "mapData(degree, 0, 10, 40, 120)",
            label: "data(label)",
            color: "#fff",
            "font-size": "mapData(degree, 0, 10, 8, 20)",
            "text-valign": "center",
            "text-halign": "center",
            "text-wrap": "wrap",
            "text-max-width": 80,
            "overlay-opacity": 0,
          },
        },
        {
          selector: "node[type = 'proverb'], node[type = 'Proverb']",
          style: { "background-color": "#FFD700" },
        },
        {
          selector: "node[type = 'subject'], node[type = 'Subject']",
          style: { "background-color": "#00d2ff" },
        },
        {
          selector: "node[type = 'meaning'], node[type = 'Meaning']",
          style: { "background-color": "#ff4b2b" },
        },
        {
          selector: "node[type = 'reference'], node[type = 'Reference']",
          style: { "background-color": "#a8ff78" },
        },
        {
          selector: "node[type = 'object'], node[type = 'Object']",
          style: { "background-color": "#be78ff" },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#444",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": 7,
            color: "#888",
            "target-arrow-shape": "triangle",
            "target-arrow-color": "#444",
          },
        },
        {
          selector: "node.dimmed",
          style: { opacity: 0.2 },
        },
        {
          selector: "edge.dimmed",
          style: { opacity: 0.1 },
        },
        {
          selector: "node.highlighted",
          style: {
            opacity: 1,
            "z-index": 999,
          },
        },
        {
          selector: "edge.highlighted",
          style: {
            opacity: 0.8,
            width: 4,
          },
        },
      ],
    });
  }, [mounted]);

  useEffect(() => {
    const cy = cyRef.current;
    const tooltip = tooltipRef.current;
    if (!cy || loading || !data.nodes.length) return;

    cy.batch(() => {
      cy.elements().remove();
      const getId = (id) => (id?.low ? id.toString() : String(id || ""));
      const degreeMap = {};
      data.edges.forEach((edge) => {
        degreeMap[getId(edge.data.source)] =
          (degreeMap[getId(edge.data.source)] || 0) + 1;
        degreeMap[getId(edge.data.target)] =
          (degreeMap[getId(edge.data.target)] || 0) + 1;
      });

      const nodesToAdd = data.nodes.map((n) => ({
        group: "nodes",
        data: {
          ...n.data,
          id: getId(n.data.id),
          degree: degreeMap[getId(n.data.id)] || 0,
        },
      }));
      cy.add(nodesToAdd);

      const validIds = new Set(nodesToAdd.map((n) => n.data.id));
      cy.add(
        data.edges
          .filter(
            (e) =>
              validIds.has(getId(e.data.source)) &&
              validIds.has(getId(e.data.target)),
          )
          .map((e) => ({
            group: "edges",
            data: {
              ...e.data,
              id: getId(e.data.id),
              source: getId(e.data.source),
              target: getId(e.data.target),
            },
          })),
      );
    });

    cy.resize();

    const layoutConfig = {
      name: "cose-bilkent",
      animate: true,
      randomize: false,
      fit: false,
      nodeDimensionsIncludeLabels: true,
      nodeRepulsion: 8000,
      idealEdgeLength: 80,
      edgeElasticity: 0.45,
      nestingFactor: 0.1,
      gravity: 1,
      tile: false,
      refresh: 1,
    };

    cy.layout({ ...layoutConfig, randomize: true, fit: true }).run();

    let continuousLayout;

    // --- TOOLTIP EVENTS ---
    cy.on("mouseover", "node[type = 'proverb'], node[type = 'Proverb']", (e) => {
      const node = e.target;
      const translation = node.data("translation") || "No translation available";
      if (tooltip) {
        tooltip.innerHTML = `${translation}`;
        tooltip.style.display = "block";
      }
    });

    cy.on("mousemove", "node[type = 'proverb'], node[type = 'Proverb']", (e) => {
      if (tooltip) {
        // Position tooltip relative to the rendered position on the canvas
        tooltip.style.left = e.renderedPosition.x + 15 + "px";
        tooltip.style.top = e.renderedPosition.y + 15 + "px";
      }
    });

    cy.on("mouseout", "node[type = 'proverb'], node[type = 'Proverb']", () => {
      if (tooltip) tooltip.style.display = "none";
    });

    cy.on("viewport", () => {
      if (tooltip) tooltip.style.display = "none";
    });

    // --- CLICK/TAP EVENTS ---
    cy.on("tap", "node", (e) => {
      const clickedNode = e.target;
      const connectedFamily = clickedNode
        .successors()
        .union(clickedNode.predecessors())
        .union(clickedNode);

      cy.batch(() => {
        cy.elements().addClass("dimmed").removeClass("highlighted");
        connectedFamily.removeClass("dimmed").addClass("highlighted");
      });
    });

    cy.on("tap", (e) => {
      if (e.target === cy) {
        cy.batch(() => {
          cy.elements().removeClass("dimmed").removeClass("highlighted");
        });
      }
    });

    const startPhysics = () => {
      if (continuousLayout) continuousLayout.stop();
      continuousLayout = cy.layout({
        ...layoutConfig,
        infinite: true,
        maxSimulationTime: 2000,
      });
      continuousLayout.run();
    };

    cy.on("drag", "node", () => {
      startPhysics();
      if (tooltip) tooltip.style.display = "none"; // Hide tooltip while dragging
    });

    cy.on("free", "node", () => {
      startPhysics();
    });

    return () => {
      cy.off("drag");
      cy.off("free");
      cy.off("mouseover");
      cy.off("mousemove");
      cy.off("mouseout");
      cy.off("viewport");
    };
  }, [data, loading]);

  if (!mounted) return null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "#111", overflow: "hidden" }}>
      {/* 1. The Graph Container */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
      />

      {/* 2. The Low-Tech Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          display: "none",
          pointerEvents: "none",
          backgroundColor: "#FFD700", // Gold theme
          color: "#111",
          padding: "10px 14px",
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: "500",
          maxWidth: "280px",
          zIndex: 1000,
          boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
          border: "1px solid #fff",
          lineHeight: "1.5",
          fontFamily: "sans-serif"
        }}
      />
    </div>
  );
}