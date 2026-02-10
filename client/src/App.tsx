import { Switch, Route, useLocation } from "wouter";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Navbar } from "@/components/layout/navbar";
import Home from "@/pages/home";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ForgotPasswordConfirmation from "@/pages/ForgotPasswordConfirmation";
import ResetPassword from "@/pages/ResetPassword";
import ConfirmEmail from "@/pages/ConfirmEmail";

import Labs from "@/pages/Labs";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Waitlist1 from "@/pages/Waitlist";
import OnePagers from "@/pages/OnePagers";
import Roadmap from "@/pages/Roadmap";
import Status from "@/pages/status";
import ServerError from "@/pages/server-error";
import Maintenance from "@/pages/maintenance";
import LabDetails from "@/pages/LabDetails";
import LabRequest from "@/pages/LabRequest";
import LabCollaboration from "@/pages/LabCollaboration";
import AdminLabs from "@/pages/AdminLabs";
import PricingArchived from "@/pages/PricingArchived";
import LabProfile from "@/pages/LabProfile";
import ProfilePortal from "@/pages/ProfilePortal";
import Account from "@/pages/Account";
import Teams from "@/pages/Teams";
import TeamDetails from "@/pages/TeamDetails";
import ManageTeams from "@/pages/ManageTeams";
import TeamEditor from "@/pages/TeamEditor";
import Requests from "@/pages/Requests";
import MyLab from "@/pages/MyLab";
import Logout from "@/pages/Logout";
import PaymentFlow from "@/pages/PaymentFlow";
import ManageSelect from "@/pages/ManageSelect";
import NewLab from "@/pages/NewLab";
import Favorites from "@/pages/Favorites";
import Subscriptions from "@/pages/Subscriptions";
import DonationDisabled from "@/pages/DonationDisabled";
import { LabsProvider } from "@/context/LabsContext";
import { TeamsProvider } from "@/context/TeamsContext";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LabRoute from "@/components/LabRoute";
import AdminRoute from "@/components/AdminRoute";
import StripeCheckout from "@/pages/StripeCheckout";
import { Footer } from "@/components/sections/footer";
import { ConsentProvider } from "@/context/ConsentContext";
import { ConsentBanner } from "@/components/ConsentBanner";

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
      <Route path="/labs" component={Labs} />
      <Route path="/labs/:id" component={LabDetails} />
      <Route path="/teams" component={Teams} />
      <Route path="/teams/:id" component={TeamDetails} />
      <Route path="/labs/:id/request" component={LabRequest} />
      <LabRoute path="/labs/:id/collaborate" component={LabCollaboration} />
      <AdminRoute path="/admin/labs" component={AdminLabs} />
      <Route path="/lab-profile" component={LabProfile} />
      <ProtectedRoute path="/account" component={Account} />
      <ProtectedRoute path="/account/edit" component={ProfilePortal} />
      <ProtectedRoute path="/requests" component={Requests} />
      <ProtectedRoute path="/subscriptions" component={Subscriptions} />
      <ProtectedRoute path="/favorites" component={Favorites} />
      <LabRoute path="/lab/manage" component={ManageSelect} />
      <LabRoute path="/lab/manage/new" component={NewLab} />
      <LabRoute path="/lab/manage/:id" component={MyLab} />
      <ProtectedRoute path="/team/manage" component={ManageTeams} />
      <ProtectedRoute path="/team/manage/new" component={TeamEditor} />
      <ProtectedRoute path="/team/manage/:id" component={TeamEditor} />
      <Route path="/payments" component={PaymentFlow} />
      <Route path="/stripe" component={StripeCheckout} />
      <Route path="/donate" component={DonationDisabled} />
      <Route path="/donate-confirmation" component={DonationDisabled} />
      <ProtectedRoute path="/subscribe" component={PricingArchived} />
      <Route path="/logout" component={Logout} />

      {/* Auth Pages */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/confirm-email" component={ConfirmEmail} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/forgot-password/confirmation" component={ForgotPasswordConfirmation} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Base Pages */}
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/pricing" component={PricingArchived} />
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
  return (
    <QueryClientProvider client={queryClient}>
      <ConsentProvider>
        <AuthProvider>
          <LabsProvider>
            <TeamsProvider>
              <Navbar />
              <ScrollToTop />
              <div className="pt-16">
                <PageTransition>
                  <Router />
                </PageTransition>
              </div>
              <Footer />
              <ConsentBanner />
              <Toaster />
            </TeamsProvider>
          </LabsProvider>
        </AuthProvider>
      </ConsentProvider>
    </QueryClientProvider>
  );
}

export default App;
