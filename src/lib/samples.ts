import type { LeadInput } from "./schemas";

/**
 * Fictional sample leads for the first-run experience. They are not real
 * customers; the UI badges them as "Sample". They ship WITHOUT any analysis:
 * every analysis you see is produced live by Gemini when you click Analyze.
 */
export const SAMPLE_LEADS: { input: LeadInput; receivedMinutesAgo: number }[] = [
  {
    receivedMinutesAgo: 12,
    input: {
      name: "Ananya Rao",
      location: "Whitefield, Bengaluru",
      propertyRequirement: "3 BHK apartment, ready to move, near ITPL, gated community",
      budget: "₹1.4–1.6 Cr",
      timeline: "1_month",
      customerMessage:
        "Hi, we're relocating from Pune for my husband's job and need to move before our kids' school term starts on 1 Dec. Looking for a ready-to-move 3BHK within 20 min of ITPL. Our home loan is already sanctioned by our bank. Can we see 2–3 options this Saturday morning? Main worry is water supply and maintenance charges, we've had bad experiences before.",
    },
  },
  {
    receivedMinutesAgo: 95,
    input: {
      name: "Karan Mehta",
      location: "Baner / Balewadi, Pune",
      propertyRequirement: "2 BHK, under-construction is fine if possession within 18 months",
      budget: "₹85–95 L",
      timeline: "3_6_months",
      customerMessage:
        "Comparing your project with another one in Hinjewadi. Your price per sq ft looks higher. What's the actual carpet area for the 2BHK, and has the RERA possession date ever been pushed? I got burned by a delayed project in 2019 so I need honesty on that. Will decide with my wife after we see the sample flat.",
    },
  },
  {
    receivedMinutesAgo: 240,
    input: {
      name: "Priya Nair",
      location: "Thane West, Mumbai",
      propertyRequirement: "1 or 2 BHK, not sure yet",
      budget: "Around 70 L maybe",
      timeline: "exploring",
      customerMessage: "Just checking what's available. Send brochure.",
    },
  },
  {
    receivedMinutesAgo: 30,
    input: {
      name: "Rahul Verma (NRI, Dubai)",
      location: "Gachibowli, Hyderabad",
      propertyRequirement: "2–3 BHK for rental income, close to Financial District, good resale",
      budget: "₹1.1–1.3 Cr",
      timeline: "1_3_months",
      customerMessage:
        "I'm based in Dubai and want to invest in Hyderabad for rental yield. What rent can a 2BHK near Financial District realistically get? I can only take calls after 7pm IST on weekdays. I'd want a video walkthrough first and need help with the NRI paperwork and power of attorney. I've shortlisted 3 builders including you.",
    },
  },
  {
    receivedMinutesAgo: 600,
    input: {
      name: "Sunita & Vikram Desai",
      location: "Andheri East, Mumbai",
      propertyRequirement: "Upgrade from 2 BHK to 3 BHK, near metro, east-facing preferred",
      budget: "₹2.2–2.5 Cr",
      timeline: "3_6_months",
      customerMessage:
        "We love the 3BHK we saw last weekend but we need to sell our current 2BHK in Chakala first to fund the down payment. Vikram's parents also have to approve since they'll live with us. Is there any scheme where we can book now and pay the balance later? Please don't call during office hours.",
    },
  },
  {
    receivedMinutesAgo: 5,
    input: {
      name: "Mohammed Irfan",
      location: "Sector 150, Noida",
      propertyRequirement: "3 BHK with study, high floor, park facing",
      budget: "₹1.8 Cr",
      timeline: "immediate",
      customerMessage:
        "Saw the ad for Tower C. If the 14th floor park-facing 3BHK is still available I want to block it this week. Please call me today, I'm free after 4pm. What is the token amount and can I pay it online?",
    },
  },
];
