import { promises as fs } from "node:fs";
import path from "node:path";
import {
  insertLabRequestSchema,
  labRequestSchema,
  updateLabRequestStatusSchema,
  type InsertLabRequest,
  type LabRequest,
  type UpdateLabRequestStatus,
} from "@shared/labRequests";

const requestsDir = path.join(process.cwd(), "server", "data");
const requestsFile = path.join(requestsDir, "lab-requests.json");

export class LabRequestStore {
  private requests: LabRequest[] = [];
  private ready: Promise<void>;

  constructor(private filePath: string = requestsFile) {
    this.ready = this.load();
  }

  private async load() {
    try {
      const contents = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(contents);
      this.requests = zArraySafe(parsed);
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        this.requests = [];
        await this.persist();
      } else {
        throw error;
      }
    }
  }

  private async persist() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.requests, null, 2));
  }

  private async ensureReady() {
    await this.ready;
  }

  private nextId() {
    return this.requests.length ? Math.max(...this.requests.map(req => req.id)) + 1 : 1;
  }

  async list(): Promise<LabRequest[]> {
    await this.ensureReady();
    return [...this.requests].sort((a, b) => b.id - a.id);
  }

  async create(payload: InsertLabRequest): Promise<LabRequest> {
    await this.ensureReady();
    const data = insertLabRequestSchema.parse(payload);
    const request: LabRequest = {
      ...data,
      id: this.nextId(),
      status: "pending_review",
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewNotes: "",
    };
    this.requests.push(request);
    await this.persist();
    return request;
  }

  async updateStatus(id: number, patch: UpdateLabRequestStatus): Promise<LabRequest> {
    await this.ensureReady();
    const data = updateLabRequestStatusSchema.parse(patch);
    const index = this.requests.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error("Lab request not found");
    }
    const updated: LabRequest = {
      ...this.requests[index],
      status: data.status,
      reviewNotes: data.reviewNotes ?? this.requests[index].reviewNotes,
      reviewedAt: data.status === "pending_review" ? null : new Date().toISOString(),
    };
    this.requests[index] = updated;
    await this.persist();
    return updated;
  }
}

function zArraySafe(value: unknown): LabRequest[] {
  if (!Array.isArray(value)) return [];
  const valid: LabRequest[] = [];
  value.forEach(item => {
    try {
      valid.push(labRequestSchema.parse(item));
    } catch {
      // ignore invalid
    }
  });
  return valid;
}

export const labRequestStore = new LabRequestStore();
