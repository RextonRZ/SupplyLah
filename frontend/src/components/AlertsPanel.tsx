"use client";

import { Order } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

export default function AlertsPanel({ orders }: { orders: Order[]; onRefresh: () => void }) {
  const alerts = orders.filter(
    o => o.requires_human_review && o.order_status !== "Confirmed" && o.order_status !== "Dispatched" && o.order_status !== "Expired"
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className={`px-4 py-3 border-b flex items-center justify-between ${alerts.length > 0 ? "border-red-100 bg-red-50" : "border-slate-100"}`}>
        <div className="flex items-center gap-2">
          {alerts.length > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          <h2 className="text-sm font-semibold text-slate-800">Exception Alerts</h2>
        </div>
        {alerts.length > 0 && (
          <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">{alerts.length}</span>
        )}
      </div>

      <div className="p-3">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2.5 py-2">
            <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center text-xs shrink-0">✓</span>
            <p className="text-sm text-slate-500">All orders processing normally</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {alerts.map(order => (
              <div key={order.order_id} className="rounded-lg border border-red-100 bg-red-50 p-3">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{order.customer?.customer_name || "Unknown"}</p>
                  <span className="text-xs font-bold text-red-500 shrink-0 ml-2 tabular-nums">
                    {((order.confidence_score || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  {(() => {
                    try { const n = JSON.parse(order.order_notes || "{}"); return n.intake_result?.notes || "Requires manual review"; }
                    catch { return "Requires manual review"; }
                  })()}
                </p>
                <div className="flex justify-between text-xs text-slate-400">
                  <span className="font-mono">#{order.order_id.split("-")[0]}</span>
                  <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
