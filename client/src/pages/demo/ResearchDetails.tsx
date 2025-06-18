import { useLocation } from "wouter";
import { mockResearch } from "@/data/mockResearch";
import { Link } from "wouter";

const sdgDescriptions: Record<string, string> = {
  "UN SDG 1": "No Poverty",
  "UN SDG 2": "Zero Hunger",
  "UN SDG 3": "Good Health and Well-being",
  "UN SDG 4": "Quality Education",
  "UN SDG 5": "Gender Equality",
  "UN SDG 6": "Clean Water and Sanitation",
  "UN SDG 7": "Affordable and Clean Energy",
  "UN SDG 8": "Decent Work and Economic Growth",
  "UN SDG 9": "Industry, Innovation and Infrastructure",
  "UN SDG 10": "Reduced Inequalities",
  "UN SDG 11": "Sustainable Cities and Communities",
  "UN SDG 12": "Responsible Consumption and Production",
  "UN SDG 13": "Climate Action",
  "UN SDG 14": "Life Below Water",
  "UN SDG 15": "Life on Land",
  "UN SDG 16": "Peace, Justice and Strong Institutions",
  "UN SDG 17": "Partnerships for the Goals",
};

export default function ResearchDetails() {
  const [location, navigate] = useLocation();
  const id = location.split("/").pop();
  const researchItem = mockResearch.find((item) => item.id.toString() === id);

  if (!researchItem) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-semibold mb-4">Research Not Found</h1>
        <button
          onClick={() => navigate("/demo/research")}
          className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  const progress = Math.min(Math.round((researchItem.funded / researchItem.goal) * 100), 100);

  return (
    <div className="pt-24 px-6 flex justify-center relative">
      {/* Sidebar buttons */}
      <div className="absolute right-6 top-28 hidden lg:flex flex-col gap-4">
        <Link href="/demo/investflow">
          <button className="px-4 py-2 w-40 rounded bg-green-600 text-white font-semibold hover:bg-green-500 transition">
            Invest
          </button>
        </Link>

        <Link href="/demo/donateflow">
          <button className="px-4 py-2 w-40 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition">
            Donate
          </button>
        </Link>
      </div>

      {/* Main content */}
      <div className="max-w-3xl w-full">
        <h1 className="text-3xl font-bold mb-4">{researchItem.name}</h1>
        <p className="mb-2 text-gray-600"><strong>Category:</strong> {researchItem.category}</p>
        <p className="mb-2 text-gray-600"><strong>Date:</strong> {researchItem.date}</p>
        <p className="mb-2 text-gray-600"><strong>Funding Goal:</strong> {researchItem.goal.toLocaleString()} €</p>
        <p className="mb-2 text-gray-600"><strong>Funded:</strong> {researchItem.funded.toLocaleString()} €</p>
        <p className="mb-2 text-gray-600"><strong>Grade:</strong> {researchItem.grade}</p>
        <p className="mb-4 text-gray-600"><strong>Progress:</strong> {progress}%</p>

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

        {researchItem.researcher && (
          <div className="mb-6 p-4 bg-muted/30 rounded border border-muted">
            <h3 className="font-semibold mb-2">Researcher</h3>
            <p><strong>Name:</strong> {researchItem.researcher.name}</p>
            <p><strong>Title:</strong> {researchItem.researcher.title}</p>
            <p><strong>Institution:</strong> {researchItem.researcher.institution}</p>
          </div>
        )}

        {Array.isArray(researchItem.impactTags) && researchItem.impactTags.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Impact Tags</h3>
            <div className="flex flex-wrap gap-2">
              {researchItem.impactTags.map((tag, i) => (
              <a
              key={i}
              href={`https://sdgs.un.org/goals/goal${tag.split(" ").pop()}`}
              target="_blank"
              rel="noopener noreferrer"
              title={sdgDescriptions[tag] || tag}
              className="bg-gray-200 text-black font-semibold px-3 py-1 rounded-full text-xs hover:bg-gray-300 transition-colors cursor-help"
            >
              {tag}
            </a>
            
              ))}
            </div>
          </div>
        )}

        {Array.isArray(researchItem.documents) && researchItem.documents.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Documents</h3>
            <ul className="list-disc ml-6">
              {researchItem.documents.map((doc, i) => (
                <li key={i}>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    {doc.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(researchItem.milestones) && researchItem.milestones.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Milestones</h3>
            <ul className="list-disc ml-6">
              {researchItem.milestones.map((m, i) => (
                <li key={i}>
                  <strong>{m.title}</strong>: {m.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        {researchItem.donors !== undefined && (
          <p className="mb-6 text-gray-600"><strong>Number of Donors:</strong> {researchItem.donors}</p>
        )}

        {researchItem.tokenPerformance && (
          <p className="mb-6 text-gray-600"><strong>Token Performance:</strong> {researchItem.tokenPerformance}</p>
        )}

        {/* Mobile-friendly buttons */}
        <div className="lg:hidden flex flex-col sm:flex-row gap-4 mb-10">
          <Link href="/demo/investflow">
            <button className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 transition">
              Invest in this project
            </button>
          </Link>
          <Link href="/demo/donateflow">
            <button className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition">
              Donate to this project
            </button>
          </Link>
        </div>

        <button
          onClick={() => navigate("/demo/research")}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
        >
          ← Back to List
        </button>
      </div>
    </div>
  );
}
