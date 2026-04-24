"use client";

import { Product } from "@/lib/types";

export default function InventoryPanel({ inventory }: { inventory: Product[] }) {
  const threshold = (p: Product) => p.reorder_threshold ?? 10;
  const isLow     = (p: Product) => p.stock_quantity <= threshold(p);
  const maxQty    = Math.max(...inventory.map(p => p.stock_quantity), 1);
  const lowCount  = inventory.filter(isLow).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Stock Levels</h2>
        {lowCount > 0 && (
          <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
            {lowCount} low
          </span>
        )}
      </div>

      <div className="p-3 space-y-2.5 max-h-64 overflow-y-auto">
        {inventory.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No inventory data</p>
        ) : (
          inventory.map(product => {
            const low      = isLow(product);
            const barWidth = Math.min(100, (product.stock_quantity / maxQty) * 100);
            return (
              <div key={product.product_id}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className={`text-xs font-medium truncate max-w-[140px] ${low ? "text-red-600" : "text-slate-700"}`}>
                    {product.product_name}
                  </span>
                  <span className={`text-xs font-semibold tabular-nums ml-2 shrink-0 ${low ? "text-red-500" : "text-slate-500"}`}>
                    {product.stock_quantity}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${low ? "bg-red-400" : product.stock_quantity < threshold(product) * 2 ? "bg-amber-400" : "bg-teal-500"}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
