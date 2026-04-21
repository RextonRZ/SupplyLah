"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Order, STATUS_COLORS } from "@/lib/types";
import { BACKEND_URL } from "@/lib/supabase";

interface Props {
  order: Order;
  onOverride?: () => void;
}

export default function OrderCard({ order, onOverride }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [overriding, setOverriding] = useState(false);

  const statusClass = STATUS_COLORS[order.order_status] || "bg-gray-100 text-gray-600";
  const createdAgo = order.created_at
    ? formatDistanceToNow(new Date(order.created_at), { addSuffix: true })
    : "";

  const isAlert = order.requires_human_review && order.order_status !== "Confirmed" && order.order_status !== "Dispatched";

  async function handleOverride(status: string) {
    setOverriding(true);
    try {
      await fetch(`${BACKEND_URL}/api/orders/${order.order_id}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: "Manual override by staff" }),
      });
      onOverride?.();
    } catch (err) {
      console.error(err);
    } finally {
      setOverriding(false);
    }
  }

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm p-3 cursor-pointer transition-all hover:shadow-md ${
        isAlert ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"
      }`}
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {order.customer?.customer_name || "Unknown Buyer"}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {order.customer?.whatsapp_number}
          </p>
        </div>
        <span className={`status-badge shrink-0 ${statusClass}`}>
          {order.order_status}
        </span>
      </div>

      {/* Meta row */}
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          {order.order_amount ? `RM ${order.order_amount.toFixed(2)}` : "—"}
        </span>
        <span>{createdAgo}</span>
      </div>

      {/* Alert badge */}
      {isAlert && (
        <div className="mt-2 flex items-center gap-1 text-xs text-red-600 font-medium alert-pulse">
          <span>⚠</span>
          <span>
            Low confidence ({((order.confidence_score || 0) * 100).toFixed(0)}%) — Needs review
          </span>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          {/* Items */}
          {order.order_item && order.order_item.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">Items</p>
              <ul className="space-y-0.5">
                {order.order_item.map((item) => (
                  <li
                    key={item.product_id}
                    className="text-xs text-slate-700 flex justify-between"
                  >
                    <span>
                      {item.is_substituted ? "🔄 " : ""}
                      {item.product_name} × {item.quantity}
                    </span>
                    <span>RM {(item.unit_price * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Order ID */}
          <p className="text-xs text-slate-400 font-mono">
            #{order.order_id.split("-")[0]}
          </p>

          {/* Override buttons for review items */}
          {isAlert && (
            <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
              <button
                disabled={overriding}
                onClick={() => handleOverride("Confirmed")}
                className="flex-1 text-xs bg-green-600 text-white rounded-lg py-1.5 font-medium hover:bg-green-700 disabled:opacity-50"
              >
                ✓ Approve
              </button>
              <button
                disabled={overriding}
                onClick={() => handleOverride("Failed")}
                className="flex-1 text-xs bg-red-100 text-red-700 rounded-lg py-1.5 font-medium hover:bg-red-200 disabled:opacity-50"
              >
                ✕ Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
