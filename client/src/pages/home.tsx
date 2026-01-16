import { Hero } from "@/components/sections/hero";
import { About } from "@/components/sections/about";
import { Waitlist } from "@/components/sections/waitlist";
import { Contact } from "@/components/sections/contact";
import { PartnerLogos } from "@/components/sections/PartnerLogos";
import { NewsReel } from "@/components/sections/NewsReel";
import { FeaturedLabs } from "@/components/sections/FeaturedLabs";


export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <FeaturedLabs
        title="Featured labs"
        description="Premier partners highlighted this week"
      />
      <About />
      <NewsReel
        title="Lab news"
        description="Latest updates across all labs"
        limit={30}
      />
      <Waitlist />
      <Contact />
      <PartnerLogos />
    </div>
  );
}
