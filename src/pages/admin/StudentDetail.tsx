import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, IndianRupee, FileCheck, Clock, XCircle, Copy, Key, User, Phone, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Sale, TicketItem } from '@/hooks/useSales';

export default function StudentDetail() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [resetDialog, setResetDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Fetch student profile
  const { data: student, isLoading: loadingStudent } = useQuery({
    queryKey: ['student-profile', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
  });

  // Fetch student sales
  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['student-sales-admin', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data.map((item) => ({
        ...item,
        tickets_data: (item.tickets_data as unknown as TicketItem[]) || [],
        status: item.status as 'pending' | 'approved' | 'rejected',
      })) as Sale[];
    },
    enabled: !!studentId,
  });

  // Calculate stats
  const approvedSales = sales.filter((s) => s.status === 'approved');
  const pendingSales = sales.filter((s) => s.status === 'pending');
  const rejectedSales = sales.filter((s) => s.status === 'rejected');
  const totalRevenue = approvedSales.reduce((sum, s) => sum + s.amount, 0);
  const totalTicketsSold = approvedSales.reduce((sum, s) => {
    return sum + s.tickets_data.reduce((tSum, t) => tSum + t.qty, 0);
  }, 0);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleResetPassword = async () => {
    if (!student || !newPassword) return;
    
    setResetting(true);
    try {
      const { error } = await supabase.functions.invoke('reset-student-password', {
        body: { student_id: student.id, new_password: newPassword },
      });
      
      if (error) throw error;
      
      toast({ title: 'Password reset successfully!' });
      setResetDialog(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Password reset failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setResetting(false);
    }
  };

  const openResetDialog = () => {
    setNewPassword(generatePassword());
    setResetDialog(true);
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(newPassword);
    toast({ title: 'Password copied to clipboard!' });
  };

  if (loadingStudent || loadingSales) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-destructive">Student not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container flex items-center gap-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{student.name}</h1>
            <p className="text-sm text-muted-foreground">Student ID: {student.student_id}</p>
          </div>
          <Button variant="outline" onClick={openResetDialog}>
            <Key className="mr-2 h-4 w-4" /> Reset Password
          </Button>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Student Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Student Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{student.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mobile</p>
                  <p className="font-medium">{student.mobile || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-medium">{format(new Date(student.created_at), 'MMM d, yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={student.is_active ? 'default' : 'secondary'} className="px-4 py-2">
                  {student.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">₹{totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{totalTicketsSold} tickets sold</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Approved Sales</CardTitle>
              <FileCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{approvedSales.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{pendingSales.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{rejectedSales.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Sales History */}
        <Card>
          <CardHeader>
            <CardTitle>Sales History ({sales.length})</CardTitle>
            <CardDescription>All sales submissions by this student</CardDescription>
          </CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No sales yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left">Sale ID</th>
                      <th className="px-4 py-3 text-left">Buyer</th>
                      <th className="px-4 py-3 text-left">Tickets</th>
                      <th className="px-4 py-3 text-left">Amount</th>
                      <th className="px-4 py-3 text-left">UTR</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale.id} className="border-b">
                        <td className="px-4 py-3 font-mono text-xs">{sale.id}</td>
                        <td className="px-4 py-3">
                          <div>{sale.buyer_name}</div>
                          <div className="text-xs text-muted-foreground">{sale.buyer_mobile}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {sale.tickets_data.map((t, i) => (
                              <div key={i} className="text-xs">
                                {t.tier_name} × {t.qty}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">₹{sale.amount.toLocaleString()}</td>
                        <td className="px-4 py-3">...{sale.utr_last4}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              sale.status === 'approved'
                                ? 'default'
                                : sale.status === 'rejected'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {sale.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {format(new Date(sale.submitted_at), 'MMM d, HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password for {student.name}</DialogTitle>
            <DialogDescription>
              Set a new password for student ID: {student.student_id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="flex gap-2">
                <Input
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="font-mono"
                />
                <Button variant="outline" size="icon" onClick={copyPassword}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => setNewPassword(generatePassword())}>
                  Generate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Make sure to copy and share this password with the student securely.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting || !newPassword}>
              {resetting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
