import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  remaining_qty: number;
  initial_qty: number;
  created_at: string;
  updated_at: string;
}

export const useTicketTiers = () => {
  return useQuery({
    queryKey: ['ticket-tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_tiers')
        .select('*')
        .order('price', { ascending: true });

      if (error) throw error;
      return data as TicketTier[];
    },
  });
};

export const useUpdateTicketTier = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, price, remaining_qty }: { id: string; price?: number; remaining_qty?: number }) => {
      const updates: Partial<TicketTier> = {};
      if (price !== undefined) updates.price = price;
      if (remaining_qty !== undefined) updates.remaining_qty = remaining_qty;

      const { error } = await supabase
        .from('ticket_tiers')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-tiers'] });
      toast({ title: 'Ticket tier updated' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message });
    },
  });
};
