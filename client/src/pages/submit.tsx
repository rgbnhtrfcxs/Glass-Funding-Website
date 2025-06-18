import { useState } from "react";

export default function SubmitProject() {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    goal: "",
    description: "",
    researcherName: "",
    researcherTitle: "",
    researcherInstitution: "",
    impactTags: [""],
    milestones: [{ title: "", description: "" }],
    documents: [] as { label: string; url: string }[],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, index?: number, type?: string) => {
    const { name, value } = e.target;

    if (type === "impactTag") {
      const tags = [...formData.impactTags];
      if (index !== undefined) tags[index] = value;
      setFormData({ ...formData, impactTags: tags });
    } else if (type === "milestone") {
      const milestones = [...formData.milestones];
      if (index !== undefined) milestones[index][name as "title" | "description"] = value;
      setFormData({ ...formData, milestones });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const addImpactTag = () => {
    setFormData({ ...formData, impactTags: [...formData.impactTags, ""] });
  };

  const addMilestone = () => {
    setFormData({ ...formData, milestones: [...formData.milestones, { title: "", description: "" }] });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitted project:", formData);
    alert("Project submitted (not actually saved — demo only)");
  };

  return (
    <div className="max-w-2xl mx-auto pt-28 px-4">
      <h1 className="text-3xl font-bold mb-6">Submit Your Research Project</h1>
      <form onSubmit={handleSubmit} className="space-y-6">

        <div>
          <label className="font-medium">Project Title</label>
          <input
            type="text"
            name="name"
            className="input"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="font-medium">Category</label>
          <input
            type="text"
            name="category"
            className="input"
            value={formData.category}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="font-medium">Funding Goal (€)</label>
          <input
            type="number"
            name="goal"
            className="input"
            value={formData.goal}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="font-medium">Description</label>
          <textarea
            name="description"
            rows={4}
            className="input"
            value={formData.description}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Researcher Info</h3>
          <input
            type="text"
            name="researcherName"
            placeholder="Name"
            className="input"
            value={formData.researcherName}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="researcherTitle"
            placeholder="Title"
            className="input"
            value={formData.researcherTitle}
            onChange={handleChange}
          />
          <input
            type="text"
            name="researcherInstitution"
            placeholder="Institution"
            className="input"
            value={formData.researcherInstitution}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Impact Tags</h3>
          {formData.impactTags.map((tag, idx) => (
            <input
              key={idx}
              type="text"
              value={tag}
              onChange={(e) => handleChange(e, idx, "impactTag")}
              className="input mb-2"
              placeholder={`Tag #${idx + 1}`}
            />
          ))}
          <button type="button" onClick={addImpactTag} className="btn btn-sm">
            + Add Tag
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Milestones</h3>
          {formData.milestones.map((m, idx) => (
            <div key={idx} className="mb-2">
              <input
                type="text"
                name="title"
                placeholder="Milestone Title"
                className="input mb-1"
                value={m.title}
                onChange={(e) => handleChange(e, idx, "milestone")}
              />
              <input
                type="text"
                name="description"
                placeholder="Milestone Description"
                className="input"
                value={m.description}
                onChange={(e) => handleChange(e, idx, "milestone")}
              />
            </div>
          ))}
          <button type="button" onClick={addMilestone} className="btn btn-sm">
            + Add Milestone
          </button>
        </div>
        <div className="space-y-2">
  <h3 className="text-xl font-semibold">Documents</h3>
  <div
    className="border-2 border-dashed border-gray-300 p-4 rounded cursor-pointer text-center hover:border-gray-400 transition"
    onDrop={(e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      const newDocs = files.map((file) => ({
        label: file.name,
        url: `mock/${file.name}`, // mock URL
      }));
      setFormData({ ...formData, documents: [...(formData.documents || []), ...newDocs] });
    }}
    onDragOver={(e) => e.preventDefault()}
  >
    <p className="text-muted-foreground">Drag and drop documents here or use the button below.</p>
  </div>
  <input
    type="file"
    multiple
    className="input mt-2"
    onChange={(e) => {
      const files = Array.from(e.target.files || []);
      const newDocs = files.map((file) => ({
        label: file.name,
        url: `mock/${file.name}`, // mock URL
      }));
      setFormData({ ...formData, documents: [...(formData.documents || []), ...newDocs] });
    }}
  />
  {formData.documents && formData.documents.length > 0 && (
    <ul className="list-disc ml-6 text-sm text-muted-foreground">
      {formData.documents.map((doc, idx) => (
        <li key={idx}>{doc.label}</li>
      ))}
    </ul>
  )}
</div>

        <button type="submit" className="btn btn-primary w-full">
          Submit Project
        </button>
      </form>
    </div>
  );
}
