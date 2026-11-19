import Link from "next/link";
import { Icon } from "../Icon";

export function ProUpsell({
  title,
  body,
  points,
  compact = false,
}: {
  title: string;
  body: string;
  points?: string[];
  compact?: boolean;
}) {
  return (
    <section className={`tp-pro-upsell ${compact ? "tp-pro-upsell-compact" : ""}`}>
      <div className="tp-pro-upsell-glow" aria-hidden="true" />
      <div className="tp-pro-upsell-copy">
        <span className="tp-pro-badge"><Icon name="crown" size={12} /> Paid plans</span>
        <h3>{title}</h3>
        <p>{body}</p>
        {points?.length ? (
          <ul>
            {points.map((point) => (
              <li key={point}><Icon name="check" size={13} /> {point}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <Link className="tp-btn tp-btn-sm tp-pro-upsell-cta" href="/app/subscriptions">
        See plans <Icon name="arrow-right" size={14} />
      </Link>
    </section>
  );
}
