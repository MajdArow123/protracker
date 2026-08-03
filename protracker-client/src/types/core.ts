export interface Sport {
  id: number;
  name: string;
  description: string;
  iconOrImage?: string | null;
}

export interface Position {
  id: number;
  name: string;
  sportId: number;
}

export interface StatCategory {
  id: number;
  name: string;
  description: string;
  sportId: number;
  minValue: number;
  maxValue: number;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
