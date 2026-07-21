import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leaxion Peptide | High-Purity Peptide Supplier",
  description: "Reliable high-purity peptide manufacturing, custom supply and worldwide B2B delivery for professional research partners.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
