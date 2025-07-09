import { useLocation } from "wouter";
import { useState } from "react";
import { mockResearch } from "../data/mockResearch";
import type { ResearchItem } from "../data/mockResearch";

type SortableKey = "name" | "category" | "grade" | "date" | "funded" | "goal" | "percent";

// TODO fix category filter for only live categories and alphebatize (A>Z)
// TODO in mobile align sort by right

export default function Research() {
  const [, navigate] = useLocation();
  const [researchList] = useState<ResearchItem[]>(mockResearch);
  const [sortKey, setSortKey] = useState<SortableKey>("name");
  const [filterCategory, setFilterCategory] = useState("All");

  const sortedAndFiltered = [...researchList]
    .filter((item) => filterCategory === "All" || item.category === filterCategory)
    .sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "category") return a.category.localeCompare(b.category);
      if (sortKey === "grade") return a.grade.localeCompare(b.grade);
      if (sortKey === "date") return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortKey === "percent") {
        const percentA = (a.funded / a.goal) * 100;
        const percentB = (b.funded / b.goal) * 100;
        return percentB - percentA;
      }
      if (sortKey === "funded") return b.funded - a.funded;
      if (sortKey === "goal") return b.goal - a.goal;
      return 0;
    });

  return (
    <section className="py-20 bg-background min-h-screen">
      <div className="container mx-auto px-4 pt-16">
        <h2 className="text-3xl font-bold mb-8 text-center">Research Projects</h2>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
          <div>
            <label htmlFor="categoryFilter" className="mr-2 font-medium">Filter by Category:</label>
            <select
              id="categoryFilter"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border px-3 py-1 rounded"
            >
              <option value="All">All</option>
              {Array.from(new Set(mockResearch.map((item) => item.category))).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sortKey" className="mr-2 font-medium">Sort by:</label>
            <select
              id="sortKey"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortableKey)}
              className="border px-3 py-1 rounded"
            >
              <option value="name">Name</option>
              <option value="date">Date</option>
              <option value="funded">Funded</option>
              <option value="goal">Goal</option>
              <option value="grade">Grade</option>
              <option value="percent">% Funded</option>
            </select>
          </div>
        </div>

        {/* Table */}
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
              {sortedAndFiltered.map((item) => {
                const percent = Math.min(Math.round((item.funded / item.goal) * 100), 100);

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-muted/20 cursor-pointer"
                    onClick={() => navigate(`/research-details/${item.id}`)}
                  >
                    <td className="px-4 py-2 font-medium text-primary underline">{item.name}</td>
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
