import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Upload, QrCode, CheckCircle, AlertCircle, Ticket, Plus, Minus, Copy, Check, Flame, TrendingUp, Clock, Instagram, Play } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import paymentQR from '@/assets/payment-qr.png';
import phase3Logo from '@/assets/phase3-logo.png';
import concertBanner from '@/assets/concert-banner.png';

const UPI_ID = '9000125959-2@ybl';
const INSTAGRAM_REEL_URL = 'https://www.instagram.com/itsmytirupati/reel/DTozKJvkvIk/';

// Concert date - February 7, 2026
const CONCERT_DATE = new Date('2026-02-07T18:00:00');

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

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const schema = z.object({
  buyer_name: z.string().min(1, 'Your name is required'),
  buyer_mobile: z.string().regex(/^\d{10}$/, 'Enter valid 10-digit mobile'),
  utr_last4: z.string().regex(/^\d{4}$/, 'Enter last 4 digits of UTR'),
});

// Generate consistent "tickets booked today" count
const getTodayTicketCount = (): number => {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  const daySeed = (dayOfYear * 7) % 20 + 15;
  
  let hourlyIncrease = 0;
  for (let h = 0; h <= hour; h++) {
    if (h >= 10 && h <= 22) {
      hourlyIncrease += 3 + (h % 4);
    } else if (h >= 7 && h < 10) {
      hourlyIncrease += 1 + (h % 2);
    } else {
      hourlyIncrease += h % 2;
    }
  }
  
  const quarterHour = Math.floor(minute / 15);
  const minuteBonus = quarterHour * (hour >= 10 && hour <= 22 ? 2 : 1);
  
  return daySeed + hourlyIncrease + minuteBonus;
};

// Calculate time left until concert
const getTimeLeft = (): TimeLeft => {
  const now = new Date();
  const difference = CONCERT_DATE.getTime() - now.getTime();
  
  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  
  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
};

