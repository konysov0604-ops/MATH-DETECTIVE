import {KEY, GROUPS, read, unlock} from './vault.js';

function refresh() {
  try {
    const raw = read();
    const record = raw === null ? null : JSON.parse(raw);
    if (record && record.version !== 3) throw new Error('Unsupported data');
    const teams = record?.public;
    if (record && (!teams || !GROUPS.every(group =>
      Array.isArray(teams[group]) && teams[group].every(student =>
        student && typeof student.name === 'string' &&
        student.name.trim() && student.name.length <= 100)))) {
      throw new Error('Invalid public data');
    }
    for (const group of GROUPS) {
      const list = document.getElementById('public-' + group);
      const fragment = document.createDocumentFragment();
      for (const student of teams?.[group] || []) {
        const item = document.createElement('li');
        item.textContent = student.name;
        fragment.append(item);
      }
      list.replaceChildren(fragment);
    }
  } catch (error) {
    // Never overwrite stored data on a parsing/read failure.
    // Keep last successfully rendered names; report only to developer console.
    console.error('MATH DETECTIVE: тізімді оқу мүмкін болмады.');
  }
}

// Reserved interface for the next stage. No allocation runs here.
// An authorized teacher must explicitly provide the password.
export async function getUnassignedForNextStage(password) {
  const raw = read();
  if (!raw) return [];
  const session = await unlock(raw, password);
  return session.data.remaining.map(s => ({id:s.id, name:s.name}));
}

window.addEventListener('storage', event => {
  if (event.key === KEY || event.key === null) refresh();
});
window.addEventListener('pageshow', refresh);
window.addEventListener('focus', refresh);
document.addEventListener('keydown', event => {
  if (event.altKey && event.shiftKey && event.code === 'KeyM') {
    event.preventDefault();
    location.href = './teacher.html';
  }
});
refresh();
