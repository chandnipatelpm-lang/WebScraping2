"use client";
import React from "react";
import { useAppStore } from "@/lib/store";

export function RightPane() {
  const { items, updateItem } = useAppStore();
  return (
    <div className="card p-4 w-[400px] h-[80vh] overflow-auto">
      <div className="font-semibold mb-2">Strings</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Key</th>
            <th className="py-2">Source</th>
            <th className="py-2">Translation</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.key} className="border-b align-top">
              <td className="py-2 pr-2 max-w-[120px] break-words text-neutral-500">{it.key}</td>
              <td className="py-2 pr-2 max-w-[200px] break-words">{it.source}</td>
              <td className="py-2">
                <input
                  className="w-full border rounded px-2 py-1"
                  value={it.target || ""}
                  onChange={(e) => updateItem(it.key, { target: e.target.value, status: "edited" })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
