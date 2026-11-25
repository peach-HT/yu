export const TYPES = ['term', 'count', 'cash'];
export function validDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateCard(card) {
  return !!card && typeof card.id === 'string' && card.id.length > 0 &&
    typeof card.name === 'string' && card.name.trim().length > 0 && card.name.length <= 40 &&
    typeof card.provider === 'string' && card.provider.length <= 40 && TYPES.includes(card.type) &&
    [card.start, card.end].every(value => typeof value === 'string' && validDate(value)) &&
    (!card.start || !card.end || card.start <= card.end) &&
    typeof card.noExpiry === 'boolean' && (!card.noExpiry || card.end === '') &&
    typeof card.notes === 'string' && card.notes.length <= 300 && typeof card.archived === 'boolean' &&
    Number.isSafeInteger(card.revision) && card.revision >= 0 &&
    // Legacy fields remain read-only; new cards do not need them.
    (!('quantity' in card) || card.quantity === null || (Number.isSafeInteger(card.quantity) && card.quantity >= 0 && card.quantity <= (card.type === 'count' ? 9999 : 9999999999))) &&
    (!('verified' in card) || (typeof card.verified === 'string' && validDate(card.verified)));
}
export function isLegacyAccounting(event) {
  return event.kind === 'adjust' || (event.debit ?? 0) !== 0;
}
export function validateEvent(event, cards) {
  const card = cards.find(item => item.id === event?.cardId);
  if (!card || typeof event.id !== 'string' || !event.id || !event.date || !validDate(event.date) ||
      typeof event.note !== 'string' || event.note.length > 160 || typeof event.undone !== 'boolean' ||
      !Number.isSafeInteger(event.revisionAfter) || event.revisionAfter < 1 ||
      (event.kind !== undefined && !['use', 'adjust'].includes(event.kind))) return false;
  const legacy = ['debit', 'previousQuantity', 'afterQuantity'].some(key => key in event);
  if (!legacy) return event.kind === 'use';
  if (!Number.isSafeInteger(event.debit) || ![event.previousQuantity, event.afterQuantity].every(value => value === null || (Number.isSafeInteger(value) && value >= 0))) return false;
  if (event.kind === 'adjust') return card.type !== 'term' && event.afterQuantity !== null &&
    event.afterQuantity <= (card.type === 'count' ? 9999 : 9999999999) &&
    (event.previousQuantity === null ? event.debit === 0 : event.previousQuantity - event.debit === event.afterQuantity) &&
    typeof event.previousVerified === 'string' && validDate(event.previousVerified);
  return event.debit >= 0 && (event.previousQuantity === null ? event.debit === 0 && event.afterQuantity === null : event.previousQuantity - event.debit === event.afterQuantity);
}
export function validateState(state) {
  return !!state && Array.isArray(state.cards) && Array.isArray(state.events) && typeof state.demo === 'boolean' &&
    state.cards.every(validateCard) && new Set(state.cards.map(card => card.id)).size === state.cards.length &&
    state.events.every(event => validateEvent(event, state.cards)) && new Set(state.events.map(event => event.id)).size === state.events.length;
}
export function createCheckin(card, input, today) {
  if (!validateCard(card)) throw Error('权益信息无效，请先核对。');
  if (card.archived) throw Error('请先恢复这项权益，再记录使用。');
  if (!today || !validDate(today) || !input.date || !validDate(input.date) || input.date > today) throw Error('请选择今天或过去的实际使用日期。');
  if ((card.start && input.date < card.start) || (card.end && input.date > card.end)) throw Error('使用日期超出已记录的有效期，请先核对日期。');
  if (typeof input.note !== 'string' || input.note.length > 160) throw Error('使用备注最多160字。');
  if (input.debit || input.amount !== undefined || input.units !== undefined) throw Error('当前版本只记录使用，不维护金额或次数。');
  const next = { ...card, revision: card.revision + 1 };
  return { card: next, event: { kind: 'use', date: input.date, note: input.note, revisionAfter: next.revision, undone: false } };
}
export function undoCheckin(card, event) {
  if (isLegacyAccounting(event)) throw Error('旧版扣减和校正记录仅供回顾，当前版本不再修改余量。');
  if (event.undone || card.revision !== event.revisionAfter) throw Error('后续记录或权益已改变，无法直接撤销这条记录。');
  return { ...card, revision: card.revision + 1 };
}
export function shiftMonth(month, delta) {
  const [year, value] = month.split('-').map(Number), date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function monthCells(month) {
  const [year, value] = month.split('-').map(Number);
  const offset = (new Date(Date.UTC(year, value - 1, 1)).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, value, 0)).getUTCDate();
  return [...Array(offset).fill(null), ...Array.from({ length }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
}
