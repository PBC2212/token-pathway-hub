import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, FileCheck, Lock, Users, ArrowRight, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const features = [
    {
      icon: Shield,
      title: "End-to-End Tokenization",
      description: "Complete asset digitization from legal structuring to token issuance and distribution"
    },
    {
      icon: FileCheck,
      title: "Automated Compliance",
      description: "Built-in KYC/AML verification and regulatory compliance for seamless onboarding"
    },
    {
      icon: Lock,
      title: "Institutional Grade Security",
      description: "Bank-level security infrastructure protecting your assets and investor data"
    },
    {
      icon: Users,
      title: "Investor Management",
      description: "Comprehensive dashboard for managing investors, distributions, and communications"
    }
  ];

  const agreementTypes = [
    "Property Pledge Agreement",
    "Token Issuance Agreement", 
    "Subscription Agreement",
    "Operating Agreement (SPV/LLC)",
    "Token Holder Agreement",
    "KYC/AML Policy",
    "Custody & Tokenization Policy",
    "Swap/Settlement Agreement"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-20 lg:py-28">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-center mb-6">
              <Shield className="h-16 w-16 text-primary" />
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight">
              Complete <span className="text-primary">RWA Tokenization</span> Platform
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Transform real world assets into digital tokens with our comprehensive platform. 
              From property tokenization to investor onboarding - we handle the entire process.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-10">
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link to="/auth">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
                <Link to="/learn-more">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Complete RWA Tokenization Suite
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to tokenize real world assets - from legal compliance to token distribution and ongoing management
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tokenization Process Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl lg:text-4xl font-bold">
                Asset Tokenization Made Simple
              </h2>
              <p className="text-lg text-muted-foreground">
                Our comprehensive platform handles every aspect of real world asset tokenization, 
                from initial structuring to ongoing token management and investor relations.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <span className="text-lg">Asset valuation and legal structuring</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <span className="text-lg">Automated investor onboarding and KYC</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <span className="text-lg">Token issuance and distribution</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <span className="text-lg">Ongoing asset and investor management</span>
                </div>
              </div>
            </div>

            <Card className="p-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-6 w-6" />
                  Platform Services
                </CardTitle>
                <CardDescription>
                  Comprehensive documentation and agreements for complete tokenization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {agreementTypes.map((agreement, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-sm">{agreement}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl lg:text-4xl font-bold">
              Ready to Tokenize Your Assets?
            </h2>
            <p className="text-lg text-muted-foreground">
              Join the future of asset ownership with our comprehensive tokenization platform
            </p>
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link to="/auth">
                Access Portal
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-primary mr-2" />
            <span className="text-xl font-bold">RWA Tokenization Platform</span>
          </div>
          <p className="text-muted-foreground mb-4">
            Complete real world asset tokenization solutions
          </p>
          <div className="flex justify-center gap-6 text-sm">
            <Link to="/privacy-policy" className="text-muted-foreground hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link to="/aml-policy" className="text-muted-foreground hover:text-primary transition-colors">
              AML Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
