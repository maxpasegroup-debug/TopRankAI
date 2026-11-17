"use client";

import { useEffect } from "react";
import { toast } from "./AppToaster";

/**
 * Converts a component's existing message/error state into toasts and clears
 * the state afterwards. Keeps older admin forms working without rewriting each
 * success and failure branch.
 */
export function useToastFeedback(
  message: string | null,
  setMessage: (value: string | null) => void,
  error: string | null,
  setError: (value: string | null) => void,
) {
  useEffect(() => {
    if (!message) return;
    toast.success(message);
    setMessage(null);
  }, [message, setMessage]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
    setError(null);
  }, [error, setError]);
}
