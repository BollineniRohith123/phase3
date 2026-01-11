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
  student_id: z.string().min(1, 'Student ID is required').regex(/^[A-Z0-9]+$/, 'Use uppercase letters and numbers only'),
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

  const [form, setForm] = useState({ student_id: '', name: '', mobile: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdCredentials, setCreatedCredentials] = useState<{ id: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

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

    const password = generatePassword();

    try {
      await createStudent.mutateAsync({
        student_id: form.student_id,
        name: form.name,
        mobile: form.mobile,
        password,
      });

      setCreatedCredentials({ id: form.student_id, password });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const copyCredentials = () => {
    if (createdCredentials) {
      navigator.clipboard.writeText(`Student ID: ${createdCredentials.id}\nPassword: ${createdCredentials.password}`);
      setCopied(true);
      toast({ title: 'Credentials copied to clipboard!' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateAnother = () => {
    setForm({ student_id: '', name: '', mobile: '' });
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
            <h1 className="text-xl font-bold">Student Created!</h1>
          </div>
        </header>

        <main className="container max-w-md py-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Success!</CardTitle>
              <CardDescription>Save these credentials - the password cannot be recovered.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg font-mono text-sm space-y-2">
                <div><span className="text-muted-foreground">Student ID:</span> <strong>{createdCredentials.id}</strong></div>
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
          <h1 className="text-xl font-bold">Create New Student</h1>
        </div>
      </header>

      <main className="container max-w-md py-6">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Student Details</CardTitle>
              <CardDescription>Enter student information. Password will be auto-generated.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Student ID *</Label>
                <Input 
                  value={form.student_id} 
                  onChange={e => setForm({...form, student_id: e.target.value.toUpperCase()})} 
                  placeholder="e.g., STU001"
                />
                {errors.student_id && <p className="text-sm text-destructive mt-1">{errors.student_id}</p>}
              </div>
              <div>
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Enter full name" />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label>Mobile Number *</Label>
                <Input value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} maxLength={10} placeholder="10-digit number" />
                {errors.mobile && <p className="text-sm text-destructive mt-1">{errors.mobile}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={createStudent.isPending}>
                {createStudent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Student
              </Button>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
}
