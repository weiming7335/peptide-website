import type { Metadata } from "next";
import Script from "next/script";
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
  return <html lang="en"><body>{children}<Script
    id="reddit-pixel"
    strategy="afterInteractive"
    dangerouslySetInnerHTML={{ __html: `
      !function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js";t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
      rdt("init","a2_jfbcik3stp9f");
      rdt("track","PageVisit");
    ` }}
  /></body></html>;
}
