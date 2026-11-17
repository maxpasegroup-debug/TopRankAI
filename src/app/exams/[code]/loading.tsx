import { PublicShell } from "@/components/platform/PublicShell";

export default function PublicExamDetailLoading() {
  return (
    <PublicShell>
      <section className="tp-section" style={{ paddingBottom: 0 }}>
        <div className="tp-shell" aria-busy="true" aria-label="Loading exam details">
          <div className="tp-skeleton" style={{ width: 150, height: 12, marginBottom: 14 }} />
          <div className="tp-skeleton" style={{ width: "min(520px, 88%)", height: 42, marginBottom: 14 }} />
          <div className="tp-skeleton" style={{ width: "min(680px, 96%)", height: 16, marginBottom: 8 }} />
          <div className="tp-skeleton" style={{ width: "min(560px, 82%)", height: 16, marginBottom: 26 }} />
          <div className="tp-grid tp-grid-3 tp-mb-24">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="tp-card tp-card-pad" key={index}>
                <div className="tp-skeleton" style={{ width: 86, height: 11, marginBottom: 12 }} />
                <div className="tp-skeleton" style={{ width: 60, height: 28 }} />
              </div>
            ))}
          </div>
          <div className="tp-card tp-card-pad">
            {Array.from({ length: 5 }, (_, index) => (
              <div className="tp-skeleton" key={index} style={{ height: 38, marginBottom: 10 }} />
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
