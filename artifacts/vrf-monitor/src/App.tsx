import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";

import Dashboard from "@/pages/dashboard";
import SystemsList from "@/pages/systems/index";
import NewSystem from "@/pages/systems/new";
import EditSystem from "@/pages/systems/edit";
import SystemDetail from "@/pages/systems/detail";
import NewSession from "@/pages/systems/new-session";
import ReadingSession from "@/pages/systems/session";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/systems" component={SystemsList} />
        <Route path="/systems/new" component={NewSystem} />
        <Route path="/systems/:systemId/edit" component={EditSystem} />
        <Route path="/systems/:systemId" component={SystemDetail} />
        <Route path="/systems/:systemId/sessions/new" component={NewSession} />
        <Route path="/systems/:systemId/sessions/:sessionId" component={ReadingSession} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
