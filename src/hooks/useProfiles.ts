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
      // Create auth user with email format: studentId@student.local
      const email = `${studentData.student_id.toLowerCase()}@student.local`;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: studentData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name: studentData.name,
            student_id: studentData.student_id,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          student_id: studentData.student_id,
          name: studentData.name,
          mobile: studentData.mobile,
          role: 'student',
        });

      if (profileError) throw profileError;

      // Add student role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'student',
        });

      if (roleError) throw roleError;

      return { user: authData.user, password: studentData.password };
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
