"use client";

import dynamic from "next/dynamic";

// Lazy-load the D3 visualization so it only runs on the client
const ProverbsVisualization = dynamic(() => import("./components/ProverbsVisualization"), {
  ssr: false,
});

export default function Page() {
  return (
    <main>
      <h1 style={{ fontSize: 28, margin: 5 }}><a href="https://starts.eu/detail/afropean-intelligence-challenge-2" target="_blank">Decoding Egwu</a></h1>
      {/* <p style={{ margin: 8, color: "#555" }}>
        This page shows relationships between Igbo proverbs containing egwu based
        on shared meanings and themes.
      </p> */}
      <ProverbsVisualization />
    </main>
  );
}
