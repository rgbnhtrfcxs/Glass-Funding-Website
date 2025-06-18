import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";

// TODO: Fix donation confirmation page – data not retrieved from URL params

export default function DonateConfirmation() {
  const [amount, setAmount] = useState<number | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const [location] = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.split("?")[1]);
    const amt = searchParams.get("amount");
    const em = searchParams.get("email");
    const proj = searchParams.get("project");
    const cat = searchParams.get("category");

    if (amt) setAmount(parseFloat(amt));
    if (em) setEmail(decodeURIComponent(em));
    if (proj) setProject(decodeURIComponent(proj));
    if (cat) setCategory(decodeURIComponent(cat));
  }, [location]);

  const target = project || category;

  return (
    <div className="max-w-md mx-auto pt-28 px-4 text-center">
      <h1 className="text-3xl font-bold mb-4">Thank You for Your Donation</h1>

      {amount && target && email ? (
        <>
          <p className="mb-4 text-muted-foreground">
            You’ve donated <strong>{amount.toFixed(2)} €</strong> to{" "}
            <strong>{target}</strong>.
          </p>
          <div className="bg-muted/30 border border-muted rounded p-4 text-left text-sm text-gray-800">
            <p><strong>Recipient:</strong> {target}</p>
            <p><strong>Amount:</strong> {amount.toFixed(2)} €</p>
            <p><strong>Email:</strong> {email}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              A confirmation email will be sent shortly. Thank you for supporting science.
            </p>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">
          Unable to retrieve donation details.
        </p>
      )}

      <Link href="/donate">
        <button className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition">
          Back to Donations
        </button>
      </Link>
    </div>
  );
}
