"use client";

import { useEffect } from "react";
import { trackRedditLead } from "@/lib/reddit-pixel";

export function RedditClickTracker() {
  useEffect(() => {
    function trackWhatsAppClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest<HTMLAnchorElement>('a[href*="wa.me/"]');
      if (link) trackRedditLead();
    }

    document.addEventListener("click", trackWhatsAppClick);
    return () => document.removeEventListener("click", trackWhatsAppClick);
  }, []);

  return null;
}