export default function ReferralForm() {
  const { studentCode } = useParams<{ studentCode: string }>();
  const { toast } = useToast();
  
  const [studentName, setStudentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);
  const [todayCount, setTodayCount] = useState(getTodayTicketCount());
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeLeft());
  
  const [form, setForm] = useState({ buyer_name: '', buyer_mobile: '', utr_last4: '' });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const totalAmount = tiers.reduce((sum, tier) => sum + (quantities[tier.id] || 0) * tier.price, 0);
  const totalTickets = Object.values(quantities).reduce((a, b) => a + b, 0);

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update ticket counter
  useEffect(() => {
    const interval = setInterval(() => {
      setTodayCount(getTodayTicketCount());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    async function fetchData() {
      if (!studentCode) {
        setError('Invalid referral link');
        setLoading(false);
        return;
      }

      try {
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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please upload a JPG or PNG image' });
      return null;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Maximum file size is 5MB' });
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
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Failed to upload screenshot. Please try again.' });
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

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
      const screenshotUrl = await uploadFile(file);
      if (!screenshotUrl) {
        setSubmitting(false);
        return;
      }

      const ticketsData: TicketItem[] = tiers
        .filter(t => quantities[t.id] > 0)
        .map(t => ({ tier_id: t.id, tier_name: t.name, price: t.price, qty: quantities[t.id] }));

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

      if (invokeError) throw new Error(invokeError.message || 'Failed to submit');
      if (data?.error) throw new Error(data.error);

      setSubmitted(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit. Please try again.';
      toast({ variant: 'destructive', title: 'Submission Failed', description: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-900/30 to-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-900/30 to-background flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-gradient-to-b from-red-900/30 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-xl">
          <CardContent className="pt-8 pb-8">
            <img src={phase3Logo} alt="Phase 3" className="h-14 mx-auto mb-6" />
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-3">Booking Submitted!</h1>
            <p className="text-muted-foreground mb-4">
              Your ticket request has been submitted successfully. {studentName} will verify your payment and confirm.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              You'll receive confirmation soon.
            </p>
            <a 
              href={INSTAGRAM_REEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
            >
              <Instagram className="h-4 w-4" />
              Follow us on Instagram
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-900/30 to-background pb-6">
      {/* Sticky Header */}
      <header className="border-b bg-background/95 backdrop-blur-md sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <img src={phase3Logo} alt="Phase 3" className="h-9 w-9 object-contain rounded" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight truncate">Ram Miriyala Live</h1>
            <p className="text-xs text-muted-foreground truncate">
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
          className="w-full h-44 sm:h-56 object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        
        {/* Live Counter Badge */}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg">
            <Flame className="h-4 w-4 shrink-0 animate-pulse" />
            <span className="text-sm font-semibold">
              🔥 {todayCount} tickets booked today!
            </span>
            <TrendingUp className="h-4 w-4 shrink-0 ml-auto" />
          </div>
        </div>
      </div>

      <main className="px-4 pt-4 max-w-lg mx-auto space-y-4">
        {/* Countdown Timer */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Clock className="h-5 w-5" />
            <span className="font-semibold">Concert Starts In</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
              <div className="text-2xl sm:text-3xl font-bold">{timeLeft.days}</div>
              <div className="text-xs uppercase tracking-wide opacity-90">Days</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
              <div className="text-2xl sm:text-3xl font-bold">{timeLeft.hours.toString().padStart(2, '0')}</div>
              <div className="text-xs uppercase tracking-wide opacity-90">Hours</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
              <div className="text-2xl sm:text-3xl font-bold">{timeLeft.minutes.toString().padStart(2, '0')}</div>
              <div className="text-xs uppercase tracking-wide opacity-90">Mins</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
              <div className="text-2xl sm:text-3xl font-bold">{timeLeft.seconds.toString().padStart(2, '0')}</div>
              <div className="text-xs uppercase tracking-wide opacity-90">Secs</div>
            </div>
          </div>
          <p className="text-center text-xs mt-3 opacity-90">
            📍 MG Indoor Sports Hub, Tirupati • Feb 7, 2026
          </p>
        </div>

        {/* Instagram Video Link */}
        <a 
          href={INSTAGRAM_REEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <div className="bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 p-[2px] rounded-xl">
            <div className="bg-background rounded-xl p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
              <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-full p-2.5 shrink-0">
                <Instagram className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Watch Ram Miriyala's Message</p>
                <p className="text-xs text-muted-foreground truncate">Special announcement for Tirupati concert! 🎤</p>
              </div>
              <div className="bg-primary/10 rounded-full p-2 shrink-0">
                <Play className="h-4 w-4 text-primary fill-primary" />
              </div>
            </div>
          </div>
        </a>

        {/* Urgency Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
            Limited seats! Book now before they're gone
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Your Details */}
          <Card className="shadow-md">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-base">Your Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div>
                <Label className="text-sm">Your Name *</Label>
                <Input 
                  value={form.buyer_name} 
                  onChange={e => setForm({...form, buyer_name: e.target.value})} 
                  placeholder="Enter your full name"
                  className="mt-1.5 h-11 text-base"
                />
                {errors.buyer_name && <p className="text-xs text-destructive mt-1">{errors.buyer_name}</p>}
              </div>
              <div>
                <Label className="text-sm">Mobile Number *</Label>
                <Input 
                  type="tel"
                  inputMode="numeric"
                  value={form.buyer_mobile} 
                  onChange={e => setForm({...form, buyer_mobile: e.target.value.replace(/\D/g, '')})} 
                  maxLength={10} 
                  placeholder="10-digit mobile number"
                  className="mt-1.5 h-11 text-base"
                />
                {errors.buyer_mobile && <p className="text-xs text-destructive mt-1">{errors.buyer_mobile}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Select Tickets */}
          <Card className="shadow-md">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" />
                Select Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {tiers.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No tickets available</p>
              ) : (
                <div className="space-y-3">
                  {tiers.map(tier => {
                    const qty = quantities[tier.id] || 0;
                    return (
                      <div 
                        key={tier.id} 
                        className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                          qty > 0 ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{tier.name}</p>
                          <p className="text-lg font-bold text-primary">₹{tier.price.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Only {tier.remaining_qty} left</p>
                        </div>
                        
                        <div className="flex items-center gap-0.5 ml-2">
                          {qty > 0 ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 rounded-full border-2 border-primary text-primary active:scale-95"
                                onClick={() => decrementQty(tier.id)}
                              >
                                <Minus className="h-5 w-5" />
                              </Button>
                              <span className="w-10 text-center font-bold text-xl">{qty}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 rounded-full border-2 border-primary text-primary active:scale-95"
                                onClick={() => incrementQty(tier.id, tier.remaining_qty)}
                                disabled={qty >= tier.remaining_qty}
                              >
                                <Plus className="h-5 w-5" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-10 px-5 font-bold text-sm active:scale-95"
                              onClick={() => incrementQty(tier.id, tier.remaining_qty)}
                            >
                              ADD +
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {errors.tickets && <p className="text-xs text-destructive mt-2">{errors.tickets}</p>}
              
              {totalTickets > 0 && (
                <div className="mt-4 pt-3 border-t flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{totalTickets} ticket{totalTickets > 1 ? 's' : ''}</p>
                  <p className="text-2xl font-bold text-primary">₹{totalAmount.toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Section */}
          <Card className="shadow-md">
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Payment</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm">
                      <QrCode className="h-4 w-4" />
                      Scan QR
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw] sm:max-w-md rounded-xl">
                    <DialogHeader>
                      <DialogTitle className="text-center text-lg">Scan to Pay</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center p-4">
                      <img src={paymentQR} alt="Payment QR Code" className="w-56 h-auto rounded-lg border" />
                      <p className="mt-3 text-base font-semibold">DURGA PRASAD P</p>
                      <p className="text-xs text-muted-foreground mt-1">PhonePe / GPay / Paytm</p>
                      {totalAmount > 0 && (
                        <p className="mt-3 text-2xl font-bold text-primary">Pay ₹{totalAmount.toLocaleString()}</p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              {/* UPI ID */}
              <div className="bg-primary/10 rounded-xl p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Or copy UPI ID:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background rounded-lg px-3 py-2.5 font-mono text-sm border truncate">
                    {UPI_ID}
                  </code>
                  <Button
                    type="button"
                    variant={upiCopied ? "default" : "outline"}
                    size="sm"
                    onClick={copyUpiId}
                    className="h-10 px-3 shrink-0 active:scale-95"
                  >
                    {upiCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-muted/50 rounded-xl p-3 text-xs">
                <p className="font-semibold mb-1.5">After payment:</p>
                <ol className="list-decimal list-inside text-muted-foreground space-y-0.5">
                  <li>Enter UTR last 4 digits below</li>
                  <li>Upload payment screenshot</li>
                </ol>
              </div>

              <div>
                <Label className="text-sm">UTR Last 4 Digits *</Label>
                <Input 
                  type="tel"
                  inputMode="numeric"
                  value={form.utr_last4} 
                  onChange={e => setForm({...form, utr_last4: e.target.value.replace(/\D/g, '')})} 
                  maxLength={4} 
                  placeholder="e.g. 1234"
                  className="mt-1.5 h-11 text-base font-mono tracking-widest"
                />
                {errors.utr_last4 && <p className="text-xs text-destructive mt-1">{errors.utr_last4}</p>}
              </div>

              <div>
                <Label className="text-sm">Payment Screenshot *</Label>
                <div className="mt-1.5">
                  <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                    file ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50 hover:bg-muted/30'
                  }`}>
                    {file ? (
                      <>
                        <CheckCircle className="h-6 w-6 text-primary mb-1" />
                        <span className="text-xs text-primary font-medium text-center px-4 truncate max-w-full">
                          {file.name}
                        </span>
                        <span className="text-xs text-muted-foreground">Tap to change</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground">Tap to upload screenshot</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="image/jpeg,image/png" 
                      className="hidden" 
                      onChange={e => setFile(e.target.files?.[0] || null)} 
                    />
                  </label>
                </div>
                {errors.file && <p className="text-xs text-destructive mt-1">{errors.file}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="sticky bottom-0 pt-2 pb-4 -mx-4 px-4 bg-gradient-to-t from-background via-background to-transparent">
            <Button 
              type="submit" 
              className="w-full h-14 text-base font-bold rounded-xl shadow-lg active:scale-[0.98]" 
              disabled={submitting || tiers.length === 0 || totalTickets === 0}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : totalTickets > 0 ? (
                `Book Now • ₹${totalAmount.toLocaleString()}`
              ) : (
                'Select Tickets to Continue'
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground px-4 pb-2">
            By booking, you confirm payment has been made
          </p>
        </form>
      </main>
    </div>
  );
}
