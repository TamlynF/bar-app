import { format } from "date-fns";

export function buildPaymentPendingEmail(p: {
  name: string;
  eventTitle: string;
  eventDate: string;
  groupSize: number;
  amountDue: number;
  payUrl: string;
}): { subject: string; html: string } {
  const eventDate = format(new Date(p.eventDate + "T00:00:00"), "EEEE d MMMM yyyy");

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F7F4EA; margin: 0; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #E6DFC8;">
        <div style="background-color: #26300D; padding: 40px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">${p.eventTitle}</h1>
          <p style="color: #FDCC4B; margin: 8px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Don Fenticas</p>
        </div>
        <div style="padding: 40px 30px; color: #1F1F1A;">
          <h2 style="margin-top: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">Almost there, ${p.name}!</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #5F624F; font-weight: 500;">
            We've saved your details for <strong>${p.eventTitle}</strong>, but we haven't received your payment yet - so your spot isn't secured. Finish checkout below and you're in.
          </p>
          <div style="background-color: #F7F4EA; border: 2px solid #E6DFC8; border-radius: 16px; padding: 24px; margin: 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 15px;">
              <tr>
                <td style="padding-bottom: 16px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">Date</td>
                <td style="padding-bottom: 16px; text-align: right; font-weight: 900; color: #1F1F1A;">${eventDate}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">Tickets</td>
                <td style="padding-bottom: 16px; text-align: right; font-weight: 900; color: #1F1F1A;">${p.groupSize} ${p.groupSize === 1 ? "Person" : "People"}</td>
              </tr>
              <tr>
                <td style="color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">Amount Due</td>
                <td style="text-align: right; font-weight: 900; color: #1F1F1A;">£${p.amountDue.toFixed(2)}</td>
              </tr>
            </table>
          </div>
          <div style="text-align: center; margin: 40px 0 20px 0;">
            <a href="${p.payUrl}" style="background-color: #FDCC4B; color: #26300D; padding: 18px 36px; text-decoration: none; border-radius: 16px; font-weight: 900; display: inline-block; text-transform: uppercase; letter-spacing: 1.5px;">Complete Payment</a>
          </div>
          <p style="font-size: 12px; color: #5F624F; text-align: center; margin-top: 24px; font-weight: 500;">
            Button not working? Copy and paste this link:<br>
            <a href="${p.payUrl}" style="color: #26300D; text-decoration: underline; margin-top: 8px; display: inline-block;">${p.payUrl}</a>
          </p>
          <p style="font-size: 12px; color: #5F624F; text-align: center; margin-top: 24px; font-weight: 500;">
            Unpaid bookings are released automatically, so please complete payment soon.
          </p>
        </div>
        <div style="background-color: #1F1F1A; padding: 30px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #E6DFC8; text-transform: uppercase; letter-spacing: 2px; font-weight: 900; opacity: 0.6;">Don Fenticas · Licensed Venue</p>
        </div>
      </div>
    </div>
  `;

  return { subject: `Finish your booking: ${p.eventTitle} @ Don Fenticas`, html };
}
