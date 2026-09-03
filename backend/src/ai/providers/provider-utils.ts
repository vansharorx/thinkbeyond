import env from "../../config/env";
import { AIProviderError } from "./provider.interface";

export const withProviderTimeout = (timeoutMs?: number): { signal: AbortSignal; clear: () => void } => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs && timeoutMs > 0 ? timeoutMs : env.AI_TIMEOUT_MS
  );
  const clear = () => clearTimeout(timeout);
  controller.signal.addEventListener("abort", clear, { once: true });
  return { signal: controller.signal, clear };
};

export const providerRequestError = (provider: string, error: unknown): AIProviderError => {
  if (error instanceof AIProviderError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new AIProviderError(`${provider} request timed out`, "timeout", 504);
  }
  return new AIProviderError(`${provider} provider is unavailable`, "unavailable", 502);
};

export const requireContent = (provider: string, content: unknown): string => {
  if (typeof content !== "string" || !content.trim()) {
    throw new AIProviderError(`${provider} returned an invalid response`, "response", 502);
  }
  return content.trim();
};