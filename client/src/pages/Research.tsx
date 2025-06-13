import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { mockResearch } from "../data/mockResearch.ts";

export default function Research() {
  const [, navigate] = useLocation();
  const [researchList, setResearchList] = useState(mockResearch);
  const [sortKey, setSortKey] = useState("name");
  const [filterCategory, setFilterCategory] = useState("All");

  useEffect(() => {
    console.log("Loaded research list:", researchList);
  }, [researchList]);

  return (
    <section className="py-20 bg-background min-h-screen">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8 text-center">Research Projects</h2>

        {/* Filter Dropdown */}
        <div className="mb-4">
          <label htmlFor="categoryFilter" className="mr-2 font-medium">Filter by Category:</label>
          <select
            id="categoryFilter"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border px-3 py-1 rounded"
          >
            <option value="All">All</option>
            <option value="Cancer">Cancer</option>
            <option value="Environmental">Environmental</option>
            <option value="Technology">Technology</option>
            <option value="Neurology">Neurology</option>
            <option value="Materials Science">Materials Science</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border divide-y divide-muted text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Goal</th>
                <th className="px-4 py-2 text-left">Funded</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Grade</th>
                <th className="px-4 py-2 text-left">Progress</th>
              </tr>
            </thead>
            <tbody>
              {researchList
                .filter((item) => filterCategory === "All" || item.category === filterCategory)
                .map((item) => {
                  const percent = Math.min(
                    Math.round((item.funded / item.goal) * 100),
                    100
                  );

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/20 cursor-pointer"
                      onClick={() => navigate(`/research-details/${item.id}`)}
                    >
                      <td className="px-4 py-2 font-medium text-primary underline">
                        {item.name}
                      </td>
                      <td className="px-4 py-2">{item.category}</td>
                      <td className="px-4 py-2">{item.goal.toLocaleString()} €</td>
                      <td className="px-4 py-2">{item.funded.toLocaleString()} €</td>
                      <td className="px-4 py-2">{item.date}</td>
                      <td className="px-4 py-2">{item.grade}</td>
                      <td className="px-4 py-2 w-[150px]">
                        <div className="relative w-full h-2 bg-muted rounded-full">
                          <div
                            className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-blue-400 to-pink-400"
                            style={{ width: `${percent}%` }}
                          />
                          <span className="absolute right-2 top-[-1.25rem] text-xs text-gray-500">
                            {percent}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
