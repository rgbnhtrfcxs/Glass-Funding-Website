import { Link } from "wouter";

export default function DemoIndex() {
  return (
    <div className="pt-28 px-4 max-w-3xl mx-auto text-center">
      <h1 className="text-3xl font-bold mb-4">Glass MVP Demo</h1>
      <p className="text-muted-foreground mb-8">
        This is a demo version of the Glass platform. All data is mock. Do not use for real investment or donations.
      </p>

      <div className="grid gap-4">
        <Link
          href="/demo/research"
          className="bg-black text-white py-2 px-4 rounded hover:bg-gray-800 transition"
        >
          🔬 View Research Projects
        </Link>

        <Link
          href="/demo/donate"
          className="bg-black text-white py-2 px-4 rounded hover:bg-gray-800 transition"
        >
          ❤️ Donate to a Cause
        </Link>

        <Link
          href="/demo/followup/101"
          className="bg-black text-white py-2 px-4 rounded hover:bg-gray-800 transition"
        >
          📈 Follow Project Progress
        </Link>
      </div>
    </div>
  );
}
