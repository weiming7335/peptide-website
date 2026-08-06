import type { Metadata } from "next";
import { FloatingWhatsapp } from "@/components/floating-whatsapp";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jikepeptide.bio"),
  title: { default: "Jike Peptide | Products, Testing & Brand Support", template: "%s | Jike Peptide" },
  description: "Research material supply, independent third-party testing, OEM, private label, packaging, brand design and international fulfillment from Jike Peptide.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Jike Peptide",
    description: "You focus on sales. We support the rest.",
    url: "https://jikepeptide.bio",
    siteName: "Jike Peptide",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SiteHeader /><main>{children}</main><SiteFooter /><FloatingWhatsapp /></body></html>;
}
