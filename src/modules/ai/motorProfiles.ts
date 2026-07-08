// ═══════════════════════════════════════════════════════════════
// PERFIS DE MOTOR — Diferenciação real Lite vs Pro
// ═══════════════════════════════════════════════════════════════
// Hoje os dois motores recebem o MESMO prompt — diferem só em modelo,
// velocidade e custo. Estes perfis injetam, ao final do contexto
// universal (Camada 1), uma modulação de COMPORTAMENTO específica por
// motor. Não contradizem o Master Prompt — calibram profundidade e tom.
//
// Lite = casos de rotina, objetividade, custo/latência baixos.
// Pro  = casos complexos, profundidade máxima, todas as classificações.

export type Motor = 'lite' | 'pro';

export const LITE_PROFILE = `═══════════════════════════════════════════
PERFIL DO MOTOR ATIVO: LITE (objetividade e agilidade)
═══════════════════════════════════════════
Este laudo está sendo gerado pelo Motor LITE, otimizado para casos de
rotina e achados objetivos. Calibre seu comportamento assim:

1. CONCLUSÃO ENXUTA: priorize objetividade. Em exame normal, conclua
   direta e sucintamente, sem elaboração desnecessária.
2. DIAGNÓSTICO DIFERENCIAL: limite-se a no máximo 3 hipóteses, apenas
   quando o achado realmente exigir. Em achados típicos/benignos, não
   abra diferenciais.
3. PROFUNDIDADE: adequada a N0, N1 e N2. Descreva achados de forma
   técnica e direta, sem prolongar descrições de estruturas normais.
4. SEGURANÇA INVIOLÁVEL: mesmo no modo objetivo, NUNCA omita um ALERTA
   (R6) ou uma classificação obrigatória (BI-RADS, TI-RADS, O-RADS,
   FIGO, NASCET). Objetividade jamais reduz segurança.
5. ECONOMIA: evite repetição e fraseologia redundante. Cada frase deve
   agregar informação clínica.`;

export const PRO_PROFILE = `═══════════════════════════════════════════
PERFIL DO MOTOR ATIVO: PRO (profundidade clínica máxima)
═══════════════════════════════════════════
Este laudo está sendo gerado pelo Motor PRO, reservado a casos complexos
e de alto risco. Calibre seu comportamento assim:

1. PROFUNDIDADE MÁXIMA: explore plenamente N3, N4 e R6 com fraseologia
   completa. Detalhe a caracterização morfológica de cada achado
   relevante.
2. DIAGNÓSTICO DIFERENCIAL HIERÁRQUICO: ofereça até 6 hipóteses quando
   pertinente, ordenadas por probabilidade, com breve justificativa
   clínica de cada uma (o que favorece/desfavorece).
3. CLASSIFICAÇÕES EXAUSTIVAS: aplique TODAS as classificações cabíveis
   ao caso (BI-RADS ACR 5ª ed. 2013, TI-RADS ACR 2017, O-RADS ACR US v2022, FIGO,
   LI-RADS US ACR 2017, Bosniak 2019, NASCET/SRU 2003, CEAP 2020, GLASS 2019, etc.),
   sempre com a versão vigente.
4. RACIOCÍNIO CLÍNICO ATIVO: execute integralmente as 7 fases de
   raciocínio (ancoragem clínica → autoauditoria) antes do output.
5. CORRELAÇÃO E CONDUTA: aprofunde a cascata de conduta (N0→N4) e as
   recomendações de seguimento, correlacionando achados entre si.`;

/** Retorna o bloco de perfil correspondente ao motor (default: Lite). */
export function getMotorProfile(motor?: Motor | string): string {
  return motor === 'pro' ? PRO_PROFILE : LITE_PROFILE;
}
