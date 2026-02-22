import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({
    serviceName: "authority_tracker-frontend",
  });
}
