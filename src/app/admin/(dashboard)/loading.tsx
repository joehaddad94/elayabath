import { PageSkeleton } from "./PageSkeleton";

/**
 * Shown the moment a dashboard link is followed, while the next screen
 * loads: the header stays, and the page area says it is on its way.
 */
export default function Loading() {
  return <PageSkeleton />;
}
