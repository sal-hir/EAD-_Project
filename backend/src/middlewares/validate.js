const { validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
    }));
    return next(new ValidationError(details));
  }
  next();
};

module.exports = { validate };
