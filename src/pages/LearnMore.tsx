import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, FileCheck, Lock, Users, ArrowRight, CheckCircle, Building, Coins, Globe, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const LearnMore = () => {
  const benefits = [
    {
      icon: Building,
      title: "Real Estate Tokenization",
      description: "Transform physical real estate assets into digital tokens, enabling fractional ownership and increased liquidity in property investments."
    },
    {
      icon: Coins,
      title: "Fractional Ownership",
      description: "Own a piece of premium real estate with smaller investment amounts, making high-value properties accessible to more investors."
    },
    {
      icon: Globe,
      title: "Global Access",
      description: "Invest in real estate markets worldwide without geographical restrictions or traditional barriers to entry."
    },
    {
      icon: TrendingUp,
      title: "Enhanced Liquidity",
      description: "Trade your real estate tokens on secondary markets, providing flexibility and liquidity traditionally unavailable in real estate."
    }
  ];

  const processSteps = [
    {
      step: "1",
      title: "Registration & KYC",
      description: "Complete your account registration and KYC/AML verification to ensure compliance and security."
    },
    {
      step: "2", 
      title: "Document Review",
      description: "Review and understand all required legal agreements including property pledges and token issuance terms."
    },
    {
      step: "3",
      title: "Agreement Execution",
      description: "Digitally sign all required agreements through our secure platform with full audit trails."
    },
    {
      step: "4",
      title: "Token Allocation",
      description: "Receive your token allocation representing your fractional ownership in the tokenized real estate asset."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Tokenization Portal</span>
            </Link>
            <Button asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">
              Understanding <span className="text-primary">Real Estate Tokenization</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Learn how our platform revolutionizes real estate investment through blockchain technology, 
              making property ownership more accessible, liquid, and secure than ever before.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-background/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Benefits of Real Estate Tokenization
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover how tokenization transforms traditional real estate investment
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <benefit.icon className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{benefit.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {benefit.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Process Steps */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              How Our Platform Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A simple, secure, and compliant process to get you started with tokenized real estate
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {processSteps.map((step, index) => (
              <Card key={index} className="text-center relative">
                <CardHeader>
                  <div className="mx-auto mb-4 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                    {step.step}
                  </div>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {step.description}
                  </CardDescription>
                </CardContent>
                {index < processSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 -right-4 w-8 h-px bg-primary/30"></div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Security & Compliance */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl lg:text-4xl font-bold">
                Security & Compliance First
              </h2>
              <p className="text-lg text-muted-foreground">
                Our platform is built with institutional-grade security and full regulatory 
                compliance to protect your investments and ensure legal compliance.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <span className="text-lg">SOC 2 Type II Certified</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <span className="text-lg">End-to-end encryption</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <span className="text-lg">Regulatory compliance monitoring</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <span className="text-lg">Multi-signature security</span>
                </div>
              </div>
            </div>

            <Card className="p-8">
              <div className="space-y-6">
                <div className="text-center">
                  <Lock className="h-16 w-16 text-primary mx-auto mb-4" />
                  <h3 className="text-2xl font-bold">Enterprise Security</h3>
                </div>
                <p className="text-muted-foreground text-center">
                  Your investments and personal data are protected by the same security 
                  standards used by major financial institutions.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl lg:text-4xl font-bold">
              Ready to Start Your Journey?
            </h2>
            <p className="text-lg text-muted-foreground">
              Join thousands of investors who are already benefiting from tokenized real estate
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link to="/auth">
                  Get Started Today
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
                <Link to="/">
                  Back to Home
                </Link>
              </Button>
            </div>
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

export default LearnMore;