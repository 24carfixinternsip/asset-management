import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Register from "./pages/Register"; // หน้า Register
// Components
import { AdminRoute } from "@/components/AdminRoute"; // Import ใหม่

// Pages
import Index from "./pages/Index";
import Products from "./pages/Products";
import Serials from "./pages/Serials";
import Transactions from "./pages/Transactions";
import Employees from "./pages/Employees";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import PortalContainer from "./pages/portal/PortalContainer";
import PortalHistory from "./pages/portal/PortalHistory";
import PortalCatalog from "./pages/portal/PortalCatalog";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster position="bottom-right" richColors />

      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<ProtectedRoute><AdminRoute><Index /></AdminRoute></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedRoute><AdminRoute><Dashboard /></AdminRoute></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><AdminRoute><Products /></AdminRoute></ProtectedRoute>} />
          <Route path="/serials" element={<ProtectedRoute><AdminRoute><Serials /></AdminRoute></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><AdminRoute><Transactions /></AdminRoute></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute><AdminRoute><Employees /></AdminRoute></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><AdminRoute><Settings /></AdminRoute></ProtectedRoute>} />
          
          <Route path="/portal" element={<ProtectedRoute><PortalContainer /></ProtectedRoute>}>
            <Route index element={<PortalCatalog />} /> {/* หน้าแรก: แสดงรายการสินค้า */}
            <Route path="history" element={<PortalHistory />} /> {/* หน้าประวัติ */}
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;