import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
  student_id: string | null;
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
    mutationFn: async (studentData: {
      student_id: string;
      name: string;
      mobile: string;
      password: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('create-student', {
        body: {
          student_id: studentData.student_id,
          name: studentData.name,
          mobile: studentData.mobile,
          password: studentData.password,
        },
      });

      if (error) {
        // Normalize function errors to plain Error for toast rendering
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error ?? 'Failed to create student');
      }

      return { user_id: data.user_id as string, password: studentData.password };
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
