// src/utils/validators.js
// ── RegEx patterns ────────────────────────────────────────────────────────────
export const PATTERNS = {
  name:     /^[A-Za-zÀ-ÖØ-öø-ÿ\s'\-.]{1,100}$/u,
  mobile:   /^(\+63|09)\d{9}$/,
  email:    /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
  username: /^[a-zA-Z0-9_]{5,100}$/,
};

// ── Individual validators (return error string or null) ───────────────────────
export const validateFirstName = (v) => {
  if (!v || !v.trim()) return 'First name is required.';
  if (!PATTERNS.name.test(v.trim())) return 'First name contains invalid characters.';
  return null;
};

export const validateLastName = (v) => {
  if (!v || !v.trim()) return 'Last name is required.';
  if (!PATTERNS.name.test(v.trim())) return 'Last name contains invalid characters.';
  return null;
};

export const validateMobile = (v, required = false) => {
  if (!v || !v.trim()) return required ? 'Mobile number is required.' : null;
  if (!PATTERNS.mobile.test(v.trim())) return 'Mobile must start with +63 or 09 followed by 9 digits.';
  return null;
};

export const validateEmail = (v, required = false) => {
  if (!v || !v.trim()) return required ? 'Email is required.' : null;
  if (!PATTERNS.email.test(v.trim())) return 'Enter a valid email address.';
  return null;
};

export const validatePassword = (v) => {
  if (!v || !v.trim()) return 'Password is required.';
  if (!PATTERNS.password.test(v)) return 'Password must be at least 8 characters with uppercase, lowercase, and a number.';
  return null;
};

export const validateUsername = (v) => {
  if (!v || !v.trim()) return 'Username is required.';
  if (!PATTERNS.username.test(v.trim())) return 'Username must be 5–100 characters (letters, numbers, underscores only).';
  return null;
};

// ── 9. Description required only if reason is "Other" ────────────────────────
export const validateDescription = (description, reason) => {
  if (reason === 'Other' && (!description || !description.trim())) {
    return 'Description is required when reason is "Other".';
  }
  return null;
};

// ── 10. Job Order description always required ─────────────────────────────────
export const validateJobOrderDescription = (v) => {
  if (!v || !v.trim()) return 'Description is required.';
  return null;
};

// ── Generic required ──────────────────────────────────────────────────────────
export const validateRequired = (v, label = 'This field') => {
  if (!v && v !== 0) return `${label} is required.`;
  if (typeof v === 'string' && !v.trim()) return `${label} is required.`;
  return null;
};

// ── Validate entire form object, returns { isValid, errors } ─────────────────
export const validateContactForm = (form) => {
  const errors = {};
  const e = (f, msg) => { if (msg) errors[f] = msg; };

  e('first_name', validateFirstName(form.first_name));
  e('last_name',  validateLastName(form.last_name));
  e('mobile',     validateMobile(form.mobile));
  e('email',      validateEmail(form.email));

  return { isValid: Object.keys(errors).length === 0, errors };
};

export const validateWorkerForm = (form) => {
  const errors = {};
  const e = (f, msg) => { if (msg) errors[f] = msg; };

  e('first_name',        validateFirstName(form.first_name));
  e('last_name',         validateLastName(form.last_name));
  e('mobile',            validateMobile(form.mobile, true));
  e('email',             validateEmail(form.email, true));
  e('username',          validateUsername(form.username));
  e('specialization_id', validateRequired(form.specialization_id, 'Specialization'));

  return { isValid: Object.keys(errors).length === 0, errors };
};

export const validateJobOrderForm = (form) => {
  const errors = {};
  const e = (f, msg) => { if (msg) errors[f] = msg; };

  e('worker_contact_id', validateRequired(form.worker_contact_id, 'Worker'));
  e('client_contact_id', validateRequired(form.client_contact_id, 'Client'));
  e('contract_type_id',  validateRequired(form.contract_type_id,  'Contract type'));
  e('start_date',        validateRequired(form.start_date,        'Start date'));
  e('end_date',          validateRequired(form.end_date,          'End date'));
  e('description',       validateJobOrderDescription(form.description));

  if (form.start_date && form.end_date && form.start_date >= form.end_date) {
    errors.end_date = 'End date must be after start date.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

// ── validate object (used by SuperAdminDashboard) ─────────────────────────────
// Returns true if valid, or an error string if invalid
export const validate = {
  name: (v) => {
    if (!v || !v.trim()) return 'Full name is required.';
    if (v.trim().length < 2) return 'Name must be at least 2 characters.';
    return true;
  },
  username: (v) => {
    const err = validateUsername(v);
    return err === null ? true : err;
  },
  password: (v) => {
    const err = validatePassword(v);
    return err === null ? true : err;
  },
  mobile: (v, required = false) => {
    const err = validateMobile(v, required);
    return err === null ? true : err;
  },
  email: (v, required = false) => {
    const err = validateEmail(v, required);
    return err === null ? true : err;
  },
};