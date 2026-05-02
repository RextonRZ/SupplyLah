"use client";

import { Order, KANBAN_COLUMNS, OrderStatus } from "@/lib/types";
import OrderCard from "./OrderCard";

interface Props {
  orders: Order[];
  onRefresh: (msg?: string, log?: string) => void;
  onSelectOrder?: (order: Order) => void;
}

const COL_META: Record<string, { accent: string; label: string }> = {
  "Pending":               { accent: "bg-amber-400",  label: "Pending" },
  "Awaiting Substitution": { accent: "bg-orange-400", label: "Subst." },
  "Awaiting Confirmation": { accent: "bg-blue-500",   label: "Confirming" },
  "Awaiting Payment":      { accent: "bg-amber-500",  label: "💳 Payment" },
  "Confirmed":             { accent: "bg-teal-500",   label: "Confirmed" },
  "Dispatched":            { accent: "bg-violet-500", label: "Dispatched" },
};

export default function KanbanBoard({ orders, onRefresh, onSelectOrder }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Order Pipeline</h2>
        <span className="text-xs text-slate-400">{orders.length} total orders</span>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-5 divide-x divide-slate-100">
        {KANBAN_COLUMNS.map((status) => {
          const meta = COL_META[status];
          const col  = orders.filter((o) => o.order_status === status);
          return (
            <div key={status} className="flex flex-col min-h-[360px]">
              {/* Column header */}
              <div className="px-3 pt-3 pb-2.5 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${meta.accent}`} />
                  <span className="text-xs font-semibold text-slate-600">{meta.label}</span>
                </div>
                <span className={`text-xs font-bold tabular-nums ${col.length > 0 ? "text-slate-700" : "text-slate-300"}`}>
                  {col.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[380px]">
                {col.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-slate-300 py-8">—</p>
                  </div>
                ) : (
                  col.map((order) => (
                    <OrderCard key={order.order_id} order={order} onOverride={onRefresh} onSelectOrder={onSelectOrder} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
