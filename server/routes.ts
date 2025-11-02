// server/routes.ts
import express, { Express } from "express";
import { createServer } from "http";
import { supabase } from "./supabaseClient.js";
import { storage } from "./storage";
import { labStore } from "./labs-store";
import { labRequestStore } from "./lab-requests-store";
import { labCollaborationStore } from "./collaboration-store";
import jwt from "jsonwebtoken";
import { supabasePublic } from "./supabasePublicClient.js";

import { ZodError } from "zod";

import {
  insertWaitlistSchema,
  insertContactSchema,
} from "@shared/schema";

import { insertLabCollaborationSchema } from "@shared/collaborations";
import {
  insertLabRequestSchema,
  updateLabRequestStatusSchema,
} from "@shared/labRequests";

import { insertDonationSchema } from "@shared/donations";

export function registerRoutes(app: Express) {
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // --------- Donations ----------
  app.post("/api/donations", async (req, res) => {
    try {
      const payload = insertDonationSchema.parse(req.body);
      const { data, error } = await supabase
        .from("donations")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      res.status(201).json(data);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res
          .status(400)
          .json({ message: issue?.message ?? "Invalid donation payload" });
      }
      res
        .status(500)
        .json({ message: error instanceof Error ? error.message : "Unable to save donation" });
    }
  });

  app.get("/api/donations", async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from("donations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json(data ?? []);
    } catch (error) {
      res
        .status(500)
        .json({ message: error instanceof Error ? error.message : "Unable to load donations" });
    }
  });

  // --------- Waitlist ----------
  app.post("/api/waitlist", async (req, res) => {
    try {
      const data = insertWaitlistSchema.parse(req.body);
      const result = await storage.addToWaitlist(data);
      res.json(result);
    } catch (_error) {
      res.status(400).json({ message: "Invalid waitlist submission" });
    }
  });

  // --------- Contact ----------
  app.post("/api/contact", async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const result = await storage.submitContact(data);
      res.json(result);
    } catch (_error) {
      res.status(400).json({ message: "Invalid contact submission" });
    }
  });

  // --------- Labs ----------
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
        return res
          .status(400)
          .json({ message: issue?.message ?? "Invalid lab payload" });
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
        return res
          .status(400)
          .json({ message: issue?.message ?? "Invalid lab update" });
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

  // --------- Lab Collaborations ----------
  app.post("/api/lab-collaborations", async (req, res) => {
    try {
      const payload = insertLabCollaborationSchema.parse(req.body);
      const lab = await labStore.findById(payload.labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });

      const created = await labCollaborationStore.create({
        ...payload,
        labName: lab.name,
      });
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res
          .status(400)
          .json({ message: issue?.message ?? "Invalid collaboration payload" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to submit collaboration" });
    }
  });

  // --------- Lab Requests ----------
  app.get("/api/lab-requests", async (_req, res) => {
    const requests = await labRequestStore.list();
    res.json(requests);
  });

  app.post("/api/lab-requests", async (req, res) => {
    try {
      const payload = insertLabRequestSchema.parse(req.body);
      const lab = await labStore.findById(payload.labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });

      const created = await labRequestStore.create({
        ...payload,
        labName: lab.name,
      });
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res
          .status(400)
          .json({ message: issue?.message ?? "Invalid lab request payload" });
      }
      res.status(500).json({ message: "Unable to submit lab request" });
    }
  });

  app.patch("/api/lab-requests/:id/status", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid request id" });

    try {
      const data = updateLabRequestStatusSchema.parse(req.body);
      const updated = await labRequestStore.updateStatus(id, data);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res
          .status(400)
          .json({ message: issue?.message ?? "Invalid status update" });
      }
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Unable to update request status" });
    }
  });

  // Get a profile by ID
app.get("/api/profile/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return res.status(404).json({ error: error.message });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Create or update a profile
app.post("/api/profile/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body; // e.g., { full_name: "John Doe" }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id, ...updates })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


// Signup
app.post("/api/signup", async (req, res) => {
  try {
    const { email, password, display_name } = req.body;

    const { data, error } = await supabasePublic.auth.signUp({
      email,
      password,
      options: {
        data: { display_name },
      },
    });

    if (error) throw error;

    res.status(201).json({ message: "Signup successful, check your email", user: data.user });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Signup failed" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password });

    if (error) throw error;

    // Return the session/token
    res.json({
      message: "Login successful",
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      user: data.user,
    });
  } catch (err) {
    res.status(401).json({ message: err instanceof Error ? err.message : "Login failed" });
  }
});



const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Missing token" });

  const { data, error } = await supabasePublic.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ message: "Invalid token" });

  req.user = data.user;
  next();
};

// Example of a protected route
app.get("/api/profile", authenticate, async (req, res) => {
  res.json({ message: "Authenticated!", user: req.user });
});



  // --------- Return HTTP server ----------
  return createServer(app);
}
