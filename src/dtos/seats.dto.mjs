import Joi from "joi";

export const bookSeatDto = Joi.object({
  id: Joi.number().integer().positive().required(),
});
