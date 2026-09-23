/**
 * The finish a product page is currently showing, held in the URL.
 *
 * It was component state, which meant choosing one of seventeen finishes
 * changed a label and nothing else: the quote link still carried only the
 * item code, a refresh lost the choice, and the page could not be sent to
 * somebody as "this basin, in Thunder". The page's own copy, meanwhile, said
 * "send the item code and the finish you want".
 *
 * Data-free and tiny so a client component can use it without reaching the
 * catalogue.
 */
export const FINISH_PARAM = "finish";

export function readFinish(search: string): string | null {
  return new URLSearchParams(search).get(FINISH_PARAM);
}

export function withFinish(search: string, slug: string): URLSearchParams {
  const params = new URLSearchParams(search);
  params.set(FINISH_PARAM, slug);
  return params;
}
