import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import LearnMore from "./pages/LearnMore";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import AMLPolicy from "./pages/AMLPolicy";
import NotFound from "./pages/NotFound";
import PropertyPledgeAgreement from "./pages/PropertyPledgeAgreement";
import TokenIssuanceAgreement from "./pages/TokenIssuanceAgreement";
import SubscriptionAgreement from "./pages/SubscriptionAgreement";
import OperatingAgreement from "./pages/OperatingAgreement";
import TokenHolderAgreement from "./pages/TokenHolderAgreement";
import KYCAMLPolicy from "./pages/KYCAMLPolicy";
import CustodyTokenizationPolicy from "./pages/CustodyTokenizationPolicy";
import SwapSettlementAgreement from "./pages/SwapSettlementAgreement";
import PledgePage from "./pages/PledgePage";
import MintPage from "./pages/MintPage";
import TokenDashboard from "./pages/TokenDashboard";
import LiquidityPage from "./pages/LiquidityPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/learn-more" element={<LearnMore />} />
            <Route path="/pledge" element={<PledgePage />} />
            <Route path="/mint" element={<MintPage />} />
            <Route path="/token-dashboard" element={<TokenDashboard />} />
            <Route path="/liquidity" element={<LiquidityPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/aml-policy" element={<AMLPolicy />} />
            <Route path="/property-pledge-agreement" element={<PropertyPledgeAgreement />} />
            <Route path="/token-issuance-agreement" element={<TokenIssuanceAgreement />} />
            <Route path="/subscription-agreement" element={<SubscriptionAgreement />} />
            <Route path="/operating-agreement" element={<OperatingAgreement />} />
            <Route path="/token-holder-agreement" element={<TokenHolderAgreement />} />
            <Route path="/kyc-aml-policy" element={<KYCAMLPolicy />} />
            <Route path="/custody-tokenization-policy" element={<CustodyTokenizationPolicy />} />
            <Route path="/swap-settlement-agreement" element={<SwapSettlementAgreement />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
