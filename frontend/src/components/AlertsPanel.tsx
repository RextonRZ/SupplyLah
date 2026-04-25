"use client";

import { Order } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

export default function AlertsPanel({ orders, onSelectOrder }: { orders: Order[]; onRefresh: () => void; onSelectOrder: (order: Order) => void }) {
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
          <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
            {alerts.map(order => {
              // Determine the reason for the alert by checking notes
              let alertReason = "Requires manual review";
              try {
                const notes = JSON.parse(order.order_notes || "{}");
                if (notes.clarification_count >= 3) {
                  alertReason = "🚨 Chat Escalated: 3+ ambiguous replies.";
                } else {
                  alertReason = notes.intake_result?.notes || "Requires review (Low AI Confidence)";
                }
              } catch (e) {
                alertReason = "Requires manual review";
              }

              return (
                <button
                  key={order.order_id}
                  onClick={() => onSelectOrder(order)}
                  className="w-full text-left group relative rounded-lg border border-red-100 bg-white p-3 cursor-pointer hover:bg-red-50 hover:border-red-200 transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-bold text-slate-900 truncate pr-4">
                      {order.customer?.customer_name || "New Customer"}
                    </p>
                    <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 tabular-nums">
                      {order.confidence_score ? `${(order.confidence_score * 100).toFixed(0)}%` : "—"}
                    </span>
                  </div>

                  <p className="text-xs text-red-600 font-medium mb-3 line-clamp-2 leading-relaxed">
                    {alertReason}
                  </p>

                  <div className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="font-mono font-bold bg-slate-100 px-1 rounded">
                        #{order.order_id.split("-")[0]}
                      </span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</span>
                    </div>
                    
                    {/* View/Resolve Indicator */}
                    <span className="text-slate-400 group-hover:text-red-500 font-bold transition-colors">
                      Review →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
