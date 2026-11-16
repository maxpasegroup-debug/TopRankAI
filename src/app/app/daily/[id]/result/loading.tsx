export default function ResultLoading() {
  return (
    <>
      <div className="tp-page-head">
        <div style={{ width: "100%" }}>
          <div className="tp-skeleton" style={{ width: 160, height: 12, marginBottom: 12 }} />
          <div className="tp-skeleton" style={{ width: "min(480px, 100%)", height: 30, marginBottom: 12 }} />
          <div className="tp-skeleton" style={{ width: 280, height: 14 }} />
        </div>
      </div>
      <div className="tp-card tp-card-pad tp-mb-24">
        <div className="tp-row tp-gap-24">
          <div className="tp-skeleton" style={{ width: 140, height: 140, borderRadius: "50%" }} />
          <div className="tp-stack tp-gap-12" style={{ flex: 1 }}>
            <div className="tp-skeleton" style={{ width: 120, height: 18 }} />
            <div className="tp-skeleton" style={{ width: "60%", height: 28 }} />
            <div className="tp-skeleton" style={{ width: "80%", height: 14 }} />
          </div>
        </div>
      </div>
      <div className="tp-card tp-card-pad">
        {[0, 1, 2, 3, 4].map((index) => (
          <div className="tp-stack tp-gap-8" key={index} style={{ padding: "14px 0", borderBottom: index < 4 ? "1px solid var(--tp-line)" : 0 }}>
            <div className="tp-skeleton" style={{ width: "70%", height: 14 }} />
            <div className="tp-skeleton" style={{ width: "40%", height: 11 }} />
          </div>
        ))}
      </div>
    </>
  );
}
