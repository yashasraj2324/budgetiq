"use client";
import { useEffect, useState } from "react";
import { subscribeToasts, ToastItem, ToastType } from "@/lib/toast";

const typeStyles: Record<ToastType, string> = {
  success: "bg-success-container text-on-success-container border-success/20",
  error: "bg-error-container text-on-error-container border-error/20",
  info: "bg-surface-container-high text-on-surface border-outline-variant",
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToasts((item) => {
      setItems((previous) => [...previous.slice(-2), item]);
      window.setTimeout(() => {
        setItems((previous) => previous.filter((existing) => existing.id !== item.id));
      }, 3500);
    });
    return unsubscribe;
  }, []);

  if (!items.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          role={item.type === "error" ? "alert" : "status"}
          className={`px-space-md py-2 rounded-lg shadow-md border text-sm font-body-md max-w-xs ${typeStyles[item.type]}`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
