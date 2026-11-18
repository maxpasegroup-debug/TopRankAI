"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";

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
  const scrollAfterRender = useRef(false);

  useEffect(() => {
    if (!scrollAfterRender.current) return;
    scrollAfterRender.current = false;
    document.getElementById("review")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  if (totalPages <= 1) return null;

  function go(event: MouseEvent<HTMLAnchorElement>, target: number) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (target === page) return;
    scrollAfterRender.current = true;
    router.push(`${baseHref}?page=${target}#review`, { scroll: false });
  }

  return (
    <nav className="tp-pager" aria-label="Question review pages">
      {page > 1 ? (
        <Link className="tp-pager-link" href={`${baseHref}?page=${page - 1}#review`} rel="prev" onClick={(event) => go(event, page - 1)}>
          Previous
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
            onClick={(event) => go(event, value)}
          >
            {value}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link className="tp-pager-link" href={`${baseHref}?page=${page + 1}#review`} rel="next" onClick={(event) => go(event, page + 1)}>
          Next
        </Link>
      ) : (
        <span className="tp-pager-link" data-disabled="true">Next</span>
      )}
    </nav>
  );
}
