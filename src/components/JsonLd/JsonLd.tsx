/**
 * Emits a JSON-LD graph.
 *
 * A Server Component with no client cost: this is markup, not behaviour.
 *
 * `JSON.stringify` output is escaped before it goes into the script, because
 * a `</script>` sequence appearing inside any product name or answer text
 * would close the tag early and spill the rest of the graph into the page as
 * markup. None of today's copy contains one; that is not a reason to depend
 * on it.
 */
export function JsonLd({ graph }: { graph: object[] }) {
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph })
    .replace(/</g, "\u003c")
    .replace(/>/g, "\u003e")
    .replace(/&/g, "\u0026");

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}
