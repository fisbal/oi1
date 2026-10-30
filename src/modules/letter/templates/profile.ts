// "My info": the details a person types once (name, address, rank, unit…) and every new letter or CV fills in
// for them. Kept on this device only, under the field names the templates use in each language.

export const PROFILE_KEYS = ['name', 'firstName', 'address', 'city', 'town', 'phone', 'email', 'web', 'rank', 'position', 'unit', 'serviceNo'] as const;
export type ProfileKey = (typeof PROFILE_KEYS)[number];
export type Profile = Partial<Record<ProfileKey, string>>;

/** The field labels that mean each detail, in every template language. */
const ALIASES: Record<ProfileKey, string[]> = {
  name: ['Prénom Nom', 'First and last name', 'Nom complet', 'Full name'],
  firstName: ['Prénom', 'First name'],
  address: ['Adresse', 'Address'],
  city: ['Ville, province, code postal', 'City, province, postal code'],
  town: ['Ville', 'City', 'Ville, province', 'City, province'],
  phone: ['Téléphone', 'Phone'],
  email: ['Courriel', 'Email'],
  web: ['LinkedIn ou site', 'LinkedIn or website'],
  rank: ['Grade', 'Rank'],
  position: ['Poste', 'Position'],
  unit: ['Unité', 'Unit'],
  serviceNo: ['Matricule', 'Service number'],
};
/** Fields made of two details, like [Grade Nom] or [Rank First and last name]. */
const COMBOS: Record<string, (p: Profile) => string | undefined> = {
  'Grade Nom': p => p.rank && p.name ? `${p.rank} ${p.name}` : undefined,
  'Rank Name': p => p.rank && p.name ? `${p.rank} ${p.name}` : undefined,
  'Grade Prénom Nom': p => p.rank && p.name ? `${p.rank} ${p.name}` : undefined,
  'Rank First and last name': p => p.rank && p.name ? `${p.rank} ${p.name}` : undefined,
};

const STORE = 'oi1.letter.profile';

export function loadProfile(): Profile {
  try { return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Profile; } catch { return {}; }
}
export function saveProfile(p: Profile) {
  try { localStorage.setItem(STORE, JSON.stringify(p)); } catch { /* private window */ }
}

/** The detail a field label stands for, if any. */
export function profileKeyOf(label: string): ProfileKey | null {
  const l = label.trim().toLowerCase();
  return PROFILE_KEYS.find(k => ALIASES[k].some(a => a.toLowerCase() === l)) ?? null;
}

/** What "My info" already knows for each of these field labels. */
export function profileValues(labels: string[], p = loadProfile()): Record<string, string> {
  const out: Record<string, string> = {};
  for (const label of labels) {
    const k = profileKeyOf(label);
    const v = k ? p[k] : COMBOS[label]?.(p);
    if (v?.trim()) out[label] = v.trim();
  }
  return out;
}

/** Learns the details among filled fields, so the next letter knows them. */
export function rememberValues(values: Record<string, string>, p = loadProfile()): Profile {
  const next = { ...p };
  for (const [label, v] of Object.entries(values)) {
    const k = profileKeyOf(label);
    if (k && v.trim()) next[k] = v.trim();
  }
  saveProfile(next);
  return next;
}
