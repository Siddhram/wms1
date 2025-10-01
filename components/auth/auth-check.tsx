'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// Define role-based route access
const roleBasedRoutes: Record<string, Set<string>> = {
  maker: new Set([
    '/dashboard',
    '/surveys',          // Added surveys access for makers
    '/surveys/inspection-creation',
    '/surveys/warehouse-creation',
    '/inward',
    '/outward',
    '/delivery-order',   // Added delivery order access for makers
    '/ro',               // Added release order access for makers
    '/reports',          // Added reports access for makers
    '/commodity-summary',
    '/aum-summary',
    '/warehouse-status', // Allow warehouse status for maker
  ]),
  checker: new Set([
    '/dashboard',
    '/surveys',
    '/surveys/inspection-creation',
    '/surveys/warehouse-creation',
    '/inward',           // Added inward access for checkers
    '/outward',          // Added outward access for checkers
    '/reports',
    '/delivery-order',   // Added delivery order access for checkers
    '/ro',               // Added release order access for checkers
    '/master-data',      // Added master data access for checkers
    '/master-data/clients',
    '/master-data/commodities',
    '/master-data/banks',
    '/master-data/branches',
    '/commodity-summary',
    '/aum-summary',
    '/warehouse-status', // Allow warehouse status for checker
  ]),
  admin: new Set([
    '/dashboard',
    '/master-data',
    '/master-data/clients',
    '/master-data/commodities',
    '/master-data/banks',
    '/master-data/branches',
    '/reports',
    '/surveys',
    '/surveys/inspection-creation',
    '/surveys/warehouse-creation',
    '/inward',
    '/outward',
    '/ro',
    '/delivery-order', // Added delivery order access for admin
    '/commodity-summary',
    '/aum-summary',
    '/warehouse-status', // Allow warehouse status for admin
    '/admin',
    '/admin/users'
  ]),
};

// Add paths that don't require authentication
const publicPaths = new Set([
  '/login',
  '/register',
  '/_next',
  '/favicon.ico',
]);

export default function AuthCheck({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't do anything while loading
    if (loading) return;

    // Handle null pathname
    if (!pathname) return;

    // Check if the path is public
    if (publicPaths.has(pathname) || pathname.startsWith('/_next')) {
      return;
    }

    // If no user is logged in, redirect to login
    if (!user) {
      router.push('/login');
      return;
    }

    // Check role-based access
    const userRole = user.role as keyof typeof roleBasedRoutes;
    if (userRole && roleBasedRoutes[userRole]) {
      const allowedPaths = roleBasedRoutes[userRole];
      // Check if the current path or any parent path is allowed
      const isPathAllowed = allowedPaths.has(pathname) || 
        Array.from(allowedPaths).some(allowedPath => pathname.startsWith(allowedPath));
      
      if (!isPathAllowed) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  // Show nothing while loading
  if (loading) {
    return null;
  }

  return <>{children}</>;
} 