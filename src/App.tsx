import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { FlameChat } from "@/components/umoja/FlameChat";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/umoja/ProtectedRoute";
import { RouteTitle } from "@/components/umoja/RouteTitle";
import { AdminRoute } from "@/components/umoja/AdminRoute";
import Landing from "./pages/Landing.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Circle from "./pages/Circle.tsx";
import SparkTrade from "./pages/SparkTrade.tsx";
import Drive from "./pages/Drive.tsx";
import DriveDashboard from "./pages/DriveDashboard.tsx";
import Predictor from "./pages/Predictor.tsx";
import Profile from "./pages/Profile.tsx";
import Banking from "./pages/Banking.tsx";
import Calculator from "./pages/Calculator.tsx";
import Market from "./pages/Market.tsx";
import Exchange from "./pages/Exchange.tsx";
import Property from "./pages/Property.tsx";
import PropertyDetails from "./pages/PropertyDetails.tsx";
import ModularCatalog from "./pages/ModularCatalog.tsx";
import PropertyHowItWorks from "./pages/PropertyHowItWorks.tsx";
import AdminProperties from "./pages/admin/AdminProperties.tsx";
import AdminBankAccounts from "./pages/admin/AdminBankAccounts.tsx";
import FlameMarketing from "./pages/FlameMarketing.tsx";
import SparkPit from "./pages/SparkPit.tsx";
import DreamDraw from "./pages/DreamDraw.tsx";
import SparkFlip from "./pages/SparkFlip.tsx";
import Kyc from "./pages/Kyc.tsx";
import Waitlist from "./pages/Waitlist.tsx";
import Referrals from "./pages/Referrals.tsx";
import Priority from "./pages/Priority.tsx";
import NotFound from "./pages/NotFound.tsx";
import Blog from "./pages/Blog.tsx";
import SparkTradeBeta from "./pages/SparkTradeBeta.tsx";
import BuySparks from "./pages/BuySparks.tsx";
import Withdraw from "./pages/Withdraw.tsx";
import Terms from "./pages/Terms.tsx";
import Privacy from "./pages/Privacy.tsx";
import BlogPost from "./pages/BlogPost.tsx";
import AdminBlog from "./pages/admin/AdminBlog.tsx";
import Community from "./pages/Community.tsx";
import Trending from "./pages/Trending.tsx";
import AdminCommunity from "./pages/admin/AdminCommunity.tsx";
import AdminTrending from "./pages/admin/AdminTrending.tsx";
import AdminPurchaseEnforcement from "./pages/admin/AdminPurchaseEnforcement.tsx";
import AdminAutomations from "./pages/admin/AdminAutomations.tsx";
import AdminPodcasts from "./pages/admin/AdminPodcasts.tsx";
import AdminCircleTracker from "./pages/admin/AdminCircleTracker.tsx";
import AdminCountries from "./pages/admin/AdminCountries.tsx";
import AdminLayout from "./components/umoja/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMembers from "./pages/admin/AdminMembers";
import AdminCircles from "./pages/admin/AdminCircles";
import AdminSparkTrade from "./pages/admin/AdminSparkTrade";
import AdminDrive from "./pages/admin/AdminDrive";
import AdminPredictor from "./pages/admin/AdminPredictor";
import AdminKycReview from "./pages/admin/AdminKycReview";
import AdminPayouts from "./pages/admin/AdminPayouts";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminInvites from "./pages/admin/AdminInvites";
import AdminReferrals from "./pages/admin/AdminReferrals";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminAllocations from "./pages/admin/AdminAllocations";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminBuyersClub from "./pages/admin/AdminBuyersClub";
import StorefrontEdit from "./pages/StorefrontEdit";
import StorefrontPublic from "./pages/StorefrontPublic";
import FulfillmentDashboard from "./pages/FulfillmentDashboard";
import AdminFulfillment from "./pages/admin/AdminFulfillment";
import MemberLayout from "./components/umoja/MemberLayout";
import AdminContentDirector from "./pages/admin/AdminContentDirector.tsx";
import AdminUgcSubmissions from "./pages/admin/AdminUgcSubmissions.tsx";
import AdminFraudDashboard from "./pages/admin/AdminFraudDashboard.tsx";
import AdminRevenueDashboard from "./pages/admin/AdminRevenueDashboard.tsx";
import AdminSupplierDashboard from "./pages/admin/AdminSupplierDashboard.tsx";
import MemberVideos from "./pages/MemberVideos.tsx";
import UploadVideo from "./pages/UploadVideo.tsx";

