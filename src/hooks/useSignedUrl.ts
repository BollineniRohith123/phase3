import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useSignedUrl = (filePath: string | null) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getSignedUrl = async () => {
      if (!filePath) {
        setSignedUrl(null);
        return;
      }

      // If it's already a full URL (legacy data), use it directly
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        setSignedUrl(filePath);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: signError } = await supabase.storage
          .from('payment-screenshots')
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (signError) throw signError;
        setSignedUrl(data.signedUrl);
      } catch (err) {
        console.error('Failed to get signed URL:', err);
        setError('Failed to load image');
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    getSignedUrl();
  }, [filePath]);

  return { signedUrl, loading, error };
};

// Helper function to get signed URL on demand
export const getSignedUrl = async (filePath: string | null): Promise<string | null> => {
  if (!filePath) return null;

  // If it's already a full URL (legacy data), use it directly
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }

  try {
    const { data, error } = await supabase.storage
      .from('payment-screenshots')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) throw error;
    return data.signedUrl;
  } catch (err) {
    console.error('Failed to get signed URL:', err);
    return null;
  }
};
