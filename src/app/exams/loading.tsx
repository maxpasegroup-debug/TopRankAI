import { PublicShell } from "@/components/platform/PublicShell";

export default function PublicExamsLoading() {
  return (
    <PublicShell>
      <section className="tp-section" style={{ paddingBottom: 0 }}>
        <div className="tp-shell" aria-busy="true" aria-label="Loading exam catalogue">
          <div style={{ maxWidth: 760 }}>
            <div className="tp-skeleton" style={{ width: 130, height: 12, marginBottom: 16 }} />
            <div className="tp-skeleton" style={{ width: "min(560px, 92%)", height: 44, marginBottom: 14 }} />
            <div className="tp-skeleton" style={{ width: "min(680px, 96%)", height: 16, marginBottom: 8 }} />
            <div className="tp-skeleton" style={{ width: "min(520px, 80%)", height: 16 }} />
          </div>
          <div className="tp-skeleton" style={{ height: 48, marginTop: 28, marginBottom: 24 }} />
          <div className="tp-grid tp-grid-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="tp-card tp-card-pad" key={index}>
                <div className="tp-skeleton" style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 16 }} />
                <div className="tp-skeleton" style={{ width: "68%", height: 18, marginBottom: 10 }} />
                <div className="tp-skeleton" style={{ width: "90%", height: 12, marginBottom: 7 }} />
                <div className="tp-skeleton" style={{ width: "74%", height: 12 }} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
