import api from './axiosInstance';
import type { BillingInfo, BillingPlanName } from '../types';

export const billingApi = {
  getInfo: () => api.get<BillingInfo>('/api/billing').then(r => r.data),
  checkout: (plan: BillingPlanName) =>
    api.post<{ url: string }>('/api/billing/checkout', { plan }).then(r => r.data),
  portal: () => api.post<{ url: string }>('/api/billing/portal', {}).then(r => r.data),
  sync: () => api.post<BillingInfo>('/api/billing/sync', {}).then(r => r.data),
};
