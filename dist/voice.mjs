import { createCheckin, validDate } from './domain.mjs?v=13';
function dateFromText(text, today) {
  if (!today || !validDate(today)) throw Error('当前日期无效。');
  if (/明天|后天|下周|下个月|上周|上个月|星期|周[一二三四五六日天]/.test(text)) throw Error('语音支持今天、昨天、前天或明确日期，其他日期请手动选择。');
  const full = [...text.matchAll(/(20\d{2})[-年](\d{1,2})[-月](\d{1,2})[日号]?/g)];
  const withoutFull = text.replace(/20\d{2}[-年]\d{1,2}[-月]\d{1,2}[日号]?/g, '');
  const short = [...withoutFull.matchAll(/(\d{1,2})月(\d{1,2})[日号]/g)];
  const relative = [...new Set(text.match(/今天|昨天|前天/g) || [])];
  if (full.length + short.length + relative.length > 1) throw Error('这句话包含多个日期，请一次只记一天。');
  let date = today;
  if (full.length) date = `${full[0][1]}-${full[0][2].padStart(2, '0')}-${full[0][3].padStart(2, '0')}`;
  else if (short.length) date = `${today.slice(0, 4)}-${short[0][1].padStart(2, '0')}-${short[0][2].padStart(2, '0')}`;
  else if (relative[0] === '昨天' || relative[0] === '前天') {
    const value = new Date(today + 'T00:00:00Z');
    value.setUTCDate(value.getUTCDate() - (relative[0] === '前天' ? 2 : 1));
    date = value.toISOString().slice(0, 10);
  }
  if (!validDate(date) || date > today) throw Error('使用日期无效或在未来，请重新说。');
  return date;
}
export function parseVoiceCommand(card, raw, today) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 160) throw Error('请用最多160字描述一次已发生的使用。');
  const transcript = raw.trim(), text = transcript.replace(/[０-９]/g, value => String.fromCharCode(value.charCodeAt(0) - 65248)).replace(/\s+/g, '');
  if (/取消|别记|不要记|不对|查询|查看|多少|是否|能不能/.test(text) || /[吗?？]/.test(text)) throw Error('请描述一次已发生的使用，或直接手动填写。');
  if (/打算|准备|计划|如果|假如|可能|预计/.test(text)) throw Error('请只记录已发生的使用，未来安排可写在权益备注中。');
  if (/余额|还剩|剩余|校正|设置为|更新为|改成|充值|退款|转账/.test(text)) throw Error('当前版本不维护金额和次数；请描述本次使用，日期信息可在编辑权益中修改。');
  return { intent: 'checkin', date: dateFromText(text, today), transcript };
}
export function createVoiceUpdate(card, command, today) {
  if (command.intent !== 'checkin') throw Error('当前版本只支持使用打卡。');
  return createCheckin(card, { date: command.date, note: command.transcript }, today);
}
