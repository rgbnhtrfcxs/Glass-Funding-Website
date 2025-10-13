import { Footer } from "@/components/sections/footer";

export default function Roadmap() {
  return (
    <div className="min-h-screen bg-background pt-32 pb-32">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Product Roadmap</h1>
          <p className="text-lg text-muted-foreground">
            We’re a small team of students with a big mission — to make scientific and technological
            research funding transparent, accessible, and efficient. This roadmap outlines the key
            phases that will shape the future of Glass, from our early foundation to full-scale
            tokenised funding infrastructure.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,_1.1fr)_minmax(0,_0.9fr)] lg:items-start">
          {/* Left side: Roadmap description */}
          <div className="bg-card border border-border rounded-3xl shadow-sm p-8 lg:p-10 h-full">
            <h2 className="text-2xl font-semibold mb-6">Roadmap Overview</h2>

            <div className="space-y-10 text-muted-foreground leading-relaxed">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Phase 0 — Foundation</h3>
                <p>
                  Designing and coding the first version of Glass — a transparent donation platform
                  that sets the groundwork for everything to come. This phase focuses on structure,
                  testing, and proving that research funding can be simpler and more direct.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Phase 1 — Donation Platform</h3>
                <p>
                  Launch of the public platform where anyone can fund research projects directly by
                  category or cause. The focus is on transparency, accessibility, and trust —
                  every donation is traceable, and every project is verified before it goes live.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Phase 2 — Investment Wing</h3>
                <p>
                  Introduction of the investment side of Glass. Here, research projects evolve from
                  donation-based support to structured investments — allowing individuals,
                  institutions, and funds to take part in scientific innovation with real data and
                  measurable impact.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Phase 3 — Tokenisation & Expansion</h3>
                <p>
                  Glass becomes a fully integrated funding infrastructure, where each project can be
                  represented by digital tokens. This enables fractional ownership, transparent
                  profit distribution, and global scalability — turning research into a new class of
                  ethical, data-backed assets.
                </p>
              </div>
            </div>

            <div className="mt-10 border-t border-border pt-8">
              <h3 className="text-2xl font-semibold mb-4 text-foreground">Our Long-Term Vision</h3>
              <p className="text-muted-foreground leading-relaxed">
                Glass aims to become a <strong>worldwide bridge between science and society</strong> —
                where research can grow through collective support instead of institutional barriers.
                We believe the future of innovation depends on openness, and we’re here to build the
                tools that make it possible.
              </p>
            </div>
          </div>

          {/* Right side: Roadmap visual */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[360px] sm:max-w-[420px] lg:max-w-[460px] xl:max-w-[520px] overflow-hidden rounded-3xl border border-border shadow-lg bg-card/80 backdrop-blur">
              <img
                src="/Roadmap.png"
                alt="Glass roadmap visual"
                className="w-full h-auto object-contain"
                loading="lazy"
              />
            </div>
          </div>
        </div>
        <div className="h-24" />
      </div>
      <Footer />
    </div>
  );
}
