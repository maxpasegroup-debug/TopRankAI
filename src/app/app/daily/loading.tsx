export default function DailyLoading() {
  return (
    <>
      <div className="tp-page-head">
        <div style={{ width: "100%" }}>
          <div className="tp-skeleton" style={{ width: 120, height: 12, marginBottom: 12 }} />
          <div className="tp-skeleton" style={{ width: 240, height: 30, marginBottom: 12 }} />
          <div className="tp-skeleton" style={{ width: "min(540px, 100%)", height: 14 }} />
        </div>
      </div>
      <div className="tp-grid tp-grid-3 tp-mb-24">
        {[0, 1, 2].map((index) => (
          <div className="tp-card tp-card-pad" key={index}>
            <div className="tp-skeleton" style={{ width: 90, height: 12, marginBottom: 14 }} />
            <div className="tp-skeleton" style={{ width: 70, height: 30 }} />
          </div>
        ))}
      </div>
      <div className="tp-card tp-card-pad">
        {[0, 1, 2, 3].map((index) => (
          <div className="tp-row-between" key={index} style={{ padding: "14px 0", borderBottom: index < 3 ? "1px solid var(--tp-line)" : 0 }}>
            <div className="tp-stack tp-gap-8" style={{ flex: 1 }}>
              <div className="tp-skeleton" style={{ width: "45%", height: 14 }} />
              <div className="tp-skeleton" style={{ width: "30%", height: 11 }} />
            </div>
            <div className="tp-skeleton" style={{ width: 92, height: 32 }} />
          </div>
        ))}
      </div>
    </>
  );
}
