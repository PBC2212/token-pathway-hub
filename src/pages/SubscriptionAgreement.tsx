import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const SubscriptionAgreement = () => {
  const navigate = useNavigate();

  // Load Cognito Forms iframe script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://www.cognitoforms.com/f/iframe.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup script on component unmount
      if (document.body.contains(script)) {
        document.body.removeChild(script);
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
            <CardTitle className="text-2xl">Subscription Agreement</CardTitle>
            <p className="text-muted-foreground">
              Please complete the form below to execute your token subscription agreement.
            </p>
          </CardHeader>
          <CardContent>
            {/* Cognito Forms Embedded Form */}
            <div className="w-full">
              <iframe 
                src="https://www.cognitoforms.com/f/Z3KEFA9eyUCar-acXrCyqg/10" 
                allow="payment" 
                style={{
                  border: 0,
                  width: '100%',
                  minHeight: '2199px'
                }}
                height="2199"
                title="Subscription Agreement Form"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SubscriptionAgreement;