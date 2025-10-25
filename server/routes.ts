import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { labStore } from "./labs-store";
import { labRequestStore } from "./lab-requests-store";
import { insertWaitlistSchema, insertContactSchema } from "@shared/schema";
import {
  insertLabRequestSchema,
  updateLabRequestStatusSchema,
} from "@shared/labRequests";
import { ZodError } from "zod";

export async function registerRoutes(app: Express) {
  app.post("/api/waitlist", async (req, res) => {
    try {
      const data = insertWaitlistSchema.parse(req.body);
      const result = await storage.addToWaitlist(data);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: "Invalid waitlist submission" });
    }
  });

  app.post("/api/contact", async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const result = await storage.submitContact(data);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: "Invalid contact submission" });
    }
  });

  app.get("/api/labs", async (_req, res) => {
    const labs = await labStore.list();
    res.json(labs);
  });

  app.post("/api/labs", async (req, res) => {
    try {
      const lab = await labStore.create(req.body);
      res.status(201).json(lab);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid lab payload" });
      }
      res.status(500).json({ message: "Unable to create lab" });
    }
  });

  app.put("/api/labs/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid lab id" });
    }
    try {
      const lab = await labStore.update(id, req.body);
      res.json(lab);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid lab update" });
      }
      if (error instanceof Error && error.message === "Lab not found") {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Unable to update lab" });
    }
  });

  app.delete("/api/labs/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid lab id" });
    }
    try {
      await labStore.delete(id);
      res.status(204).end();
    } catch (error) {
      if (error instanceof Error && error.message === "Lab not found") {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Unable to delete lab" });
    }
  });

  app.get("/api/lab-requests", async (_req, res) => {
    const requests = await labRequestStore.list();
    res.json(requests);
  });

  app.post("/api/lab-requests", async (req, res) => {
    try {
      const payload = insertLabRequestSchema.parse(req.body);
      const lab = await labStore.findById(payload.labId);
      if (!lab) {
        return res.status(404).json({ message: "Selected lab no longer exists" });
      }
      const created = await labRequestStore.create({
        ...payload,
        labName: lab.name,
      });
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid request" });
      }
      res.status(500).json({ message: "Unable to submit request" });
    }
  });

  app.patch("/api/lab-requests/:id/status", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid request id" });
    }
    try {
      const data = updateLabRequestStatusSchema.parse(req.body);
      const updated = await labRequestStore.updateStatus(id, data);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid status update" });
      }
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Unable to update request" });
    }
  });

  return createServer(app);
}
