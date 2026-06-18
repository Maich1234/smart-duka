/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Kenyan format: 07xx xxx xxx or 2547xxxxxxxx)
 */
export const isValidPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  const kenyanRegex = /^(07|2547)\d{8}$/;
  return kenyanRegex.test(cleaned);
};

/**
 * Validate password strength (min 6 chars)
 */
export const isStrongPassword = (password: string): boolean => {
  return password.length >= 6;
};

/**
 * Validate that two passwords match
 */
export const doPasswordsMatch = (password: string, confirmPassword: string): boolean => {
  return password === confirmPassword;
};

/**
 * Validate product quantity (positive integer)
 */
export const isValidQuantity = (quantity: number): boolean => {
  return Number.isInteger(quantity) && quantity >= 0;
};

/**
 * Validate price (positive number)
 */
export const isValidPrice = (price: number): boolean => {
  return typeof price === 'number' && price >= 0;
};