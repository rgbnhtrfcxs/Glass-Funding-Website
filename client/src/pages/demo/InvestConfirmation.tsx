import { useEffect, useState } from "react";

export default function InvestConfirmation() {
  const [amount, setAmount] = useState<number | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);

      const amt = searchParams.get("amount");
      const proj = searchParams.get("project");
      const mail = searchParams.get("email");

      if (amt && !isNaN(Number(amt))) setAmount(parseFloat(amt));
      if (proj) setProject(decodeURIComponent(proj));
      if (mail) setEmail(decodeURIComponent(mail));
    } catch (err) {
      console.error("Failed to parse URL parameters:", err);
    }
  }, []);

  return (
    <div className="max-w-md mx-auto pt-28 px-4 text-center">
      <h1 className="text-3xl font-bold mb-4">Investment Confirmed</h1>

      {amount !== null && project ? (
        <>
          <p className="mb-4 text-muted-foreground">
            Thank you for investing <strong>{amount.toFixed(2)} €</strong> in <strong>{project}</strong>.
          </p>
          <div className="bg-muted/30 border border-muted rounded p-4 text-left text-sm text-gray-800">
            <p><strong>Project:</strong> {project}</p>
            <p><strong>Amount:</strong> {amount.toFixed(2)} €</p>
            {email && <p><strong>Email:</strong> {email}</p>}
            <p><strong>Status:</strong> Confirmed</p>
            <p className="mt-2 text-xs text-muted-foreground">
              You will be notified of all project updates and ROI tracking.
            </p>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Unable to retrieve investment details.</p>
      )}
    </div>
  );
}
