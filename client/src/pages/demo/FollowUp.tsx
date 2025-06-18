import { Link } from "wouter";
import { mockFollowUp } from "../../data/mockFollowUp";


export default function FollowUp() {
  return (
    <section className="container mx-auto px-4 pt-28">
      <h1 className="text-3xl font-bold mb-6 text-center">Research Follow-Up</h1>
      <p className="mb-8 text-center text-muted-foreground">Explore the progress of fully funded research projects.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mockFollowUp.map((project) => (
          <Link key={project.id} href={`/followup/${project.id}`}>
            <div className="border border-gray-200 p-6 rounded-lg shadow hover:shadow-md cursor-pointer transition">
              <h2 className="text-xl font-semibold mb-2">{project.name}</h2>
              <p className="text-sm text-muted-foreground mb-2">{project.category}</p>
              <div className="text-sm text-gray-700">
                <p><strong>Uploaded:</strong> {project.dateUploaded}</p>
                <p><strong>Funded:</strong> {project.dateFunded}</p>
                <p><strong>Amount:</strong> €{project.funded.toLocaleString()}</p>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">{project.description.slice(0, 100)}...</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
