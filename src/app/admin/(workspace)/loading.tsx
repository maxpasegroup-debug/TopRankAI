export default function AdminWorkspaceLoading() {
  return (
    <div aria-busy="true" aria-label="Loading administration page">
      <div className="tp-skeleton" style={{ height: 14, width: 120 }} />
      <div className="tp-skeleton" style={{ height: 38, width: "min(360px, 75%)", marginTop: 14 }} />
      <div className="tp-skeleton" style={{ height: 16, width: "min(520px, 90%)", marginTop: 12 }} />
      <div className="tp-admin-grid" style={{ marginTop: 28 }}>
        {[0, 1, 2, 3].map((item) => (
          <div className="tp-skeleton" style={{ height: 118 }} key={item} />
        ))}
      </div>
      <div className="tp-skeleton" style={{ height: 280, marginTop: 20 }} />
    </div>
  );
}
