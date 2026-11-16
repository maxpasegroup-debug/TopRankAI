import Link from "next/link";
import { Icon, type IconName } from "@/components/platform/Icon";
import { PublicShell } from "@/components/platform/PublicShell";

export const metadata = {
  title: "Contact",
  description: "How to reach the TopRank AI team for support, content corrections and privacy requests.",
};

const channels: { icon: IconName; title: string; body: string; action: string; href: string }[] = [
  {
    icon: "mail",
    title: "Product support",
    body: "Account access, exam selection, a paper that will not load, or anything that looks broken.",
    action: "support@toprank.ai",
    href: "mailto:support@toprank.ai?subject=TopRank%20support",
  },
  {
    icon: "edit",
    title: "Content corrections",
    body: "A question that is wrong, an explanation that needs work, or a syllabus topic that belongs elsewhere.",
    action: "content@toprank.ai",
    href: "mailto:content@toprank.ai?subject=Content%20correction",
  },
  {
    icon: "shield",
    title: "Privacy & account data",
    body: "Access, correction or deletion requests for your personal data.",
    action: "privacy@toprank.ai",
    href: "mailto:privacy@toprank.ai?subject=Privacy%20request",
  },
];

export default function ContactPage() {
  return (
    <PublicShell>
      <section className="tp-section" style={{ paddingBottom: 0 }}>
        <div className="tp-shell">
          <div className="tp-section-head" style={{ maxWidth: 720 }}>
            <span className="tp-eyebrow">Contact</span>
            <h1 style={{ fontSize: "clamp(32px, 4.4vw, 52px)", letterSpacing: "-0.035em", margin: "14px 0" }}>
              Reach the people behind <span className="tp-gradient-text">the loop.</span>
            </h1>
            <p className="tp-lede">
              These are monitored mailboxes, not decorative forms. Include your account email and, for
              content issues, the exam and question code shown in the review screen.
            </p>
          </div>
        </div>
      </section>

      <section className="tp-section">
        <div className="tp-shell tp-grid tp-grid-3">
          {channels.map((channel) => (
            <article className="tp-card tp-card-pad tp-card-lift" key={channel.title} data-reveal>
              <span className="tp-feature-icon"><Icon name={channel.icon} /></span>
              <h3 style={{ fontSize: 19, marginBottom: 8 }}>{channel.title}</h3>
              <p className="tp-small tp-muted" style={{ lineHeight: 1.6 }}>{channel.body}</p>
              <a className="tp-btn tp-btn-soft tp-btn-sm tp-mt-24" href={channel.href}>{channel.action}</a>
            </article>
          ))}
        </div>
      </section>

      <section className="tp-section" style={{ paddingTop: 0 }}>
        <div className="tp-shell">
          <div className="tp-card tp-card-pad">
            <div className="tp-grid tp-grid-2">
              <div>
                <h2 style={{ fontSize: 24, letterSpacing: "-0.03em", marginBottom: 10 }}>Registered entity</h2>
                <p className="tp-small tp-muted" style={{ lineHeight: 1.7 }}>
                  TOP RANK AI PRIVATE LIMITED<br />
                  India<br />
                  Operating the TopRank AI exam preparation platform.
                </p>
              </div>
              <div>
                <h2 style={{ fontSize: 24, letterSpacing: "-0.03em", marginBottom: 10 }}>Data requests</h2>
                <p className="tp-small tp-muted" style={{ lineHeight: 1.7 }}>
                  Signed-in candidates can raise a privacy request from the account area. Include your
                  registered email when contacting us directly.
                </p>
                <div className="tp-row tp-gap-8 tp-wrap tp-mt-16">
                  <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/privacy">Privacy notice</Link>
                  <Link className="tp-btn tp-btn-ghost tp-btn-sm" href="/terms">Terms of use</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="tp-note tp-mt-24">
            <strong>Response times.</strong> Support and content mailboxes are reviewed on working days.
            Content corrections that affect a live question are treated as priority because they can
            change a candidate&apos;s recorded score in a future paper.
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
