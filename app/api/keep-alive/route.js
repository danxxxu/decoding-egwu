import { getDriver } from "@/lib/neo4j";

export async function GET() {
  const driver = getDriver();
  const session = driver.session();

  try {
    // A simple query to reset the 72-hour timer
    await session.run('MATCH (n) RETURN count(n) LIMIT 1');
    return new Response(JSON.stringify({ status: 'Aura instance is awake' }), {
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  } finally {
    await session.close();
    // await driver.close();
  }
}