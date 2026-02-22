exports.success = (res, data, message) => {
  res.status(200).json({
    success: true,
    data: data,
    message: message || "Operation completed successfully",
  });
};

exports.error = (res, message, code = 400) => {
  res.status(code).json({
    success: false,
    error: message || "An error occurred during the operation",
  });
};
