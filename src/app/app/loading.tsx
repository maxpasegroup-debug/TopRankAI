export default function AppWorkspaceLoading() {
  return (
    <div aria-busy="true" aria-label="Loading workspace page">
      <div className="tp-skeleton" style={{ height: 14, width: 150 }} />
      <div className="tp-skeleton" style={{ height: 38, width: "min(380px, 78%)", marginTop: 14 }} />
      <div className="tp-skeleton" style={{ height: 16, width: "min(540px, 92%)", marginTop: 12 }} />
      <div className="tp-grid tp-grid-3" style={{ marginTop: 28 }}>
        {[0, 1, 2].map((item) => (
          <div className="tp-skeleton" style={{ height: 142 }} key={item} />
        ))}
      </div>
      <div className="tp-skeleton" style={{ height: 280, marginTop: 20 }} />
    </div>
  );
}
