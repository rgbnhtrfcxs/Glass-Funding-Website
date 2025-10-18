import { Switch, Route, useLocation } from "wouter";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Navbar } from "@/components/layout/navbar";
import { DemoNavbar } from "@/components/layout/demonavbar";
import Home from "@/pages/home";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";
import { Footer } from "./components/sections/footer";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ForgotPasswordConfirmation from "@/pages/ForgotPasswordConfirmation";

import Projects from "@/pages/Projects";
import ProjectDetails from "@/pages/ProjectDetails";
import Bubbles from "@/pages/Bubbles";
import DonateFlow from "@/pages/DonateFlow";
import DonateConfirmation from "@/pages/DonateConfirmation";
import FollowUp from "@/pages/FollowUp";
import FollowUpStory from "@/pages/FollowUpStory";
import Favorites from "@/pages/favorites";
import Profile from "@/pages/profile";
import MyFollowups from "@/pages/MyFollowUps";
import SubmitProject from "@/pages/submit";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Waitlist1 from "@/pages/Waitlist";
import OnePagers from "@/pages/OnePagers";
import Roadmap from "@/pages/Roadmap";
import Status from "@/pages/status";
import ServerError from "@/pages/server-error";
import Maintenance from "@/pages/maintenance";

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return null;
}

function PageTransition({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    setIsActive(false);
    const frame = window.requestAnimationFrame(() => setIsActive(true));
    return () => window.cancelAnimationFrame(frame);
  }, [location]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsActive(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className={`page-transition ${isActive ? "page-transition--active" : ""}`}>
      {children}
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Demo Routes */}
      <Route path="/projects" component={Projects} />
      <Route path="/research" component={Projects} />
      <Route path="/projects/:id" component={ProjectDetails} />
      <Route path="/research-details/:id" component={ProjectDetails} />
      <Route path="/bubbles" component={Bubbles} />
      <Route path="/donate" component={Bubbles} />
      <Route path="/donateflow" component={DonateFlow} />
      <Route path="/donate-confirmation" component={DonateConfirmation} />
      <Route path="/followups" component={FollowUp} />
      <Route path="/followups/:id" component={FollowUpStory} />
      <Route path="/followup" component={FollowUp} />
      <Route path="/followup/:id" component={FollowUpStory} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/profile" component={Profile} />
      <Route path="/myfollowups" component={MyFollowups} />
      <Route path="/submit" component={SubmitProject} />

      {/* Auth Pages */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/forgot-password/confirmation" component={ForgotPasswordConfirmation} />

      {/* Base Pages */}
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/one-pagers" component={OnePagers} />
      <Route path="/roadmap" component={Roadmap} />
      <Route path="/status" component={Status} />
      <Route path="/500" component={ServerError} />
      <Route path="/maintenance" component={Maintenance} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/Waitlist"component={Waitlist1} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();

  const isDemo = [
    "/projects",
    "/research",
    "/bubbles",
    "/donate",
    "/donateflow",
    "/donate-confirmation",
    "/followups",
    "/followup",
    "/signup",
    "/forgot-password",
    "/forgot-password/confirmation",
    "/login",
    "/profile",
    "/favorites",
    "/myfollowups",
    "/submit",
    "/500",
    "/maintenance",
  ].some(path => location.startsWith(path)) || 
    location.startsWith("/projects/") ||
    location.startsWith("/research-details/") || 
    location.startsWith("/followups/") ||
    location.startsWith("/followup/");

  return (
    <QueryClientProvider client={queryClient}>
      {isDemo ? <DemoNavbar /> : <Navbar />}
      <ScrollToTop />
      <PageTransition>
        <Router />
      </PageTransition>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
