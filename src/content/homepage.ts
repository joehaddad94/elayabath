/**
 * The homepage's products before anyone chooses them in the dashboard's
 * Site content tab. Once a list is saved there, this one is no longer used;
 * it also decides which product pages are built ahead at deploy.
 *
 * Taken from what the homepage showed before the dashboard's Homepage screen
 * was removed (the seeded featured set, by name). A product that is hidden
 * or gone simply drops out.
 */
export const HOMEPAGE_PRODUCTS: readonly string[] = [
  "e02-sw30008", // ALCO, bathtub
  "e02-sw30007", // ALCOVE, bathtub
  "e01-sw10114", // ARCO, washbasin
  "e02-sw30055", // ARIA, washbasin
  "e05-sf10270", // ARIA, shower
  "e05-sf20073", // ARIA, tapware
  "e06-sw10413", // AXE C, toilet
  "e06-sw10412", // AXE S, toilet
  "e05-ac40161", // BASKET, accessory
  "e02-sw30035", // BELLA, bathtub
  "e02-sw30024", // BIZA, bathtub
  "e02-sw30060", // BRISA, washbasin
];
