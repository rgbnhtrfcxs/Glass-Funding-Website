import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertWaitlistSchema, insertContactSchema } from "@shared/schema";

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

  return createServer(app);
}
