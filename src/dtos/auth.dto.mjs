import Joi from "joi";

export const registerDto = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(6).max(128).required(),
});

export const loginDto = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

export const forgotPasswordDto = Joi.object({
  email: Joi.string().email().lowercase().required(),
});

export const resetPasswordDto = Joi.object({
  token:    Joi.string().required(),
  password: Joi.string().min(6).max(128).required(),
});
