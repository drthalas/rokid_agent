// Adapt the reference's raw PCM transport to the existing gateway's canonical WAV contract.
export function pcmToWav(pcm) {
  const bytes = pcm instanceof Uint8Array ? pcm : new Uint8Array(pcm);
  if (bytes.length <= 3200 || bytes.length > 960000 || bytes.length % 2) throw new Error('invalid_audio_size');
  const result = new Uint8Array(44 + bytes.length), view = new DataView(result.buffer);
  const ascii = (at, value) => { for (let i = 0; i < value.length; i++) result[at + i] = value.charCodeAt(i); };
  ascii(0, 'RIFF'); view.setUint32(4, result.length - 8, true); ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, bytes.length, true); result.set(bytes, 44);
  return result.buffer;
}
