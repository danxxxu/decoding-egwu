import neo4j from "neo4j-driver";

let driver;

export function getDriver() {
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(
        process.env.NEO4J_USERNAME,
        process.env.NEO4J_PASSWORD
      )
    );
  }
  return driver;
}
