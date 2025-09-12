import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ArrowLeft, AlertTriangle, Eye, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

const AMLPolicy = () => {
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
              Anti-Money Laundering Policy
            </h1>
            <p className="text-lg text-muted-foreground">
              Our commitment to preventing financial crimes in tokenization activities
            </p>
          </div>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6" />
                  Policy Overview
                </CardTitle>
                <CardDescription>
                  Our comprehensive approach to AML compliance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  This Anti-Money Laundering (AML) Policy establishes our commitment to preventing 
                  the use of our tokenization platform for money laundering, terrorist financing, 
                  and other illicit activities. We maintain a robust compliance program that meets 
                  or exceeds all applicable regulatory requirements.
                </p>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Key Principles</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• Zero tolerance for money laundering and terrorist financing</li>
                    <li>• Comprehensive customer due diligence procedures</li>
                    <li>• Ongoing transaction monitoring and suspicious activity reporting</li>
                    <li>• Regular training and compliance program updates</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Eye className="h-6 w-6" />
                  Customer Due Diligence
                </CardTitle>
                <CardDescription>
                  Verification requirements for all platform users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Identity Verification</h3>
                  <p className="text-muted-foreground mb-3">
                    All users must provide government-issued identification and undergo identity verification:
                  </p>
                  <ul className="space-y-1 text-muted-foreground ml-4">
                    <li>• Full legal name verification</li>
                    <li>• Date of birth confirmation</li>
                    <li>• Current residential address</li>
                    <li>• Government-issued photo ID (passport, driver's license, etc.)</li>
                    <li>• Biometric verification when required</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Enhanced Due Diligence</h3>
                  <p className="text-muted-foreground mb-3">
                    Additional verification is required for high-risk customers:
                  </p>
                  <ul className="space-y-1 text-muted-foreground ml-4">
                    <li>• Politically Exposed Persons (PEPs)</li>
                    <li>• Customers from high-risk jurisdictions</li>
                    <li>• Large transaction amounts ($10,000+)</li>
                    <li>• Corporate entities and beneficial ownership disclosure</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Source of Funds</h3>
                  <p className="text-muted-foreground">
                    All customers must provide documentation demonstrating the legitimate source 
                    of funds for tokenization investments, including bank statements, tax returns, 
                    or other acceptable proof of income.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Transaction Monitoring
                </CardTitle>
                <CardDescription>
                  Continuous monitoring for suspicious activities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Automated Monitoring Systems</h3>
                  <p className="text-muted-foreground">
                    Our platform employs sophisticated monitoring systems that analyze all 
                    transactions in real-time for suspicious patterns, including:
                  </p>
                  <ul className="space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>• Unusual transaction amounts or frequencies</li>
                    <li>• Transactions involving high-risk jurisdictions</li>
                    <li>• Rapid movement of funds between accounts</li>
                    <li>• Transactions inconsistent with customer profile</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Suspicious Activity Reporting</h3>
                  <p className="text-muted-foreground">
                    When suspicious activity is detected, we file Suspicious Activity Reports (SARs) 
                    with FinCEN and other relevant authorities within required timeframes. We maintain 
                    strict confidentiality of all SAR filings as required by law.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Record Keeping</h3>
                  <p className="text-muted-foreground">
                    All transaction records, customer information, and compliance documentation 
                    are maintained for a minimum of 5 years as required by federal regulations.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Prohibited Activities</CardTitle>
                <CardDescription>
                  Activities that are strictly forbidden on our platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                  <h3 className="font-semibold text-destructive mb-2">Zero Tolerance Policy</h3>
                  <p className="text-muted-foreground mb-3">
                    The following activities will result in immediate account suspension and reporting to authorities:
                  </p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Money laundering or structuring transactions to avoid reporting</li>
                    <li>• Terrorist financing or sanctions evasion</li>
                    <li>• Use of stolen or fraudulent funds</li>
                    <li>• Transactions involving illegal activities</li>
                    <li>• Providing false or misleading information during KYC</li>
                    <li>• Attempting to circumvent AML controls</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Sanctions Compliance</CardTitle>
                <CardDescription>
                  Adherence to international sanctions programs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Sanctions Screening</h3>
                  <p className="text-muted-foreground">
                    All customers and transactions are screened against comprehensive sanctions lists including:
                  </p>
                  <ul className="space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>• OFAC Specially Designated Nationals (SDN) List</li>
                    <li>• UN Security Council Consolidated List</li>
                    <li>• EU Consolidated List</li>
                    <li>• HM Treasury Consolidated List</li>
                    <li>• Other relevant international sanctions lists</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Geographic Restrictions</h3>
                  <p className="text-muted-foreground">
                    Our services are not available to residents or entities in certain high-risk 
                    jurisdictions or countries subject to comprehensive sanctions programs.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Reporting & Contact</CardTitle>
                <CardDescription>
                  How to report suspicious activities or contact our compliance team
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Reporting Suspicious Activity</h3>
                  <p className="text-muted-foreground">
                    If you become aware of any suspicious activity, please report it immediately 
                    to our compliance team. All reports are handled confidentially.
                  </p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="font-semibold">AML Compliance Officer</p>
                  <p className="text-muted-foreground">Email: compliance@tokenizationportal.com</p>
                  <p className="text-muted-foreground">Phone: 1-800-COMPLIANCE (24/7 hotline)</p>
                  <p className="text-muted-foreground">Response time: Immediate for urgent matters</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Annual Review</h3>
                  <p className="text-muted-foreground">
                    This AML Policy is reviewed and updated annually or as required by regulatory changes. 
                    All updates are communicated to users through our platform notifications.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground mt-12">
              <p>Last updated: {new Date().toLocaleDateString()}</p>
              <p className="mt-2">
                This AML Policy is subject to applicable laws and regulations. 
                Non-compliance may result in account suspension and legal action.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AMLPolicy;