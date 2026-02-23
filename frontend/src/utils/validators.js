export const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s.\-']{2,150}$/
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{5,100}$/
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]{8,255}$/
export const PHONE_REGEX = /^[+]?[0-9 ()\-]{7,20}$/
export const MOBILE_REGEX = /^(\+639\d{9}|09\d{9})$/
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const validate = {
  name: (v) => NAME_REGEX.test(v?.trim()) || 'Enter a valid name (letters only)',
  username: (v) =>
    USERNAME_REGEX.test(v?.trim()) ||
    'Username: min 5 chars, letters/numbers/underscore only',
  password: (v) =>
    PASSWORD_REGEX.test(v) ||
    'Min 8 chars with uppercase, lowercase, number & special character',
  phone: (v) => !v || PHONE_REGEX.test(v?.trim()) || 'Invalid phone number',
  mobile: (v) =>
    !v ||
    MOBILE_REGEX.test(v?.trim()) ||
    'Mobile must start with +639 or 09 and be 11 digits',
  email: (v) => !v || EMAIL_REGEX.test(v?.trim()) || 'Invalid email address',
}

export const normaliseMobile = (v) => {
  if (!v) return v
  const s = v.trim()
  if (s.startsWith('09')) return '+63' + s.slice(1)
  return s
}