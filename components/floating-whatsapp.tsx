import { christineWhatsapp } from "@/lib/site";

const message = encodeURIComponent("Hello, I would like to learn more about Jike Peptide products and services.");

export function FloatingWhatsapp() {
  return <a
    className="floating-whatsapp"
    href={`${christineWhatsapp}?text=${message}`}
    target="_blank"
    rel="noreferrer"
    aria-label="Chat with Jike Peptide on WhatsApp"
    title="Chat with us on WhatsApp"
  >
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3.5A12.5 12.5 0 0 0 5.25 22.37L3.7 28.3l6.08-1.5A12.5 12.5 0 1 0 16 3.5Z" />
      <path d="M11.1 9.55c.28-.64.57-.66.84-.67h.72c.23 0 .48.08.61.43l.95 2.32c.1.25.06.48-.1.71l-.72.96c-.15.2-.3.38-.12.69.18.31.8 1.28 1.73 2.07 1.19 1.02 2.19 1.34 2.5 1.49.31.16.49.13.67-.08l1.06-1.24c.23-.27.46-.22.77-.1l2.25 1.06c.32.16.53.24.61.37.08.14.08.78-.18 1.52-.26.75-1.51 1.42-2.08 1.51-.53.09-1.2.13-1.94-.1-.45-.14-1.03-.33-1.77-.65-.78-.34-3.43-1.25-5.82-4.31-.67-.86-1.65-2.29-1.65-3.77 0-1.48.77-2.21 1.05-2.51l.61-.71Z" />
    </svg>
    <span>WhatsApp</span>
  </a>;
}
