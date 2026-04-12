import { useEffect, useState } from "react";
import { Mail, Phone, Check } from "lucide-react";

interface CardPageProps {
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedIn: string;
}

export function CardPage({ name, title, email, phone, linkedIn }: CardPageProps) {
  const [copied, setCopied] = useState(false);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function copyEmail() {
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);

    const prevTitle = document.title;
    document.title = `${name} — Glass Connect`;

    return () => {
      document.head.removeChild(meta);
      document.title = prevTitle;
    };
  }, [name]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="/GlassLogo5.png"
            alt="Glass Connect"
            className="h-12 w-auto object-contain"
          />
        </div>

        {/* Card */}
        <div className="relative overflow-hidden bg-white/75 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60">
          {/* Accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-blue-500 to-pink-400" />

          <div className="flex flex-col items-center gap-6 px-8 py-8">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg ring-4 ring-white">
                <span className="text-white text-3xl font-bold tracking-tight">
                  {initials}
                </span>
              </div>
              {/* Subtle glow */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 blur-xl opacity-30 -z-10 scale-110" />
            </div>

            {/* Identity */}
            <div className="text-center">
              <h1 className="text-2xl font-bold text-[#1a2238] tracking-tight leading-snug">
                {name}
              </h1>
              <p className="text-sm font-semibold text-[#54668f] mt-1.5 tracking-wide uppercase">
                {title}
              </p>
              <p className="text-sm text-[#6b748d] mt-0.5">Glass Connect</p>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-[#d1dbf2] to-transparent" />

            {/* Contact links */}
            <div className="w-full flex flex-col gap-3">
              {/* LinkedIn */}
              <a
                href={linkedIn}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 w-full px-4 py-3.5 bg-[#0077b5] hover:bg-[#005f8d] active:bg-[#004d77] text-white rounded-2xl transition-colors font-medium text-sm shadow-sm"
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                <span>Connect on LinkedIn</span>
              </a>

              {/* Email — copies to clipboard */}
              <button
                type="button"
                onClick={copyEmail}
                className="flex items-center gap-3 w-full px-4 py-3.5 bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground rounded-2xl transition-colors font-medium text-sm shadow-sm"
              >
                {copied
                  ? <Check className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  : <Mail className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                }
                <span className="truncate">{copied ? "Copied!" : email}</span>
              </button>

              {/* Phone */}
              <a
                href={`tel:${phone.replace(/\s/g, "")}`}
                className="flex items-center gap-3 w-full px-4 py-3.5 bg-white hover:bg-[#f4f7fd] active:bg-[#edf7ff] text-[#1a2238] border border-[#d1dbf2] rounded-2xl transition-colors font-medium text-sm shadow-sm"
              >
                <Phone className="w-5 h-5 flex-shrink-0 text-primary" aria-hidden="true" />
                <span>{phone}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#6b748d] mt-6 tracking-wide">
          glass-connect.com
        </p>
      </div>
    </div>
  );
}
