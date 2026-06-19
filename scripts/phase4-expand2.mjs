import { readFileSync, writeFileSync } from 'fs';

const templates = JSON.parse(readFileSync('scripts/phase4-templates.json', 'utf8'));

const e2 = templates.find(x => x.id === 'vascular-aorta-toracica');
e2.aiInstructions += `

14. PROTOCOLO DE VIGILÂNCIA LONGITUDINAL — ANEURISMA TORÁCICO CONHECIDO
───────────────────────────────────────────────────────────────
MEDIDAS SERIADAS — COMO MEDIR CORRETAMENTE:
  Método: borda externa a borda externa (outer-to-outer), perpendicular ao eixo do vaso.
  Evitar: medição oblíqua (superestima diâmetro em 20–30%).
  Comparar: mesma janela, mesma angulação do exame anterior.
  Variação entre exames: ±2 mm = erro de medida normal para US.
  Crescimento real: ≥4 mm entre exames comparáveis = progressão clínica.

FREQUÊNCIA DE VIGILÂNCIA:
  Ectasia (<4 cm): anual com US (se acessível) ou TC bianual.
  Aneurisma 4,0–4,9 cm: TC semestral.
  Aneurisma 5,0–5,4 cm: TC trimestral + avaliação cirúrgica vascular.
  Pós-reparo (TEVAR/cirurgia): TC em 1 mês, 6 meses, anual.

CONTROLE PÓS-TEVAR (ENDOLEAK):
  Tipo I (paraprótese proximal/distal): reintervenção indicada.
  Tipo II (ramos colaterais): vigiar; reintervenção se saco expansivo.
  Tipo III (fratura/kink da prótese): reintervenção.
  US limitado para endoleak — TC com contraste (3 fases) é padrão.
  US contraste-assistido (CEUS) pode auxiliar quando contraindicação à TC.

15. DIAGNÓSTICO DIFERENCIAL — MASSA PARAÓRTICA
───────────────────────────────────────────────────────────────
MASSA PARAÓRTICA:
  Adenomegalia mediastinal: hipoecoica, sem pulsação, sem PD arterial interno.
  Hematoma mediastinal: hipoecoico laminar após trauma torácico.
  Distinção ao US: massa pulsátil + paredes contínuas ao vaso = aneurisma.
  Massa não-pulsátil adjacente = extravascular → TC/PET para estadiamento.

ANEURISMA MICÓTICO (INFECCIOSO):
  Saculação focal excêntrica em aorta ateromatosa.
  Contexto: sepse, endocardite, infecção por Salmonella (idosos).
  Paredes irregulares + tecido peri-aórtico aumentado + gás (raro).
  → R6: avaliação cirúrgica urgente + hemoculturas.

16. INTEGRAÇÃO COM EXAMES COMPLEMENTARES
───────────────────────────────────────────────────────────────
TC AORTA TORÁCICA (padrão-ouro):
  Protocolo bifásico: sem contraste + fase arterial.
  MPR perpendicular ao eixo longo para medida precisa do diâmetro.
  Detecta endoleak, trombo, dissecção, úlcera penetrante, hematoma intramural.

RM AORTA:
  Sem radiação — ideal para jovens e Marfan em seguimento longitudinal.
  Sequências: MRA (contraste) + SSFP cineRM.
  Limitação: artefato de movimento + exame prolongado.

ECOCARDIOGRAMA TRANSTORÁCICO (ETT):
  Alta resolução para raiz aórtica e ascendente proximal.
  Exame de referência para Marfan e valva bicúspide (eixo paraesternal longo).
  Complementa o US vascular para porção proximal.

ECOCARDIOGRAMA TRANSESOFÁGICO (ETE):
  Padrão-ouro para dissecção e avaliação intraoperatória.
  Avalia toda a aorta torácica (exceto ponto cego traqueial entre raiz e arco).
  Acesso invasivo: sedação + sonda oral — ambiente hospitalar.`;

