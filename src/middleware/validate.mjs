import { APIError } from "../utils/APIError.mjs";

/**
 * Returns an Express middleware that validates req.body or req.params
 * against the given Joi schema.
 *
 * @param {import("joi").Schema} schema
 * @param {"body"|"params"} source
 */
export function validate(schema, source = "body") {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[source] ?? {}, { abortEarly: false });

    if (error) {
      const details = error.details.map((d) => d.message);
      return next(new APIError(400, "Validation failed", details));
    }

    // Replace with the coerced/sanitised value (trimmed strings, lowercased email, etc.)
    req[source] = value;
    next();
  };
}
