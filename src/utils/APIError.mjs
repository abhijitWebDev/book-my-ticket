export class APIError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {string[]} [details]
   */
  constructor(statusCode, message, details = []) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
