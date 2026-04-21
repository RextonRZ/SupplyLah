export type OrderStatus =
  | "Pending"
  | "Awaiting Confirmation"
  | "Confirmed"
  | "Dispatched"
  | "Failed"
  | "Expired";

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  is_substituted: boolean;
}

export interface Order {
  order_id: string;
  customer_id: string;
  merchant_id: string;
  order_amount: number | null;
  order_status: OrderStatus;
  order_notes: string | null;
  confidence_score: number | null;
  requires_human_review: boolean;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    customer_name: string;
    whatsapp_number: string;
  };
  order_item?: OrderItem[];
}

export interface Product {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  unit_price: number;
  stock_quantity: number;
}

export interface DashboardStats {
  total_today: number;
  pending: number;
  awaiting_confirmation: number;
  confirmed: number;
  dispatched: number;
  failed: number;
  requires_review: number;
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Awaiting Confirmation": "bg-blue-100 text-blue-800 border-blue-200",
  Confirmed: "bg-green-100 text-green-800 border-green-200",
  Dispatched: "bg-purple-100 text-purple-800 border-purple-200",
  Failed: "bg-red-100 text-red-800 border-red-200",
  Expired: "bg-gray-100 text-gray-600 border-gray-200",
};

export const KANBAN_COLUMNS: OrderStatus[] = [
  "Pending",
  "Awaiting Confirmation",
  "Confirmed",
  "Dispatched",
];
