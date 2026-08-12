import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./betterAuth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

export default http;
