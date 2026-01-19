import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import StudentDashboard from "./pages/student/Dashboard";
import NewSale from "./pages/student/NewSale";
import MyReferralLink from "./pages/student/MyReferralLink";
import AdminDashboard from "./pages/admin/Dashboard";
import CreateStudent from "./pages/admin/CreateStudent";
import StudentDetail from "./pages/admin/StudentDetail";
import ReferralForm from "./pages/public/ReferralForm";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            
            {/* Public Referral Route - No auth required */}
            <Route path="/ref/:studentCode" element={<ReferralForm />} />
            
            {/* Student Routes */}
            <Route path="/student" element={
              <ProtectedRoute requiredRole="student">
                <StudentDashboard />
              </ProtectedRoute>
            } />
            <Route path="/student/new-sale" element={
              <ProtectedRoute requiredRole="student">
                <NewSale />
              </ProtectedRoute>
            } />
            <Route path="/student/my-link" element={
              <ProtectedRoute requiredRole="student">
                <MyReferralLink />
              </ProtectedRoute>
            } />
            
            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/create-student" element={
              <ProtectedRoute requiredRole="admin">
                <CreateStudent />
              </ProtectedRoute>
            } />
            <Route path="/admin/student/:studentId" element={
              <ProtectedRoute requiredRole="admin">
                <StudentDetail />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
