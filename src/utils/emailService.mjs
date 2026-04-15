import { Autosend } from "autosendjs";

/**
 * Generic EmailService wrapping autosendjs.
 *
 * Configuration is pulled from environment variables so no API key is
 * ever hard-coded:
 *
 *   AUTOSEND_API_KEY   – required
 *   EMAIL_FROM         – sender address (default: noreply@example.com)
 *   AUTOSEND_BASE_URL  – optional, override the API endpoint
 *   AUTOSEND_TIMEOUT   – optional, request timeout in ms (default: 30000)
 *   AUTOSEND_RETRIES   – optional, retry attempts (default: 3)
 *   AUTOSEND_DEBUG     – optional, set to "true" to enable SDK debug logs
 */
class EmailService {
  #client;
  #from;

  constructor() {
    const apiKey = process.env.AUTOSEND_API_KEY;
    if (!apiKey) {
      console.warn("[EmailService] AUTOSEND_API_KEY is not set – emails will not be sent.");
    }

    this.#from = process.env.EMAIL_FROM || "noreply@example.com";

    const options = {};
    if (process.env.AUTOSEND_BASE_URL) options.baseUrl = process.env.AUTOSEND_BASE_URL;
    if (process.env.AUTOSEND_TIMEOUT)  options.timeout  = Number(process.env.AUTOSEND_TIMEOUT);
    if (process.env.AUTOSEND_RETRIES)  options.maxRetries = Number(process.env.AUTOSEND_RETRIES);
    if (process.env.AUTOSEND_DEBUG === "true") options.debug = true;

    this.#client = apiKey ? new Autosend(apiKey, options) : null;
  }

  // ─── Core methods ────────────────────────────────────────────────────────────

  /**
   * Send a single email.
   * @param {{ to: string, subject: string, text?: string, html?: string, from?: string }} opts
   */
  async send({ to, subject, text, html, from }) {
    if (!this.#client) return this.#warn("send");

    return this.#client.emails.send({
      from: { email: from || this.#from },
      to:   { email: to },
      subject,
      ...(html ? { html } : { text: text || "" }),
    });
  }

  /**
   * Send multiple emails in a single bulk request.
   * @param {Array<{ to: string, subject: string, text?: string, html?: string, from?: string }>} emails
   */
  async sendBulk(emails) {
    if (!this.#client) return this.#warn("sendBulk");

    const payload = emails.map(({ to, subject, text, html, from }) => ({
      from:    { email: from || this.#from },
      to:      { email: to },
      subject,
      ...(html ? { html } : { text: text || "" }),
    }));

    return this.#client.emails.bulk({ emails: payload });
  }

  // ─── Contact management ──────────────────────────────────────────────────────

  async createContact({ email, firstName, lastName, listIds = [], customFields = {} }) {
    if (!this.#client) return this.#warn("createContact");
    return this.#client.contacts.create({ email, firstName, lastName, listIds, customFields });
  }

  async upsertContact({ email, firstName, lastName }) {
    if (!this.#client) return this.#warn("upsertContact");
    return this.#client.contacts.upsert({ email, firstName, lastName });
  }

  async deleteContact(contactId) {
    if (!this.#client) return this.#warn("deleteContact");
    return this.#client.contacts.delete(contactId);
  }

  // ─── App-level template helpers ──────────────────────────────────────────────

  /**
   * Welcome email sent after successful registration.
   * @param {{ name: string, email: string }} user
   */
  async sendWelcome(user) {
    return this.send({
      to:      user.email,
      subject: "Welcome to BookMyTicket!",
      html: `
        <h2>Hi ${user.name},</h2>
        <p>Thanks for registering! You can now browse and book available seats.</p>
        <p>Happy booking!</p>
      `,
    });
  }

  /**
   * Email verification link sent after registration.
   * @param {{ name: string, email: string }} user
   * @param {string} verifyUrl  – full URL with token query param
   */
  async sendVerificationEmail(user, verifyUrl) {
    return this.send({
      to:      user.email,
      subject: "Verify your email – BookMyTicket",
      html: `
        <h2>Hi ${user.name},</h2>
        <p>Thanks for signing up! Please verify your email address by clicking the button below.</p>
        <p>This link expires in <strong>24 hours</strong>.</p>
        <p>
          <a href="${verifyUrl}"
             style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px">
            Verify Email
          </a>
        </p>
        <p>Or copy this link into your browser:<br/><small>${verifyUrl}</small></p>
      `,
    });
  }

  /**
   * Password-reset link email.
   * @param {{ name: string, email: string }} user
   * @param {string} resetUrl  – full URL with token query param
   */
  async sendPasswordReset(user, resetUrl) {
    return this.send({
      to:      user.email,
      subject: "Reset your password – BookMyTicket",
      html: `
        <h2>Hi ${user.name},</h2>
        <p>We received a request to reset your password. Click the button below to set a new one.</p>
        <p>This link expires in <strong>1 hour</strong>. If you didn't request this, you can ignore this email.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px">
            Reset Password
          </a>
        </p>
        <p>Or copy this link into your browser:<br/><small>${resetUrl}</small></p>
      `,
    });
  }

  /**
   * Booking confirmation email.
   * @param {{ name: string, email: string }} user
   * @param {{ seatId: string|number, category: string, price: number, txId: string|number, cardLast4: string }} booking
   */
  async sendBookingConfirmation(user, { seatId, category, price }) {
    const movie = process.env.MOVIE_NAME || "Dhurandhar The Revenge";

    return this.send({
      to:      user.email,
      subject: `Booking Confirmed – ${movie} | Seat #${seatId}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#10b981">Booking Confirmed!</h2>
          <p>Hi ${user.name}, your seat is reserved. See you at the show!</p>

          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr style="background:#f1f5f9">
              <td style="padding:10px 14px;font-weight:600">Movie</td>
              <td style="padding:10px 14px;font-weight:700">${movie}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-weight:600">Seat</td>
              <td style="padding:10px 14px">#${seatId} &nbsp;·&nbsp; ${category}</td>
            </tr>
            <tr style="background:#f1f5f9">
              <td style="padding:10px 14px;font-weight:600">Price</td>
              <td style="padding:10px 14px">₹${price}</td>
            </tr>
          </table>

          <p style="color:#64748b;font-size:13px">
            This is an automated confirmation. Please keep this email for your records.
          </p>
        </div>
      `,
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  #warn(method) {
    console.warn(`[EmailService] Skipping ${method}() – no API key configured.`);
  }
}

// Export a single shared instance
export const emailService = new EmailService();
