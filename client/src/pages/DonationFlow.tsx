import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

const PRESET_AMOUNTS = [25, 50, 100, 250];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function DonateFlow() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [donorType, setDonorType] = useState<"individual" | "company">("individual");
  const [amount, setAmount] = useState<number | "">("");
  const [email, setEmail] = useState("");
  const [storedEmail, setStoredEmail] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [recurring, setRecurring] = useState(true);
  const feeRate = 0.25;
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
  const [ownedLabs, setOwnedLabs] = useState<
    Array<{
      id: number;
      name: string;
      siret_number?: string | null;
      lab_manager?: string | null;
      contact_email?: string | null;
      address_line1?: string | null;
      address_line2?: string | null;
      city?: string | null;
      postal_code?: string | null;
      country?: string | null;
    }>
  >([]);
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const paymentElementRef = useRef<HTMLDivElement | null>(null);
  const stripeInstance = useRef<any>(null);
  const stripeElements = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedEmail = window.localStorage.getItem("glass-demo-email") || window.sessionStorage.getItem("glass-demo-email");
    if (savedEmail) setStoredEmail(savedEmail);
  }, []);

  // Load Stripe.js once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = document.querySelector('script[src="https://js.stripe.com/v3"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => setStripeReady(true));
      if ((window as any).Stripe) setStripeReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3";
    script.async = true;
    script.onload = () => setStripeReady(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("email, display_name, name, legal_full_name, address_line1, address_line2, city, postal_code, country")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (!storedEmail) setEmail(data.email || user.email || "");
        setDetails(prev => ({
          ...prev,
          fullName: data.legal_full_name || data.display_name || data.name || prev.fullName,
          addressLine1: data.address_line1 || prev.addressLine1,
          addressLine2: data.address_line2 || prev.addressLine2,
          city: data.city || prev.city,
          postalCode: data.postal_code || prev.postalCode,
          country: data.country || prev.country || "France",
        }));
      })
      .catch(() => {});
  }, [storedEmail, user?.id]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("labs")
      .select(
        "id, name, siret_number, lab_manager, contact_email, address_line1, address_line2, city, postal_code, country",
      )
      .or(`owner_user_id.eq.${user.id},contact_email.eq.${user.email}`)
      .then(({ data }) => {
        if (data && Array.isArray(data)) {
          setOwnedLabs(data);
          if (!selectedLabId && data.length > 0) {
            setSelectedLabId(data[0].id);
          }
        }
      })
      .catch(() => {});
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (donorType !== "company") return;
    const lab = ownedLabs.find(l => l.id === selectedLabId) || ownedLabs[0];
    if (!lab) return;
    setSelectedLabId(lab.id);
    setDetails(prev => ({
      ...prev,
      companyName: lab.name || prev.companyName,
      siret: lab.siret_number || prev.siret,
      contactName: lab.lab_manager || prev.contactName,
      addressLine1: lab.address_line1 || prev.addressLine1,
      addressLine2: lab.address_line2 || prev.addressLine2,
      city: lab.city || prev.city,
      postalCode: lab.postal_code || prev.postalCode,
      country: lab.country || prev.country,
    }));
    if (!storedEmail && !email) {
      setEmail(lab.contact_email || "");
    }
  }, [donorType, selectedLabId, ownedLabs]);

  // Mount Payment Element when client secret arrives
  useEffect(() => {
    if (!stripeReady || !clientSecret) return;
    const StripeCtor = (window as any).Stripe;
    if (!StripeCtor) return;
    const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!pk) return;
    const stripe = StripeCtor(pk);
    const elements = stripe.elements({ clientSecret });
    const paymentEl = elements.create("payment");
    if (paymentElementRef.current) {
      paymentEl.mount(paymentElementRef.current);
    }
    stripeInstance.current = stripe;
    stripeElements.current = elements;
    return () => {
      try {
        paymentEl.unmount();
      } catch {
        /* ignore */
      }
    };
  }, [stripeReady, clientSecret]);

  const searchParams = useMemo(() => {
    const query = location.split("?")[1] ?? "";
    return new URLSearchParams(query);
  }, [location]);

  const donationLabel = "Glass Connect (beta)";

  const fee = typeof amount === "number" ? +(amount * feeRate + 0.3).toFixed(2) : 0;
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

  const handleSubmit = async () => {
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
      setCheckoutLoading(true);
      setCheckoutError(null);
      try {
        const res = await fetch("/api/donations/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: total,
            email: emailValue,
            donorType,
            recurring,
            fullName: details.fullName,
            companyName: details.companyName,
            siret: details.siret,
            contactName: details.contactName,
            addressLine1: details.addressLine1,
            addressLine2: details.addressLine2,
            city: details.city,
            postalCode: details.postalCode,
            country: details.country,
          }),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Unable to start checkout");
        }
        const payload = await res.json();
        if (!payload?.client_secret) {
          throw new Error("No client secret returned");
        }
        setClientSecret(payload.client_secret);
        setStep(3);
      } catch (err) {
        setCheckoutError(err instanceof Error ? err.message : "Unable to start checkout");
      } finally {
        setCheckoutLoading(false);
      }
      return;
    }

    // Step 3: confirm payment inline
    if (!stripeInstance.current || !stripeElements.current) {
      setCheckoutError("Payment form is still loading. Please wait a second.");
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const amountParam = total.toFixed(2);
      const result = await stripeInstance.current.confirmPayment({
        elements: stripeElements.current,
        confirmParams: {
          return_url: `${window.location.origin}/donate-confirmation?status=success&amount=${amountParam}`,
        },
        redirect: "if_required",
      });
      if (result.error) {
        throw new Error(result.error.message || "Payment could not be completed");
      }
      // If no redirect was needed, confirm status and show success locally.
      const status = result.paymentIntent?.status;
      if (status === "succeeded" || status === "processing") {
        navigate(`/donate-confirmation?status=success&amount=${amountParam}`);
        return;
      }
      if (status === "requires_action") {
        setCheckoutError("Additional authentication is required. Please follow the on-screen prompts.");
        return;
      }
      navigate(`/donate-confirmation?status=success&amount=${amountParam}`);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pb-20 space-y-6">
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
                {ownedLabs.length > 1 && (
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Select lab for receipt</label>
                    <select
                      className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={selectedLabId ?? ""}
                      onChange={e => setSelectedLabId(Number(e.target.value))}
                    >
                      {ownedLabs.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
          <div className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Donation</span>
                <span className="font-medium text-foreground">€{typeof amount === "number" ? amount.toFixed(2) : "0.00"}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform fee (2,5% + €0.3)</span>
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
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              {!clientSecret && <p className="text-sm text-muted-foreground">Preparing secure payment form…</p>}
              <div ref={paymentElementRef} className="min-h-[180px]" />
            </div>
            {checkoutError && <p className="text-xs text-destructive">{checkoutError}</p>}
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
            disabled={(step === 1 && !isAmountValid) || checkoutLoading || (step === 3 && !clientSecret)}
          >
            {step < 3 ? "Next" : checkoutLoading ? "Processing…" : `Pay €${total.toFixed(2)}`}
          </button>
        </div>
        {checkoutError && step < 3 && (
          <p className="text-xs text-destructive text-right">{checkoutError}</p>
        )}
      </div>
    </div>
  );
}
