"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { toast } from "./AppToaster";

/**
 * Drag-and-drop image uploader backed by the R2 proxy at /api/uploads/avatar.
 *
 * The URL is never typed by hand: dropping, browsing or pasting a file uploads
 * it and returns the public object URL, which the parent form stores.
 */

type Props = {
  value: string;
  onChange: (url: string) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
};

type Config = { configured: boolean; maxBytes: number };

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; percent: number }
  | { kind: "error"; message: string };

export function ImageDropzone({ value, onChange, onBusyChange, disabled = false, compact = false }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [failedPreview, setFailedPreview] = useState(false);

  const busy = status.kind === "uploading";
  const blocked = disabled || busy || config?.configured === false;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/uploads/avatar")
      .then((response) => response.json())
      .then((data: Config) => {
        if (!cancelled) setConfig({ configured: Boolean(data.configured), maxBytes: Number(data.maxBytes) || 0 });
      })
      .catch(() => {
        if (!cancelled) setConfig({ configured: false, maxBytes: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFailedPreview(false);
  }, [value]);

  function upload(file: File) {
    if (blocked) return;
    const maxBytes = config?.maxBytes ?? 2 * 1024 * 1024;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      const message = "Choose a JPEG, PNG or WebP image.";
      setStatus({ kind: "error", message });
      toast.error(message);
      return;
    }
    if (file.size > maxBytes) {
      const message = `Images must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller.`;
      setStatus({ kind: "error", message });
      toast.error(message);
      return;
    }

    setStatus({ kind: "uploading", percent: 0 });

    const body = new FormData();
    body.append("file", file);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/uploads/avatar");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setStatus({ kind: "uploading", percent: Math.min(100, Math.round((event.loaded / event.total) * 100)) });
      }
    };
    request.onload = () => {
      let payload: { url?: string; error?: string } = {};
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        payload = {};
      }
      if (request.status >= 200 && request.status < 300 && payload.url) {
        onChange(payload.url);
        setStatus({ kind: "idle" });
        toast.success("Profile picture uploaded.");
      } else {
        const message = payload.error ?? "The image could not be uploaded.";
        setStatus({ kind: "error", message });
        toast.error(message);
      }
    };
    request.onerror = () => {
      const message = "The upload was interrupted. Check your connection.";
      setStatus({ kind: "error", message });
      toast.error(message);
    };
    request.send(body);
  }

  function choose(files: FileList | null) {
    const file = files?.[0];
    if (file) upload(file);
  }

  return (
    <div className="grid gap-3">
      <div
        className={`relative grid gap-3 rounded-md border border-dashed p-4 transition-colors sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center ${
          dragging ? "border-brand bg-brand-soft" : "border-line bg-surface-2"
        } ${blocked && config?.configured !== false ? "opacity-70" : ""}`}
        onDragOver={(event) => {
          if (blocked) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(event.dataTransfer.files);
        }}
      >
        <div className={`mx-auto grid place-items-center overflow-hidden rounded-full bg-surface-3 text-muted ${compact ? "h-16 w-16" : "h-20 w-20"}`}>
          {value && !failedPreview ? (
            <img
              key={value}
              src={value}
              alt="Selected profile picture"
              className="h-full w-full object-cover"
              onError={() => setFailedPreview(true)}
            />
          ) : (
            <Icon name="user" size={compact ? 24 : 30} />
          )}
        </div>

        <div className="min-w-0 text-center sm:text-left">
          <p className="text-[13.5px] font-semibold text-ink">
            {busy ? `Uploading… ${status.kind === "uploading" ? status.percent : 0}%` : value ? "Profile picture added" : "Drag an image here"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            JPEG, PNG or WebP. Up to 2 MB. It is stored in TopRank&apos;s image storage and shown only inside your account.
          </p>
          {busy ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={status.kind === "uploading" ? status.percent : 0} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${status.kind === "uploading" ? status.percent : 0}%` }} />
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <button
              type="button"
              className="tp-btn tp-btn-soft tp-btn-sm"
              onClick={() => input.current?.click()}
              disabled={blocked}
            >
              <Icon name="upload" size={15} /> {value ? "Replace image" : "Browse files"}
            </button>
            {value ? (
              <button
                type="button"
                className="tp-btn tp-btn-ghost tp-btn-sm"
                onClick={() => {
                  onChange("");
                  setStatus({ kind: "idle" });
                  toast("Profile picture removed.");
                }}
                disabled={disabled || busy}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>

        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            choose(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {config?.configured === false ? (
        <p className="text-xs leading-relaxed text-warn">
          File storage is not configured on this deployment yet, so uploads are disabled. An administrator needs to add
          the storage credentials to the server environment. You can finish your account without a picture and add one
          later.
        </p>
      ) : null}
    </div>
  );
}
