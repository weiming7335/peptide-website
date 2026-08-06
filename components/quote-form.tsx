"use client";

import { useState, type FormEvent } from "react";
import { formEndpoint } from "@/lib/site";

export function QuoteForm() {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const form = event.currentTarget;
    try {
      const response = await fetch(formEndpoint, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Submission failed");
      form.reset();
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success") return <div className="quote-success" role="status">
    <span>✓</span><h2>Inquiry received.</h2><p>Our team will review your request and reply by email or WhatsApp.</p>
    <button className="button" type="button" onClick={() => setState("idle")}>Submit another inquiry</button>
  </div>;

  return <form className="quote-form" onSubmit={submit}>
    <div className="form-row">
      <label>Full name *<input name="name" autoComplete="name" required /></label>
      <label>Email *<input name="email" type="email" autoComplete="email" required /></label>
    </div>
    <div className="form-row">
      <label>WhatsApp / Phone<input name="phone_whatsapp" type="tel" autoComplete="tel" /></label>
      <label>Company / Organization<input name="company" autoComplete="organization" /></label>
    </div>
    <div className="form-row">
      <label>Customer type *<select name="customer_type" defaultValue="" required><option value="" disabled>Select one</option><option>Individual buyer</option><option>Retailer / Reseller</option><option>Wholesaler / Distributor</option><option>Brand owner</option><option>Research organization</option><option>Other</option></select></label>
      <label>Country / Region *<input name="country" autoComplete="country-name" required /></label>
    </div>
    <label>Inquiry type *<select name="inquiry_type" defaultValue="" required><option value="" disabled>Select one</option><option>Catalog products</option><option>OEM & private label</option><option>Labels or packaging</option><option>Brand design</option><option>E-commerce website</option><option>Third-party testing</option><option>Other</option></select></label>
    <label>Inquiry details (optional)<textarea name="message" placeholder="Add any questions, requirements or delivery information you would like us to know." /></label>
    <label className="form-consent"><input name="research_use_confirmation" type="checkbox" value="Confirmed" required /><span>I understand that catalog materials are supplied for laboratory research use only and are not for human consumption.</span></label>
    <input type="hidden" name="_subject" value="New Jike Peptide inquiry" />
    <input className="form-honeypot" name="_gotcha" tabIndex={-1} autoComplete="off" aria-hidden="true" />
    {state === "error" && <p className="form-error" role="alert">The form could not be sent. Please try again or contact us by WhatsApp.</p>}
    <button className="button quote-submit" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Submit inquiry"}</button>
  </form>;
}
