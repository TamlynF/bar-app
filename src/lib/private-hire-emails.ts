export type PrivateHireEmail = {
  subject: string;
  heading: string;
  greeting: string;
  body: string[];
  noteLabel?: string;
};

export function buildPrivateHireOutcomeEmail(p: {
  name: string;
  outcome: "confirmed" | "cancelled";
  notes?: string | null;
}): PrivateHireEmail {
  const isConfirmed = p.outcome === "confirmed";

  return {
    subject: isConfirmed
      ? "Your Private Hire Enquiry Has Been Confirmed! 🎉"
      : "Update on Your Private Hire Enquiry — Don Fenticas",
    heading: isConfirmed ? "You're Confirmed!" : "Enquiry Update",
    greeting: `Hi ${p.name}!`,
    body: isConfirmed
      ? [
          "We're delighted to confirm your private hire booking at Don Fenticas. Our team will be in touch shortly with the next steps.",
        ]
      : [
          "Thank you for your private hire enquiry. Unfortunately we're unable to accommodate your request at this time.",
        ],
    noteLabel: p.notes?.trim() || "",
  };
}
