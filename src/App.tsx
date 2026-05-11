import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { FlameChat } from "@/components/umoja/FlameChat";
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
import Calculator from "./pages/Calculator.tsx";
import Market from "./pages/Market.tsx";
import Exchange from "./pages/Exchange.tsx";
import Property from "./pages/Property.tsx";
import FlameMarketing from "./pages/FlameMarketing.tsx";
import SparkPit from "./pages/SparkPit.tsx";
import DreamDraw from "./pages/DreamDraw.tsx";
import SparkFlip from "./pages/SparkFlip.tsx";
import Kyc from "./pages/Kyc.tsx";
import Waitlist from "./pages/Waitlist.tsx";
import NotFound from "./pages/NotFound.tsx";
import AdminLayout from "./components/umoja/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMembers from "./pages/admin/AdminMembers";
import AdminCircles from "./pages/admin/AdminCircles";
import AdminSparkTrade from "./pages/admin/AdminSparkTrade";
import AdminDrive from "./pages/admin/AdminDrive";
import AdminPredictor from "./pages/admin/AdminPredictor";
import AdminKycReview from "./pages/admin/AdminKycReview";
import AdminPayouts from "./pages/admin/AdminPayouts";
import AdminInvites from "./pages/admin/AdminInvites";

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
              <Route path="/waitlist" element={<Waitlist />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/circle" element={<ProtectedRoute><Circle /></ProtectedRoute>} />
              <Route path="/spark" element={<ProtectedRoute><SparkTrade /></ProtectedRoute>} />
              <Route path="/drive" element={<ProtectedRoute><Drive /></ProtectedRoute>} />
              <Route path="/predictor" element={<ProtectedRoute><Predictor /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/calculator" element={<ProtectedRoute><Calculator /></ProtectedRoute>} />
              <Route path="/market" element={<ProtectedRoute><Market /></ProtectedRoute>} />
              <Route path="/exchange" element={<ProtectedRoute><Exchange /></ProtectedRoute>} />
              <Route path="/property" element={<ProtectedRoute><Property /></ProtectedRoute>} />
              <Route path="/flame-marketing" element={<ProtectedRoute><FlameMarketing /></ProtectedRoute>} />
              <Route path="/spark-pit" element={<ProtectedRoute><SparkPit /></ProtectedRoute>} />
              <Route path="/spark-pit/dream-draw" element={<ProtectedRoute><DreamDraw /></ProtectedRoute>} />
              <Route path="/spark-pit/spark-flip" element={<ProtectedRoute><SparkFlip /></ProtectedRoute>} />
              <Route path="/kyc" element={<ProtectedRoute><Kyc /></ProtectedRoute>} />

              <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="members" element={<AdminMembers />} />
                <Route path="circles" element={<AdminCircles />} />
                <Route path="spark-trade" element={<AdminSparkTrade />} />
                <Route path="drive" element={<AdminDrive />} />
                <Route path="predictor" element={<AdminPredictor />} />
                <Route path="kyc-review" element={<AdminKycReview />} />
                <Route path="payouts" element={<AdminPayouts />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
            <FlameChat />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
