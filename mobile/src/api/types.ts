// backend/catalog/serializers.py・accounts の API レスポンス型

export type SeriesStatus = "active" | "wishlist" | "completed";
export type AvailabilityStatus = "available" | "unavailable" | "unknown";

export interface Series {
  id: number;
  title: string;
  author: string;
  author_kana: string;
  publisher: string;
  magazine_label: string;
  status: SeriesStatus;
  current_volume: number;
  total_volumes: number | null;
  favorite_score: number;
  next_volume: number;
  cart_count: number;
  next_cover_url: string | null;
  next_cover_is_fallback: boolean;
  first_volume_cover_url: string | null;
  availability_status: AvailabilityStatus | null;
  availability_map: Record<string, Exclude<AvailabilityStatus, "unknown">>;
  created_at: string;
  updated_at: string;
}

export interface VolumeCover {
  id: number;
  volume_number: number;
  image_url: string;
  image_file: string | null;
  source: "rakuten" | "manual" | "upload";
  resolved_url: string | null;
  fetched_at: string;
  /** 発売前の仮表紙（サーバは仮表紙をキャッシュせず毎回返す） */
  provisional?: boolean;
}

export interface CartItem {
  id: number;
  series: number;
  series_title: string;
  volume_number: number;
  added_at: string;
}

export interface RentalHistoryItem {
  id: number;
  series: number;
  series_title: string;
  volume_number: number;
  rented_at: string;
}

export interface RentalShop {
  id: number;
  name: string;
  memo: string;
  created_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Me {
  id: number;
  username: string;
  is_staff: boolean;
}

export interface Invite {
  token: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  signup_url?: string;
}

export interface RakutenCandidate {
  title: string;
  author: string;
  author_kana: string;
  publisher: string;
  cover_url: string | null;
}

export interface ReadingStats {
  total: number;
  monthly: { label: string; count: number }[];
  yearly: { label: string; count: number }[];
}

export interface CheckoutResult {
  created: number;
  completed_series: { id: number; title: string }[];
}
