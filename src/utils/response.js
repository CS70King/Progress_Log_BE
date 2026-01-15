/**
 * Standardized response utility functions
 */

const successResponse = (data, message = 'Success', statusCode = 200) => ({
  success: true,
  data,
  message,
  statusCode
});

const errorResponse = (code, message, details = null, statusCode = 400) => ({
  success: false,
  error: {
    code,
    message,
    ...(details && { details })
  },
  statusCode
});

const paginatedResponse = (items, pagination, message = 'Success') => ({
  success: true,
  data: {
    items,
    pagination
  },
  message
});

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse
};
