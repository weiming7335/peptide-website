type GoogleAdsWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

const quoteFormConversion = "AW-18358283872/beLCCMa_-dgcEODc9LFE";

export function trackGoogleQuoteFormConversion() {
  if (typeof window === "undefined") return;

  const googleWindow = window as GoogleAdsWindow;
  googleWindow.gtag?.("event", "conversion", {
    send_to: quoteFormConversion,
    value: 1,
    currency: "USD",
  });
}
