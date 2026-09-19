export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

type Listener = (item: ToastItem) => void;
let listeners: Listener[] = [];
let nextId = 1;

/** Fire a toast from anywhere. Rendered by <ToastHost /> mounted in Shell. */
export function toast(message: string, type: ToastType = "info") {
  const item: ToastItem = { id: nextId++, message, type };
  listeners.forEach((listener) => listener(item));
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}
