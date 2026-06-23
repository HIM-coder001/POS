const { validationResult } = require('express-validator');

/**
 * Runs after express-validator chains.
 * If there are validation errors, responds 422 with the first error message.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ message: errors.array()[0].msg });
  }
  next();
};

module.exports = validate;
