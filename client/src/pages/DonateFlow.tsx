import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { mockResearch } from "@/data/mockResearch";

const PRESET_AMOUNTS = [25, 50, 100, 250];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function DonateFlow() {
  const [location, navigate] = useLocation();
  const [amount, setAmount] = useState<number | "">("");
  const [email, setEmail] = useState("");
  const [storedEmail, setStoredEmail] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [recurring, setRecurring] = useState(true);
  const feeRate = 0.05;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedEmail = window.localStorage.getItem("glass-demo-email") || window.sessionStorage.getItem("glass-demo-email");
    if (savedEmail) {
      setStoredEmail(savedEmail);
    }
  }, []);

  const searchParams = useMemo(() => {
    const query = location.split("?")[1] ?? "";
    return new URLSearchParams(query);
  }, [location]);

  const projectId = searchParams.get("projectId");
  const category = searchParams.get("category");
  const project = projectId ? mockResearch.find(item => item.id.toString() === projectId) : undefined;
  const donationLabel = project?.name ?? category ?? "your chosen cause";

  const fee = typeof amount === "number" ? +(amount * feeRate).toFixed(2) : 0;
  const total = typeof amount === "number" ? +(amount + fee).toFixed(2) : 0;
  const emailValue = storedEmail ?? email;
  const isEmailValid = storedEmail ? true : email !== "" && isValidEmail(email);
  const isFormValid = typeof amount === "number" && amount > 0 && isEmailValid;

  const handleAmountInput = (value: string) => {
    if (value === "") {
      setAmount("");
      return;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    setAmount(parsed);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value === "" || isValidEmail(value)) {
      setEmailError(null);
    } else {
      setEmailError("Enter a valid email address.");
    }
  };

  const handleSubmit = () => {
    if (!isFormValid) {
      if (!isEmailValid) {
        setEmailError("Enter a valid email address before continuing.");
      }
      return;
    }

    const params = new URLSearchParams();
    params.set("amount", total.toFixed(2));
    params.set("donation", typeof amount === "number" ? amount.toFixed(2) : "0");
    params.set("fee", fee.toFixed(2));
    params.set("email", emailValue);
    params.set("recurring", recurring ? "true" : "false");
    if (projectId) params.set("projectId", projectId);
    if (project) params.set("project", project.name);
    if (!project && category) params.set("category", category);

    navigate(`/donate-confirmation?${params.toString()}`);
  };

  return (
    <div className="max-w-lg mx-auto pt-28 px-4 pb-20">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Donate to {donationLabel}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose an amount, confirm your email, and we&apos;ll keep you posted on progress.
        </p>
      </div>

      <div className="mt-8 rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
        <label className="block text-sm font-medium text-foreground">Donation amount (€)</label>
        <input
          type="number"
          inputMode="decimal"
          className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm"
          value={amount === "" ? "" : amount}
          onChange={event => handleAmountInput(event.target.value)}
          min={1}
          step={0.01}
          placeholder="Enter a custom amount"
        />

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRESET_AMOUNTS.map(value => {
            const isActive = amount === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setAmount(value);
                }}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-transparent bg-primary text-primary-foreground shadow-md"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                €{value}
              </button>
            );
          })}
        </div>

        {storedEmail ? (
          <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
            <p className="font-medium">Signed in as {storedEmail}</p>
            <p className="text-xs text-primary/80">We&apos;ll send the receipt and updates to this email.</p>
          </div>
        ) : (
          <div className="mt-6">
            <label className="block text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              className={`mt-2 w-full rounded-full border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                emailError ? "border-destructive" : "border-border"
              }`}
              value={email}
              onChange={event => handleEmailChange(event.target.value)}
              placeholder="you@example.org"
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "donation-email-error" : undefined}
            />
            {emailError && (
              <p id="donation-email-error" className="mt-2 text-xs text-destructive">
                {emailError}
              </p>
            )}
          </div>
        )}

        <label className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            checked={recurring}
            onChange={event => setRecurring(event.target.checked)}
          />
          <span>
            Keep this donation recurring each month. You can pause or adjust at any time inside your profile.
          </span>
        </label>

        {typeof amount === "number" && amount > 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-background/80 p-4 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Donation</span>
              <span className="font-medium text-foreground">€{amount.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span>Platform fee (5%)</span>
              <span className="font-medium text-foreground">€{fee.toFixed(2)}</span>
            </div>
            <div className="mt-3 flex justify-between text-sm font-semibold text-foreground">
              <span>Total today</span>
              <span>€{total.toFixed(2)}</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {recurring
                ? "Recurring donations help researchers plan with confidence. You can cancel any time."
                : "You’ll receive a receipt and milestone updates for this one-time donation."}
            </p>
          </div>
        )}

        <button
          type="button"
          className="mt-6 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleSubmit}
          disabled={!isFormValid}
        >
          Proceed to donate
        </button>
      </div>
    </div>
  );
}
