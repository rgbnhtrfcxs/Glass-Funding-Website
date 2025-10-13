import { useState } from "react";
import { UploadCloud, Plus, Trash2, CheckCircle, ArrowUpRight } from "lucide-react";
import {
  submissionGuidelines,
  projectCategories,
  milestoneTemplates,
} from "@/data/mockWorkspace";

interface MilestoneField {
  title: string;
  description: string;
}

interface DocumentAttachment {
  label: string;
  url: string;
}

const emptyMilestone: MilestoneField = { title: "", description: "" };

export default function SubmitProject() {
  const [formData, setFormData] = useState({
    name: "",
    category: projectCategories[0] ?? "",
    goal: "",
    description: "",
    researcherName: "",
    researcherTitle: "",
    researcherInstitution: "",
    impactTags: [""],
    milestones: [emptyMilestone],
    documents: [] as DocumentAttachment[],
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    index?: number,
    type?: "impactTag" | "milestone"
  ) => {
    const { name, value } = e.target;

    if (type === "impactTag" && index !== undefined) {
      const nextTags = [...formData.impactTags];
      nextTags[index] = value;
      setFormData({ ...formData, impactTags: nextTags });
      return;
    }

    if (type === "milestone" && index !== undefined) {
      const nextMilestones = [...formData.milestones];
      nextMilestones[index] = {
        ...nextMilestones[index],
        [name]: value,
      };
      setFormData({ ...formData, milestones: nextMilestones });
      return;
    }

    setFormData({ ...formData, [name]: value });
  };

  const addImpactTag = () => {
    setFormData(prev => ({ ...prev, impactTags: [...prev.impactTags, ""] }));
  };

  const removeImpactTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      impactTags: prev.impactTags.filter((_, idx) => idx !== index),
    }));
  };

  const addMilestone = () => {
    setFormData(prev => ({ ...prev, milestones: [...prev.milestones, { ...emptyMilestone }] }));
  };

  const removeMilestone = (index: number) => {
    setFormData(prev => ({
      ...prev,
      milestones: prev.milestones.filter((_, idx) => idx !== index),
    }));
  };

  const attachDocuments = (files: FileList | null) => {
    if (!files) return;

    const newDocs: DocumentAttachment[] = Array.from(files).map(file => ({
      label: file.name,
      url: `mock/${file.name}`,
    }));

    setFormData(prev => ({
      ...prev,
      documents: [...prev.documents, ...newDocs],
    }));
  };

  const removeDocument = (index: number) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, idx) => idx !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.table(formData);
    alert("Project submitted (demo only, data not persisted).");
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-24">
      <div className="container mx-auto px-4 pt-32">
        <div className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Submit Your Research Project</h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Share the breakthrough you&apos;re building. Glass diligence will review your submission and collaborate on
            milestones before opening it to funders.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,_2fr)_minmax(0,_1fr)]">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-border bg-card p-6 md:p-10 space-y-8 shadow-sm">
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Project Overview</h2>
              <div className="space-y-2">
                <label className="text-sm font-medium">Project title</label>
                <input
                  type="text"
                  name="name"
                  className="input"
                  placeholder="What breakthrough are you pursuing?"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="input"
                  >
                    {projectCategories.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Funding goal (€)</label>
                  <input
                    type="number"
                    name="goal"
                    className="input"
                    placeholder="e.g. 75000"
                    value={formData.goal}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Short narrative</label>
                <textarea
                  name="description"
                  rows={4}
                  className="input"
                  placeholder="In a few sentences, what impact will your research unlock?"
                  value={formData.description}
                  onChange={handleChange}
                  required
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Research Team</h2>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-1 space-y-2">
                  <label className="text-sm font-medium">Lead researcher</label>
                  <input
                    type="text"
                    name="researcherName"
                    className="input"
                    placeholder="Full name"
                    value={formData.researcherName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <input
                    type="text"
                    name="researcherTitle"
                    className="input"
                    placeholder="Principal Investigator"
                    value={formData.researcherTitle}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Institution / Lab</label>
                  <input
                    type="text"
                    name="researcherInstitution"
                    className="input"
                    placeholder="Your institution"
                    value={formData.researcherInstitution}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Impact tags</h2>
                <button
                  type="button"
                  onClick={addImpactTag}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add tag
                </button>
              </div>
              <div className="space-y-3">
                {formData.impactTags.map((tag, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={tag}
                      onChange={event => handleChange(event, idx, "impactTag")}
                      className="input"
                      placeholder={`Tag #${idx + 1}`}
                    />
                    {formData.impactTags.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeImpactTag(idx)}
                        className="rounded-full border border-border p-2 text-muted-foreground hover:text-destructive hover:border-destructive transition"
                        aria-label="Remove impact tag"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Milestone plan</h2>
                <button
                  type="button"
                  onClick={addMilestone}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add milestone
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Funders release capital tranche-by-tranche. Tie each milestone to a clearly measurable output.
              </p>

              <div className="space-y-5">
                {formData.milestones.map((milestone, idx) => (
                  <div key={idx} className="rounded-2xl border border-border bg-background/70 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        Milestone {idx + 1}
                      </span>
                      {formData.milestones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMilestone(idx)}
                          className="text-xs text-muted-foreground hover:text-destructive transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      name="title"
                      className="input"
                      placeholder="Milestone title"
                      value={milestone.title}
                      onChange={event => handleChange(event, idx, "milestone")}
                    />
                    <textarea
                      name="description"
                      rows={3}
                      className="input"
                      placeholder="Describe the deliverable and expected timeline."
                      value={milestone.description}
                      onChange={event => handleChange(event, idx, "milestone")}
                    />
                    <div className="flex flex-wrap gap-2">
                      {milestoneTemplates.map(template => (
                        <button
                          type="button"
                          key={template}
                          onClick={() =>
                            setFormData(prev => {
                              const next = [...prev.milestones];
                              next[idx] = {
                                ...next[idx],
                                title: next[idx].title || template,
                              };
                              return { ...prev, milestones: next };
                            })
                          }
                          className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition"
                        >
                          {template}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Supporting documents</h2>
                <UploadCloud className="h-4 w-4 text-primary" />
              </div>
              <div
                className="cursor-pointer rounded-2xl border border-dashed border-border bg-background/60 p-8 text-center hover:border-primary transition"
                onDrop={event => {
                  event.preventDefault();
                  attachDocuments(event.dataTransfer.files);
                }}
                onDragOver={event => event.preventDefault()}
              >
                <p className="text-sm text-muted-foreground">
                  Drag files here or click below to upload budgets, experimental protocols, or ethics approvals.
                </p>
                <label className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition cursor-pointer">
                  <UploadCloud className="h-4 w-4" />
                  Choose files
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={event => attachDocuments(event.target.files)}
                  />
                </label>
              </div>

              {formData.documents.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Attached files</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {formData.documents.map((doc, idx) => (
                      <li key={doc.label} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-2">
                        <span>{doc.label}</span>
                        <button
                          type="button"
                          onClick={() => removeDocument(idx)}
                          className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive transition"
                          aria-label="Remove document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
            >
              Submit for review
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </form>

          <aside className="space-y-6">
            {submissionGuidelines.map(section => (
              <div key={section.title} className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <h3 className="text-lg font-semibold">{section.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{section.description}</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {section.items.map(item => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-1" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}
