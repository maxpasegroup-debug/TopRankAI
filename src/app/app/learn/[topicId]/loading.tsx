export default function TopicLoading() {
  return (
    <>
      <div className="tp-skeleton" style={{ width: 260, height: 12, marginBottom: 20 }} />
      <div className="tp-page-head">
        <div style={{ width: "100%" }}>
          <div className="tp-skeleton" style={{ width: 220, height: 24, marginBottom: 12 }} />
          <div className="tp-skeleton" style={{ width: "min(640px, 100%)", height: 14 }} />
        </div>
      </div>
      <div className="tp-dash">
        <div className="tp-stack tp-gap-20">
          {[0, 1, 2].map((index) => (
            <div className="tp-card tp-card-pad" key={index}>
              <div className="tp-skeleton" style={{ width: 180, height: 18, marginBottom: 16 }} />
              {[0, 1, 2, 3, 4].map((row) => (
                <div className="tp-skeleton" key={row} style={{ width: row === 4 ? "60%" : "100%", height: 12, marginBottom: 8 }} />
              ))}
            </div>
          ))}
        </div>
        <aside className="tp-stack tp-gap-20">
          <div className="tp-card tp-card-pad">
            <div className="tp-skeleton" style={{ width: 120, height: 16, marginBottom: 14 }} />
            {[0, 1, 2, 3].map((row) => <div className="tp-skeleton" key={row} style={{ height: 34, marginBottom: 8 }} />)}
          </div>
        </aside>
      </div>
    </>
  );
}
