export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function exactObject(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key))) {
    throw new ApiError(400, 'invalid_input', 'Expected the documented JSON fields');
  }
}

export function textField(value, name, max = 128) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ApiError(400, 'invalid_input', `Invalid ${name}`);
  return value.trim();
}
