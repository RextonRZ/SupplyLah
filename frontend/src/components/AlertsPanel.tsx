"use client";

import { Order } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

interface Props {
  orders: Order[];
  onRefresh: () => void;
}

export default function AlertsPanel({ orders, onRefresh }: Props) {
  const alerts = orders.filter(
    (o) =>
      o.requires_human_review &&
      o.order_status !== "Confirmed" &&
      o.order_status !== "Dispatched" &&
      o.order_status !== "Expired"
  );

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
          <span>🔔</span> Exception Alerts
        </h2>
        <p className="text-xs text-slate-400 text-center py-4">
          No alerts — all orders processing normally ✓
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-red-200 p-4">
      <h2 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
        <span className="alert-pulse">🔴</span>
        <span>Exception Alerts ({alerts.length})</span>
      </h2>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {alerts.map((order) => (
          <div
            key={order.order_id}
            className="border border-red-100 rounded-xl p-3 bg-red-50"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {order.customer?.customer_name || "Unknown"}
                </p>
                <p className="text-xs text-slate-500">
                  {order.customer?.whatsapp_number}
                </p>
              </div>
              <span className="text-xs text-red-600 font-bold">
                {((order.confidence_score || 0) * 100).toFixed(0)}% confidence
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-1 line-clamp-2">
              {order.order_notes
                ? (() => {
                    try {
                      const n = JSON.parse(order.order_notes);
                      return n.intake_result?.notes || order.order_notes;
                    } catch {
                      return order.order_notes;
                    }
                  })()
                : "Requires manual review"}
            </p>

            <div className="flex justify-between items-center mt-2 text-xs text-slate-400">
              <span>#{order.order_id.split("-")[0]}</span>
              <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
