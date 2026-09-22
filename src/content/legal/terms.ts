import type { LegalDocument } from "./types";

const terms: LegalDocument = {
  title: "Terms of Use",
  lede: "The terms you accept by using this website, and what the information on it does and does not commit us to.",
  draftNote: [
    "The version published on elayabath.com contains the literal unfilled placeholder [your website URL] in its first clause, which means the terms have never been read through since the template was pasted in.",
    "This rewrite fills that gap and adds the clauses a browse-then-quote catalogue actually needs, chiefly that nothing on the site is a binding offer. It is a starting point for a lawyer, not legal advice.",
  ],
  sections: [
    {
      id: "general",
      title: "1. General",
      body: [
        {
          type: "p",
          text: "These Terms of Use govern your use of the website at https://elayabath.com and any services, features or content offered through it. The site is operated by Elaya Bath, [REGISTERED COMPANY NAME], of [REGISTERED ADDRESS].",
        },
      ],
    },
    {
      id: "accept",
      title: "2. Accepting these terms",
      body: [
        {
          type: "p",
          text: "By accessing, browsing or using the site you confirm that you have read and understood these terms and our Privacy Policy, and that you agree to both. If you do not agree, please do not use the site.",
        },
      ],
    },
    {
      id: "changes",
      title: "3. Changes",
      body: [
        {
          type: "p",
          text: "We may update these terms. The version on this page at the time you use the site is the version that applies. Where a change is material we will note it on this page rather than change the text silently.",
        },
      ],
    },
    {
      id: "quotes",
      title: "4. Prices and quotations",
      body: [
        {
          type: "p",
          text: "This site does not display prices and does not sell anything directly. There is no basket, no checkout and no payment.",
        },
        {
          type: "p",
          text: "Nothing on this site is an offer to sell. A request sent through the enquiry form is an invitation for us to quote, and creates no contract. A contract comes into existence only when we issue a written quotation and you accept it in writing.",
        },
        {
          type: "p",
          text: "Quotations are valid for [QUOTATION VALIDITY PERIOD] unless the quotation itself says otherwise, and are subject to the availability of the product and finish quoted.",
        },
      ],
    },
    {
      id: "info",
      title: "5. Product information",
      body: [
        {
          type: "p",
          text: "We describe products, dimensions and finishes as accurately as we can. Dimensions are nominal and subject to manufacturing tolerance, and you should work from the technical data sheet for the item code rather than from this website when preparing a specification or an installation.",
        },
        {
          type: "p",
          text: "Finish swatches and product photographs are reproductions. Colour varies with screen, lighting and, for natural materials such as marble and concrete, between individual pieces. Ask for a physical sample before committing to a finish.",
        },
        { type: "p", text: "We may change or withdraw products without notice." },
      ],
    },
    {
      id: "use",
      title: "6. Acceptable use",
      body: [
        {
          type: "p",
          text: "You may use this site to research products and to contact us. You may not use it to send unlawful or abusive material, to attempt to gain unauthorised access to any part of it, to interfere with its operation, or to extract its contents systematically by automated means for a commercial purpose.",
        },
      ],
    },
    {
      id: "ip",
      title: "7. Intellectual property",
      body: [
        {
          type: "p",
          text: "The Elaya Bath name and logo, the product designs, the photography, the product descriptions and the arrangement of this site are owned by Elaya Bath or used under licence, and are protected by intellectual property law.",
        },
        {
          type: "p",
          text: "You may view this site, and print or download extracts for your own reference or for a project you are specifying. You may not otherwise reproduce, publish or use any part of it commercially without our written permission.",
        },
        {
          type: "p",
          text: "[THIRD PARTY IMAGERY TO BE CONFIRMED] Some photography on this site is credited to outside designers. Confirm the licence position for those images before launch.",
        },
      ],
    },
    {
      id: "links",
      title: "8. Links to other sites",
      body: [
        {
          type: "p",
          text: "Where we link to a site we do not control, including the regional office at aquaeliteuae.com, we are not responsible for its content or its handling of your data.",
        },
      ],
    },
    {
      id: "liability",
      title: "9. Liability",
      body: [
        {
          type: "p",
          text: "The site is provided as it is. We do not guarantee that it will be uninterrupted or free of errors, and we are not liable for loss arising from reliance on information on it, except where that liability cannot be excluded by law. Nothing in these terms limits liability for death or personal injury caused by negligence, or for fraud.",
        },
        { type: "p", text: "[LIABILITY CAP TO BE SET BY COUNSEL]" },
      ],
    },
    {
      id: "law",
      title: "10. Governing law",
      body: [
        {
          type: "p",
          text: "These terms are governed by the law of [JURISDICTION], and the courts of [JURISDICTION] have exclusive jurisdiction over any dispute arising from them.",
        },
        {
          type: "p",
          text: "For anything in these terms, write to Info@elayabath.com. Last updated [DATE].",
        },
      ],
    },
  ],
};

export default terms;
