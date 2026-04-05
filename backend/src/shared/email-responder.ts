import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import type { SearchProfile } from "./types";

const ses = new SESClient({});

const FROM = () => process.env.SES_FROM_EMAIL!;
const REPLY_TO = () => process.env.SES_INBOUND_EMAIL || FROM();

function send(to: string, subject: string, html: string) {
  return ses.send(
    new SendEmailCommand({
      Source: FROM(),
      ReplyToAddresses: [REPLY_TO()],
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: wrapEmail(html) } },
      },
    })
  );
}

function wrapEmail(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px;">
  <div style="text-align:center;padding:16px 0;">
    <h1 style="margin:0;font-size:24px;font-weight:800;color:#111827;">CarFinder</h1>
  </div>
  <div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;">
    ${content}
  </div>
  <div style="text-align:center;padding:16px 0;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">
      Reply to this email to manage your searches. Send "help" for commands.
    </p>
  </div>
</div></body></html>`;
}

export async function sendWelcome(email: string): Promise<void> {
  await send(
    email,
    "Welcome to CarFinder",
    `
    <h2 style="margin:0 0 16px;color:#111827;">Welcome to CarFinder!</h2>
    <p style="color:#374151;line-height:1.6;">
      You're all set. Just reply to this email with what car you're looking for, and I'll start searching for you every day.
    </p>
    <p style="color:#374151;line-height:1.6;"><strong>Example:</strong></p>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;border-left:3px solid #3b82f6;">
      <p style="margin:0;color:#374151;font-style:italic;">
        "Looking for a 2005-2008 Porsche 911 Carrera S. Manual transmission, under $60k. Must be a 997.1 — no 997.2. Prefer Seal Grey or Arctic Silver. Sport chrono package is a must."
      </p>
    </div>
    <p style="color:#374151;line-height:1.6;">
      Be as specific as you want. Our AI reads every listing description and evaluates it against your exact requirements.
    </p>
    <p style="color:#6b7280;font-size:14px;margin-top:24px;">
      <strong>Commands you can send anytime:</strong><br/>
      &bull; Describe a car → creates a new search<br/>
      &bull; "list" → see your active searches<br/>
      &bull; "pause" → pause all searches<br/>
      &bull; "pause [name]" → pause a specific search<br/>
      &bull; "resume" → resume searches<br/>
      &bull; "delete [name]" → delete a search<br/>
      &bull; "stop" or "unsubscribe" → stop all emails<br/>
      &bull; "help" → see this list again
    </p>
    `
  );
}

export async function sendSearchCreated(
  email: string,
  search: SearchProfile
): Promise<void> {
  const criteria = [
    search.makes?.length ? `Make: ${search.makes.join(", ")}` : null,
    search.models?.length ? `Model: ${search.models.join(", ")}` : null,
    search.yearMin || search.yearMax ? `Year: ${search.yearMin || "Any"}\u2013${search.yearMax || "Any"}` : null,
    search.priceMax ? `Budget: Under $${search.priceMax.toLocaleString()}` : null,
    search.mileageMax ? `Max Mileage: ${search.mileageMax.toLocaleString()} mi` : null,
    search.transmission ? `Transmission: ${search.transmission}` : null,
    search.drivetrain ? `Drivetrain: ${search.drivetrain.toUpperCase()}` : null,
    search.excludeDealers ? `Private sellers only` : null,
    search.excludeSalvage ? `Clean title only` : null,
  ]
    .filter(Boolean)
    .map((c) => `&bull; ${c}`)
    .join("<br/>");

  await send(
    email,
    `Search created: ${search.name}`,
    `
    <h2 style="margin:0 0 16px;color:#111827;">Search Created</h2>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:16px;">
      <h3 style="margin:0 0 8px;color:#166534;">${search.name}</h3>
      <p style="margin:0;color:#374151;font-size:14px;line-height:1.8;">${criteria}</p>
    </div>
    ${
      search.aiNotes
        ? `<div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:16px;border-left:3px solid #3b82f6;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">AI Notes</p>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;font-style:italic;">${search.aiNotes}</p>
      </div>`
        : ""
    }
    <p style="color:#374151;line-height:1.6;">
      I'll start searching today. You'll get your first results in tomorrow's digest (if there are matches).
    </p>
    <p style="color:#6b7280;font-size:13px;">
      Reply to refine this search, or send a new car description to add another search.
    </p>
    `
  );
}

export async function sendSearchList(
  email: string,
  searches: SearchProfile[]
): Promise<void> {
  if (searches.length === 0) {
    await send(
      email,
      "Your Searches",
      `
      <h2 style="margin:0 0 16px;color:#111827;">Your Searches</h2>
      <p style="color:#374151;">You don't have any searches yet. Reply with a car description to create one!</p>
      `
    );
    return;
  }

  const list = searches
    .map((s) => {
      const status = s.isActive
        ? '<span style="color:#16a34a;font-weight:600;">Active</span>'
        : '<span style="color:#6b7280;font-weight:600;">Paused</span>';
      const details = [
        s.makes?.join(", "),
        s.yearMin || s.yearMax ? `${s.yearMin || "?"}\u2013${s.yearMax || "?"}` : null,
        s.priceMax ? `Under $${s.priceMax.toLocaleString()}` : null,
        s.transmission,
      ]
        .filter(Boolean)
        .join(" · ");

      return `
        <div style="padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="color:#111827;">${s.name}</strong>
            ${status}
          </div>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${details}</p>
          ${s.aiNotes ? `<p style="margin:4px 0 0;font-size:12px;color:#9ca3af;font-style:italic;">${s.aiNotes.slice(0, 100)}${s.aiNotes.length > 100 ? "..." : ""}</p>` : ""}
        </div>`;
    })
    .join("");

  await send(
    email,
    `Your Searches (${searches.length})`,
    `
    <h2 style="margin:0 0 16px;color:#111827;">Your Searches</h2>
    ${list}
    <p style="color:#6b7280;font-size:13px;margin-top:16px;">
      Reply with "pause [name]", "resume [name]", or "delete [name]" to manage.
    </p>
    `
  );
}

export async function sendSearchModified(
  email: string,
  search: SearchProfile,
  whatChanged: string
): Promise<void> {
  await send(
    email,
    `Search updated: ${search.name}`,
    `
    <h2 style="margin:0 0 16px;color:#111827;">Search Updated</h2>
    <p style="color:#374151;line-height:1.6;">
      I've updated <strong>${search.name}</strong>. ${whatChanged}
    </p>
    ${
      search.aiNotes
        ? `<div style="background:#f9fafb;border-radius:8px;padding:16px;margin-top:16px;border-left:3px solid #3b82f6;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Current AI Notes</p>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;font-style:italic;">${search.aiNotes}</p>
      </div>`
        : ""
    }
    `
  );
}

export async function sendConfirmation(
  email: string,
  subject: string,
  message: string
): Promise<void> {
  await send(email, subject, `<p style="color:#374151;line-height:1.6;">${message}</p>`);
}

export async function sendHelp(email: string): Promise<void> {
  await send(
    email,
    "CarFinder Help",
    `
    <h2 style="margin:0 0 16px;color:#111827;">How to Use CarFinder</h2>
    <p style="color:#374151;line-height:1.6;">
      Everything happens through email. Just reply to any CarFinder email or send a new email to this address.
    </p>
    <h3 style="color:#111827;margin:20px 0 8px;">Create a search</h3>
    <p style="color:#374151;font-size:14px;">
      Describe the car you want. Be as specific as you like:
    </p>
    <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin:8px 0;font-style:italic;color:#374151;font-size:14px;">
      "I want a 2005-2008 Porsche 911 Carrera S, manual only, under $55k. Must be 997.1. Prefer Seal Grey. No sunroof."
    </div>
    <h3 style="color:#111827;margin:20px 0 8px;">Commands</h3>
    <table style="width:100%;font-size:14px;color:#374151;">
      <tr><td style="padding:4px 8px;"><strong>list</strong></td><td>See all your searches</td></tr>
      <tr><td style="padding:4px 8px;"><strong>pause</strong></td><td>Pause all searches</td></tr>
      <tr><td style="padding:4px 8px;"><strong>pause [name]</strong></td><td>Pause a specific search</td></tr>
      <tr><td style="padding:4px 8px;"><strong>resume</strong></td><td>Resume all searches</td></tr>
      <tr><td style="padding:4px 8px;"><strong>delete [name]</strong></td><td>Delete a search</td></tr>
      <tr><td style="padding:4px 8px;"><strong>stop / unsubscribe</strong></td><td>Stop all emails</td></tr>
      <tr><td style="padding:4px 8px;"><strong>help</strong></td><td>See this message</td></tr>
    </table>
    <h3 style="color:#111827;margin:20px 0 8px;">Modify a search</h3>
    <p style="color:#374151;font-size:14px;">
      Just describe what you want to change:
    </p>
    <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin:8px 0;font-style:italic;color:#374151;font-size:14px;">
      "Add requirement: must have sport chrono package. Also increase max price to $65k."
    </div>
    `
  );
}

export async function sendError(email: string, message: string): Promise<void> {
  await send(
    email,
    "CarFinder: Couldn't process your request",
    `
    <p style="color:#374151;line-height:1.6;">
      I wasn't able to understand your last message. ${message}
    </p>
    <p style="color:#374151;line-height:1.6;">
      Try describing the car you're looking for, or reply "help" for a list of commands.
    </p>
    `
  );
}
