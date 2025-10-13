import { Footer } from "@/components/sections/footer";

export default function Roadmap() {
  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Product Roadmap</h1>
          <p className="text-lg text-muted-foreground">
            Use this space to outline the milestones, upcoming launches, and the big picture vision for Glass.
            Update the content below whenever there are new phases to share with the community.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 lg:grid-cols-[minmax(0,_1fr)_auto] gap-12">
          <div className="bg-card border border-border rounded-3xl shadow-sm p-8">
            <h2 className="text-2xl font-semibold mb-4">Roadmap Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              Craft your roadmap narrative here. Highlight what is shipping now, what is on deck, and the long-term initiatives
              Glass is working toward. Visitors will return to this page to see what&apos;s coming next.
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-[320px] lg:max-w-[360px] min-h-[520px] lg:min-h-[640px] rounded-3xl border-2 border-dashed border-muted-foreground/40 bg-muted/40 flex items-center justify-center px-6 text-center text-muted-foreground">
              <span className="text-sm leading-relaxed">
                Roadmap visual placeholder. Replace this box with your vertical roadmap graphic when it&apos;s ready.
              </span>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
