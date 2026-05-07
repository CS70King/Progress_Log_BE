export const parseDateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

export const formatDateOnly = (value: Date | null) => {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
};
