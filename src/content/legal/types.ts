/**
 * Long-form legal prose, as structured content rather than dictionary
 * strings.
 *
 * These documents run to a few thousand words each. Putting them in the UI
 * dictionary would bury forty interface labels under them and make the
 * dictionary unreadable, so they live here, typed, one file per document.
 * They are still localisable: a second language adds a sibling file.
 *
 * Every fact only the client can supply is written as [BRACKETED TEXT] and
 * rendered with emphasis, so it cannot be missed the way `[your website URL]`
 * has been missed on the live site for however long it has been there.
 */

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] };

export interface LegalSection {
  /** Anchor, and the key the section navigation links to. */
  id: string;
  title: string;
  body: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  lede: string;
  /** Why this text exists and what it replaced. Rendered as a draft warning
   *  at the top of the page, before any of the policy. */
  draftNote: string[];
  sections: LegalSection[];
}
