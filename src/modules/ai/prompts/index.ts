export * from './general';

import { medicinaInternaPrompt } from './areas/medicina-interna';
import { ginecologiaPrompt } from './areas/ginecologia';
import { mastologiaPrompt } from './areas/mastologia';
import { medicinaFetalPrompt } from './areas/medicina-fetal';
import { pequenasPartesPrompt } from './areas/pequenas-partes';
import { musculoesqueleticoPrompt } from './areas/musculoesqueletico';
import { vascularPrompt } from './areas/vascular';
import { pediatriaPrompt } from './areas/pediatria';
import { procedimentosPrompt } from './areas/procedimentos';
import { reumatologicoPrompt } from './areas/reumatologico';

export const AREA_SPECIFIC_PROMPTS: Record<string, string> = {
  'medicina-interna': medicinaInternaPrompt,
  'ginecologia': ginecologiaPrompt,
  'mastologia': mastologiaPrompt,
  'medicina-fetal': medicinaFetalPrompt,
  'pequenas-partes': pequenasPartesPrompt,
  'musculoesqueletico': musculoesqueleticoPrompt,
  'vascular': vascularPrompt,
  'pediatria': pediatriaPrompt,
  'procedimentos': procedimentosPrompt,
  'reumatologico': reumatologicoPrompt,
};
