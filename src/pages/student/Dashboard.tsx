import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStudentSales } from '@/hooks/useSales';
import { useTicketTiers } from '@/hooks/useTicketTiers';
import { Badge } from '@/components/ui/badge';
import { LogOut, Plus, IndianRupee, FileCheck, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ReferralLinkBanner } from '@/components/ReferralLinkBanner';

export default function StudentDashboard() {
  const { profile, signOut } = useAuth();
  const { data: sales = [], isLoading } = useStudentSales();
  const { data: tiers = [] } = useTicketTiers();
  const navigate = useNavigate();

  const totalSales = sales.filter(s => s.status === 'approved').length;
  const totalRevenue = sales.filter(s => s.status === 'approved').reduce((sum, s) => sum + s.amount, 0);
  const pendingCount = sales.filter(s => s.status === 'pending').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container flex items-center justify-between py-4">
          <div>
            <h1 className="text-xl font-bold">Welcome, {profile?.name}</h1>
            <p className="text-sm text-muted-foreground">ID: {profile?.student_id}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Referral Link Banner */}
        <ReferralLinkBanner />

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSales}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue Collected</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Inventory</h2>
        </div>
        <div className="grid gap-2 grid-cols-2 md:grid-cols-6">
          {tiers.map(tier => (
            <Card key={tier.id} className="text-center">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{tier.name}</p>
                <p className="font-bold">₹{tier.price}</p>
                <p className="text-xs text-green-600">{tier.remaining_qty} left</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Sales</h2>
          <Button onClick={() => navigate('/student/new-sale')}>
            <Plus className="mr-2 h-4 w-4" /> New Sale
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Buyer</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Tickets</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => (
                    <tr key={sale.id} className="border-b">
                      <td className="px-4 py-3">{format(new Date(sale.submitted_at), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-3">{sale.buyer_name}</td>
                      <td className="px-4 py-3">₹{sale.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs">
                        {sale.tickets_data.map(t => `${t.qty}x${t.tier_name}`).join(', ')}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(sale.status)}</td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No sales yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
