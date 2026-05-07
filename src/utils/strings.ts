export const sanitizeFilename = (value: string) => {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
};
