"use client";

import { useState, type FormEvent } from "react";
import { trackGoogleQuoteFormConversion } from "@/lib/google-ads";

const formEndpoint = "https://formspree.io/f/mkodeagk";

export function LandingQuoteForm() {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const form = event.currentTarget;
    try {
      const response = await fetch(formEndpoint, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Submission failed");
      trackGoogleQuoteFormConversion();
      form.reset();
      setState("success");
    } catch {
      setState("error");
    }
  }

  return <form onSubmit={submit}>
    <div className="form-grid">
      <label><span>Name *</span><input name="name" autoComplete="name" required /></label>
      <label><span>Company *</span><input name="company" autoComplete="organization" required /></label>
      <label><span>Business email *</span><input name="email" type="email" autoComplete="email" required /></label>
      <label><span>WhatsApp</span><input name="whatsapp" type="tel" autoComplete="tel" /></label>
      <label><span>Country / market *</span><input name="country" autoComplete="country-name" required /></label>
      <label><span>Estimated order volume *</span><select name="volume" defaultValue="" required><option value="" disabled>Select</option><option>Qualifying trial order</option><option>Recurring wholesale order</option><option>OEM / private label program</option><option>Bulk procurement</option></select></label>
    </div>
    <label><span>Procurement requirements *</span><textarea name="requirements" rows={5} placeholder="Describe the material specifications, quantities, packaging and documentation you require." required /></label>
    <label className="checkbox"><input type="checkbox" name="business_confirmation" value="confirmed" required /><span>I am contacting Jike Peptide on behalf of a commercial business or institution and understand that orders are subject to buyer, end-use and destination review.</span></label>
    <input type="hidden" name="_subject" value="New B2B factory landing page inquiry" />
    <input className="honeypot" type="text" name="_gotcha" tabIndex={-1} autoComplete="off" />
    <button className="button button-light" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : <>Submit procurement inquiry <span>→</span></>}</button>
    <p className={`form-status ${state === "error" ? "form-error" : ""}`} role="status" aria-live="polite">{state === "success" && "Thank you. Your procurement inquiry has been received."}{state === "error" && "The form could not be sent. Please contact Christine on WhatsApp."}</p>
  </form>;
}
