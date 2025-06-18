// client/src/pages/Signup.tsx
import { useState } from "react";
import { Link } from "wouter";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || password.length < 6) {
      alert("Please enter a valid email and password (min 6 characters).");
      return;
    }
    alert("Sign up functionality coming soon!");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background pt-28 px-4">
      <div className="max-w-md w-full space-y-6 bg-white p-8 border border-gray-200 rounded shadow">
        <h2 className="text-2xl font-bold text-center">Create an Account</h2>
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border rounded"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Email</label>
            <input
              type="email"
              className="w-full px-4 py-2 border rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 border rounded"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-500 transition"
          >
            Sign Up
          </button>
        </form>
        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login">
            <a className="text-indigo-600 hover:underline font-medium">Log In</a>
          </Link>
        </p>
      </div>
    </div>
  );
}
