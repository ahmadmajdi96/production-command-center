const url = process.env.APS_DATABASE_URL;
if (!url) {
  throw new Error("Set APS_DATABASE_URL to the dedicated APS database connection.");
}

export default {
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: { url },
};
