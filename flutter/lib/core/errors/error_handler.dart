import '../network/api_client.dart';

/// Voltium Error Handler
///
/// Centralized error handling for API errors, validation errors, and unexpected failures.
class AppError implements Exception {
  final String message;
  final String? code;
  final dynamic originalError;

  AppError(this.message, {this.code, this.originalError});

  @override
  String toString() => 'AppError($code): $message';
}

/// Standardized error handler for API responses
class ErrorHandler {
  /// Convert any error to a user-friendly message
  static String getUserFriendlyMessage(dynamic error) {
    if (error is ApiException) {
      if (error.code == 'VALIDATION_ERROR') {
        return 'Validation failed: ${error.message}';
      }
      if (error.code == 'UNAUTHORIZED') {
        return 'Session expired. Please log in again.';
      }
      if (error.code == 'FORBIDDEN') {
        return 'You do not have permission to perform this action.';
      }
      return error.message;
    }
    if (error is AppError) {
      return error.message;
    }
    if (error is FormatException) {
      return 'Invalid data received. Please try again.';
    }
    return 'Something went wrong. Please try again.';
  }

  /// Log error for debugging
  static void logError(dynamic error, {String? context}) {
    // TODO: Send to Sentry in production
    print('[${context ?? 'ERROR'}] $error');
  }
}
