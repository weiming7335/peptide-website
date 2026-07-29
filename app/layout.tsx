import type { Metadata } from "next";
import "./globals.css";
import "./red-theme.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jikepeptide.bio"),
  title: { default: "Jike Peptide | Research Peptide Supply", template: "%s | Jike Peptide" },
  description: "Research peptide kits, batch-linked third-party COA verification, worldwide delivery and custom packaging support from Jike Peptide Team.",
  robots: { index: true, follow: true },
  openGraph: { title: "Jike Peptide", description: "Research peptide supply with third-party COA verification.", url: "https://jikepeptide.bio", siteName: "Jike Peptide", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
