import { useState } from 'react';
import { getSignedUrl } from '@/hooks/useSignedUrl';

interface ScreenshotLinkProps {
  screenshotPath: string | null;
  className?: string;
}

export function ScreenshotLink({ screenshotPath, className = "text-xs text-primary hover:underline" }: ScreenshotLinkProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!screenshotPath || loading) return;

    setLoading(true);
    try {
      const url = await getSignedUrl(screenshotPath);
      if (url) {
        window.open(url, '_blank');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!screenshotPath) return null;

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {loading ? 'Loading...' : 'View'}
    </button>
  );
}
