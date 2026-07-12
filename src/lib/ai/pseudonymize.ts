/**
 * Refuses to send anything to the model that looks like it identifies the
 * student — email addresses, or their own display name if it's known
 * server-side. This does NOT catch a student typing "jag heter Alva" in free
 * text (docs/04 Risk 2, accepted residual risk); it's a hard backstop
 * against accidentally building name/email into a prompt payload.
 */
export class PseudonymizationViolation extends Error {
  constructor(reason: string) {
    super(`Refusing to send to AI: ${reason}`);
  }
}

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function assertPseudonymous(payload: unknown, knownIdentifiers: string[] = []): void {
  const text = JSON.stringify(payload);

  if (EMAIL_PATTERN.test(text)) {
    throw new PseudonymizationViolation('payload contains what looks like an email address');
  }

  for (const identifier of knownIdentifiers) {
    const trimmed = identifier.trim();
    if (trimmed.length >= 2 && text.toLowerCase().includes(trimmed.toLowerCase())) {
      throw new PseudonymizationViolation(`payload contains known identifier "${trimmed}"`);
    }
  }
}
