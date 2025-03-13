import axios from "axios";
import axiosRetry from "axios-retry";
import { v4 as uuidv4 } from "uuid";
import { env } from "@/app/config/env";
import { getTokens } from "@/features/auth/lib/token-manager";

export const api = axios.create({
  baseURL: env.API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Explicitly disable retries
axiosRetry(api, { retries: 0 });

// Add request ID and auth token to each request
api.interceptors.request.use((config) => {
  // Add request ID
  config.headers["X-Request-Id"] = uuidv4();

  // Add auth token if available
  const tokens = getTokens();
  if (tokens?.idToken) {
    config.headers["Authorization"] = `Bearer ${tokens.idToken}`;
  }

  return config;
});
