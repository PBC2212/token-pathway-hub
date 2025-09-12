import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const OperatingAgreement = () => {
  const navigate = useNavigate();

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
            <CardTitle className="text-2xl">Operating Agreement (SPV/LLC)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This page will contain the Operating Agreement (SPV/LLC) form. Content will be added soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OperatingAgreement;