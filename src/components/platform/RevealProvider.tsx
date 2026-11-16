"use client";

import { useEffect } from "react";

/**
 * Progressive reveal for elements marked with data-reveal.
 *
 * GSAP is loaded lazily so the first paint never waits on it. If the reduced
 * motion preference is set, or the animation library fails to load, content
 * stays fully visible and only a subtle CSS fade is applied.
 */
export function RevealProvider() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (media.matches || elements.length === 0) {
      elements.forEach((element) => element.setAttribute("data-visible", "true"));
      return;
    }

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);

        const context = gsap.context(() => {
          elements.forEach((element) => {
            const delay = Number(element.dataset.revealDelay ?? 0);
            gsap.fromTo(
              element,
              { autoAlpha: 0, y: 22 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                delay,
                ease: "power3.out",
                scrollTrigger: { trigger: element, start: "top 88%", once: true },
                onStart: () => element.setAttribute("data-visible", "true"),
              },
            );
          });
        });

        cleanup = () => context.revert();
      } catch {
        elements.forEach((element) => element.setAttribute("data-visible", "true"));
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
