'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExplorePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/explore/graphs');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Redirecting...</div>
    </div>
  );
}