import BrowseVideos from "./pages/BrowseVideos.tsx";
import CreatorStudio from "./pages/CreatorStudio.tsx";
import CreatorVideos from "./pages/CreatorVideos.tsx";
import CreatorSchedule from "./pages/CreatorSchedule.tsx";
import CreatorAnalytics from "./pages/CreatorAnalytics.tsx";
import CreatorSubscription from "./pages/CreatorSubscription.tsx";
import Learn from "./pages/Learn.tsx";
import SparkTradeMembership from "./pages/SparkTradeMembership.tsx";
import SparkTradeOnboarding from "./pages/SparkTradeOnboarding.tsx";
import SparkTradeIncomeGoal from "./pages/SparkTradeIncomeGoal.tsx";
import SparkTradeBusinessPreference from "./pages/SparkTradeBusinessPreference.tsx";
import SparkTradeAIBlueprint from "./pages/SparkTradeAIBlueprint.tsx";
import SparkTradeStoreCreation from "./pages/SparkTradeStoreCreation.tsx";
import SparkTradeSubscriptionRecommendation from "./pages/SparkTradeSubscriptionRecommendation.tsx";
import SparkTradeOnboardingSummary from "./pages/SparkTradeOnboardingSummary.tsx";
import SparkTradeMarketplaceRecommendations from "./pages/SparkTradeMarketplaceRecommendations.tsx";
import SparkTradeProductOpportunities from "./pages/SparkTradeProductOpportunities.tsx";
import SparkTradeDemandMeter from "./pages/SparkTradeDemandMeter.tsx";
import SparkTradeDashboard from "./pages/SparkTradeDashboard.tsx";
import SparkTradeAdminDashboard from "./pages/SparkTradeAdminDashboard.tsx";
import SparkTradeGroupBrands from "./pages/SparkTradeGroupBrands.tsx";

const queryClient = new QueryClient();

