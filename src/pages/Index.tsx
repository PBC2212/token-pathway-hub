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
      title: "Secure Digital Agreements",
      description: "Industry-standard security and compliance for all your tokenization documents"
    },
    {
      icon: FileCheck,
      title: "Streamlined KYC/AML",
      description: "Complete your verification process quickly and securely with our integrated forms"
    },
    {
      icon: Lock,
      title: "Regulatory Compliance",
      description: "All agreements meet current regulatory requirements for asset tokenization"
    },
    {
      icon: Users,
      title: "Multi-Party Coordination",
      description: "Coordinate between investors, property owners, and service providers seamlessly"
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
              Tokenization <span className="text-primary">Agreements Portal</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Secure, compliant, and streamlined digital agreements for real estate tokenization. 
              Complete your onboarding with confidence through our integrated platform.
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
              Why Choose Our Platform?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built specifically for real estate tokenization with security, compliance, and user experience in mind
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
                Streamlined Tokenization Process
              </h2>
              <p className="text-lg text-muted-foreground">
                Our platform guides you through each step of the tokenization process, 
                ensuring all legal requirements are met while maintaining the highest 
                standards of security and compliance.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <span className="text-lg">Complete KYC/AML verification</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <span className="text-lg">Sign all required agreements</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <span className="text-lg">Receive token allocation</span>
                </div>
              </div>
            </div>

            <Card className="p-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-6 w-6" />
                  Required Agreements
                </CardTitle>
                <CardDescription>
                  Complete these documents to finalize your tokenization onboarding
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
              Ready to Get Started?
            </h2>
            <p className="text-lg text-muted-foreground">
              Join our secure platform and complete your tokenization agreements today
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
            <span className="text-xl font-bold">Tokenization Portal</span>
          </div>
          <p className="text-muted-foreground">
            Secure digital agreements for real estate tokenization
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
