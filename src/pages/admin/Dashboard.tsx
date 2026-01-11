import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAllSales, useApproveSale, useRejectSale } from '@/hooks/useSales';
import { useStudents } from '@/hooks/useProfiles';
import { useTicketTiers, useUpdateTicketTier } from '@/hooks/useTicketTiers';
import { Badge } from '@/components/ui/badge';
import { LogOut, Users, Package, FileCheck, IndianRupee, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const { data: sales = [] } = useAllSales();
  const { data: students = [] } = useStudents();
  const { data: tiers = [] } = useTicketTiers();
  const approveSale = useApproveSale();
  const rejectSale = useRejectSale();
  const updateTier = useUpdateTicketTier();

  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; saleId: string }>({ open: false, saleId: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [saleFilter, setSaleFilter] = useState('pending');

  const totalRevenue = sales.filter(s => s.status === 'approved').reduce((sum, s) => sum + s.amount, 0);
  const pendingCount = sales.filter(s => s.status === 'pending').length;

  const filteredSales = sales.filter(s => saleFilter === 'all' || s.status === saleFilter);

  const handleReject = async () => {
    await rejectSale.mutateAsync({ saleId: rejectDialog.saleId, reason: rejectReason });
    setRejectDialog({ open: false, saleId: '' });
    setRejectReason('');
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container flex items-center justify-between py-4">
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </header>

      <main className="container py-6">
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{students.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{sales.filter(s => s.status === 'approved').length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-orange-500">{pendingCount}</div></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sales" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Sales Submissions</CardTitle>
                <div className="flex gap-2">
                  {['pending', 'approved', 'rejected', 'all'].map(f => (
                    <Button key={f} variant={saleFilter === f ? 'default' : 'outline'} size="sm" onClick={() => setSaleFilter(f)}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left">ID</th>
                        <th className="px-4 py-3 text-left">Buyer</th>
                        <th className="px-4 py-3 text-left">Amount</th>
                        <th className="px-4 py-3 text-left">UTR</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.map(sale => (
                        <tr key={sale.id} className="border-b">
                          <td className="px-4 py-3 font-mono text-xs">{sale.id}</td>
                          <td className="px-4 py-3">
                            <div>{sale.buyer_name}</div>
                            <div className="text-xs text-muted-foreground">{sale.buyer_mobile}</div>
                          </td>
                          <td className="px-4 py-3">₹{sale.amount.toLocaleString()}</td>
                          <td className="px-4 py-3">...{sale.utr_last4}</td>
                          <td className="px-4 py-3">
                            <Badge variant={sale.status === 'approved' ? 'default' : sale.status === 'rejected' ? 'destructive' : 'secondary'}>
                              {sale.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {sale.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => approveSale.mutate(sale.id)} disabled={approveSale.isPending}>
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => setRejectDialog({ open: true, saleId: sale.id })}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            {sale.screenshot_url && (
                              <a href={sale.screenshot_url} target="_blank" className="text-xs text-primary hover:underline">View</a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <Card>
              <CardHeader><CardTitle>Ticket Inventory</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {tiers.map(tier => (
                    <div key={tier.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="flex-1"><span className="font-medium">{tier.name}</span></div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Price:</span>
                        <Input type="number" className="w-24" defaultValue={tier.price}
                          onBlur={(e) => updateTier.mutate({ id: tier.id, price: parseInt(e.target.value) })} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Qty:</span>
                        <Input type="number" className="w-24" defaultValue={tier.remaining_qty}
                          onBlur={(e) => updateTier.mutate({ id: tier.id, remaining_qty: parseInt(e.target.value) })} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students">
            <Card>
              <CardHeader><CardTitle>Students ({students.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left">ID</th>
                        <th className="px-4 py-3 text-left">Name</th>
                        <th className="px-4 py-3 text-left">Mobile</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(student => (
                        <tr key={student.id} className="border-b">
                          <td className="px-4 py-3 font-mono">{student.student_id}</td>
                          <td className="px-4 py-3">{student.name}</td>
                          <td className="px-4 py-3">{student.mobile}</td>
                          <td className="px-4 py-3">
                            <Badge variant={student.is_active ? 'default' : 'secondary'}>
                              {student.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">{format(new Date(student.created_at), 'MMM d, yyyy')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ ...rejectDialog, open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Sale</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, saleId: '' })}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
