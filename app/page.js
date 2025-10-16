"use client";

import dynamic from "next/dynamic";

// Lazy-load the D3 visualization so it only runs on the client
const ProverbsVisualization = dynamic(() => import("./components/ProverbsVisualization"), {
  ssr: false,
});

export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Decoding Egwu</h1>
      <p style={{ marginBottom: 16, color: "#555" }}>
        This page shows relationships between Igbo proverbs containing egwu based
        on shared meanings and themes.
      </p>
      <ProverbsVisualization />
    </main>
  );
}
