import type {
  Claim, Donation, DonationRequest, ImpactReport, TransportOrder, TransportStatus, UserView, Wishlist,
} from './types';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

/** Fired when the backend answers 401 so the shell can drop the stale session. */
export const UNAUTHORIZED_EVENT = 'foodbridge:unauthorized';

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    ...rest,
  });
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const payload = (data ?? {}) as { error?: string; fields?: Record<string, string> };
    let message = payload.error ?? (res.status === 403 ? 'Keine Berechtigung für diese Aktion' : `Anfrage fehlgeschlagen (${res.status})`);
    if (payload.fields) {
      message += ' (' + Object.entries(payload.fields).map(([k, v]) => `${k}: ${v}`).join(', ') + ')';
    }
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<UserView>('/api/auth/login', { method: 'POST', json: { username, password } }),
    logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
    me: () => request<UserView>('/api/auth/me'),
    accounts: () => request<UserView[]>('/api/auth/accounts'),
  },
  donations: {
    create: (body: DonationRequest) => request<Donation>('/api/donations', { method: 'POST', json: body }),
    available: () => request<Donation[]>('/api/donations/available'),
    mine: () => request<Donation[]>('/api/donations/mine'),
    all: () => request<Donation[]>('/api/donations'),
  },
  claims: {
    create: (donationId: number) => request<Claim>('/api/claims', { method: 'POST', json: { donationId } }),
    mine: () => request<Claim[]>('/api/claims/mine'),
  },
  logistics: {
    bundle: () => request<TransportOrder[]>('/api/logistics/bundle', { method: 'POST' }),
    orders: () => request<TransportOrder[]>('/api/logistics/orders'),
    setStatus: (id: number, status: TransportStatus) =>
      request<TransportOrder>(`/api/logistics/orders/${id}/status`, { method: 'PATCH', json: { status } }),
    assignDriver: (id: number, driverName: string) =>
      request<TransportOrder>(`/api/logistics/orders/${id}/driver`, { method: 'PATCH', json: { driverName } }),
  },
  impact: {
    global: () => request<ImpactReport>('/api/impact'),
    mine: () => request<ImpactReport>('/api/impact/mine'),
  },
  wishlists: {
    all: () => request<Wishlist[]>('/api/wishlists'),
    create: (body: { productName: string; quantityKg: number; note: string }) =>
      request<Wishlist>('/api/wishlists', { method: 'POST', json: body }),
    remove: (id: number) => request<void>(`/api/wishlists/${id}`, { method: 'DELETE' }),
  },
};

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
