import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateStudent } from '@/hooks/useProfiles';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Copy, Check } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

const schema = z.object({
  partner_id: z.string().min(1, 'Partner ID is required').regex(/^[A-Z0-9]+$/, 'Use uppercase letters and numbers only'),
  name: z.string().min(1, 'Name is required'),
  mobile: z.string().regex(/^\d{10}$/, 'Enter valid 10-digit mobile'),
});

function generatePassword(): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export default function CreateStudent() {
  const navigate = useNavigate();
  const createStudent = useCreateStudent();
  const { toast } = useToast();

  const [form, setForm] = useState({ partner_id: '', name: '', mobile: '' });
  const [passwordMode, setPasswordMode] = useState<'auto' | 'custom'>('auto');
  const [password, setPassword] = useState<string>(generatePassword());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>('');
  const [createdCredentials, setCreatedCredentials] = useState<{ id: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitError('');

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

    const passwordToUse = passwordMode === 'auto' ? password : password.trim();

    if (passwordMode === 'custom' && passwordToUse.length < 6) {
      setErrors({ password: 'Password must be at least 6 characters' });
      return;
    }

    try {
      await createStudent.mutateAsync({
        partner_id: form.partner_id,
        name: form.name,
        mobile: form.mobile,
        password: passwordToUse,
      });

      setCreatedCredentials({ id: form.partner_id, password: passwordToUse });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create student');
      // Mutation already shows a toast; we also render the message inline here.
    }
  };

  const copyCredentials = () => {
    if (createdCredentials) {
      navigator.clipboard.writeText(`Partner ID: ${createdCredentials.id}\nPassword: ${createdCredentials.password}`);
      setCopied(true);
      toast({ title: 'Credentials copied to clipboard!' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateAnother = () => {
    setForm({ partner_id: '', name: '', mobile: '' });
    setPasswordMode('auto');
    setPassword(generatePassword());
    setCreatedCredentials(null);
  };

  if (createdCredentials) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-background">
          <div className="container flex items-center gap-4 py-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Partner Created!</h1>
          </div>
        </header>

        <main className="container max-w-md py-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-primary">Success!</CardTitle>
              <CardDescription>Save these credentials. You can also reset the password later from the Admin panel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg font-mono text-sm space-y-2">
                <div><span className="text-muted-foreground">Partner ID:</span> <strong>{createdCredentials.id}</strong></div>
                <div><span className="text-muted-foreground">Password:</span> <strong>{createdCredentials.password}</strong></div>
              </div>
              
              <Button onClick={copyCredentials} variant="outline" className="w-full">
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy Credentials'}
              </Button>

              <div className="flex gap-2">
                <Button onClick={handleCreateAnother} className="flex-1">Create Another</Button>
                <Button onClick={() => navigate('/admin')} variant="outline" className="flex-1">Back to Dashboard</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container flex items-center gap-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Create New Partner</h1>
        </div>
      </header>

      <main className="container max-w-md py-6">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Partner Details</CardTitle>
              <CardDescription>Create a partner login. The password is set now and shown once.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Partner ID *</Label>
                <Input 
                  value={form.partner_id} 
                  onChange={e => setForm({...form, partner_id: e.target.value.toUpperCase()})} 
                  placeholder="e.g., PTR001"
                />
                {errors.partner_id && <p className="text-sm text-destructive mt-1">{errors.partner_id}</p>}
              </div>
              <div>
                <Label>Full Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter full name"
                />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label>Mobile *</Label>
                <Input
                  value={form.mobile}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setForm({ ...form, mobile: digitsOnly });
                  }}
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                  autoComplete="tel"
                />
                {errors.mobile && <p className="text-sm text-destructive mt-1">{errors.mobile}</p>}
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <Label>Initial Password *</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={passwordMode === 'auto' ? 'default' : 'outline'}
                      onClick={() => {
                        setPasswordMode('auto');
                        setPassword(generatePassword());
                        setErrors((e) => ({ ...e, password: '' }));
                      }}
                    >
                      Auto
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={passwordMode === 'custom' ? 'default' : 'outline'}
                      onClick={() => {
                        setPasswordMode('custom');
                        setPassword('');
                      }}
                    >
                      Custom
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex gap-2">
                  <Input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={passwordMode === 'custom' ? 'Enter password (min 6 chars)' : ''}
                    readOnly={passwordMode === 'auto'}
                  />
                  {passwordMode === 'auto' && (
                    <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
                      Generate
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  We set this password in the login system (we do not store it in the database).
                </p>
                {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={createStudent.isPending}>
                {createStudent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Partner
              </Button>

              {submitError && (
                <p className="text-sm text-destructive" role="alert">
                  {submitError}
                </p>
              )}
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
}
