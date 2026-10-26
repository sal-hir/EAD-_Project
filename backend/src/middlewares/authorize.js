const { AppError } = require('./errorHandler');

// Role-based access control middleware factory
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

// Check if user owns resource or is admin/dispatcher
const authorizeOwnerOrAdmin = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      const resourceUserId = await getResourceUserId(req);
      const isOwner = req.user.id === resourceUserId;
      const isPrivileged = ['ADMIN', 'DISPATCHER'].includes(req.user.role);
      if (!isOwner && !isPrivileged) {
        return next(new AppError('You do not have permission to access this resource', 403));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = { authorize, authorizeOwnerOrAdmin };
