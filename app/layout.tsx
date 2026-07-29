import type { Metadata } from "next";
import "./globals.css";
import "./red-theme.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jikepeptide.bio"),
  title: { default: "Jike Peptide | Research Peptide Supply", template: "%s | Jike Peptide" },
  description: "B2B research peptide supply, batch-linked third-party COA verification, worldwide fulfillment and private-label support from Jike Peptide Team.",
  robots: { index: true, follow: true },
  openGraph: { title: "Jike Peptide", description: "B2B research peptide supply with batch-linked analytical documentation.", url: "https://jikepeptide.bio", siteName: "Jike Peptide", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
