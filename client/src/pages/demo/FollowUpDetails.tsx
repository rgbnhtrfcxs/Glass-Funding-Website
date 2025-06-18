import { useParams } from "wouter";
import { useEffect, useState } from "react";
import { mockFollowUp, FollowUpItem } from "../../data/mockFollowUp";

export default function FollowUpDetails() {
  const { id } = useParams();
  const [item, setItem] = useState<FollowUpItem | null>(null);

  useEffect(() => {
    const data = mockFollowUp.find((entry) => entry.id === Number(id));
    if (data) setItem(data);
  }, [id]);

  if (!item) {
    return (
      <div className="pt-28 text-center">
        <p className="text-muted-foreground">Research project not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pt-28 px-4">
      <h1 className="text-3xl font-bold mb-4">{item.name}</h1>
      <p className="text-muted-foreground mb-6">{item.description}</p>

      <div className="grid grid-cols-2 gap-4 text-sm mb-6">
        <p><strong>Category:</strong> {item.category}</p>
        <p><strong>Funding Goal:</strong> {item.goal} €</p>
        <p><strong>Funded:</strong> {item.funded} €</p>
        <p><strong>Uploaded:</strong> {item.dateUploaded}</p>
        <p><strong>Funded On:</strong> {item.dateFunded}</p>
        <p><strong>Donors:</strong> {item.donors}</p>
        <p><strong>Token Performance:</strong> {item.tokenPerformance}</p>
        <p><strong>Visibility:</strong> {item.visibility}</p>
      </div>

      {item.progress !== undefined && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Progress</h3>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-green-500 h-4 rounded-full transition-all"
              style={{ width: `${item.progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{item.progress}% Complete</p>
        </div>
      )}

      {item.timeline && item.timeline.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Project Timeline</h3>
          <ul className="list-disc ml-6 text-muted-foreground space-y-1">
            {item.timeline.map((step, index) => (
              <li key={index}>
                <strong>{step.title}</strong> – {step.date} – 
                <span className={`ml-2 font-medium ${step.status === "complete" ? "text-green-600" : step.status === "in progress" ? "text-yellow-600" : "text-gray-500"}`}>
                  {step.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.updates && item.updates.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Research Updates</h3>
          <div className="space-y-4 text-muted-foreground">
            {item.updates.map((update, index) => (
              <div key={index} className="border-l-4 border-muted pl-4">
                <p className="text-sm text-black"><strong>{update.date}</strong></p>
                <p>{update.content}</p>
                {update.image && (
                  <img src={update.image} alt="Update" className="mt-2 rounded max-w-full" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {item.milestones && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Milestones</h3>
          <ul className="list-disc ml-6 text-muted-foreground space-y-1">
            {item.milestones.map((m, index) => (
              <li key={index}>
                <strong>{m.title}</strong>: {m.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.impactTags && item.impactTags.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Impact Tags</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {item.impactTags.map((tag, index) => {
              const match = tag.match(/UN SDG (\d+)/);
              const goalNumber = match ? match[1] : null;
              const goalUrl = goalNumber
                ? `https://sdgs.un.org/goals/goal${goalNumber}`
                : "#";

              const goalTitles: Record<string, string> = {
                "1": "No Poverty",
                "2": "Zero Hunger",
                "3": "Good Health and Well-being",
                "4": "Quality Education",
                "5": "Gender Equality",
                "6": "Clean Water and Sanitation",
                "7": "Affordable and Clean Energy",
                "8": "Decent Work and Economic Growth",
                "9": "Industry, Innovation and Infrastructure",
                "10": "Reduced Inequalities",
                "11": "Sustainable Cities and Communities",
                "12": "Responsible Consumption and Production",
                "13": "Climate Action",
                "14": "Life Below Water",
                "15": "Life on Land",
                "16": "Peace, Justice and Strong Institutions",
                "17": "Partnerships for the Goals"
              };

              const tooltip = goalNumber ? goalTitles[goalNumber] || "UN SDG Goal" : "UN Goal";

              return (
                <a
                  key={index}
                  href={goalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={tooltip}
                  className="px-3 py-1 rounded bg-muted font-semibold text-black hover:bg-gray-300 transition cursor-help"
                >
                  {tag}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {item.researcher && (
        <div className="bg-muted/30 border border-muted rounded p-4 text-sm mb-6">
          <p><strong>Researcher:</strong> {item.researcher.name}</p>
          <p><strong>Title:</strong> {item.researcher.title}</p>
          <p><strong>Institution:</strong> {item.researcher.institution}</p>
        </div>
      )}

      {item.documents && item.documents.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-2">Documents</h3>
          <ul className="list-disc ml-6 text-muted-foreground space-y-1">
            {item.documents.map((doc, idx) => (
              <li key={idx}>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-black hover:underline"
                >
                  {doc.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
