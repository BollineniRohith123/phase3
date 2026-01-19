import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Upload, QrCode, CheckCircle, AlertCircle, Ticket } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import paymentQR from '@/assets/payment-qr.png';

interface TicketTier {
  id: string;
  name: string;
  price: number;
  remaining_qty: number;
}

interface TicketItem {
  tier_id: string;
  tier_name: string;
  price: number;
  qty: number;
}

const schema = z.object({
  buyer_name: z.string().min(1, 'Your name is required'),
  buyer_mobile: z.string().regex(/^\d{10}$/, 'Enter valid 10-digit mobile'),
  utr_last4: z.string().regex(/^\d{4}$/, 'Enter last 4 digits of UTR'),
});

export default function ReferralForm() {
  const { studentCode } = useParams<{ studentCode: string }>();
  const { toast } = useToast();
  
  const [studentName, setStudentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [submitted, setSubmitted] = useState(false);
  
  const [form, setForm] = useState({ buyer_name: '', buyer_mobile: '', utr_last4: '' });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const totalAmount = tiers.reduce((sum, tier) => sum + (quantities[tier.id] || 0) * tier.price, 0);
  const totalTickets = Object.values(quantities).reduce((a, b) => a + b, 0);

  // Fetch student info and ticket tiers on mount
  useEffect(() => {
    async function fetchData() {
      if (!studentCode) {
        setError('Invalid referral link');
        setLoading(false);
        return;
      }

      try {
        // Fetch student name (using anon key, RLS will allow this query)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('name, is_active')
          .eq('student_id', studentCode.toUpperCase())
          .eq('role', 'student')
          .single();

        if (profileError || !profile) {
          setError('This referral link is invalid or expired.');
          setLoading(false);
          return;
        }

        if (!profile.is_active) {
          setError('This referral link is no longer active.');
          setLoading(false);
          return;
        }

        setStudentName(profile.name);

        // Fetch ticket tiers
        const { data: tiersData, error: tiersError } = await supabase
          .from('ticket_tiers')
          .select('*')
          .gt('remaining_qty', 0)
          .order('price', { ascending: true });

        if (tiersError) {
          console.error('Failed to fetch tiers:', tiersError);
        }

        setTiers(tiersData || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [studentCode]);

  const uploadFile = async (file: File): Promise<string | null> => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload a JPG or PNG image',
      });
      return null;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Maximum file size is 5MB',
      });
      return null;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `public-sales/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      return fileName;
    } catch (err) {
      console.error('Upload error:', err);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'Failed to upload screenshot. Please try again.',
      });
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form
    try {
      schema.parse(form);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((e) => { if (e.path[0]) newErrors[e.path[0].toString()] = e.message; });
        setErrors(newErrors);
        return;
      }
    }

    if (totalTickets === 0) {
      setErrors({ tickets: 'Select at least one ticket' });
      return;
    }

    if (!file) {
      setErrors({ file: 'Upload payment screenshot' });
      return;
    }

    setSubmitting(true);

    try {
      // Upload screenshot
      const screenshotUrl = await uploadFile(file);
      if (!screenshotUrl) {
        setSubmitting(false);
        return;
      }

      // Prepare tickets data
      const ticketsData: TicketItem[] = tiers
        .filter(t => quantities[t.id] > 0)
        .map(t => ({ tier_id: t.id, tier_name: t.name, price: t.price, qty: quantities[t.id] }));

      // Submit via edge function
      const { data, error: invokeError } = await supabase.functions.invoke('create-public-sale', {
        body: {
          student_code: studentCode?.toUpperCase(),
          buyer_name: form.buyer_name.trim(),
          buyer_mobile: form.buyer_mobile,
          utr_last4: form.utr_last4,
          screenshot_url: screenshotUrl,
          tickets_data: ticketsData,
          amount: totalAmount,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to submit');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSubmitted(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: errorMessage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Invalid Link</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Submission Successful!</h1>
            <p className="text-muted-foreground mb-4">
              Your ticket purchase has been submitted. {studentName} will review and confirm your payment.
            </p>
            <p className="text-sm text-muted-foreground">
              You can close this page now.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container py-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Ticket className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Buy Event Tickets</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Referred by <span className="font-medium text-foreground">{studentName}</span>
          </p>
        </div>
      </header>

      <main className="container max-w-lg py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Your Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Your Name *</Label>
                <Input 
                  value={form.buyer_name} 
                  onChange={e => setForm({...form, buyer_name: e.target.value})} 
                  placeholder="Enter your full name"
                />
                {errors.buyer_name && <p className="text-sm text-destructive mt-1">{errors.buyer_name}</p>}
              </div>
              <div>
                <Label>Mobile Number *</Label>
                <Input 
                  value={form.buyer_mobile} 
                  onChange={e => setForm({...form, buyer_mobile: e.target.value})} 
                  maxLength={10} 
                  placeholder="10-digit number" 
                />
                {errors.buyer_mobile && <p className="text-sm text-destructive mt-1">{errors.buyer_mobile}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Select Tickets</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {tiers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No tickets available</p>
              ) : (
                tiers.map(tier => (
                  <div key={tier.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{tier.name} - ₹{tier.price}</p>
                      <p className="text-xs text-muted-foreground">{tier.remaining_qty} available</p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={tier.remaining_qty}
                      value={quantities[tier.id] || 0}
                      onChange={e => setQuantities({...quantities, [tier.id]: parseInt(e.target.value) || 0})}
                      className="w-20"
                    />
                  </div>
                ))
              )}
              {errors.tickets && <p className="text-sm text-destructive">{errors.tickets}</p>}
              {tiers.length > 0 && (
                <div className="pt-2 border-t text-right">
                  <p className="text-lg font-bold">Total: ₹{totalAmount.toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Payment</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <QrCode className="h-4 w-4 mr-2" />
                      Show QR
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-center">Scan to Pay</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center p-4">
                      <img src={paymentQR} alt="Payment QR Code" className="w-64 h-auto rounded-lg" />
                      <p className="mt-4 text-lg font-semibold">DURGA PRASAD P</p>
                      <p className="text-sm text-muted-foreground mt-1">Scan using PhonePe / GPay / Paytm</p>
                      {totalAmount > 0 && (
                        <p className="mt-3 text-xl font-bold text-primary">Pay ₹{totalAmount.toLocaleString()}</p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium mb-1">How to pay:</p>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                  <li>Click "Show QR" to see payment QR code</li>
                  <li>Pay ₹{totalAmount.toLocaleString()} using any UPI app</li>
                  <li>Enter the last 4 digits of UTR below</li>
                  <li>Upload a screenshot of the payment</li>
                </ol>
              </div>
              <div>
                <Label>UTR Last 4 Digits *</Label>
                <Input 
                  value={form.utr_last4} 
                  onChange={e => setForm({...form, utr_last4: e.target.value})} 
                  maxLength={4} 
                  placeholder="1234" 
                />
                {errors.utr_last4 && <p className="text-sm text-destructive mt-1">{errors.utr_last4}</p>}
              </div>
              <div>
                <Label>Payment Screenshot *</Label>
                <div className="mt-2">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground text-center px-2">
                      {file ? file.name : 'Click to upload (JPG/PNG, max 5MB)'}
                    </span>
                    <input 
                      type="file" 
                      accept="image/jpeg,image/png" 
                      className="hidden" 
                      onChange={e => setFile(e.target.files?.[0] || null)} 
                    />
                  </label>
                </div>
                {errors.file && <p className="text-sm text-destructive mt-1">{errors.file}</p>}
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={submitting || tiers.length === 0}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Purchase
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By submitting, you confirm that you have made the payment.
          </p>
        </form>
      </main>
    </div>
  );
}
