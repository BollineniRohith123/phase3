import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTicketTiers } from '@/hooks/useTicketTiers';
import { useCreateSale, TicketItem } from '@/hooks/useSales';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import { z } from 'zod';

const schema = z.object({
  buyer_name: z.string().min(1, 'Buyer name is required'),
  buyer_mobile: z.string().regex(/^\d{10}$/, 'Enter valid 10-digit mobile'),
  utr_last4: z.string().regex(/^\d{4}$/, 'Enter last 4 digits of UTR'),
});

export default function NewSale() {
  const navigate = useNavigate();
  const { data: tiers = [] } = useTicketTiers();
  const createSale = useCreateSale();
  const { uploadFile, uploading } = useFileUpload();

  const [form, setForm] = useState({ buyer_name: '', buyer_mobile: '', utr_last4: '' });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalAmount = tiers.reduce((sum, tier) => sum + (quantities[tier.id] || 0) * tier.price, 0);
  const totalTickets = Object.values(quantities).reduce((a, b) => a + b, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

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

    const screenshotUrl = await uploadFile(file);
    if (!screenshotUrl) return;

    const ticketsData: TicketItem[] = tiers
      .filter(t => quantities[t.id] > 0)
      .map(t => ({ tier_id: t.id, tier_name: t.name, price: t.price, qty: quantities[t.id] }));

    await createSale.mutateAsync({
      buyer_name: form.buyer_name,
      buyer_mobile: form.buyer_mobile,
      utr_last4: form.utr_last4,
      amount: totalAmount,
      screenshot_url: screenshotUrl,
      tickets_data: ticketsData,
    });

    navigate('/student');
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container flex items-center gap-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/student')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">New Sale Submission</h1>
        </div>
      </header>

      <main className="container max-w-lg py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Buyer Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Buyer Name *</Label>
                <Input value={form.buyer_name} onChange={e => setForm({...form, buyer_name: e.target.value})} />
                {errors.buyer_name && <p className="text-sm text-destructive mt-1">{errors.buyer_name}</p>}
              </div>
              <div>
                <Label>Buyer Mobile *</Label>
                <Input value={form.buyer_mobile} onChange={e => setForm({...form, buyer_mobile: e.target.value})} maxLength={10} placeholder="10-digit number" />
                {errors.buyer_mobile && <p className="text-sm text-destructive mt-1">{errors.buyer_mobile}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Select Tickets</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {tiers.map(tier => (
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
              ))}
              {errors.tickets && <p className="text-sm text-destructive">{errors.tickets}</p>}
              <div className="pt-2 border-t text-right">
                <p className="text-lg font-bold">Total: ₹{totalAmount.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Payment Proof</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>UTR Last 4 Digits *</Label>
                <Input value={form.utr_last4} onChange={e => setForm({...form, utr_last4: e.target.value})} maxLength={4} placeholder="1234" />
                {errors.utr_last4 && <p className="text-sm text-destructive mt-1">{errors.utr_last4}</p>}
              </div>
              <div>
                <Label>Payment Screenshot *</Label>
                <div className="mt-2">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">{file ? file.name : 'Click to upload (JPG/PNG, max 5MB)'}</span>
                    <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
                {errors.file && <p className="text-sm text-destructive mt-1">{errors.file}</p>}
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={createSale.isPending || uploading}>
            {(createSale.isPending || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Sale
          </Button>
        </form>
      </main>
    </div>
  );
}
