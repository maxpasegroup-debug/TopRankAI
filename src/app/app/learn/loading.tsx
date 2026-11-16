export default function LearnLoading() {
  return (
    <>
      <div className="tp-page-head">
        <div style={{ width: "100%" }}>
          <div className="tp-skeleton" style={{ width: 150, height: 12, marginBottom: 12 }} />
          <div className="tp-skeleton" style={{ width: 260, height: 30, marginBottom: 12 }} />
          <div className="tp-skeleton" style={{ width: "min(540px, 100%)", height: 14 }} />
        </div>
      </div>
      <div className="tp-skeleton tp-mb-24" style={{ height: 42, maxWidth: 520 }} />
      <div className="tp-grid tp-grid-4 tp-mb-24">
        {[0, 1, 2, 3].map((index) => (
          <div className="tp-card tp-card-pad" key={index}>
            <div className="tp-skeleton" style={{ width: 84, height: 11, marginBottom: 12 }} />
            <div className="tp-skeleton" style={{ width: 56, height: 28 }} />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((index) => (
        <div className="tp-card tp-card-pad tp-mb-20" key={index}>
          <div className="tp-skeleton" style={{ width: "35%", height: 18, marginBottom: 14 }} />
          {[0, 1, 2, 3].map((row) => (
            <div className="tp-skeleton" key={row} style={{ height: 34, marginBottom: 8 }} />
          ))}
        </div>
      ))}
    </>
  );
}
