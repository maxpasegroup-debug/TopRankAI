"use client";

import { Icon } from "../Icon";

export type TimeNoticeLevel = "info" | "warn" | "danger" | "critical" | "over";

export type TimerNoticeData = {
  id: number;
  level: TimeNoticeLevel;
  title: string;
  detail: string;
};

function Mascot({ level }: { level: TimeNoticeLevel }) {
  const panicking = level === "danger" || level === "critical" || level === "over";
  const worried = level === "warn";
  const dizzy = level === "over";

  return (
    <svg className="tp-mascot" data-level={level} viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      {/* alarm-clock bells and feet */}
      <g className="tp-mascot-lines">
        <path d="M24 27 17 21M56 27l7-6" />
        <circle cx="24" cy="26" r="5.5" />
        <circle cx="56" cy="26" r="5.5" />
        <path d="M34 65v7M46 65v7" />
      </g>

      <circle className="tp-mascot-face" cx="40" cy="45" r="20" />

      {/* clock hands stay visible so it still reads as a clock */}
      <g className="tp-mascot-hands">
        <path d="M40 31v14l7 4" />
      </g>

      {/* arms react to the pressure */}
      <g className="tp-mascot-lines">
        {panicking ? <path d="M21 41 13 33M59 41l8-8" /> : <path d="M21 49l-7 6M59 49l7 6" />}
      </g>

      {dizzy ? (
        <g className="tp-mascot-lines">
          <path d="M30 41a3.4 3.4 0 1 0 3.4 3.4M50 41a3.4 3.4 0 1 1-3.4 3.4" />
        </g>
      ) : panicking ? (
        <g className="tp-mascot-lines">
          <path d="M30 39l7 7M37 39l-7 7M43 39l7 7M50 39l-7 7" />
        </g>
      ) : (
        <g className="tp-mascot-eyes">
          <circle cx="33" cy="44" r={worried ? 3.4 : 2.8} />
          <circle cx="47" cy="44" r={worried ? 3.4 : 2.8} />
          {worried ? <path className="tp-mascot-lines" d="M28.5 37.5 36 40M51.5 37.5 44 40" /> : null}
        </g>
      )}

      {panicking ? (
        <ellipse className="tp-mascot-mouth" cx="40" cy="55" rx="4.6" ry="5.4" />
      ) : worried ? (
        <path className="tp-mascot-lines" d="M34 56q6-5 12 0" />
      ) : (
        <path className="tp-mascot-lines" d="M34 53q6 5 12 0" />
      )}

      {panicking || worried ? (
        <g className="tp-mascot-sweat">
          <path d="M62 33c2.6 4 3.6 6.2 0 7.2-3.6-1-2.6-3.2 0-7.2z" />
          {panicking ? <path d="M17 30c2.2 3.4 3 5.2 0 6-3-.8-2.2-2.6 0-6z" /> : null}
        </g>
      ) : null}

      {panicking ? (
        <g className="tp-mascot-speed">
          <path d="M6 36h7M4 44h6M7 52h5" />
        </g>
      ) : null}
    </svg>
  );
}

export function TimerNotice({ notice, onDismiss }: { notice: TimerNoticeData; onDismiss: () => void }) {
  return (
    <div className="tp-time-alert" data-level={notice.level} role="alert">
      <span className="tp-time-alert-figure">
        <Mascot level={notice.level} />
      </span>
      <div className="tp-time-alert-body">
        <strong>{notice.title}</strong>
        <span>{notice.detail}</span>
      </div>
      <button type="button" className="tp-time-alert-close" onClick={onDismiss} aria-label="Dismiss time warning">
        <Icon name="x" size={13} />
      </button>
      <span className="tp-time-alert-meter" aria-hidden="true" />
    </div>
  );
}
