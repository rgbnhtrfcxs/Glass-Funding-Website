import { useEffect, useState } from "react";

export type PricingTier = {
  name: string;
  monthly_price: number | null;
  yearly_price?: number | null;
  currency?: string | null;
  description: string;
  highlights: string[];
  featured?: boolean;
};

const defaultTiers: PricingTier[] = [
  {
    name: "Base",
    monthly_price: 0,
    yearly_price: 0,
    description: "Launch on GLASS-Connect with the essentials.",
    highlights: ["Profile page", "Equipment showcase", "Inbound contact form"],
    featured: false,
  },
  {
    name: "Verified",
    monthly_price: 99,
    yearly_price: 999,
    description: "Add the badge researchers trust.",
    highlights: ["Remote/on-site verification", "Badge on listing", "Priority placement"],
    featured: false,
  },
  {
    name: "Premier",
    monthly_price: 199,
    yearly_price: 1990,
    description: "Flagship placement plus media support.",
    highlights: ["Free verification", "Direct collaboration management", "Seminar access"],
    featured: true,
  },
];

export function usePricing() {
  const [tiers, setTiers] = useState<PricingTier[]>(defaultTiers);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/pricing");
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.includes("application/json")) {
          await res.text();
          return;
        }
        const payload = await res.json();
        if (active && Array.isArray(payload?.tiers) && payload.tiers.length) {
          const normalized = payload.tiers
            .map((t: any) => ({
              name: t.name,
              monthly_price: t.monthly_price === undefined ? null : t.monthly_price,
              yearly_price: t.yearly_price === undefined ? null : t.yearly_price,
              currency: t.currency ?? null,
              description: t.description,
              highlights: Array.isArray(t.highlights) ? t.highlights : [],
              featured: Boolean(t.featured),
            }))
            .filter((t: PricingTier) => t.name.toLowerCase().trim() !== "custom");
          setTiers(normalized);
        }
      } catch {
        // keep defaults
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return { tiers, loading };
}
