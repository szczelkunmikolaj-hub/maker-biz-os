import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import { Layout } from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import KanbanBoard from "@/pages/KanbanBoard";
import Expenses from "@/pages/Expenses";
import QuoteGenerator from "@/pages/QuoteGenerator";
import SettingsPage from "@/pages/SettingsPage";
import TemplatesPage from "@/pages/TemplatesPage";
import ImportQueue from "@/pages/ImportQueue";
import CalendarPage from "@/pages/CalendarPage";
import FilamentPurchases from "@/pages/FilamentPurchases";
import DataManagement from "@/pages/DataManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/kanban" element={<KanbanBoard />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/filament" element={<FilamentPurchases />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/quote" element={<QuoteGenerator />} />
              <Route path="/import" element={<ImportQueue />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
