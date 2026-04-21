"use client";

import { Product } from "@/lib/types";

interface Props {
  inventory: Product[];
}

export default function InventoryPanel({ inventory }: Props) {
  const lowStock = inventory.filter((p) => p.stock_quantity <= 10);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
        <span>📦</span> Inventory Status
      </h2>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {inventory.map((product) => {
          const isLow = product.stock_quantity <= 10;
          const barWidth = Math.min(100, (product.stock_quantity / 200) * 100);

          return (
            <div key={product.product_id} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className={`font-medium ${isLow ? "text-red-600" : "text-slate-700"}`}>
                  {isLow ? "⚠ " : ""}{product.product_name}
                </span>
                <span className={`font-bold ${isLow ? "text-red-600" : "text-slate-600"}`}>
                  {product.stock_quantity} units
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isLow ? "bg-red-400" : product.stock_quantity < 30 ? "bg-yellow-400" : "bg-green-400"
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {lowStock.length > 0 && (
        <p className="mt-3 text-xs text-red-600 font-medium">
          {lowStock.length} product{lowStock.length > 1 ? "s" : ""} running low
        </p>
      )}
    </div>
  );
}
