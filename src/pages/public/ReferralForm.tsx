import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Upload, QrCode, CheckCircle, AlertCircle, Ticket, Plus, Minus, Copy, Check } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import paymentQR from '@/assets/payment-qr.png';
import phase3Logo from '@/assets/phase3-logo.png';
import concertBanner from '@/assets/concert-banner.png';

const UPI_ID = '9000125959-2@ybl';

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
  const [upiCopied, setUpiCopied] = useState(false);
  
  const [form, setForm] = useState({ buyer_name: '', buyer_mobile: '', utr_last4: '' });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const totalAmount = tiers.reduce((sum, tier) => sum + (quantities[tier.id] || 0) * tier.price, 0);
  const totalTickets = Object.values(quantities).reduce((a, b) => a + b, 0);

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setUpiCopied(true);
      toast({ title: 'UPI ID copied!' });
      setTimeout(() => setUpiCopied(false), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to copy' });
    }
  };

  const incrementQty = (tierId: string, maxQty: number) => {
    const current = quantities[tierId] || 0;
    if (current < maxQty) {
      setQuantities({ ...quantities, [tierId]: current + 1 });
    }
  };

  const decrementQty = (tierId: string) => {
    const current = quantities[tierId] || 0;
    if (current > 0) {
      setQuantities({ ...quantities, [tierId]: current - 1 });
    }
  };

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
        err.issues.forEach((issue) => { if (issue.path[0]) newErrors[issue.path[0].toString()] = issue.message; });
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
      <div className="min-h-screen bg-gradient-to-b from-red-900/20 to-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-900/20 to-background flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-gradient-to-b from-red-900/20 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <img src={phase3Logo} alt="Phase 3" className="h-16 mx-auto mb-4" />
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
    <div className="min-h-screen bg-gradient-to-b from-red-900/20 to-background">
      {/* Header with Logo */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-3 flex items-center justify-center gap-3">
          <img src={phase3Logo} alt="Phase 3 Entertainments" className="h-10 w-auto" />
          <div className="text-left">
            <h1 className="text-lg font-bold leading-tight">Ram Miriyala Live</h1>
            <p className="text-xs text-muted-foreground">
              Referred by <span className="font-medium text-foreground">{studentName}</span>
            </p>
          </div>
        </div>
      </header>

      {/* Concert Banner */}
      <div className="relative">
        <img 
          src={concertBanner} 
          alt="Ram Miriyala Live in Concert" 
          className="w-full h-48 sm:h-64 object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      <main className="container max-w-lg py-6 -mt-8 relative z-10">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Your Details */}
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Your Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Your Name *</Label>
                <Input 
                  value={form.buyer_name} 
                  onChange={e => setForm({...form, buyer_name: e.target.value})} 
                  placeholder="Enter your full name"
                  className="mt-1"
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
                  className="mt-1"
                />
                {errors.buyer_mobile && <p className="text-sm text-destructive mt-1">{errors.buyer_mobile}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Select Tickets - Swiggy Style */}
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                Select Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tiers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No tickets available</p>
              ) : (
                <div className="space-y-3">
                  {tiers.map(tier => {
                    const qty = quantities[tier.id] || 0;
                    return (
                      <div 
                        key={tier.id} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{tier.name}</p>
                          <p className="text-lg font-bold text-primary">₹{tier.price.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{tier.remaining_qty} left</p>
                        </div>
                        
                        {/* +/- Controls */}
                        <div className="flex items-center gap-1">
                          {qty > 0 ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                                onClick={() => decrementQty(tier.id)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center font-bold text-lg">{qty}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                                onClick={() => incrementQty(tier.id, tier.remaining_qty)}
                                disabled={qty >= tier.remaining_qty}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold px-4"
                              onClick={() => incrementQty(tier.id, tier.remaining_qty)}
                            >
                              ADD
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {errors.tickets && <p className="text-sm text-destructive">{errors.tickets}</p>}
              
              {/* Total - Only show when tickets selected */}
              {totalTickets > 0 && (
                <div className="pt-3 border-t flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{totalTickets} ticket{totalTickets > 1 ? 's' : ''} selected</p>
                  </div>
                  <p className="text-xl font-bold text-primary">₹{totalAmount.toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Section */}
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Payment</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <QrCode className="h-4 w-4" />
                      Scan QR
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-center">Scan to Pay</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center p-4">
                      <img src={paymentQR} alt="Payment QR Code" className="w-64 h-auto rounded-lg border" />
                      <p className="mt-4 text-lg font-semibold">DURGA PRASAD P</p>
                      <p className="text-sm text-muted-foreground mt-1">Scan using PhonePe / GPay / Paytm</p>
                      {totalAmount > 0 && (
                        <p className="mt-3 text-2xl font-bold text-primary">Pay ₹{totalAmount.toLocaleString()}</p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* UPI ID Copy Section */}
              <div className="bg-primary/10 rounded-lg p-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Or pay directly to UPI ID:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background rounded px-3 py-2 font-mono text-sm border">
                    {UPI_ID}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyUpiId}
                    className="shrink-0 gap-2"
                  >
                    {upiCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    {upiCopied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>

              {/* Payment Instructions */}
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium mb-2">How to pay:</p>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                  <li>Scan QR or copy UPI ID above</li>
                  {totalAmount > 0 && <li>Pay <span className="font-semibold text-foreground">₹{totalAmount.toLocaleString()}</span></li>}
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
                  className="mt-1"
                />
                {errors.utr_last4 && <p className="text-sm text-destructive mt-1">{errors.utr_last4}</p>}
              </div>

              <div>
                <Label>Payment Screenshot *</Label>
                <div className="mt-2">
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
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

          <Button 
            type="submit" 
            className="w-full h-12 text-lg font-semibold" 
            disabled={submitting || tiers.length === 0 || totalTickets === 0}
          >
            {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {totalTickets > 0 ? `Pay ₹${totalAmount.toLocaleString()} & Submit` : 'Select Tickets to Continue'}
          </Button>

          <p className="text-xs text-center text-muted-foreground pb-4">
            By submitting, you confirm that you have made the payment.
          </p>
        </form>
      </main>
    </div>
  );
}
