export function isBuildQuery(text) {
  if (typeof text !== 'string') return false;
  const words = text.toLowerCase().replace(/[?!.,:;«»]/g, ' ').trim().replace(/\s+/g, ' ');
  return /^(?:(?:джарвис|jarvis) )?(?:какая (?:версия|сборка)(?: (?:джарвис|jarvis))?|какой билд (?:установлен|джарвис|jarvis)|что за (?:версия|сборка)(?: (?:джарвис|jarvis))?)$/.test(words);
}

export function buildLabel(info) {
  if (!info || !/^[a-f0-9]{40}$/.test(info.gitSha) || !/^[a-f0-9-]{36}$/.test(info.releaseId)) return 'Сборка Jarvis не определена';
  return `Jarvis build ${info.gitSha.slice(0, 7)} · resource ${info.releaseId}`;
}
