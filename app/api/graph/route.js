import { getDriver } from "@/lib/neo4j";

export async function GET() {
  const driver = getDriver();
  const session = driver.session();

  try {
    const result = await session.run(`
      MATCH (n)
      OPTIONAL MATCH (n)-[r]-(m)
      RETURN n, r, m
    `);

    const nodeMap = new Map();
    const rawEdges = [];

    for (const record of result.records) {
      const n = record.get("n");
      const r = record.get("r");
      const m = record.get("m");

      const addNode = (node) => {
        if (!node) return null;

        // This is the globally unique string ID from Neo4j
        const cleanId = node.elementId.toString();

        if (!nodeMap.has(cleanId)) {
          // 1. Extract properties and sanitize any internal 'id' property
          const sanitizedProps = { ...node.properties };

          // Check if there is a property CALLED 'id' inside the node
          if (sanitizedProps.id && typeof sanitizedProps.id === "object") {
            // Rename it or convert it to a string so it doesn't overwrite your primary ID
            sanitizedProps.db_internal_id = sanitizedProps.id.toString();
            delete sanitizedProps.id;
          }
          // Determine the display label dynamically
          let displayLabel = "Node";
          if (node.labels.includes("proverb")) {
            displayLabel = node.properties.proverb;
          } else if (node.labels.includes("meaning")) {
            displayLabel = node.properties.egwu_meaning || "egwu_meaning"; 
          } else if (node.labels.includes("subject")) {
            displayLabel = node.properties.subject || "subject"; 
          } else if (node.labels.includes("object")) {
            displayLabel = node.properties.object || "object"; 
          } else if (node.labels.includes("reference")) {
            displayLabel = node.properties.reference || "reference";
          } else {
            displayLabel = node.properties.name || node.labels[0] || "Unknown";
          }

          nodeMap.set(cleanId, {
            data: {
              ...sanitizedProps, // Spread properties FIRST
              id: cleanId, // Set the ID LAST so it is guaranteed to be the string
              label: displayLabel,
              type: node.labels?.[0] || "Unknown",
            },
          });
        }
        return cleanId;
      };
      const nId = addNode(n);
      const mId = addNode(m);

      if (r && nId && mId) {
        const mId = addNode(m);
        rawEdges.push({
          data: {
            id: r.elementId.toString(),
            source: r.startNodeElementId.toString(),
            target: r.endNodeElementId.toString(),
            label: r.type,
            ...r.properties,
          },
        });
      }
    }

    // --- CRITICAL SAFETY STEP ---
    // Get a list of all valid Node IDs
    const validNodeIds = new Set(nodeMap.keys());

    // Only keep edges where BOTH source and target exist in our validNodeIds set
    const edges = rawEdges.filter((edge) => {
      const hasSource = validNodeIds.has(edge.data.source);
      const hasTarget = validNodeIds.has(edge.data.target);

      if (!hasSource || !hasTarget) {
        console.error(
          `Removing orphan edge ${edge.data.id}: Source(${edge.data.source}) found: ${hasSource}, Target(${edge.data.target}) found: ${hasTarget}`,
        );
        return false;
      }
      return true;
    });

    const nodes = Array.from(nodeMap.values());
    // console.log(nodes)

    return new Response(JSON.stringify({ nodes, edges }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Neo4j error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  } finally {
    await session.close();
  }
}
