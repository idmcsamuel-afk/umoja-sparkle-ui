import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/umoja/ProtectedRoute";
import { AdminRoute } from "@/components/umoja/AdminRoute";
import Landing from "./pages/Landing.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import Circle from "./pages/Circle.tsx";
import SparkTrade from "./pages/SparkTrade.tsx";
import Drive from "./pages/Drive.tsx";
import Predictor from "./pages/Predictor.tsx";
import Profile from "./pages/Profile.tsx";
import NotFound from "./pages/NotFound.tsx";
import AdminLayout from "./components/umoja/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMembers from "./pages/admin/AdminMembers";
import AdminCircles from "./pages/admin/AdminCircles";
import AdminSparkTrade from "./pages/admin/AdminSparkTrade";
import AdminDrive from "./pages/admin/AdminDrive";
import AdminPredictor from "./pages/admin/AdminPredictor";
import AdminPayouts from "./pages/admin/AdminPayouts";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/circle" element={<ProtectedRoute><Circle /></ProtectedRoute>} />
              <Route path="/spark" element={<ProtectedRoute><SparkTrade /></ProtectedRoute>} />
              <Route path="/drive" element={<ProtectedRoute><Drive /></ProtectedRoute>} />
              <Route path="/predictor" element={<ProtectedRoute><Predictor /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

              <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="members" element={<AdminMembers />} />
                <Route path="circles" element={<AdminCircles />} />
                <Route path="spark-trade" element={<AdminSparkTrade />} />
                <Route path="drive" element={<AdminDrive />} />
                <Route path="predictor" element={<AdminPredictor />} />
                <Route path="payouts" element={<AdminPayouts />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
