"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function Motion({ children, className = "" }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.from("[data-enter]", { y: 30, opacity: 0, stagger: .1, duration: .8, ease: "power3.out", clearProps: "all" });
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach(element => gsap.from(element, { y: 35, opacity: 0, duration: .7, ease: "power2.out", scrollTrigger: { trigger: element, start: "top 92%", once: true }, clearProps: "all" }));
        gsap.to("[data-float]", { y: -14, rotation: 2, duration: 3, repeat: -1, yoyo: true, ease: "sine.inOut" });
      }, root);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);
  return <div ref={root} className={`rank ${className}`}>{children}</div>;
}
