import type { Org } from "@shared/orgs";

export const resolveOrgParam = (value: string | undefined | null) => (value ?? "").trim();

export const orgMatchesParam = (org: Pick<Org, "id" | "slug">, value: string | undefined | null) => {
  const param = resolveOrgParam(value);
  if (!param) return false;
  if (org.slug && org.slug === param) return true;
  return String(org.id) === param;
};

export const getOrgHref = (org: Pick<Org, "id" | "slug">) => `/orgs/${org.slug || org.id}`;
