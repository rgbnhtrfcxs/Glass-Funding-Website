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

import Research from "@/pages/Research";
import ResearchDetails from "@/pages/demo/ResearchDetails";
import Donate from "@/pages/Donate";
import InvestFlow from "@/pages/demo/InvestFlow";
import DonateFlow from "@/pages/demo/DonateFlow";
import DonateConfirmation from "@/pages/demo/DonateConfirmation";
import InvestConfirmation from "@/pages/demo/InvestConfirmation";
import FollowUp from "@/pages/FollowUp";
import FollowUpDetails from "@/pages/demo/FollowUpDetails";

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
      <Route path="/demo/research-details/:id" component={ResearchDetails} />
      <Route path="/donate" component={Donate} />
      <Route path="/demo/investflow" component={InvestFlow} />
      <Route path="/demo/donateflow" component={DonateFlow} />
      <Route path="/demo/donate-confirmation" component={DonateConfirmation} />
      <Route path="/demo/invest-confirmation" component={InvestConfirmation} />
      <Route path="/followup" component={FollowUp} />
      <Route path="/demo/followup/:id" component={FollowUpDetails} />

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
  const isDemo = 
  location.startsWith("/demo") ||
  location === "/research" ||
  location === "/donate" ||
  location.startsWith("/followup"); 

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
