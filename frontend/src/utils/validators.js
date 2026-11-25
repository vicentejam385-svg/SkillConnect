// src/utils/validators.js
// ── RegEx patterns ────────────────────────────────────────────────────────────
export const PATTERNS = {
  name:     /^[A-Za-zÀ-ÖØ-öø-ÿ\s'\-.]{1,100}$/u,
  mobile:   /^(\+639|09)\d{9}$/,                 // +639XXXXXXXXX or 09XXXXXXXXX
  phone:    /^[\d\s-]+$/,                         // landline: digits, spaces, dashes
  email:    /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/,
  username: /^[a-zA-Z0-9_]{4,30}$/,
  // Contract types must be a length of time, e.g. "2 Weeks", "3 Months", "5 Years ++"
  contractType:   /^\d{1,3}\s(Day|Week|Month|Year)s?(\s?\+{1,2})?$/i,
  // Specializations: letters, spaces and & / - ( ) only, e.g. "Electrician", "Masonry & Concrete"
  specialization: /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s&/()\-]*$/u,
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
  if (!PATTERNS.mobile.test(v.trim())) return 'Enter a valid PH mobile number (09XXXXXXXXX or +639XXXXXXXXX).';
  return null;
};

// Phone (landline) is always optional; only checked when something is typed
export const validatePhone = (v) => {
  if (!v || !v.trim()) return null;
  const digits = v.replace(/\D/g, '');
  if (!PATTERNS.phone.test(v.trim()) || digits.length < 7 || digits.length > 11) return 'Enter a valid phone number (e.g. 02 8123 4567), or leave it blank.';
  return null;
};

export const validateEmail = (v, required = false) => {
  if (!v || !v.trim()) return required ? 'Email is required.' : null;
  if (v.trim().length > 150 || !PATTERNS.email.test(v.trim())) return 'Enter a valid email address (e.g. name@example.com).';
  return null;
};

export const validatePassword = (v) => {
  if (!v || !v.trim()) return 'Password is required.';
  if (v.length > 64) return 'Password must be 64 characters or fewer.';
  if (!PATTERNS.password.test(v)) return 'Use at least 8 characters with an uppercase letter, a lowercase letter and a number.';
  return null;
};

export const validateUsername = (v) => {
  if (!v || !v.trim()) return 'Username is required.';
  if (!PATTERNS.username.test(v.trim())) return 'Username must be 4–30 characters: letters, numbers and underscores only.';
  return null;
};

// Names added on the Configuration page
export const validateConfigName = (v, kind) => {
  const t = (v || '').trim();
  if (!t) return 'Name is required.';
  if (t.length < 2 || t.length > 50) return 'Name must be 2–50 characters.';
  if (kind === 'contract_type' && !PATTERNS.contractType.test(t)) return 'Use a length of time, e.g. 2 Weeks, 3 Months or 1 Year.';
  if (kind === 'specialization' && !PATTERNS.specialization.test(t)) return 'Use letters only (spaces, & / - ( ) allowed).';
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