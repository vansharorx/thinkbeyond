import { AppError } from "../utils/AppError";

export interface CanonicalRepositorySource {
  canonicalUrl: string;
  sourceKey: string;
  owner: string;
  name: string;
}

const githubSegment = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const canonicalizeRepositoryUrl = (value: unknown): CanonicalRepositorySource => {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError("A GitHub repository URL is required", 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new AppError("Invalid GitHub repository URL", 400);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || !["github.com", "www.github.com"].includes(hostname)) {
    throw new AppError("Only HTTPS GitHub repository URLs are supported", 400);
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.port) {
    throw new AppError("GitHub repository URL contains unsupported components", 400);
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) {
    throw new AppError("GitHub repository URL must contain an owner and repository", 400);
  }

  const owner = segments[0];
  const name = segments[1].replace(/\.git$/i, "");
  if (!githubSegment.test(owner) || !name || !githubSegment.test(name)) {
    throw new AppError("GitHub repository URL contains an invalid owner or repository", 400);
  }

  const normalizedOwner = owner.toLowerCase();
  const normalizedName = name.toLowerCase();
  return {
    owner: normalizedOwner,
    name: normalizedName,
    canonicalUrl: `https://github.com/${normalizedOwner}/${normalizedName}.git`,
    sourceKey: `github:${normalizedOwner}/${normalizedName}`,
  };
};