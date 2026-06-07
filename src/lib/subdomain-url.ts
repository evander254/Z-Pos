export function getShopSubdomainUrl(slug?: string | null) {
  if (!slug) return "";
  if (typeof window === "undefined") return `https://${slug}.zpos.com`;

  const { protocol, hostname, port } = window.location;
  const portSuffix = port ? `:${port}` : "";

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return `${protocol}//${slug}.localhost${portSuffix}`;
  }

  const parts = hostname.split(".");
  const baseDomain = parts.length > 2 ? parts.slice(-2).join(".") : hostname;
  return `${protocol}//${slug}.${baseDomain}${portSuffix}`;
}

export function getTenantSlugFromHost() {
  if (typeof window === "undefined") return null;

  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;

  if (hostname.endsWith(".localhost")) {
    return hostname.replace(/\.localhost$/, "") || null;
  }

  const parts = hostname.split(".");
  if (parts.length < 3) return null;

  const slug = parts[0];
  if (["www", "app", "api", "admin", "auth", "mail", "support", "help"].includes(slug)) {
    return null;
  }

  return slug || null;
}
