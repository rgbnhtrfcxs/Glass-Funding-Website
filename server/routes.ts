// server/routes.ts
import express, { type Express } from "express";
import { createServer } from "http";

import { registerAuthRoutes } from "./routes/auth.js";
import { registerLabRoutes } from "./routes/labs.js";
import { registerLabRequestRoutes } from "./routes/lab-requests.js";
import { registerTeamRoutes } from "./routes/teams.js";
import { registerStripeRoutes } from "./routes/stripe.js";
import { registerPublicFormRoutes } from "./routes/public-forms.js";
import { registerCollaborationRoutes } from "./routes/collaborations.js";
import { registerNewsRoutes } from "./routes/news.js";
import { registerMyLabRoutes } from "./routes/my-lab.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerOrganizationRoutes } from "./routes/organizations.js";
import { registerAuditorRoutes } from "./routes/auditor.js";
import { registerVerificationRoutes } from "./routes/verification.js";

export function registerRoutes(app: Express) {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  registerStripeRoutes(app);
  registerAuthRoutes(app);
  registerLabRoutes(app);
  registerTeamRoutes(app);
  registerCollaborationRoutes(app);
  registerLabRequestRoutes(app);
  registerNewsRoutes(app);
  registerPublicFormRoutes(app);
  registerVerificationRoutes(app);
  registerMyLabRoutes(app);
  registerAdminRoutes(app);
  registerOrganizationRoutes(app);
  registerAuditorRoutes(app);

  return createServer(app);
}
