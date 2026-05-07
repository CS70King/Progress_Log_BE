export type ApiFieldError = {
  field: string;
  message: string;
};

export class AppError extends Error {
  statusCode: number;
  code: string;
  errors?: ApiFieldError[];

  constructor(statusCode: number, message: string, code = 'APP_ERROR', errors?: ApiFieldError[]) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
  }
}
