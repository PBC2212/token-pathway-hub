import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const PropertyPledgeAgreement = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Load Cognito Forms iframe script
    const script = document.createElement('script');
    script.src = 'https://www.cognitoforms.com/f/iframe.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector('script[src="https://www.cognitoforms.com/f/iframe.js"]');
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Property Pledge Agreement</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <iframe 
              src="https://www.cognitoforms.com/f/Z3KEFA9eyUCar-acXrCyqg/7" 
              allow="payment" 
              className="border-0 w-full" 
              height="2059"
              title="Property Pledge Agreement Form"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PropertyPledgeAgreement;