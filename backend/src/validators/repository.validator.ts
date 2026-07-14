import { body } from "express-validator";

export const importRepositoryValidation = [
  body("url")
    .notEmpty()
    .withMessage("Repository URL is required")
    .isURL()
    .withMessage("Invalid URL")
    .matches(/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/)
    .withMessage("Only valid GitHub repository URLs are allowed"),
];