"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Order } from "@/lib/types";
import { BACKEND_URL } from "@/lib/supabase";

interface Props {
  order: Order;
  onOverride?: () => void;
  onSelectOrder?: (order: Order) => void;
}

export default function OrderCard({ order, onOverride, onSelectOrder }: Props) {
  const [expanded,   setExpanded]   = useState(false);
  const [overriding, setOverriding] = useState(false);

  const isAlert = order.requires_human_review
    && order.order_status !== "Confirmed"
    && order.order_status !== "Dispatched";

  const createdAgo = order.created_at
    ? formatDistanceToNow(new Date(order.created_at), { addSuffix: true })
    : "";

  async function handleOverride(status: string) {
    setOverriding(true);
    try {
      await fetch(`${BACKEND_URL}/api/orders/${order.order_id}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: "Manual override by staff" }),
      });
      onOverride?.();
    } catch {}
    finally { setOverriding(false); }
  }

  return (
    <div
      onClick={() => setExpanded(v => !v)}
      className={`rounded-lg border bg-white cursor-pointer transition-colors duration-150 ${
        isAlert
          ? "border-red-200 bg-red-50/40"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
      }`}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-1.5 mb-1">
          <p className="text-xs font-semibold text-slate-800 leading-tight truncate">
            {order.customer?.customer_name || "Unknown"}
          </p>
          {order.order_amount != null && (
            <p className="text-xs font-bold text-teal-700 shrink-0 tabular-nums">
              RM {order.order_amount.toFixed(0)}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-[11px] text-slate-400 font-mono truncate">{order.customer?.whatsapp_number}</p>
          <p className="text-[11px] text-slate-400 shrink-0">{createdAgo}</p>
        </div>
        {isAlert && (
          <div className="mt-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <p className="text-[11px] text-red-500 font-medium">
              {((order.confidence_score || 0) * 100).toFixed(0)}% confidence — review needed
            </p>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-3 py-2.5 space-y-2" onClick={e => e.stopPropagation()}>
          {order.order_item && order.order_item.length > 0 && (
            <div className="space-y-1">
              {order.order_item.map((item) => (
                <div key={item.product_id} className="flex justify-between text-[11px]">
                  <span className="text-slate-600">
                    {item.is_substituted && <span className="text-orange-500 mr-1">↔</span>}
                    {item.product_name} × {item.quantity}
                  </span>
                  <span className="text-slate-500 tabular-nums">RM {(item.unit_price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-300 font-mono">#{order.order_id.split("-")[0]}</p>
          {isAlert && (
            <div className="flex gap-1.5 pt-0.5">
              <button
                onClick={() => onSelectOrder?.(order)}
                className="flex-1 text-[11px] py-1.5 rounded-md font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm"
              >
                Review
              </button>
              <button
                disabled={overriding}
                onClick={() => handleOverride("Failed")}
                className="flex-1 text-xs py-1.5 rounded-md font-semibold border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
