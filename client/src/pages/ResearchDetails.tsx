import { useLocation } from "wouter";
import { mockResearch } from "@/data/mockResearch";

export default function ResearchDetails() {
  const [location, navigate] = useLocation();

  const id = location.split("/").pop();
  const researchItem = mockResearch.find((item) => item.id.toString() === id);

  if (!researchItem) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-semibold mb-4">Research Not Found</h1>
        <button
          onClick={() => navigate("/research")}
          className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  const progress = Math.min(
    Math.round((researchItem.funded / researchItem.goal) * 100),
    100
  );

  return (
    <div className="pt-24 px-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">{researchItem.name}</h1>
      <p className="mb-4 text-gray-600">
        <strong>Category:</strong> {researchItem.category}
      </p>
      <p className="mb-4 text-gray-600">
        <strong>Date:</strong> {researchItem.date}
      </p>
      <p className="mb-4 text-gray-600">
        <strong>Funding Goal:</strong> {researchItem.goal.toLocaleString()} €
      </p>
      <p className="mb-4 text-gray-600">
        <strong>Funded:</strong> {researchItem.funded.toLocaleString()} €
      </p>
      <p className="mb-4 text-gray-600">
        <strong>Grade:</strong> {researchItem.grade}
      </p>
      <p className="mb-2 text-gray-600">
        <strong>Progress:</strong> {progress}%
      </p>
      <div className="mb-6 w-full bg-muted rounded-full h-3">
        <div
          className="h-3 rounded-full bg-gradient-to-r from-blue-400 to-pink-400"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mb-6 text-gray-800">
        <strong>Description:</strong>
        <p className="mt-2">{researchItem.description}</p>
      </div>

      <button
        onClick={() => navigate("/research")}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
      >
        ← Back to List
      </button>
    </div>
  );
}
