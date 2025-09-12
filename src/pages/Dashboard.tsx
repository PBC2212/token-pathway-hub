import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Shield, FileText, Users, Building, Briefcase } from 'lucide-react';

const Dashboard = () => {
  const { user, signOut } = useAuth();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const features = [
    {
      icon: Shield,
      title: "Secure Platform",
      description: "Your tokenization journey starts here with industry-leading security"
    },
    {
      icon: FileText,
      title: "Digital Agreements",
      description: "Streamlined document management for all your tokenization needs"
    },
    {
      icon: Users,
      title: "Multi-Party Support",
      description: "Coordinate seamlessly between all stakeholders in the process"
    },
    {
      icon: Building,
      title: "Real Estate Focus",
      description: "Purpose-built for real estate tokenization and investment"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Tokenization Portal</h1>
              <p className="text-muted-foreground">Welcome back, {user.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={signOut} className="flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Welcome to Your Dashboard</CardTitle>
            <CardDescription>
              Your secure platform for real estate tokenization agreements and documentation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This is your central hub for managing tokenization agreements, completing KYC verification, 
              and coordinating with all stakeholders in your real estate tokenization journey.
            </p>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card key={index} className="text-center hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                  <feature.icon className="h-6 w-6 text-primary" />
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Next Steps
            </CardTitle>
            <CardDescription>
              Complete these actions to proceed with your tokenization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">Complete KYC Verification</h3>
                  <p className="text-sm text-muted-foreground">Verify your identity to access all features</p>
                </div>
                <Button variant="outline" size="sm">Start KYC</Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">Review Agreements</h3>
                  <p className="text-sm text-muted-foreground">Access and complete required documentation</p>
                </div>
                <Button variant="outline" size="sm">View Docs</Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">Contact Support</h3>
                  <p className="text-sm text-muted-foreground">Get help with your tokenization process</p>
                </div>
                <Button variant="outline" size="sm">Get Help</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;