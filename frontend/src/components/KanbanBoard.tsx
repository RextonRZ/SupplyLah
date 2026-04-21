"use client";

import { Order, KANBAN_COLUMNS, OrderStatus, STATUS_COLORS } from "@/lib/types";
import OrderCard from "./OrderCard";

interface Props {
  orders: Order[];
  onRefresh: () => void;
}

const COLUMN_ICONS: Record<string, string> = {
  Pending: "⏳",
  "Awaiting Confirmation": "💬",
  Confirmed: "✅",
  Dispatched: "🚚",
};

export default function KanbanBoard({ orders, onRefresh }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((status) => {
        const col = orders.filter((o) => o.order_status === status);
        return (
          <div key={status} className="bg-slate-100 rounded-2xl p-3">
            {/* Column header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <span>{COLUMN_ICONS[status]}</span>
                <span>{status}</span>
              </h3>
              <span className="text-xs font-bold bg-white text-slate-600 rounded-full px-2 py-0.5 border border-slate-200">
                {col.length}
              </span>
            </div>

            {/* Cards */}
            <div className="kanban-col">
              {col.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-6">No orders</div>
              ) : (
                col.map((order) => (
                  <OrderCard key={order.order_id} order={order} onOverride={onRefresh} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
