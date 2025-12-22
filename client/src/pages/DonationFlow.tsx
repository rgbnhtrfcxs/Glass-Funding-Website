import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const PRESET_AMOUNTS = [25, 50, 100, 250];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function DonateFlow() {
  const [location, navigate] = useLocation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [donorType, setDonorType] = useState<"individual" | "company">("individual");
  const [amount, setAmount] = useState<number | "">("");
  const [email, setEmail] = useState("");
  const [storedEmail, setStoredEmail] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [recurring, setRecurring] = useState(true);
  const feeRate = 0.015;
  const [details, setDetails] = useState({
    fullName: "",
    companyName: "",
    siret: "",
    contactName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postalCode: "",
    country: "France",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedEmail = window.localStorage.getItem("glass-demo-email") || window.sessionStorage.getItem("glass-demo-email");
    if (savedEmail) setStoredEmail(savedEmail);
  }, []);

  const searchParams = useMemo(() => {
    const query = location.split("?")[1] ?? "";
    return new URLSearchParams(query);
  }, [location]);

  const donationLabel = "Glass Connect (beta)";

  const fee = typeof amount === "number" ? +(amount * feeRate + 0.25).toFixed(2) : 0;
  const total = typeof amount === "number" ? +(amount + fee).toFixed(2) : 0;
  const emailValue = storedEmail ?? email;
  const isEmailValid = storedEmail ? true : email !== "" && isValidEmail(email);
  const isAmountValid = typeof amount === "number" && amount > 0;
  const isFormValid = isAmountValid && isEmailValid;

  const handleAmountInput = (value: string) => {
    if (value === "") {
      setAmount("");
      return;
    }
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) setAmount(parsed);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value === "" || isValidEmail(value)) setEmailError(null);
    else setEmailError("Enter a valid email address.");
  };

  const handleSubmit = () => {
    if (step === 1) {
      if (!isAmountValid) {
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!isEmailValid) {
        setEmailError("Enter a valid email address before continuing.");
        return;
      }
      if (donorType === "individual" && !details.fullName.trim()) {
        setEmailError("Full name is required for receipts.");
        return;
      }
      if (donorType === "company" && (!details.companyName.trim() || !details.siret.trim())) {
        setEmailError("Company name and SIRET are required for company receipts.");
        return;
      }
      if (!details.addressLine1.trim() || !details.city.trim() || !details.postalCode.trim()) {
        setEmailError("Address, city, and postal code are required for the receipt.");
        return;
      }
      setEmailError(null);
      setStep(3);
      return;
    }

    const params = new URLSearchParams();
    params.set("amount", total.toFixed(2));
    params.set("donation", typeof amount === "number" ? amount.toFixed(2) : "0");
    params.set("fee", fee.toFixed(2));
    params.set("email", emailValue);
    params.set("recurring", recurring ? "true" : "false");
    params.set("donorType", donorType);
    params.set("fullName", details.fullName);
    params.set("companyName", details.companyName);
    params.set("siret", details.siret);
    params.set("contactName", details.contactName);
    params.set("addressLine1", details.addressLine1);
    params.set("addressLine2", details.addressLine2);
    params.set("city", details.city);
    params.set("postalCode", details.postalCode);
    params.set("country", details.country);
    navigate(`/donate-confirmation?${params.toString()}`);
  };

  return (
    <div className="max-w-3xl mx-auto pt-40 px-4 pb-20 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-semibold">Support {donationLabel}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Your contribution helps us keep the beta free, improve onboarding, and ship the features your team needs.
        </p>
      </div>

      <div id="donate-form" className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <span className={`rounded-full px-3 py-1 ${step === 1 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>1. Amount</span>
          <span className={`rounded-full px-3 py-1 ${step === 2 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>2. Receipt details</span>
          <span className={`rounded-full px-3 py-1 ${step === 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>3. Checkout</span>
        </div>

        {step === 1 && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Payer type</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                    donorType === "individual" ? "border-primary text-primary" : "border-border text-muted-foreground"
                  }`}
                  onClick={() => setDonorType("individual")}
                >
                  Individual
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                    donorType === "company" ? "border-primary text-primary" : "border-border text-muted-foreground"
                  }`}
                  onClick={() => setDonorType("company")}
                >
                  Company
                </button>
              </div>
            </div>

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
          </>
        )}

        {step === 2 && (
          <>
            {storedEmail ? (
              <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
                <p className="font-medium">Signed in as {storedEmail}</p>
                <p className="text-xs text-primary/80">We&apos;ll send the receipt and updates to this email.</p>
              </div>
            ) : (
              <div>
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

            {donorType === "individual" ? (
              <div className="grid gap-3 mt-4">
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-foreground">Full name</label>
                  <input
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={details.fullName}
                    onChange={e => setDetails(prev => ({ ...prev, fullName: e.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-3 mt-4">
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-foreground">Company name</label>
                  <input
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={details.companyName}
                    onChange={e => setDetails(prev => ({ ...prev, companyName: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-foreground">SIRET</label>
                  <input
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={details.siret}
                    onChange={e => setDetails(prev => ({ ...prev, siret: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-foreground">Contact name</label>
                  <input
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={details.contactName}
                    onChange={e => setDetails(prev => ({ ...prev, contactName: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-3 mt-4">
              <div className="grid gap-1">
                <label className="text-sm font-medium text-foreground">Address line 1</label>
                <input
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  value={details.addressLine1}
                  onChange={e => setDetails(prev => ({ ...prev, addressLine1: e.target.value }))}
                />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium text-foreground">Address line 2 (optional)</label>
                <input
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  value={details.addressLine2}
                  onChange={e => setDetails(prev => ({ ...prev, addressLine2: e.target.value }))}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-foreground">City</label>
                  <input
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={details.city}
                    onChange={e => setDetails(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-foreground">Postal code</label>
                  <input
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={details.postalCode}
                    onChange={e => setDetails(prev => ({ ...prev, postalCode: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium text-foreground">Country</label>
                <input
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  value={details.country}
                  onChange={e => setDetails(prev => ({ ...prev, country: e.target.value }))}
                />
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Donation</span>
              <span className="font-medium text-foreground">€{typeof amount === "number" ? amount.toFixed(2) : "0.00"}</span>
            </div>
            <div className="flex justify-between">
              <span>Platform fee (1.5% + €0.25)</span>
              <span className="font-medium text-foreground">€{fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-foreground font-semibold">
              <span>Total today</span>
              <span>€{total.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {recurring
                ? "Recurring donations help us plan ahead. You can cancel any time."
                : "One-time donation. We’ll issue a receipt once processed."}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition"
            onClick={() => setStep(prev => (prev === 1 ? 1 : ((prev - 1) as 1 | 2 | 3)))}
            disabled={step === 1}
          >
            Back
          </button>
          <button
          type="button"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleSubmit}
          disabled={step === 1 && !isAmountValid}
        >
          {step < 3 ? "Next" : "Proceed to checkout"}
        </button>
      </div>
      </div>
    </div>
  );
}
