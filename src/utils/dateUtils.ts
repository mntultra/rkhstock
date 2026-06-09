export const formatDate = (dateInput: string | Date | null | undefined, locale: 'th-TH' | 'en-GB' = 'en-GB'): string => {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleDateString(locale, { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
};
