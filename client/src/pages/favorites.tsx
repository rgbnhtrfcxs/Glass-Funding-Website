import { Link } from "wouter";
import { mockResearch } from "@/data/mockResearch";

export default function Favorites() {
  // For now, use a few entries from mockResearch to simulate favorites
  const favoriteProjects = mockResearch.slice(0, 3); // Example: first 3 projects as "favorites"

  return (
    <div className="max-w-4xl mx-auto pt-32 px-4">
      <h1 className="text-3xl font-bold mb-6">⭐ Favorite Projects</h1>

      {favoriteProjects.length === 0 ? (
        <p className="text-muted-foreground">You haven't saved any projects yet.</p>
      ) : (
        <div className="grid gap-4">
          {favoriteProjects.map((project) => (
            <Link
              key={project.id}
              href={`/research-details/${project.id}`}
              className="block p-4 border rounded hover:bg-muted transition"
            >
              <h2 className="text-xl font-semibold">{project.name}</h2>
              <p className="text-sm text-muted-foreground">{project.category}</p>
              <p className="text-sm mt-1">
                {Math.round((project.funded / project.goal) * 100)}% funded – {project.funded} € raised
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
