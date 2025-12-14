import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";

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
import PortalContainer from "./pages/portal/PortalContainer";
import PortalHistory from "./pages/portal/PortalHistory";

const queryClient = new QueryClient();

// ProtectedRoute เดิม (เช็คแค่ว่า Login หรือยัง)
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
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* 🔴 ADMIN ROUTES (ต้อง Login + เป็น Admin เท่านั้น) */}
          <Route path="/" element={<ProtectedRoute><AdminRoute><Index /></AdminRoute></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><AdminRoute><Dashboard /></AdminRoute></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><AdminRoute><Products /></AdminRoute></ProtectedRoute>} />
          <Route path="/serials" element={<ProtectedRoute><AdminRoute><Serials /></AdminRoute></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><AdminRoute><Transactions /></AdminRoute></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute><AdminRoute><Employees /></AdminRoute></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><AdminRoute><Settings /></AdminRoute></ProtectedRoute>} />
          
          {/* 🟢 USER PORTAL ROUTES (ต้อง Login แต่ใครเข้าก็ได้) */}
          <Route path="/portal" element={<ProtectedRoute><PortalContainer /></ProtectedRoute>} />
          <Route path="/portal/history" element={<ProtectedRoute><PortalHistory /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;