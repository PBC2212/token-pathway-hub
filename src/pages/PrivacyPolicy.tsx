import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Tokenization Portal</span>
            </div>
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              Tokenization Privacy Policy
            </h1>
            <p className="text-lg text-muted-foreground">
              Your privacy and data security are our top priorities in the tokenization process
            </p>
          </div>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Data Collection & Usage</CardTitle>
                <CardDescription>
                  What information we collect and how we use it
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Personal Information</h3>
                  <p className="text-muted-foreground">
                    We collect personal information necessary for KYC/AML compliance, including but not limited to: 
                    full name, date of birth, address, government-issued ID, financial information, and beneficial 
                    ownership details. This information is required by law for asset tokenization activities.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Financial Data</h3>
                  <p className="text-muted-foreground">
                    Investment amounts, source of funds, bank account information, and transaction history 
                    are collected to ensure compliance with securities regulations and anti-money laundering requirements.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Technical Data</h3>
                  <p className="text-muted-foreground">
                    We collect IP addresses, device information, and usage analytics to maintain platform 
                    security and improve user experience.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Data Security & Storage</CardTitle>
                <CardDescription>
                  How we protect and store your sensitive information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Encryption</h3>
                  <p className="text-muted-foreground">
                    All personal and financial data is encrypted both in transit and at rest using 
                    industry-standard AES-256 encryption. Communication channels use TLS 1.3 protocol.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Access Controls</h3>
                  <p className="text-muted-foreground">
                    Access to personal data is restricted to authorized personnel only, with multi-factor 
                    authentication and role-based permissions. All access is logged and monitored.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Data Retention</h3>
                  <p className="text-muted-foreground">
                    Personal data is retained for the minimum period required by law (typically 7-10 years 
                    for financial records) and securely deleted thereafter.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Regulatory Compliance</CardTitle>
                <CardDescription>
                  Our commitment to meeting legal and regulatory requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">KYC/AML Compliance</h3>
                  <p className="text-muted-foreground">
                    We are required by law to verify the identity of all participants in tokenization 
                    activities and monitor for suspicious activities. This includes ongoing monitoring 
                    and reporting to relevant authorities when required.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Securities Regulations</h3>
                  <p className="text-muted-foreground">
                    All tokenization activities comply with applicable securities laws, including 
                    investor accreditation verification and regulatory filing requirements.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">International Standards</h3>
                  <p className="text-muted-foreground">
                    We adhere to international privacy standards including GDPR, CCPA, and other 
                    applicable data protection regulations based on your jurisdiction.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Your Rights</CardTitle>
                <CardDescription>
                  Understanding your privacy rights and how to exercise them
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Data Access & Portability</h3>
                  <p className="text-muted-foreground">
                    You have the right to access your personal data and receive a copy in a 
                    machine-readable format, subject to regulatory constraints.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Correction & Updates</h3>
                  <p className="text-muted-foreground">
                    You can request corrections to inaccurate personal information. Some changes 
                    may require re-verification for compliance purposes.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Limitations</h3>
                  <p className="text-muted-foreground">
                    Due to regulatory requirements, we may be unable to delete certain information 
                    during mandatory retention periods or ongoing legal proceedings.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Contact Information</CardTitle>
                <CardDescription>
                  How to reach us regarding privacy matters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  For privacy-related inquiries, data access requests, or concerns about how 
                  your information is handled, please contact our Data Protection Officer:
                </p>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="font-semibold">Data Protection Officer</p>
                  <p className="text-muted-foreground">Email: privacy@tokenizationportal.com</p>
                  <p className="text-muted-foreground">Response time: 72 hours for urgent matters, 30 days for standard requests</p>
                </div>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground mt-12">
              <p>Last updated: {new Date().toLocaleDateString()}</p>
              <p className="mt-2">
                This privacy policy may be updated periodically to reflect changes in our practices 
                or applicable regulations. Users will be notified of material changes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;