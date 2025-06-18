import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Navbar } from "@/components/layout/navbar";
import { DemoNavbar } from "@/components/layout/demonavbar";
import Home from "@/pages/home";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { Footer } from "./components/sections/footer";

import Research from "@/pages/Research";
import ResearchDetails from "@/pages/ResearchDetails";
import Donate from "@/pages/Donate";
import InvestFlow from "@/pages/InvestFlow";
import DonateFlow from "@/pages/DonateFlow";
import DonateConfirmation from "@/pages/DonateConfirmation";
import InvestConfirmation from "@/pages/InvestConfirmation";
import FollowUp from "@/pages/FollowUp";
import FollowUpDetails from "@/pages/FollowUpDetails";

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return null;
}

function Router() {
  return (
    <Switch>
      {/* Demo Routes */}
      <Route path="/research" component={Research} />
      <Route path="/research-details/:id" component={ResearchDetails} />
      <Route path="/donate" component={Donate} />
      <Route path="/investflow" component={InvestFlow} />
      <Route path="/donateflow" component={DonateFlow} />
      <Route path="/donate-confirmation" component={DonateConfirmation} />
      <Route path="/invest-confirmation" component={InvestConfirmation} />
      <Route path="/followup" component={FollowUp} />
      <Route path="/followup/:id" component={FollowUpDetails} />

      {/* Base Pages */}
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();

  const isDemo = [
    "/research",
    "/donate",
    "/investflow",
    "/donateflow",
    "/donate-confirmation",
    "/invest-confirmation",
    "/followup",
  ].some(path => location.startsWith(path)) || 
    location.startsWith("/research-details/") || 
    location.startsWith("/followup/");

  return (
    <QueryClientProvider client={queryClient}>
      {isDemo ? <DemoNavbar /> : <Navbar />}
      <ScrollToTop />
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
