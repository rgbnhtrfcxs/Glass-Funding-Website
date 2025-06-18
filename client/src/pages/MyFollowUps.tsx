import { Link } from "wouter";
import { mockFollowUp } from "../data/mockFollowUp";

export default function MyFollowups() {
  const myProjects = mockFollowUp.filter(project => project.visibility === "private");

  return (
    <div className="max-w-4xl mx-auto pt-28 px-4">
      <h1 className="text-3xl font-bold mb-6">My Followed Projects</h1>

      {myProjects.length === 0 ? (
        <p className="text-muted-foreground">You are not following any projects yet.</p>
      ) : (
        <div className="grid gap-6">
          {myProjects.map(project => (
            <Link href={`/followup/${project.id}`} key={project.id}>
              <div className="border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md cursor-pointer transition">
                <h2 className="text-xl font-semibold mb-1">{project.name}</h2>
                <p className="text-sm text-muted-foreground mb-2">
                  {project.description.slice(0, 100)}...
                </p>
                <div className="text-sm text-gray-500 flex justify-between">
                  <span>Funded: €{project.funded} / €{project.goal}</span>
                  <span>{project.dateFunded}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
