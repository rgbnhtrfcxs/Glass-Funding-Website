import { motion } from "framer-motion";

export function PartnerLogos() {
  return (
    <section id="partners" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-4">Our Partners</h2>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {[
            {
              src: "/logos/logo-unistra.png",
              alt: "Unistra",
              href: "https://www.unistra.fr",
              className: "scale-125"
            },
            {
              src: "/logos/logo-EMStrasbourg.png",
              alt: "EM Strasbourg",
              href: "https://www.em-strasbourg.com/fr",
              className: "scale-[1.7]"
            },
            {
              src: "/logos/GrandEst.png",
              alt: "Grand Est",
              href: "https://www.grandest.fr/en/",
              className: "scale-[1.9]"
            },
            {
              src: "/logos/logo-etena.png",
              alt: "Pépite Eténa",
              href: "https://etena.unistra.fr/",
              className: "scale-[1]"
            },/*,
            {
                src: "/logos/Strasbourg.jpg",
                alt: "Strasbourg",
                className: "scale-[1.2]"
            },
            */
            {
                src: "/logos/logo-LaRucheAProjets.png",
                alt: "La Ruche a projets",
                href: "https://www.em-strasbourg.com/fr/etudiant/vie-etudiante-et-services/centre-entrepreneurial-la-ruche/incubateur-la-ruche-a-projets",
                className: "scale-[1.7]" //so it is visible
            } 
          ].map((logo, index) => (
            <a
              key={index}
              href={logo.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="bg-white border border-border rounded-xl p-4 h-20 flex items-center justify-center shadow-sm">
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    className={`max-h-10 object-contain opacity-80 hover:opacity-100 transition duration-300 ${logo.className}`}
                  />
                </div>
              </motion.div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
