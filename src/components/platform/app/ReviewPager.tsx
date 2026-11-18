"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { MouseEvent, ReactNode } from "react";

type LoadingControl = { page: number; kind: "prev" | "next" | "page" };

function pageNumbers(page: number, totalPages: number) {
  const numbers: (number | "gap")[] = [];
  for (let value = 1; value <= totalPages; value += 1) {
    const near = Math.abs(value - page) <= 2 || value === 1 || value === totalPages;
    if (near) {
      numbers.push(value);
    } else if (numbers[numbers.length - 1] !== "gap") {
      numbers.push("gap");
    }
  }
  return numbers;
}

export function ReviewPager({
  page,
  totalPages,
  baseHref,
}: {
  page: number;
  totalPages: number;
  baseHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState<LoadingControl | null>(null);
  const scrollAfterRender = useRef(false);

  useEffect(() => {
    if (loading === null) return;
    if (loading.page === page) {
      setLoading(null);
      return;
    }
    // A failed or interrupted navigation must not leave a spinner running forever.
    const timer = window.setTimeout(() => setLoading(null), 12000);
    return () => window.clearTimeout(timer);
  }, [loading, page]);

  useEffect(() => {
    if (!scrollAfterRender.current) return;
    scrollAfterRender.current = false;
    document.getElementById("review")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  if (totalPages <= 1) return null;

  function go(event: MouseEvent<HTMLAnchorElement>, target: number, kind: LoadingControl["kind"]) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (target === page || loading !== null) return;
    scrollAfterRender.current = true;
    setLoading({ page: target, kind });
    startTransition(() => {
      router.push(`${baseHref}?page=${target}#review`, { scroll: false });
    });
  }

  const busy = loading !== null;
  const spinner = <span className="tp-spinner" aria-hidden="true" />;
  const label = (text: ReactNode, hidden: boolean) => (
    <span className="tp-pager-text" data-hidden={hidden ? "true" : undefined}>{text}</span>
  );

  return (
    <nav className="tp-pager" aria-label="Question review pages" aria-busy={isPending || busy}>
      {page > 1 ? (
        <Link
          className="tp-pager-link"
          href={`${baseHref}?page=${page - 1}#review`}
          rel="prev"
          data-busy={loading?.kind === "prev" ? "true" : undefined}
          aria-disabled={busy}
          onClick={(event) => go(event, page - 1, "prev")}
        >
          {label("Previous", loading?.kind === "prev")}
          {loading?.kind === "prev" ? spinner : null}
        </Link>
      ) : (
        <span className="tp-pager-link" data-disabled="true">Previous</span>
      )}
      {pageNumbers(page, totalPages).map((value, index) =>
        value === "gap" ? (
          <span className="tp-pager-gap" key={`gap-${index}`}>…</span>
        ) : (
          <Link
            className="tp-pager-link"
            href={`${baseHref}?page=${value}#review`}
            key={value}
            aria-current={value === page ? "page" : undefined}
            data-active={value === page ? "true" : undefined}
            data-busy={loading?.kind === "page" && loading.page === value ? "true" : undefined}
            aria-disabled={busy}
            onClick={(event) => go(event, value, "page")}
          >
            {label(value, loading?.kind === "page" && loading.page === value)}
            {loading?.kind === "page" && loading.page === value ? spinner : null}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link
          className="tp-pager-link"
          href={`${baseHref}?page=${page + 1}#review`}
          rel="next"
          data-busy={loading?.kind === "next" ? "true" : undefined}
          aria-disabled={busy}
          onClick={(event) => go(event, page + 1, "next")}
        >
          {label("Next", loading?.kind === "next")}
          {loading?.kind === "next" ? spinner : null}
        </Link>
      ) : (
        <span className="tp-pager-link" data-disabled="true">Next</span>
      )}
    </nav>
  );
}
