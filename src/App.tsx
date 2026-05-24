import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { DemoProvider } from "@/context/DemoContext";
import { TierProvider } from "@/context/TierContext";
import { MonthProvider } from "@/context/MonthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import Dashboard from "@/pages/Dashboard";
import CustomerOrdersPage from "@/pages/CustomerOrdersPage";
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
import AuthPage from "@/pages/Auth";
import PricingPage from "@/pages/PricingPage";
import TrustPage from "@/pages/TrustPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <TierProvider>
          <DemoProvider>
          <AppProvider>
            <MonthProvider>
              <NotificationProvider>
                <Toaster />
                <Sonner />
                <Routes>
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/trust" element={<TrustPage />} />
                  <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route path="/customer-orders" element={<AdminRoute><CustomerOrdersPage /></AdminRoute>} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/kanban" element={<KanbanBoard />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/expenses" element={<Expenses />} />
                    <Route path="/filament" element={<FilamentPurchases />} />
                    <Route path="/templates" element={<TemplatesPage />} />
                    <Route path="/quote" element={<QuoteGenerator />} />
                    <Route path="/import" element={<ImportQueue />} />
                    <Route path="/data" element={<DataManagement />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Route>
                  <Route path="/" element={<ProtectedRoute allowLanding><Layout /></ProtectedRoute>}>
                    <Route index element={<Dashboard />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </NotificationProvider>
            </MonthProvider>
          </AppProvider>
          </DemoProvider>
          </TierProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