if (typeof window !== "undefined") {
  window.addEventListener("paystack-popup-open", () => {
    try { queryClient.cancelQueries(); } catch {}
  });
  window.addEventListener("paystack-popup-close", () => {
    try { queryClient.refetchQueries({ type: "active" }); } catch {}
  });
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <RouteTitle />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/waitlist" element={<Waitlist />} />
              <Route path="/spark-trade-beta" element={<SparkTradeBeta />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route element={<MemberLayout />}>
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
                <Route path="/trending" element={<ProtectedRoute><Trending /></ProtectedRoute>} />
                <Route path="/circle" element={<ProtectedRoute><Circle /></ProtectedRoute>} />
                <Route path="/spark" element={<ProtectedRoute><SparkTrade /></ProtectedRoute>} />
                <Route path="/spark-trade/membership" element={<ProtectedRoute><SparkTradeMembership /></ProtectedRoute>} />
                <Route path="/spark-trade/onboarding" element={<ProtectedRoute><SparkTradeOnboarding /></ProtectedRoute>} />
                <Route path="/spark-trade/onboarding/income-goal" element={<ProtectedRoute><SparkTradeIncomeGoal /></ProtectedRoute>} />
                <Route path="/spark-trade/onboarding/group-brands" element={<ProtectedRoute><SparkTradeGroupBrands /></ProtectedRoute>} />
                <Route path="/spark-trade/onboarding/business-preference" element={<ProtectedRoute><SparkTradeBusinessPreference /></ProtectedRoute>} />
                <Route path="/spark-trade/onboarding/ai-blueprint" element={<ProtectedRoute><SparkTradeAIBlueprint /></ProtectedRoute>} />
                <Route path="/spark-trade/onboarding/ai-store-creation" element={<ProtectedRoute><SparkTradeStoreCreation /></ProtectedRoute>} />
                <Route path="/spark-trade/onboarding/subscription-recommendation" element={<ProtectedRoute><SparkTradeSubscriptionRecommendation /></ProtectedRoute>} />
                <Route path="/spark-trade/onboarding/summary" element={<ProtectedRoute><SparkTradeOnboardingSummary /></ProtectedRoute>} />
                <Route path="/spark-trade/onboarding/marketplace-recommendations" element={<ProtectedRoute><SparkTradeMarketplaceRecommendations /></ProtectedRoute>} />
                <Route path="/spark-trade/onboarding/product-opportunities" element={<ProtectedRoute><SparkTradeProductOpportunities /></ProtectedRoute>} />
                <Route path="/spark-trade/demand-meter" element={<ProtectedRoute><SparkTradeDemandMeter /></ProtectedRoute>} />
                <Route path="/spark-trade/dashboard" element={<ProtectedRoute><SparkTradeDashboard /></ProtectedRoute>} />
                <Route path="/spark-trade/admin" element={<ProtectedRoute><SparkTradeAdminDashboard /></ProtectedRoute>} />
                <Route path="/drive" element={<ProtectedRoute><Drive /></ProtectedRoute>} />
                <Route path="/drive/dashboard" element={<ProtectedRoute><DriveDashboard /></ProtectedRoute>} />
                <Route path="/predictor" element={<ProtectedRoute><Predictor /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/profile/banking" element={<ProtectedRoute><Banking /></ProtectedRoute>} />
                <Route path="/payouts" element={<ProtectedRoute><Banking /></ProtectedRoute>} />
                <Route path="/calculator" element={<ProtectedRoute><Calculator /></ProtectedRoute>} />
                <Route path="/market" element={<ProtectedRoute><Market /></ProtectedRoute>} />
                <Route path="/exchange" element={<ProtectedRoute><Exchange /></ProtectedRoute>} />
                <Route path="/property" element={<ProtectedRoute><Property /></ProtectedRoute>} />
                <Route path="/property/modular-catalog" element={<ProtectedRoute><ModularCatalog /></ProtectedRoute>} />
                <Route path="/property/how-it-works" element={<ProtectedRoute><PropertyHowItWorks /></ProtectedRoute>} />
                <Route path="/property/:id" element={<ProtectedRoute><PropertyDetails /></ProtectedRoute>} />
                <Route path="/flame-marketing" element={<ProtectedRoute><FlameMarketing /></ProtectedRoute>} />
                <Route path="/spark-pit" element={<ProtectedRoute><SparkPit /></ProtectedRoute>} />
                <Route path="/spark-pit/dream-draw" element={<ProtectedRoute><DreamDraw /></ProtectedRoute>} />
                <Route path="/spark-pit/spark-flip" element={<ProtectedRoute><SparkFlip /></ProtectedRoute>} />
                <Route path="/buy-sparks" element={<ProtectedRoute><BuySparks /></ProtectedRoute>} />
                <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
                <Route path="/kyc" element={<ProtectedRoute><Kyc /></ProtectedRoute>} />
                <Route path="/learn" element={<ProtectedRoute><Learn /></ProtectedRoute>} />
                <Route path="/podcast" element={<Navigate to="/learn" replace />} />
                <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
                <Route path="/priority" element={<ProtectedRoute><Priority /></ProtectedRoute>} />
                <Route path="/storefront/edit" element={<ProtectedRoute><StorefrontEdit /></ProtectedRoute>} />
                <Route path="/fulfillment/dashboard" element={<ProtectedRoute><FulfillmentDashboard /></ProtectedRoute>} />
                <Route path="/create-video" element={<Navigate to="/upload-video" replace />} />
                <Route path="/upload-video" element={<ProtectedRoute><UploadVideo /></ProtectedRoute>} />
                <Route path="/my-videos" element={<ProtectedRoute><MemberVideos /></ProtectedRoute>} />
                <Route path="/browse-videos" element={<ProtectedRoute><BrowseVideos /></ProtectedRoute>} />
                <Route path="/creator-studio" element={<ProtectedRoute><CreatorStudio /></ProtectedRoute>} />
                <Route path="/creator-studio/videos" element={<ProtectedRoute><CreatorVideos /></ProtectedRoute>} />
                <Route path="/creator-studio/schedule" element={<ProtectedRoute><CreatorSchedule /></ProtectedRoute>} />
                <Route path="/creator-studio/analytics" element={<ProtectedRoute><CreatorAnalytics /></ProtectedRoute>} />
                <Route path="/creator-studio/subscription" element={<ProtectedRoute><CreatorSubscription /></ProtectedRoute>} />
                <Route path="/creator-studio/videos/:id" element={<ProtectedRoute><CreatorStudio /></ProtectedRoute>} />
              </Route>
              <Route path="/shop/:code" element={<StorefrontPublic />} />

              <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="members" element={<AdminMembers />} />
                <Route path="circles" element={<AdminCircles />} />
                <Route path="spark-trade" element={<AdminSparkTrade />} />
                <Route path="drive" element={<AdminDrive />} />
                <Route path="predictor" element={<AdminPredictor />} />
                <Route path="kyc-review" element={<AdminKycReview />} />
                <Route path="payouts" element={<AdminPayouts />} />
                <Route path="withdrawals" element={<AdminWithdrawals />} />
                <Route path="invites" element={<AdminInvites />} />
                <Route path="referrals" element={<AdminReferrals />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="allocations" element={<AdminAllocations />} />
                <Route path="notifications" element={<AdminNotifications />} />
                <Route path="buyers-club" element={<AdminBuyersClub />} />
                <Route path="fulfillment" element={<AdminFulfillment />} />
                <Route path="properties" element={<AdminProperties />} />
                <Route path="bank-accounts" element={<AdminBankAccounts />} />
                <Route path="blog" element={<AdminBlog />} />
                <Route path="community" element={<AdminCommunity />} />
                <Route path="trending" element={<AdminTrending />} />
                <Route path="purchase-enforcement" element={<AdminPurchaseEnforcement />} />
                <Route path="content-director" element={<AdminContentDirector />} />
                <Route path="ugc-submissions" element={<AdminUgcSubmissions />} />
                <Route path="automations" element={<AdminAutomations />} />
                <Route path="podcasts" element={<AdminPodcasts />} />
                <Route path="circle-tracker" element={<AdminCircleTracker />} />
                <Route path="countries" element={<AdminCountries />} />
                <Route path="fraud-dashboard" element={<AdminFraudDashboard />} />
                <Route path="revenue-dashboard" element={<AdminRevenueDashboard />} />
                <Route path="supplier-dashboard" element={<AdminSupplierDashboard />} />
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
