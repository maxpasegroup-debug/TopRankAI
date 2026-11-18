"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Icon } from "../Icon";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className, style, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input
        {...props}
        className={className}
        style={{ paddingRight: 46, ...style }}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          width: 32,
          height: 32,
          display: "grid",
          placeItems: "center",
          border: 0,
          background: "transparent",
          color: "currentColor",
          opacity: 0.7,
          cursor: "pointer",
        }}
      >
        <Icon name={visible ? "eye-off" : "eye"} size={17} />
      </button>
    </div>
  );
}
