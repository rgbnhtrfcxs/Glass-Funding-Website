import { Hero } from "@/components/sections/hero";
import { About } from "@/components/sections/about";
import { Waitlist } from "@/components/sections/waitlist";
import { Contact } from "@/components/sections/contact";
import { Footer } from "@/components/sections/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background pt-16">
      <Hero />
      <About />
      <Waitlist />
      <Contact />
      <Footer />
    </div>
  );
}