import type { LegalDocument } from "./types";

const privacy: LegalDocument = {
  title: "Privacy Policy",
  lede: "What Elaya Bath collects when you use this site, why it is collected, and what you can ask us to do with it.",
  draftNote: [
    "The policy published on elayabath.com is the unedited WordPress sample text. It describes blog comments, Gravatar avatars and embedded content from other websites, none of which exist on this site, and it never mentions the enquiry form, which is the only place the site actually collects anything.",
    "What follows is a rewrite that matches how the site really works. It is a starting point for a lawyer, not legal advice, and it is not a substitute for advice on the specific laws that apply to Elaya Bath in Qatar, the UAE, the EU and the US.",
  ],
  sections: [
    {
      id: "who",
      title: "Who we are",
      body: [
        {
          type: "p",
          text: "This site is operated by Elaya Bath, [REGISTERED COMPANY NAME], of [REGISTERED ADDRESS]. In this policy, we and us mean Elaya Bath, and you means anyone using this website.",
        },
        { type: "p", text: "Our website address is https://elayabath.com." },
      ],
    },
    {
      id: "collect",
      title: "What we collect",
      body: [
        {
          type: "p",
          text: "Very little, because this site sells nothing directly. There is no account to create, no basket and no payment.",
        },
        { type: "h3", text: "When you send an enquiry" },
        {
          type: "ul",
          items: [
            "Your name and e-mail address, which are required in order to reply.",
            "Your country, which decides which regional office handles the enquiry.",
            "The item codes you are asking about.",
            "For trade and project enquiries, a company or project name and an approximate quantity.",
            "Anything else you choose to write in the message field.",
          ],
        },
        { type: "h3", text: "Automatically" },
        {
          type: "ul",
          items: [
            "Standard server log information, including IP address, browser type and the pages requested, used to keep the site available and secure.",
            "Nothing else. This build sets no analytics and no advertising cookies.",
          ],
        },
      ],
    },
    {
      id: "why",
      title: "Why we collect it",
      body: [
        {
          type: "p",
          text: "We use enquiry details for one purpose: to answer the enquiry and to quote for the products you asked about. Where an enquiry becomes an order, we keep the correspondence as a record of what was quoted and agreed.",
        },
        {
          type: "p",
          text: "We do not sell your details, and we do not use them to build advertising profiles.",
        },
      ],
    },
    {
      id: "share",
      title: "Who we share it with",
      body: [
        {
          type: "p",
          text: "Enquiries are routed to the regional office that covers your market. For the Middle East and Africa that office operates under a separate business, [AQUA ELITE UAE, RELATIONSHIP TO BE CONFIRMED], reachable at info@aquaeliteuae.com. This means an enquiry from those regions is read by people outside Elaya Bath, and this policy should say so plainly once the relationship is confirmed.",
        },
        {
          type: "p",
          text: "We also use service providers who process data on our behalf, including [HOSTING PROVIDER] and [E-MAIL PROVIDER]. They act on our instructions and may not use the data for their own purposes.",
        },
        {
          type: "p",
          text: "We disclose information where the law requires it, and no further.",
        },
      ],
    },
    {
      id: "keep",
      title: "How long we keep it",
      body: [
        {
          type: "p",
          text: "Enquiries that do not lead to an order are kept for [RETENTION PERIOD] and then deleted. Enquiries that do lead to an order are kept for as long as the law requires records of that transaction to be kept. Server logs are kept for [LOG RETENTION PERIOD].",
        },
      ],
    },
    {
      id: "cookies",
      title: "Cookies and analytics",
      body: [
        {
          type: "p",
          text: "This build sets no analytics cookies and runs no advertising trackers, so no consent banner is required for it.",
        },
        {
          type: "p",
          text: "[IF ANALYTICS IS ADDED] The live site currently loads Google Analytics immediately, with no consent step. That needs a consent banner before it is acceptable for visitors in the EU and the UK, whatever this policy says. If analytics is reinstated here, this section and that banner have to be written together.",
        },
      ],
    },
    {
      id: "rights",
      title: "Your rights",
      body: [
        {
          type: "p",
          text: "Depending on where you live, you may have the right to ask us for a copy of the personal data we hold about you, to have it corrected or deleted, to object to our using it, and to ask us to send it to someone else. To exercise any of these, write to the address below and tell us which right you are exercising.",
        },
        {
          type: "p",
          text: "We answer within [RESPONSE PERIOD]. If you are not satisfied with our answer, you can complain to your local data protection authority.",
        },
      ],
    },
    {
      id: "contact",
      title: "Contacting us",
      body: [
        {
          type: "p",
          text: "For anything in this policy, write to Info@elayabath.com, or use the enquiry form and choose Something else.",
        },
        {
          type: "p",
          text: "This policy was last updated on [DATE]. If we change it materially we will say so on this page.",
        },
      ],
    },
  ],
};

export default privacy;
