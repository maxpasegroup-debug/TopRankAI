import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import "./../styles/global.css";
import "./../styles/experience.css";
import "./../styles/platform.css";

// Fonts are vendored so the app does not need to reach Google Fonts at build or
// request time. The latin-ext files cover ₹ and other extended Latin glyphs.
const jakarta = localFont({
  src: [
    { path: "./fonts/plus-jakarta-sans-latin.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-jakarta",
  display: "swap",
  adjustFontFallback: false,
});

const jakartaExt = localFont({
  src: [
    { path: "./fonts/plus-jakarta-sans-latin-ext.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-jakarta-ext",
  display: "swap",
  adjustFontFallback: false,
});

const bricolage = localFont({
  src: [
    { path: "./fonts/bricolage-grotesque-latin.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-bricolage",
  display: "swap",
  adjustFontFallback: false,
});

const bricolageExt = localFont({
  src: [
    { path: "./fonts/bricolage-grotesque-latin-ext.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-bricolage-ext",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: {
    default: "TopRank AI — Daily exam preparation for India",
    template: "%s · TopRank AI",
  },
  description:
    "Choose your exams, sit a real daily paper, and get deterministic scoring, syllabus tracking and honest readiness analytics. Built for Indian competitive exams.",
  applicationName: "TopRank AI",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "TopRank AI — Daily exam preparation for India",
    description:
      "A daily preparation loop for Indian competitive exams: real papers, deterministic scoring and honest progress analytics.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0a12" },
  ],
};

const THEME_COOKIE = "toprank_theme";

function resolveTheme(value: string | undefined): "light" | "dark" | "system" {
  return value === "light" || value === "dark" ? value : "system";
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const theme = resolveTheme(store.get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${jakartaExt.variable} ${bricolage.variable} ${bricolageExt.variable}`}
      data-theme={theme}
      suppressHydrationWarning
    >
      <body className="body-platform">
        <a className="tp-skip" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
