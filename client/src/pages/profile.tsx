import { Link } from "wouter";

export default function Profile() {
  return (
    <div className="max-w-3xl mx-auto pt-32 px-4">
      <h1 className="text-3xl font-bold mb-6">My Profile</h1>

      <div className="space-y-4 text-muted-foreground">
        <p>Welcome back! Use the links below to manage your research activity:</p>

        <div className="flex flex-col space-y-3 mt-4">
          <Link href="/favorites" className="text-lg text-blue-600 hover:underline">
            ⭐ Favorites
          </Link>
          <Link href="/myfollowups" className="text-lg text-blue-600 hover:underline">
            📈 My Follow-Ups
          </Link>
          <Link href="/submit" className="text-lg text-blue-600 hover:underline">
            🧪 Submit a Project (coming soon)
          </Link>
        </div>
      </div>
    </div>
  );
}
