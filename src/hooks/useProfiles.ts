import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
  partner_id: string | null;
  name: string;
  mobile: string | null;
  role: 'admin' | 'student';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useStudents = () => {
  return useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Profile[];
    },
  });
};

export const useCreateStudent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (partnerData: {
      partner_id: string;
      name: string;
      mobile: string;
      password: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('create-student', {
        body: {
          student_id: partnerData.partner_id,
          name: partnerData.name,
          mobile: partnerData.mobile,
          password: partnerData.password,
        },
      });

      // Handle function invocation errors (network, CORS, non-2xx, etc.)
      if (error) {
        let message: string | undefined;

        // 1) Preferred: parse JSON body from the Response (when available)
        const ctx: any = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json().catch(() => null);
          message = body?.error;
        }

        // 2) Fallback: some errors embed a JSON object inside error.message
        if (!message && typeof (error as any).message === 'string') {
          const raw = (error as any).message as string;
          const jsonStart = raw.indexOf('{');
          if (jsonStart !== -1) {
            try {
              const parsed = JSON.parse(raw.slice(jsonStart));
              message = parsed?.error;
            } catch {
              // ignore
            }
          }
        }

        throw new Error(message || (error as any).message || 'Failed to create student');
      }

      // Handle application-level errors returned from the backend function
      if (!data?.success) {
        throw new Error(data?.error ?? 'Failed to create student');
      }

      return { user_id: data.user_id as string, password: partnerData.password };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'Student created successfully!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to create student', description: error.message });
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Profile> & { id: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'Profile updated!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message });
    },
  });
};
