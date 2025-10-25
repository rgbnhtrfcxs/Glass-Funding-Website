import { promises as fs } from "node:fs";
import path from "node:path";
import {
  insertLabSchema,
  labListSchema,
  updateLabSchema,
  type InsertLab,
  type LabPartner,
  type UpdateLab,
} from "@shared/labs";
import { mockLabs } from "@shared/mockLabs";

const dataDir = path.join(process.cwd(), "server", "data");
const labsFilePath = path.join(dataDir, "labs.json");

export class LabStore {
  private labs: LabPartner[] = [];
  private ready: Promise<void>;

  constructor(private filePath: string = labsFilePath) {
    this.ready = this.load();
  }

  private async load() {
    try {
      const contents = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(contents);
      this.labs = labListSchema.parse(parsed);
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        this.labs = mockLabs;
        await this.persist();
      } else {
        throw error;
      }
    }
  }

  private async persist() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.labs, null, 2));
  }

  private async ensureReady() {
    await this.ready;
  }

  private nextId() {
    return this.labs.length ? Math.max(...this.labs.map(lab => lab.id)) + 1 : 1;
  }

  async list(): Promise<LabPartner[]> {
    await this.ensureReady();
    return [...this.labs];
  }

  async findById(id: number): Promise<LabPartner | undefined> {
    await this.ensureReady();
    return this.labs.find(lab => lab.id === id);
  }

  async create(payload: InsertLab): Promise<LabPartner> {
    await this.ensureReady();
    const data = insertLabSchema.parse(payload);
    const lab: LabPartner = { ...data, id: this.nextId() };
    this.labs.push(lab);
    await this.persist();
    return lab;
  }

  async update(id: number, updates: UpdateLab): Promise<LabPartner> {
    await this.ensureReady();
    const data = updateLabSchema.parse(updates);
    const index = this.labs.findIndex(lab => lab.id === id);
    if (index === -1) {
      throw new Error("Lab not found");
    }
    const updated: LabPartner = {
      ...this.labs[index],
      ...data,
    };
    this.labs[index] = updated;
    await this.persist();
    return updated;
  }

  async delete(id: number): Promise<void> {
    await this.ensureReady();
    const index = this.labs.findIndex(lab => lab.id === id);
    if (index === -1) {
      throw new Error("Lab not found");
    }
    this.labs.splice(index, 1);
    await this.persist();
  }
}

export const labStore = new LabStore();
