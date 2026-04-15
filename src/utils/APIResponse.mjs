export class APIResponse {
  /**
   * @param {import("express").Response} res
   * @param {number} statusCode
   * @param {string} message
   * @param {*} data
   */
  constructor(res, statusCode, message, data = null) {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data,
    });
  }
}
