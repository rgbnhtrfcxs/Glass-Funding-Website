import { motion } from "framer-motion";
import { Footer } from "@/components/sections/footer";

const onePagers = [
  {
    title: "GLASS-Connect Overview",
    description: "A concise overview of GLASS-Connect, our mission, and how the platform helps labs share capabilities and connect with collaborators.",
    file: "/OnePageIntroduction.pdf",
  },
];

export default function OnePagers() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pt-24 pb-16">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-5xl font-bold text-center mb-10"
        >
          Glass One-Pagers
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-3xl mx-auto text-center text-muted-foreground mb-16"
        >
          Explore shareable one-pagers that highlight GLASS-Connect and our approach to connecting labs with collaborators.
        </motion.p>

        <div className="space-y-12">
          {onePagers.map((item, index) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="bg-card border rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="p-8 space-y-4">
                <h2 className="text-2xl md:text-3xl font-semibold">{item.title}</h2>
                <p className="text-muted-foreground text-lg">{item.description}</p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={item.file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    View PDF
                  </a>
                  <a
                    href={item.file}
                    download
                    className="inline-flex items-center justify-center rounded-full border border-input px-6 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Download
                  </a>
                </div>
              </div>

              <div className="border-t border-border bg-muted/40">
                <object
                  data={item.file}
                  type="application/pdf"
                  className="hidden w-full md:block lg:h-[720px] md:h-[640px]"
                >
                  <p className="p-6 text-muted-foreground">
                    Your browser is unable to display the PDF. You can still
                    {" "}
                    <a href={item.file} target="_blank" rel="noopener noreferrer" className="underline">
                      open the document in a new tab
                    </a>
                    {" "}
                    or download it for offline viewing.
                  </p>
                </object>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
