export default function PlannerLoading() {
  return (
    <>
      <div className="tp-page-head">
        <div style={{ width: "100%" }}>
          <div className="tp-skeleton" style={{ width: 130, height: 12, marginBottom: 12 }} />
          <div className="tp-skeleton" style={{ width: 220, height: 30, marginBottom: 12 }} />
          <div className="tp-skeleton" style={{ width: "min(520px, 100%)", height: 14 }} />
        </div>
      </div>
      <div className="tp-grid tp-grid-2" style={{ alignItems: "start" }}>
        {[0, 1].map((column) => (
          <div className="tp-card tp-card-pad" key={column}>
            <div className="tp-skeleton" style={{ width: 160, height: 18, marginBottom: 16 }} />
            {[0, 1, 2, 3, 4].map((row) => (
              <div className="tp-skeleton" key={row} style={{ height: 40, marginBottom: 10 }} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
