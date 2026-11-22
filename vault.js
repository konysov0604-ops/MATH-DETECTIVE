// One atomic record: public names + encrypted teacher configuration.
export const KEY = 'math-detective.vault.v3';
export const LEGACY = 'math-detective.teacher.v1';
export const GROUPS = ['NATURAL', 'INTEGER', 'RATIONAL'];
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const bytes = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
export function valid(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.fixed) ||
      !Array.isArray(data.remaining) || data.remaining.length > 8) return false;
  const all = [...data.fixed, ...data.remaining];
  return all.every(s => s && typeof s.id === 'string' && s.id &&
    typeof s.name === 'string' && s.name.trim() && s.name.length <= 100) &&
    new Set(all.map(s => s.id)).size === all.length &&
    data.fixed.every(s => GROUPS.includes(s.group));
}
export function read() { return localStorage.getItem(KEY); }
export function project(data) {
  return Object.fromEntries(GROUPS.map(g => [g,
    data.fixed.filter(s => s.group === g).map(s => ({name:s.name}))]));
}
async function derive(password, salt) {
  const material = await crypto.subtle.importKey('raw', enc.encode(password),
    'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:600000,
    hash:'SHA-256'}, material, {name:'AES-GCM', length:256}, false,
    ['encrypt','decrypt']);
}
export async function unlock(raw, password) {
  const record = JSON.parse(raw);
  if (record.version !== 3 || record.kdf !== 'PBKDF2-SHA256-600000')
    throw new Error('Unsupported record');
  const salt = bytes(record.salt);
  const iv = bytes(record.iv);
  if (salt.length !== 16 || iv.length !== 12) throw new Error('Invalid record');
  const key = await derive(password, salt);
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key,
    bytes(record.ciphertext));
  const data = JSON.parse(dec.decode(plain));
  if (!valid(data)) throw new Error('Invalid data');
  return {key, salt, data};
}
export async function create(password, data) {
  if (!valid(data)) throw new Error('Invalid data');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {key:await derive(password, salt), salt, data};
}
export async function seal(session, data) {
  if (!valid(data)) throw new Error('Invalid data');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM', iv},
    session.key, enc.encode(JSON.stringify(data)));
  return JSON.stringify({version:3, kdf:'PBKDF2-SHA256-600000',
    salt:b64(session.salt), iv:b64(iv), ciphertext:b64(ciphertext),
    public:project(data)});
}
export function download(raw, filename) {
  const url = URL.createObjectURL(new Blob([raw], {type:'application/json'}));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// Future allocation code may receive the unassigned list only after unlock.
// No password or encryption key is stored in localStorage/sessionStorage.
