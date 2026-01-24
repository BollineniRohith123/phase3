import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Copy, Check, Share2, QrCode, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function MyReferralLink() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const referralLink = `${window.location.origin}/ref/${profile?.partner_id}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({ title: 'Link copied!' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to copy' });
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Buy Event Tickets',
          text: `Hi! Use my referral link to purchase event tickets:`,
          url: referralLink,
        });
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled');
      }
    } else {
      copyToClipboard();
    }
  };

  const shareOnWhatsApp = () => {
    const message = encodeURIComponent(`Hi! Use my referral link to purchase event tickets:\n${referralLink}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container flex items-center gap-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/student')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">My Referral Link</h1>
        </div>
      </header>

      <main className="container max-w-lg py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Your Unique Link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this link with buyers. When they fill the form and submit, you'll see their purchase in your dashboard for approval.
            </p>
            
            <div className="flex gap-2">
              <Input 
                value={referralLink} 
                readOnly 
                className="font-mono text-sm"
              />
              <Button 
                variant="outline" 
                size="icon" 
                onClick={copyToClipboard}
                className="shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="default" 
              className="w-full"
              onClick={shareLink}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share Link
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-700 dark:text-green-400"
              onClick={shareOnWhatsApp}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Share on WhatsApp
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={copyToClipboard}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Share your unique link with potential buyers</li>
              <li>They fill in their details and select tickets</li>
              <li>They pay via UPI and upload payment proof</li>
              <li>You see their submission in your dashboard</li>
              <li>Admin approves and tickets are confirmed</li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
