export const ADMIN_EMAILS = [
  '011107miko@gmail.com',
  'szczelkunmikolaj@gmail.com',
];

export const isAdmin = (email: string | null | undefined): boolean =>
  ADMIN_EMAILS.includes(email ?? '');
