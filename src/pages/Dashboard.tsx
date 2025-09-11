import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, FileText, ExternalLink, CheckCircle } from 'lucide-react';

const Dashboard = () => {
  const { user, signOut } = useAuth();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const agreements = [
    {
      name: "KYC/AML Policy",
      description: "Complete your Know Your Customer and Anti-Money Laundering verification",
      url: "https://www.cognitoforms.com/IMECapitalTokenizationLP/KYCAMLPolicyAgreement",
      order: 1,
      required: true
    },
    {
      name: "Property Pledge Agreement", 
      description: "Legal agreement to pledge your property as backing for the tokenization process",
      url: "", // You'll add this when you create the form
      order: 2,
      required: true
    },
    {
      name: "Token Issuance Agreement",
      description: "Defines the terms and conditions for creating and issuing your property tokens", 
      url: "", // You'll add this when you create the form
      order: 3,
      required: true
    },
    {
      name: "Subscription Agreement",
      description: "Investment agreement covering purchase terms, eligibility, and risk disclosures",
      url: "", // You'll add this when you create the form
      order: 4,
      required: true
    },
    {
      name: "Operating Agreement (SPV/LLC)",
      description: "Operating agreement for the legal entity that will hold and manage the tokenized property",
      url: "", // You'll add this when you create the form
      order: 5,
      required: true
    },
    {
      name: "Token Holder Agreement", 
      description: "Defines your ongoing rights and responsibilities as a token holder",
      url: "", // You'll add this when you create the form
      order: 6,
      required: true
    },
    {
      name: "Custody & Tokenization Policy",
      description: "Explains how Fireblocks securely handles custody, minting, and transfer of your tokens",
      url: "", // You'll add this when you create the form
      order: 7,
      required: true
    },
    {
      name: "Swap/Settlement Agreement",
      description: "Terms and conditions for peer-to-peer token swaps and settlements", 
      url: "", // You'll add this when you create the form
      order: 8,
      required: true
    }
  ];

  const handleAgreementClick = (agreement: any) => {
    if (!agreement.url) {
      alert("This form is not yet available. Please check back soon.");
      return;
    }
    
    // Open form in new tab
    window.open(agreement.url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Tokenization Portal</h1>
            <p className="text-muted-foreground">Welcome, {user.email}</p>
          </div>
          <Button variant="outline" onClick={signOut} className="flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Instructions */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-1" />
              <div>
                <p className="font-medium text-blue-800">Complete Your Tokenization Agreements</p>
                <p className="text-sm text-blue-700 mt-1">
                  Click on each agreement below to open the form in a new tab. Complete them in order for the smoothest process.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agreements Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agreements.map((agreement) => (
            <Card
              key={agreement.order}
              className="transition-all hover:shadow-md cursor-pointer hover:border-primary/50"
              onClick={() => handleAgreementClick(agreement)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-sm bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center">
                        {agreement.order}
                      </span>
                      {agreement.name}
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                  </div>
                  {agreement.url ? (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Available</span>
                  ) : (
                    <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Coming Soon</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {agreement.description}
                </p>
                {!agreement.url && (
                  <p className="text-xs text-orange-600 mt-2">
                    Form will be available soon
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground">
              <p className="mb-2">
                <strong>Questions?</strong> Contact your account manager for assistance with any agreements.
              </p>
              <p>
                All forms are secure and your information is protected by industry-standard encryption.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;