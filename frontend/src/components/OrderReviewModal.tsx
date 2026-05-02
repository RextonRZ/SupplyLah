"use client";

import { useState, useEffect } from "react";
import { BACKEND_URL, supabase } from "@/lib/supabase";
import { Order } from "@/lib/types";

export default function OrderReviewModal({
  order,
  onClose,
  onSave,
}: {
  order: Order;
  onClose: () => void;
  onSave: (msg?: string, log?: string, logsArray?: any[]) => void;
}) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [amount, setAmount] = useState(order.order_amount || 0);
  const [status, setStatus] = useState(
    order.order_status === "Pending" ? "Awaiting Confirmation" : order.order_status
  );
  const [notes, setNotes] = useState(order.order_notes || "{}");
  const [isSaving, setIsSaving] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [calcDetails, setCalcDetails] = useState<any>(null);
  const [bypassMinOrder, setBypassMinOrder] = useState(false);
  const isBelowMin = calcDetails ? calcDetails.subtotal < 50 : true;

  // Fetch the conversation history for this specific order/customer
  useEffect(() => {
    async function fetchLogs() {
      const { data } = await supabase
        .from("conversation_log")
        .select("*")
        .eq("customer_id", order.customer_id)
        .order("created_at", { ascending: true })
        .limit(20);
      setLogs(data || []);
      setLoadingLogs(false);
    }
    fetchLogs();
  }, [order]);

  // Sync calculation on load and when notes change
  useEffect(() => {
    const result = calculateTotalFromJson(notes);
    if (result) {
      setCalcDetails(result);
      setAmount(result.grandTotal);
    } else {
      // If JSON is invalid or empty, reset calculation display
      setCalcDetails(null);
      setAmount(0);
    }
  }, [notes]);

  const handleNotesChange = (val: string) => {
    setNotes(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  const handleSave = async () => {
    if (jsonError || amount < 0) return;
    setIsSaving(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          amount: amount,
          status: status,
          notes: notes,
          merchant_id: order.merchant_id,
        }),
      });

      const data = await response.json()

      if (response.ok) {
        // Use updated_logs from backend (captured after pipeline completes)
        onSave(data.message, data.log, data.updated_logs || logs);
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const calculateTotalFromJson = (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      let items = [];
      let discount = 0;
      let delivery = 0;

      if (data.inventory_result) {
        items = data.inventory_result.items || [];
        discount = parseFloat(data.inventory_result.discount_applied || 0);
        delivery = parseFloat(data.inventory_result.delivery_fee || 0);
      } else if (data.previous_items) {
        items = data.previous_items;
      } else {
        return null;
      }

      const subtotal = items.reduce((sum: number, item: any) => {
        const qty = item.fulfilled_qty ?? item.quantity ?? 0;
        const price = item.unit_price ?? 0;
        return sum + (price * qty);
      }, 0);

      const grandTotal = subtotal - discount + delivery;

      return { subtotal, discount, delivery, grandTotal };
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Manual Review: {order.customer?.customer_name}
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Order ID: {order.order_id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left: Raw Conversation History */}
          <div className="w-full md:w-1/2 border-r border-slate-100 flex flex-col bg-slate-50/50">
            <div className="p-4 border-b border-slate-100 bg-white">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Conversation History
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingLogs ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-10 bg-slate-200 rounded-lg w-2/3" />
                  <div className="h-10 bg-slate-200 rounded-lg w-1/2 ml-auto" />
                </div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${log.sender_type === "buyer" ? "items-start" : "items-end"}`}
                  >
                    <span className="text-[10px] text-slate-400 mb-1">
                      {log.sender_type === "buyer" ? "Buyer" : "SupplyLah AI"} •{" "}
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm max-w-[90%] ${log.sender_type === "buyer"
                        ? "bg-white border border-slate-200 text-slate-700 rounded-tl-none"
                        : "bg-teal-600 text-white rounded-tr-none"
                        }`}
                    >
                      {log.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Editable Order Form */}
          <div className="w-full md:w-1/2 p-6 flex flex-col space-y-4 overflow-y-auto">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Correct Order Data
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                Order Summary (Auto-calculated)
              </label>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-mono">
                    RM {calcDetails?.subtotal.toFixed(2) || "0.00"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount:</span>
                  <span className="font-mono text-red-500">
                    - RM {calcDetails?.discount.toFixed(2) || "0.00"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Delivery:</span>
                  <span className="font-mono">
                    RM {calcDetails?.delivery.toFixed(2) || "0.00"}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between">
                  <span className="font-bold text-slate-800">Total:</span>
                  <span className="font-bold text-teal-700 tabular-nums">
                    RM {amount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Logic for Minimum Order Value Warning */}
              {isBelowMin && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
                  <p className="text-[11px] text-amber-700 font-bold flex items-center gap-1.5">
                    ⚠️ Below Minimum Order Value (RM 50.00)
                  </p>
                  <p className="text-[10px] text-amber-600 mb-2">
                    This order does not meet the warehouse threshold. To save
                    anyway, please confirm below.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bypassMinOrder}
                      onChange={(e) => setBypassMinOrder(e.target.checked)}
                      className="w-3 h-3 accent-amber-600"
                    />
                    <span className="text-[10px] font-bold text-amber-700 uppercase">
                      Bypass threshold
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                Pipeline Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none"
              >
                <option value="Pending">Pending</option>
                <option value="Awaiting Confirmation">
                  Awaiting Confirmation
                </option>
                <option value="Confirmed">Confirmed</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            <div className="flex-1 flex flex-col">
              <label className="block text-xs font-bold text-slate-500 mb-1">
                Order Metadata (JSON)
              </label>
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                className={`flex-1 w-full p-4 font-mono text-[11px] border rounded-xl outline-none resize-none ${jsonError ? "border-red-500 bg-red-50" : "border-slate-200"}`}
              />
              {jsonError ? (
                <p className="text-[10px] text-red-500 mt-2 font-mono">
                  ❌ Invalid JSON: {jsonError}
                </p>
              ) : (
                <p className="text-[10px] text-green-600 mt-2">
                  ✅ Valid JSON syntax.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-bold text-slate-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !!jsonError || amount < 0 || (isBelowMin && !bypassMinOrder)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-2 rounded-xl text-sm font-bold shadow-lg disabled:opacity-30 disabled:grayscale transition-all"
          >
            {isSaving ? "Saving..." : "Resolve & Save Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
