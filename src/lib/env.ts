export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getAuthSecret() {
  return process.env.AUTH_SECRET ?? "development-secret";
}
