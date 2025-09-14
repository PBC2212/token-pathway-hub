import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Coins, Shield, Info, TrendingUp, Zap, Clock, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MintTokensManager from '@/components/MintTokensManager';

const MintPage = () => {
  const navigate = useNavigate();

  const mintingSteps = [
    {
      icon: CheckCircle,
      title: "Asset Verification",
      description: "Your pledged assets have been verified and approved",
      status: "completed"
    },
    {
      icon: Coins,
      title: "Token Minting",
      description: "Create digital tokens representing your real-world assets",
      status: "current"
    },
    {
      icon: Shield,
      title: "Fireblocks Security",
      description: "Tokens secured in enterprise-grade Fireblocks vault",
      status: "upcoming"
    },
    {
      icon: TrendingUp,
      title: "Market Ready",
      description: "Tokens available for trading and liquidity provision",
      status: "upcoming"
    }
  ];

  const mintingFeatures = [
    {
      icon: Zap,
      title: "Instant Minting",
      description: "Fast token creation process with real-time updates"
    },
    {
      icon: Shield,
      title: "Secure Process",
      description: "Enterprise-grade security with Fireblocks integration"
    },
    {
      icon: Coins,
      title: "ERC-20 Standard",
      description: "Fully compatible tokens for maximum interoperability"
    },
    {
      icon: Clock,
      title: "24/7 Support",
      description: "Round-the-clock technical assistance available"
    }
  ];

  const getStepStatus = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>;
      case 'current':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Current</Badge>;
      case 'upcoming':
        return <Badge variant="outline">Upcoming</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Token Minting</h1>
          </div>
        </div>

        {/* Page Description */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              About Token Minting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Transform your verified real-world assets into digital tokens on the blockchain. 
              Our secure minting process creates ERC-20 tokens that represent fractional ownership 
              of your assets, enabling liquidity and tradability while maintaining full compliance.
            </p>
          </CardContent>
        </Card>

        {/* Minting Process Steps */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Minting Process</CardTitle>
            <CardDescription>
              Follow these steps to successfully mint your asset tokens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {mintingSteps.map((step, index) => (
                <div key={index} className="relative">
                  <div className="flex flex-col items-center text-center p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className={`p-3 rounded-full mb-3 ${
                      step.status === 'completed' ? 'bg-green-100' : 
                      step.status === 'current' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <step.icon className={`h-6 w-6 ${
                        step.status === 'completed' ? 'text-green-600' : 
                        step.status === 'current' ? 'text-blue-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <h3 className="font-semibold mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
                    {getStepStatus(step.status)}
                  </div>
                  {index < mintingSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-2 w-4 h-0.5 bg-border transform -translate-y-1/2"></div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {mintingFeatures.map((feature, index) => (
            <Card key={index} className="text-center hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="mx-auto mb-2 p-3 bg-primary/10 rounded-full w-fit">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Important Notice */}
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Info className="h-5 w-5" />
              Important Notice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-amber-800 space-y-2">
              <p>• Ensure all legal agreements are completed before minting</p>
              <p>• Minted tokens will be secured in your designated Fireblocks vault</p>
              <p>• Token minting is irreversible once confirmed on the blockchain</p>
              <p>• Gas fees may apply depending on network conditions</p>
            </div>
          </CardContent>
        </Card>
        
        {/* Main Minting Interface */}
        <MintTokensManager />

        {/* Additional Resources */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Button variant="outline" className="h-auto p-4 justify-start">
                <div className="text-left">
                  <h3 className="font-medium">Documentation</h3>
                  <p className="text-sm text-muted-foreground">Learn about token minting process</p>
                </div>
              </Button>
              
              <Button variant="outline" className="h-auto p-4 justify-start">
                <div className="text-left">
                  <h3 className="font-medium">Support Center</h3>
                  <p className="text-sm text-muted-foreground">Get help from our team</p>
                </div>
              </Button>
              
              <Button variant="outline" className="h-auto p-4 justify-start">
                <div className="text-left">
                  <h3 className="font-medium">API Reference</h3>
                  <p className="text-sm text-muted-foreground">Technical integration guides</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MintPage;