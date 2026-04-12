import type { LabPartner } from "@shared/labs";

export const resolveLabParam = (value: string | undefined | null) => (value ?? "").trim();

export const labMatchesParam = (lab: Pick<LabPartner, "id" | "slug">, value: string | undefined | null) => {
  const param = resolveLabParam(value);
  if (!param) return false;
  if (lab.slug && lab.slug === param) return true;
  return String(lab.id) === param;
};

export const getLabHref = (lab: Pick<LabPartner, "id" | "slug">) => `/labs/${lab.slug || lab.id}`;
