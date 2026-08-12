/**
 * Shared demo login used by the Convex seeder and the web auth forms.
 * Available in local development and Vercel preview deployments — never production.
 */
export const DEMO_USER = {
  email: "test@example.com",
  password: "password",
  name: "Test User",
} as const;
