import type { ErcDisciplineOption } from "@shared/labs";

const fallbackTitles: Record<string, string> = {
  PE1: "Mathematics",
  PE2: "Fundamental Constituents of Matter",
  PE3: "Condensed Matter Physics",
  PE4: "Physical and Analytical Chemical Sciences",
  PE5: "Synthetic Chemistry and Materials",
  PE6: "Computer Science and Informatics",
  PE7: "Systems and Communication Engineering",
  PE8: "Products and Processes Engineering",
  PE9: "Universe Sciences",
  PE10: "Earth System Science",
  PE11: "Materials Engineering",
  LS1: "Molecular and Structural Biology",
  LS2: "Genetics, Genomics, and Bioinformatics",
  LS3: "Cell Biology and Development",
  LS4: "Physiology in Health and Disease",
  LS5: "Neuroscience and Disorders",
  LS6: "Immunity, Infection, and Immunotherapy",
  LS7: "Diagnostic Tools, Therapies, and Public Health",
  LS8: "Evolutionary, Population, and Environmental Biology",
  LS9: "Biotechnology and Biosystems Engineering",
  SH1: "Individuals, Markets, and Organisations",
  SH2: "Institutions, Values, and Behaviour",
  SH3: "Society, Diversity, and Population",
  SH4: "The Human Mind and Complexity",
  SH5: "Cultures and Cultural Production",
  SH6: "The Human Past",
  SH7: "Human Mobility, Environment, and Space",
  SH8: "Science, Technology, and Innovation Studies",
};

const fallbackOptions: ErcDisciplineOption[] = [
  ...Array.from({ length: 11 }, (_, index) => ({
    code: `PE${index + 1}` as const,
    domain: "PE" as const,
    title: fallbackTitles[`PE${index + 1}`] ?? `PE${index + 1}`,
  })),
  ...Array.from({ length: 9 }, (_, index) => ({
    code: `LS${index + 1}` as const,
    domain: "LS" as const,
    title: fallbackTitles[`LS${index + 1}`] ?? `LS${index + 1}`,
  })),
  ...Array.from({ length: 8 }, (_, index) => ({
    code: `SH${index + 1}` as const,
    domain: "SH" as const,
    title: fallbackTitles[`SH${index + 1}`] ?? `SH${index + 1}`,
  })),
];

const isErcOption = (value: unknown): value is ErcDisciplineOption => {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.code !== "string" || !/^(PE(1[0-1]|[1-9])|LS[1-9]|SH[1-8])$/.test(row.code)) return false;
  if (typeof row.title !== "string" || row.title.trim().length === 0) return false;
  return row.domain === "PE" || row.domain === "LS" || row.domain === "SH";
};

export const fetchErcDisciplineOptions = async (): Promise<ErcDisciplineOption[]> => {
  try {
    const response = await fetch("/api/erc-disciplines");
    if (!response.ok) return fallbackOptions;
    const payload = await response.json();
    if (!Array.isArray(payload)) return fallbackOptions;
    const options = payload.filter(isErcOption);
    return options.length > 0 ? options : fallbackOptions;
  } catch {
    return fallbackOptions;
  }
};

export const ercLabel = (discipline: ErcDisciplineOption) => `${discipline.code} - ${discipline.title}`;
