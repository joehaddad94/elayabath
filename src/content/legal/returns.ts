import type { LegalDocument } from "./types";

const returns: LegalDocument = {
  title: "Returns & Refunds",
  lede: "What happens if something arrives damaged, arrives wrong, or turns out not to be what you specified.",
  draftNote: [
    "The policy published on elayabath.com is the unedited WooCommerce sample. It governs the return of perishable goods such as food, flowers, newspapers or magazines, and grants partial refunds on a book with obvious signs of use and on a CD, DVD, VHS tape, software, video game, cassette tape, or vinyl record that has been opened. It has clearly never been read. It is also not linked from anywhere on the live site.",
    "This rewrite covers what Elaya Bath actually sells: heavy, fragile sanitaryware, frequently made to order in a chosen finish, shipped internationally and installed by a third party. It is a starting point for a lawyer, not legal advice.",
  ],
  sections: [
    {
      id: "scope",
      title: "How orders are placed",
      body: [
        {
          type: "p",
          text: "Nothing is sold through this website. Orders follow a written quotation, so the terms of that quotation, together with this policy, govern the sale. Where the two differ, the quotation wins.",
        },
        {
          type: "p",
          text: "This policy applies to [TRADE / CONSUMER / BOTH] customers. Consumers in some countries have statutory cancellation rights that go further than this policy, and nothing here limits them.",
        },
      ],
    },
    {
      id: "damage",
      title: "Damage in transit",
      body: [
        {
          type: "p",
          text: "Ceramic, stone and glass are fragile, and damage in transit is the most common problem.",
        },
        {
          type: "ul",
          items: [
            "Inspect every item on delivery, before the carrier leaves where possible.",
            "Note any visible damage on the delivery paperwork.",
            "Photograph the outer packaging and the damage before unpacking further.",
            "Tell us within [DAMAGE NOTIFICATION WINDOW, TYPICALLY 48 HOURS] of delivery.",
          ],
        },
        {
          type: "p",
          text: "Where damage is reported within that window with photographs, we replace the item at our cost. Reported later, we will do what we can, but the carrier's own claim window may already have closed.",
        },
      ],
    },
    {
      id: "wrong",
      title: "Wrong or faulty items",
      body: [
        {
          type: "p",
          text: "If the item delivered does not match the item code and finish on the quotation, or has a manufacturing fault, tell us and we will replace it or refund it in full, including return carriage.",
        },
        {
          type: "p",
          text: "Please do not install an item you believe is wrong or faulty. Installation is normally taken as acceptance, and it makes a replacement far harder.",
        },
      ],
    },
    {
      id: "change",
      title: "Changing your mind",
      body: [
        {
          type: "p",
          text: "For stock items in a standard finish, returns are accepted within [RETURN WINDOW, TYPICALLY 14 OR 30 DAYS] of delivery, provided the item is unused, uninstalled and in its original packaging.",
        },
        {
          type: "p",
          text: "Return carriage is the customer's responsibility, and a restocking fee of [RESTOCKING FEE, IF ANY] may apply. Because these items are heavy and fragile, we strongly recommend arranging the return through us rather than a general courier.",
        },
      ],
    },
    {
      id: "no",
      title: "What cannot be returned",
      body: [
        {
          type: "p",
          text: "The following cannot be returned unless faulty or wrongly supplied.",
        },
        {
          type: "ul",
          items: [
            "Items made to order in a non-standard finish, including customisation codes such as SS99, CR99 and M99. These are produced for one order and cannot be resold.",
            "Items cut, drilled or otherwise modified after delivery.",
            "Items that have been installed, or connected to a water supply or waste.",
            "Items returned without their original packaging, where that packaging is what protects them in transit.",
          ],
        },
        {
          type: "p",
          text: "Natural variation in marble, concrete and resin is not a fault. These materials vary piece to piece in colour and veining, and a finished item will differ from the swatch on this website. Ask for a physical sample before ordering if an exact match matters.",
        },
      ],
    },
    {
      id: "how",
      title: "How to make a claim",
      body: [
        {
          type: "p",
          text: "Write to Salessupport@elayabath.com, or use the enquiry form, and include:",
        },
        {
          type: "ul",
          items: [
            "the quotation or order number;",
            "the item code, for example E02-SW40034;",
            "photographs, for damage or a fault;",
            "whether you would prefer a replacement or a refund.",
          ],
        },
        {
          type: "p",
          text: "We acknowledge claims within [ACKNOWLEDGEMENT PERIOD] and tell you what happens next. Do not return anything before we have confirmed the return, or we may not be able to identify it when it arrives.",
        },
      ],
    },
    {
      id: "refunds",
      title: "Refunds",
      body: [
        {
          type: "p",
          text: "Once a returned item is received and inspected, we confirm by e-mail whether the refund is approved. Approved refunds are issued to the original payment method within [REFUND PERIOD]. Original delivery charges are refunded only where the item was faulty or wrongly supplied.",
        },
      ],
    },
    {
      id: "warranty",
      title: "Warranty",
      body: [
        {
          type: "p",
          text: "Products carry a [WARRANTY PERIOD] warranty against manufacturing defects from the date of delivery. The warranty does not cover damage from incorrect installation, misuse, harsh or abrasive cleaning products, limescale, or normal wear.",
        },
        {
          type: "p",
          text: "Correct installation matters: installation by someone other than an approved installer may affect a warranty claim, so keep the installer's details and the technical data sheet for the item code with your records.",
        },
        { type: "p", text: "Last updated [DATE]." },
      ],
    },
  ],
};

export default returns;
