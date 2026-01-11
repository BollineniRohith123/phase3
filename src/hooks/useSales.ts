import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Json } from '@/integrations/supabase/types';

export interface TicketItem {
  tier_id: string;
  tier_name: string;
  price: number;
  qty: number;
}

export interface Sale {
  id: string;
  student_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  buyer_name: string;
  buyer_mobile: string;
  amount: number;
  utr_last4: string;
  screenshot_url: string | null;
  tickets_data: TicketItem[];
  rejection_reason: string | null;
  submitted_at: string;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to parse tickets_data from JSON
const parseSale = (data: Record<string, unknown>): Sale => {
  return {
    ...data,
    tickets_data: (data.tickets_data as TicketItem[]) || [],
    status: data.status as 'pending' | 'approved' | 'rejected',
  } as Sale;
};

export const useStudentSales = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-sales', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((item) => parseSale(item as unknown as Record<string, unknown>));
    },
    enabled: !!user,
  });
};

export const useAllSales = (filters?: { status?: string; studentId?: string }) => {
  return useQuery({
    queryKey: ['all-sales', filters],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((item) => parseSale(item as unknown as Record<string, unknown>));
    },
  });
};

export const useCreateSale = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (saleData: {
      buyer_name: string;
      buyer_mobile: string;
      amount: number;
      utr_last4: string;
      screenshot_url: string | null;
      tickets_data: TicketItem[];
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sales')
        .insert({
          buyer_name: saleData.buyer_name,
          buyer_mobile: saleData.buyer_mobile,
          amount: saleData.amount,
          utr_last4: saleData.utr_last4,
          screenshot_url: saleData.screenshot_url,
          student_id: user.id,
          tickets_data: saleData.tickets_data as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-sales'] });
      toast({ title: 'Sale submitted successfully!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Submission failed', description: error.message });
    },
  });
};

export const useUpdateSale = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, tickets_data, ...updates }: Partial<Sale> & { id: string }) => {
      const updatePayload: Record<string, unknown> = { ...updates };
      if (tickets_data) {
        updatePayload.tickets_data = tickets_data as unknown as Json;
      }
      
      const { error } = await supabase
        .from('sales')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-sales'] });
      queryClient.invalidateQueries({ queryKey: ['all-sales'] });
      toast({ title: 'Sale updated successfully!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message });
    },
  });
};

export const useApproveSale = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (saleId: string) => {
      // First, get the sale details
      const { data: sale, error: fetchError } = await supabase
        .from('sales')
        .select('*')
        .eq('id', saleId)
        .single();

      if (fetchError) throw fetchError;

      // Deduct inventory atomically for each ticket using RPC
      const ticketsData = (sale.tickets_data as unknown as TicketItem[]) || [];
      for (const ticket of ticketsData) {
        const { error: rpcError } = await supabase.rpc('decrement_ticket_qty', {
          p_tier_id: ticket.tier_id,
          p_qty: ticket.qty
        });
        
        if (rpcError) {
          throw new Error(`Failed to deduct inventory for ${ticket.tier_name}: ${rpcError.message}`);
        }
      }

      // Update sale status
      const { error } = await supabase
        .from('sales')
        .update({ 
          status: 'approved', 
          approved_at: new Date().toISOString() 
        })
        .eq('id', saleId);

      if (error) throw error;

      // Trigger webhook via edge function
      try {
        await supabase.functions.invoke('fire-webhook', {
          body: { sale_id: saleId },
        });
      } catch (webhookError) {
        console.error('Webhook failed:', webhookError);
      }

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-sales'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-tiers'] });
      toast({ title: 'Sale approved!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Approval failed', description: error.message });
    },
  });
};

export const useRejectSale = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ saleId, reason }: { saleId: string; reason: string }) => {
      const { error } = await supabase
        .from('sales')
        .update({ status: 'rejected', rejection_reason: reason })
        .eq('id', saleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-sales'] });
      toast({ title: 'Sale rejected' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Rejection failed', description: error.message });
    },
  });
};
