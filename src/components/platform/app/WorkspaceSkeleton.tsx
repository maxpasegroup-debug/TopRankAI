import type { ReactNode } from "react";

type Variant = "list" | "grid" | "form" | "charts" | "player";

function Header() {
  return (
    <div className="tp-page-head">
      <div style={{ width: "100%" }}>
        <div className="tp-skeleton" style={{ width: 130, height: 12, marginBottom: 12 }} />
        <div className="tp-skeleton" style={{ width: "min(300px, 70%)", height: 32, marginBottom: 12 }} />
        <div className="tp-skeleton" style={{ width: "min(560px, 94%)", height: 14 }} />
      </div>
    </div>
  );
}

function Stats({ count = 3 }: { count?: number }) {
  return (
    <div className="tp-grid tp-grid-3 tp-mb-24">
      {Array.from({ length: count }, (_, index) => (
        <div className="tp-card tp-card-pad" key={index}>
          <div className="tp-skeleton" style={{ width: 88, height: 12, marginBottom: 14 }} />
          <div className="tp-skeleton" style={{ width: 64, height: 30, marginBottom: 10 }} />
          <div className="tp-skeleton" style={{ width: "70%", height: 11 }} />
        </div>
      ))}
    </div>
  );
}

function ListCard({ rows = 4 }: { rows?: number }) {
  return (
    <div className="tp-card tp-card-pad">
      <div className="tp-skeleton" style={{ width: 130, height: 16, marginBottom: 16 }} />
      {Array.from({ length: rows }, (_, index) => (
        <div
          className="tp-row-between"
          key={index}
          style={{ padding: "13px 0", borderBottom: index < rows - 1 ? "1px solid var(--tp-line)" : 0 }}
        >
          <div className="tp-stack tp-gap-8" style={{ flex: 1 }}>
            <div className="tp-skeleton" style={{ width: `${58 - (index % 3) * 8}%`, height: 13 }} />
            <div className="tp-skeleton" style={{ width: "34%", height: 11 }} />
          </div>
          <div className="tp-skeleton" style={{ width: 88, height: 30 }} />
        </div>
      ))}
    </div>
  );
}

function FormCard({ fields = 8 }: { fields?: number }) {
  return (
    <div className="tp-card tp-card-pad">
      <div className="tp-skeleton" style={{ width: 150, height: 18, marginBottom: 8 }} />
      <div className="tp-skeleton" style={{ width: "52%", height: 11, marginBottom: 20 }} />
      <div className="tp-form-grid">
        {Array.from({ length: fields }, (_, index) => (
          <div className="tp-field" key={index}>
            <div className="tp-skeleton" style={{ width: 90, height: 11, marginBottom: 8 }} />
            <div className="tp-skeleton" style={{ height: 42 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkspaceSkeleton({ variant = "list" }: { variant?: Variant }) {
  let body: ReactNode;
  if (variant === "charts") {
    body = (
      <>
        <Stats count={4} />
        <div className="tp-grid tp-grid-2">
          <div className="tp-card tp-card-pad">
            <div className="tp-skeleton" style={{ width: 160, height: 16, marginBottom: 18 }} />
            <div className="tp-skeleton" style={{ height: 230 }} />
          </div>
          <div className="tp-card tp-card-pad">
            <div className="tp-skeleton" style={{ width: 140, height: 16, marginBottom: 18 }} />
            <div className="tp-skeleton" style={{ height: 230 }} />
          </div>
        </div>
      </>
    );
  } else if (variant === "grid") {
    body = (
      <>
        <Stats />
        <div className="tp-grid tp-grid-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="tp-card tp-card-pad" key={index}>
              <div className="tp-skeleton" style={{ width: 42, height: 42, borderRadius: 999, marginBottom: 14 }} />
              <div className="tp-skeleton" style={{ width: "70%", height: 15, marginBottom: 8 }} />
              <div className="tp-skeleton" style={{ width: "48%", height: 11 }} />
            </div>
          ))}
        </div>
      </>
    );
  } else if (variant === "form") {
    body = (
      <div className="tp-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <FormCard />
        <FormCard fields={4} />
      </div>
    );
  } else if (variant === "player") {
    body = (
      <div className="tp-player">
        <div className="tp-stack tp-gap-16">
          <div className="tp-card tp-card-pad">
            <div className="tp-skeleton" style={{ width: "55%", height: 14, marginBottom: 14 }} />
            <div className="tp-skeleton" style={{ height: 8 }} />
          </div>
          <div className="tp-card tp-card-pad" style={{ minHeight: 420 }}>
            <div className="tp-skeleton" style={{ width: 110, height: 24, marginBottom: 22 }} />
            <div className="tp-skeleton" style={{ width: "92%", height: 20, marginBottom: 10 }} />
            <div className="tp-skeleton" style={{ width: "74%", height: 20, marginBottom: 26 }} />
            {Array.from({ length: 4 }, (_, index) => (
              <div className="tp-skeleton" key={index} style={{ height: 52, marginBottom: 10 }} />
            ))}
          </div>
        </div>
        <aside className="tp-card tp-card-pad">
          <div className="tp-skeleton" style={{ width: 120, height: 15, marginBottom: 14 }} />
          <div className="tp-palette-grid">
            {Array.from({ length: 25 }, (_, index) => (
              <div className="tp-skeleton" key={index} style={{ aspectRatio: "1" }} />
            ))}
          </div>
          <div className="tp-skeleton" style={{ height: 38, marginTop: 18 }} />
        </aside>
      </div>
    );
  } else {
    body = (
      <>
        <Stats />
        <ListCard />
      </>
    );
  }

  return (
    <div aria-busy="true" aria-label="Loading page">
      <Header />
      {body}
    </div>
  );
}
