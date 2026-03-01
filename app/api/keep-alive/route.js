import { getDriver } from "@/lib/neo4j";

export async function GET() {
  const driver = getDriver();
  const session = driver.session();

  try {
    // A simple query to reset the 72-hour timer
    await session.run(`
      MERGE (h:Heartbeat {id: 'vercel-ping'})
      SET h.lastActive = datetime()
      RETURN h.lastActive
    `);
    return new Response(
      JSON.stringify({ status: "Success: Write activity recorded" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );ß
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  } finally {
    await session.close();
    // await driver.close();
  }
}
