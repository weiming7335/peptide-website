"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { trackGoogleQuoteFormConversion } from "@/lib/google-ads";
import { trackRedditLead } from "@/lib/reddit-pixel";

const formEndpoint = "https://formspree.io/f/mkodeagk";

const countries = [
  "United States",
  "Mexico",
  "Brazil",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Netherlands",
  "Switzerland",
  "Australia",
  "Japan",
  "South Korea",
  "Singapore",
  "Hong Kong SAR",
  "China",
  "India",
  "Israel",
  "United Arab Emirates",
  "Other",
];

export function QuoteForm() {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const form = event.currentTarget;

    try {
      const response = await fetch(formEndpoint, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error("Submission failed");
      trackGoogleQuoteFormConversion();
      trackRedditLead();
      form.reset();
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return <div className="quote-success" role="status">
      <span>✓</span>
      <h2>Inquiry received.</h2>
      <p>Christine will review your requested products, quantities and documentation requirements and reply by email or WhatsApp.</p>
      <button type="button" className="primary-button" onClick={() => setState("idle")}>Submit another inquiry</button>
    </div>;
  }

  return <form className="quote-form" onSubmit={submit}>
    <div className="quote-form-note">Include the compound, specification, estimated quantity and documentation required for an accurate quotation.</div>

    <div className="form-row">
      <label>First Name *
        <input name="first_name" type="text" placeholder="John" autoComplete="given-name" required />
      </label>
      <label>Last Name *
        <input name="last_name" type="text" placeholder="Doe" autoComplete="family-name" required />
      </label>
    </div>

    <label>Institution / Company Name *
      <input name="company" type="text" placeholder="e.g. Advanced BioResearch Labs" autoComplete="organization" required />
    </label>

    <div className="form-row">
      <label>Email *
        <input name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
      </label>
      <label>Phone / WhatsApp
        <input name="phone_whatsapp" type="tel" placeholder="+1 555 000 0000" autoComplete="tel" />
      </label>
    </div>

    <label>Country *
      <select name="country" defaultValue="" required>
        <option value="" disabled>Select country</option>
        {countries.map(country => <option value={country} key={country}>{country}</option>)}
      </select>
    </label>

    <label>Inquiry Details *
      <textarea name="inquiry_details" placeholder="Please specify products or catalog codes, nominal specifications, quantities, documentation requirements and any private-label needs." required />
    </label>

    <label className="form-consent">
      <input name="research_use_confirmation" type="checkbox" value="Confirmed" required />
      <span>I understand that Jike Peptide catalog materials are supplied strictly for research use and are not for human consumption.</span>
    </label>

    <input type="hidden" name="_subject" value="New Jike Peptide procurement inquiry" />
    <input className="form-honeypot" type="text" name="_gotcha" tabIndex={-1} autoComplete="off" aria-hidden="true" />

    {state === "error" && <p className="form-error" role="alert">The inquiry could not be sent. Please try again or contact Christine using the details beside this form.</p>}
    <button className="primary-button quote-submit" type="submit" disabled={state === "sending"}>
      {state === "sending" ? "Sending…" : "Submit inquiry"}
    </button>
  </form>;
}
