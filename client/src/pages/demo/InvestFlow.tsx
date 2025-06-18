import { useState } from "react";
import { useLocation } from "wouter";

export default function InvestFlow() {
  const [amount, setAmount] = useState<number | "">("");
  const [email, setEmail] = useState("");
  const [, navigate] = useLocation();
  const feeRate = 0.07;

  const fee = typeof amount === "number" ? +(amount * feeRate).toFixed(2) : 0;
  const total = typeof amount === "number" ? +(amount + fee).toFixed(2) : 0;

  return (
    <div className="max-w-md mx-auto pt-28 px-4">
      <h1 className="text-2xl font-bold mb-6 text-center">Invest in a Project</h1>

      <label className="block mb-2 font-medium">Investment Amount (€)</label>
      <input
        type="number"
        className="w-full px-4 py-2 border rounded mb-4"
        value={amount}
        onChange={(e) => {
          const value = e.target.value;
          setAmount(value === "" ? "" : parseFloat(value));
        }}
        min={1}
        step={0.01}
      />

      <label className="block mb-2 font-medium text-sm">Email</label>
      <input
        type="email"
        className="w-full px-4 py-2 border rounded mb-4"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
      />

      {typeof amount === "number" && (
        <div className="bg-muted/30 border border-muted rounded p-4 text-sm text-gray-800 mb-4">
          <div className="flex justify-between mb-1">
            <span>Investment:</span>
            <span>{amount.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Platform Fee (7%):</span>
            <span>{fee.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total:</span>
            <span>{total.toFixed(2)} €</span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            This fee covers operational costs, legal infrastructure, and performance tracking tools.
          </p>
        </div>
      )}

        <button
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-500 transition"
        onClick={() => {
            navigate(
      `/invest-confirmation?amount=${total}&project=${encodeURIComponent("Your Project")}&email=${encodeURIComponent(email)}`);
        }}
  disabled={typeof amount !== "number" || !email}
>
  Proceed to Invest
</button>

    </div>
  );
}
