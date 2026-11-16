import { LogoMark } from "@/components/platform/Logo";

export function Brand() {
  return (
    <a className="brand-lockup" href="/home" aria-label="TopRank home">
      <span className="brand-mark"><LogoMark size={22} /></span>
      <span>
        <p className="brand-name">TopRank</p>
        <p className="brand-tagline">Your preparation workspace</p>
      </span>
    </a>
  );
}
