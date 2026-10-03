import fs from 'node:fs';

// A smoke must name its model, or use the explicit runtime selection. Never inherit Desktop defaults.
export function smokeModel({ model = process.env.ROKID_SMOKE_MODEL, configFile = process.env.ROKID_SMOKE_CONFIG ?? '.local/config.json' } = {}) {
  model ??= JSON.parse(fs.readFileSync(configFile, 'utf8')).model;
  if (typeof model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(model)) throw new Error('smoke_model_required');
  return model;
}