const e3 = templates.find(x => x.id === 'procedimentos-escleroterapia');
e3.aiInstructions += `

11. ESCLEROTERAPIA DE CISTO TIREOIDIANO — PROTOCOLO DETALHADO
───────────────────────────────────────────────────────────────
INDICACOES ESPECIFICAS:
  Cisto tireoidiano simples benigno (TI-RADS 1 ou 2) sintomático por efeito de massa.
  Cisto misto com componente solido <20%: indicacao favoravel.
  Alternativa cirurgia em paciente com alto risco operatorio.
  CONTRAINDICACAO: nodulo TI-RADS >= 3 sem biopsia previa (risco de malignidade).

TECNICA — INJECAO PERCUTANEA DE ETANOL (PEI):
  Paciente em decubito dorsal com pescoco hiperestendido.
  Agulha 21–22G, 10 cm. Transdutor linear 12–15 MHz.
  Passo 1: aspiracao total do conteudo cistico (registrar volume).
  Passo 2: instilacao etanol absoluto = 50% do volume aspirado (maximo 10 mL).
  Passo 3: rotacao do pescoco + movimentos do transdutor para distribuicao uniforme.
  Passo 4: manter por 3–5 minutos; reaspirar o etanol.
  Resultado: contracao e obliteracao em 80–95% dos casos.
  Sessoes: 1–3, intervalo de 4–6 semanas.
  Complicacao: dor cervical leve, febre baixa transitoria (esperadas).

ACOMPANHAMENTO POS-PEI:
  US em 1–3 meses: reducao >= 50% do volume = resposta adequada.
  Recorrencia: 10–15% em 2 anos (novas sessoes ou cirurgia).

12. DOCUMENTACAO — RELATÓRIO COMPLETO DE PROCEDIMENTO
───────────────────────────────────────────────────────────────
CAMPOS OBRIGATORIOS:
  Data/hora + identificacao do paciente.
  Indicacao clinica (diagnostico pre-procedimento).
  Estrutura-alvo: tipo, localizacao, dimensoes pre-procedimento.
  Agente esclerosante: nome + concentracao + volume total.
  Tecnica: espuma Tessari / PEI / liquido; proporcao esclerosante:ar.
  Acesso: numero de puncoes, agulha utilizada, anestesia.
  Achados intraoperatorios: posicao da agulha ao US, distribuicao do agente.
  Intercorrencias: ausentes / presentes + conduta tomada.
  Instrucoes ao paciente: compressao, restricoes, sinais de alerta.
  Data do controle programado (US controle em 4–6 semanas).
  Imagens arquivadas: >= 3 imagens (pre / agulha in situ / distribuicao do agente).
  Assinatura + CRM do executante.

GRAU DE SUCESSO TECNICO — DEFINICAO:
  Sucesso completo: distribuicao uniforme do agente em todo o alvo + sem extravasamento.
  Sucesso parcial: distribuicao em >= 50% do alvo.
  Insucesso tecnico: distribuicao <50% ou impossibilidade de acesso.

13. PROTOCOLO DE EMERGENCIA EM COMPLICACOES GRAVES
───────────────────────────────────────────────────────────────
REACAO ALERGICA GRAVE (ANAFILAXIA):
  Identificar: urticaria generalizada + hipotensao + broncoespasmo.
  Adrenalina 0,3 mg IM na coxa lateral. O2 por mascara.
  Acesso venoso + reposicao volumetrica. Acionar SAMU/emergencia.
  Documentar no laudo: descricao da reacao + conduta + desfecho.

MIGRAÇÃO CEREBRAL DE MICROBOLHAS (POS-ESPUMA):
  Identificar: alteracoes visuais transitoriias, cefaleia, confusao.
  Decubito dorsal + O2 100% por mascara por 30 min.
  Monitorar neurologicamente por 2 horas.
  Nao liberar o paciente se sintomas persistirem.

TVP POS-ESCLEROTERAPIA:
  Identificar: dor e edema crescente da panturrilha/coxa pos-procedimento.
  US duplex venoso: compressibilidade das veias profundas.
  TVP confirmada: anticoagulacao (HBPM ou DOAC por 3 meses).
  R6 se TVP proximal ou TEP suspeito.`;

writeFileSync('scripts/phase4-templates.json', JSON.stringify(templates, null, 2), 'utf8');

console.log('Phase 4 final template sizes:');
for (const x of templates) {
  const n = (x.aiInstructions || '').length;
  const s = n >= 14000 ? '[OK]' : n >= 12000 ? '[~] ' : '[!!]';
  console.log(`  ${s} ${x.name.padEnd(38)} ${n} chars`);
}
