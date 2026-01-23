import { defineApp } from "convex/server";
import betterAuth from "@convex-dev/better-auth/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import tableHistory from "convex-table-history/convex.config";

const app = defineApp();
app.use(betterAuth);
app.use(migrations);
app.use(tableHistory, { name: "babyAuditLog" });

export default app;
