// Presentation only: canonical assistant text remains unchanged in gateway history.
// Ink <text> collapses embedded newlines. Column children preserve logical lines.
export function answerLines(text) {
  return String(text || '').slice(0, 16000).split(/\r\n|\r|\n/).map((text, id) => ({ id, text, blank: !text.trim() }));
}
