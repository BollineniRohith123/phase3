import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Copy, Check, Link, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ReferralLinkBanner() {
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

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Link className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Your Referral Link</p>
            <p className="text-xs text-muted-foreground truncate">{referralLink}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={copyToClipboard}
            className="gap-1"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button 
            size="sm" 
            onClick={() => navigate('/student/my-link')}
            className="gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            More
          </Button>
        </div>
      </div>
    </div>
  );
}
