import { useState } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, navigate] = useLocation();

  const handleLogin = () => {
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    // Fake login logic for MVP
    alert("Logged in successfully!");
    navigate("/");
  };

  return (
    <div className="max-w-md mx-auto pt-32 px-4">
      <h1 className="text-2xl font-bold mb-6 text-center">Login to Your Account</h1>

      <label className="block mb-2 font-medium">Email</label>
      <input
        type="email"
        className="w-full px-4 py-2 border rounded mb-4"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />

      <label className="block mb-2 font-medium">Password</label>
      <input
        type="password"
        className="w-full px-4 py-2 border rounded mb-6"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
      />

      <button
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-500 transition"
        onClick={handleLogin}
      >
        Login
      </button>

      <p className="text-center text-sm text-muted-foreground mt-4">
        Don’t have an account? <a href="/Signup" className="text-blue-600 underline">Sign up</a>
      </p>
    </div>
  );
}
