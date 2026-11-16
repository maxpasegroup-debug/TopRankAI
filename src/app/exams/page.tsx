import Link from "next/link";
import { ExamCard } from "@/components/platform/ExamCard";
import { Icon } from "@/components/platform/Icon";
import { PublicShell } from "@/components/platform/PublicShell";
import { getPublicCatalogue } from "@/server/platform/public";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Exam catalogue",
  description: "Browse engineering, medical, law, management, civil services, banking, defence, design and research entrance exams.",
};

export default async function ExamsPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const { category, q } = await searchParams;
  const catalogue = await getPublicCatalogue();
  const query = (q ?? "").trim().toLowerCase();
  const filtered = catalogue.exams.filter((exam) => {
    const matchesCategory = !category || exam.categorySlug === category;
    const matchesQuery = !query || `${exam.name} ${exam.code} ${exam.subjectNames.join(" ")}`.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  return (
    <PublicShell>
      <section className="tp-section" style={{ paddingBottom: 0 }}>
        <div className="tp-shell">
          <div className="tp-section-head" style={{ maxWidth: 760 }}>
            <span className="tp-eyebrow">Exam catalogue</span>
            <h1 style={{ fontSize: "clamp(32px, 4.4vw, 52px)", letterSpacing: "-0.035em", margin: "14px 0" }}>
              Every pathway has a <span className="tp-gradient-text">daily loop.</span>
            </h1>
            <p className="tp-lede">
              Choose the exam you are preparing for. Each pathway carries its own syllabus, marking
              model and reviewed question bank. Patterns change — always confirm the current bulletin
              on the official website.
            </p>
          </div>

          <form className="tp-row tp-gap-12 tp-wrap" method="get" style={{ marginBottom: 24 }}>
            <div className="tp-grow" style={{ minWidth: 220 }}>
              <label className="tp-sr" htmlFor="exam-search">Search exams</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: 14, color: "var(--tp-faint)" }}>
                  <Icon name="search" size={18} />
                </span>
                <input
                  id="exam-search"
                  name="q"
                  defaultValue={q ?? ""}
                  className="tp-input"
                  style={{ paddingLeft: 42 }}
                  placeholder="Search by exam or subject…"
                />
              </div>
            </div>
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <button className="tp-btn" type="submit">Search</button>
            {q || category ? <Link className="tp-btn tp-btn-ghost" href="/exams">Clear</Link> : null}
          </form>

          <div className="tp-cat-strip" style={{ marginBottom: 34 }}>
            <Link className="tp-cat-chip" data-active={!category} href="/exams">All exams</Link>
            {catalogue.categories.map((item) => (
              <Link className="tp-cat-chip" data-active={category === item.slug} href={`/exams?category=${item.slug}`} key={item.slug}>
                {item.name} <span style={{ opacity: 0.6 }}>{item.count}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="tp-section" style={{ paddingTop: 0 }}>
        <div className="tp-shell">
          {filtered.length ? (
            <div className="tp-grid tp-grid-3">
              {filtered.map((exam) => <ExamCard exam={exam} key={exam.code} />)}
            </div>
          ) : (
            <div className="tp-empty">
              <span className="tp-feature-icon" style={{ margin: 0 }}><Icon name="search" /></span>
              <h3>No exam matched that search</h3>
              <p>Try a different subject, or browse the full catalogue. New pathways are added as their syllabus is verified.</p>
              <Link className="tp-btn tp-btn-soft" href="/exams">Reset filters</Link>
            </div>
          )}
        </div>
      </section>

      <section className="tp-section" style={{ paddingTop: 0 }}>
        <div className="tp-shell">
          <div className="tp-note" style={{ maxWidth: 820 }}>
            <strong>About this catalogue.</strong> Exam names, papers and marking notes are curated from
            publicly published official information. There is no single free official API for every
            Indian exam syllabus or date, so dates are shown only when an administrator records a
            verified source. Exam dates that are not confirmed are never invented.
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
