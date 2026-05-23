export const ADMIN_EMAIL = '011107miko@gmail.com';

export const isAdmin = (email: string | null | undefined): boolean =>
  email === ADMIN_EMAIL;
