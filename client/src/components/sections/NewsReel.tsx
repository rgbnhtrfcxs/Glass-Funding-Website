import { useEffect, useState } from "react";

type NewsItem = {
  id: number;
  lab_id: number;
  title: string;
  summary: string;
  category?: string | null;
  images?: Array<{ url: string; name?: string }>;
  created_at?: string;
  labs?: { name?: string | null; subscription_tier?: string | null };
};

interface NewsReelProps {
  title?: string;
  description?: string;
  limit?: number;
  className?: string;
}

export function NewsReel({ title = "Latest news", description, limit = 20, className = "" }: NewsReelProps) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/news/public?limit=${limit}`);
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.includes("application/json")) {
          await res.text();
          throw new Error("Unable to load news");
        }
        const payload = await res.json();
        if (active) setItems(Array.isArray(payload?.news) ? payload.news : []);
      } catch (err: any) {
        if (active) setError(err?.message || "Unable to load news");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [limit]);

  return (
    <section className={`rounded-3xl border border-border bg-card/80 p-6 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">News</p>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">Loading news…</div>
      )}
      {error && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-full">
            {items.length === 0 && (
              <div className="min-w-[260px] rounded-2xl border border-dashed border-border bg-background/60 px-4 py-4 text-sm text-muted-foreground">
                No news yet. Check back soon.
              </div>
            )}
            {items.map(item => {
              const labName = item.labs?.name || `Lab ${item.lab_id}`;
              const created = item.created_at ? new Date(item.created_at).toLocaleDateString() : "";
              return (
                <div
                  key={item.id}
                  className="min-w-[260px] max-w-[280px] rounded-2xl border border-border bg-background/70 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted/60 px-2 py-1 text-[11px] capitalize">{item.category || "update"}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground line-clamp-2">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{item.summary}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">{labName}</span>
                    <span className="text-[11px]">{created}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.images?.slice(0, 2).map(img => (
                      <img
                        key={img.url}
                        src={img.url}
                        alt={img.name || "news"}
                        className="h-14 w-14 rounded-lg object-cover border border-border"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
