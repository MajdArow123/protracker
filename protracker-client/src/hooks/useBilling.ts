import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../api/billingApi';
import { useAuth } from '../context/useAuth';
import type { BillingInfo } from '../types';

// Coach billing info (plan, limits, usage). Only coaches have billing.
export function useBilling() {
  const { user } = useAuth();
  return useQuery<BillingInfo>({
    queryKey: ['billing'],
    queryFn: billingApi.getInfo,
    enabled: !!user && user.role === 'Coach',
    staleTime: 60_000,
  });
}
