type RedditPixelWindow = Window & {
  rdt?: (...args: unknown[]) => void;
};

const leadSessionKey = "jike_reddit_lead_tracked";

export function trackRedditLead() {
  if (typeof window === "undefined") return;

  const redditWindow = window as RedditPixelWindow;
  if (!redditWindow.rdt) return;

  try {
    if (window.sessionStorage.getItem(leadSessionKey)) return;
    redditWindow.rdt("track", "Lead");
    window.sessionStorage.setItem(leadSessionKey, "1");
  } catch {
    redditWindow.rdt("track", "Lead");
  }
}
