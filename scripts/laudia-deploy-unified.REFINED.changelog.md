# Changelog — Auditoria Camada 3 (máscaras)


## musculoesqueletico — OMBRO (`F2TVThjVXGXlyXAL7YUn`)

_The OMBRO mask is generally well-structured and detailed (classification checklist, exact recommendation phraseology per N-tier, technique, output skeleton), and its cited classification systems (Ellman, OMERACT 2017, EULAR-OMERACT 0-3) are consistent with R10's MSK adjunct list. However, it has one clear clinically-consequential internal contradiction in N-tier classification for the same finding (cisto paralabral com compressão nervosa: N4 vs N3), and a structural defect where a "FIM DO PROMPT" end-marker appears mid-file with ~100 lines of substantive, operative instructions following it, undermining the document's own section boundaries._

- **[internal-contradiction]** Contradiz diretamente a classificação já estabelecida na seção principal (linha 93: "Cisto paralabral... N4 (com compressão nervosa)"). Como N4 aciona ALERTA DE LESÃO ESTRUTURAL AGUDA e recomendação prioritária (linhas 110, 112, 121, 162) enquanto N3 aciona um cenário de recomendação distinto e menos urgente (linha 109), essa divergência pode levar a classificações de urgência inconsistentes para o mesmo achado clínico.

  - ANTES: `→ Cisto paralabral comprimindo nervo: N3 → artroscopia.`
  - DEPOIS: `→ Cisto paralabral comprimindo nervo: N4 (compressão nervosa) → artroscopia.`


## musculoesqueletico — COTOVELO (`BK0BJr6BTbqIgCtsKa7Y`)

_This mask (COTOVELO) is well-structured and internally consistent overall: N0-N4 classification tiers are used coherently, recommendation phraseology follows the house "sugere-se/recomenda-se/considerar" style consistently, ALERTA tags are applied correctly to N4 findings, and the OMERACT/EULAR-OMERACT citations (2017, score 0-3) match R10's approved adjunct-system list for MSK exams. One concrete numeric defect was found in the ulnar nerve AST threshold definition, which leaves a boundary interval undefined/self-contradictory._

- **[internal-contradiction]** Internal numeric inconsistency: the threshold states normal is '≤7,5 mm²' but the gray zone is defined starting at '8', leaving the interval from 7,5 to 8 mm² unclassified (neither normal nor gray zone). Aligning the gray-zone lower bound to 7,5 mm² closes the gap so every value maps to exactly one category.

  - ANTES: `AST do nervo ulnar no epicôndilo medial: ≤7,5 mm² normal; >10 mm² = neuropatia compressiva provável (zona cinzenta 8–10 mm²).`
  - DEPOIS: `AST do nervo ulnar no epicôndilo medial: ≤7,5 mm² normal; >10 mm² = neuropatia compressiva provável (zona cinzenta 7,5–10 mm²).`


## musculoesqueletico — PUNHO (`oJY7jg9CmiGzcdoEsJee`)

_This is a well-constructed, internally coherent Camada 3 mask for punho ultrasound. It correctly scopes OMERACT/EULAR-OMERACT (2017) as an MSK adjunct system per R10, does not invoke any of the R10-governed classification systems (BI-RADS/TI-RADS/etc.) inappropriately, and its N0-N4 tiers, recommendation phrasing, and CTS thresholds are consistent throughout. The only defect found is a small verbatim redundancy in the OMERACT appendix where "DERRAME ARTICULAR" is defined twice with near-identical wording under two different labels (K1 and K3), adding no distinguishing value._

- **[redundancy]** K1 (linhas 193-194) e K3 (linha 214) definem 'DERRAME ARTICULAR' com a mesma redação clínica (material/coleção anecoica/hipoecoica intra-articular, deslocável, compressível, sem Doppler), duplicando conteúdo sem agregar distinção. Como K3 também cobre BURSITE, a correção remove a repetição mantendo a referência cruzada a K1.

  - ANTES: `K3 — DERRAME / BURSITE (referências rápidas OMERACT):
  DERRAME ARTICULAR: coleção anecoica/hipoecoica intra-articular, deslocável e compressível, SEM sinal Doppler.
  BURSITE: distensão da bursa por`
  - DEPOIS: `K3 — BURSITE (referência rápida OMERACT):
  BURSITE: distensão da bursa por líquido ± espessamento sinovial ± Doppler (atividade inflamatória se PD+). (Definição de derrame articular: ver K1.)`


## musculoesqueletico — MÃO E PUNHO (`XGza8OaqygJeXzBq2xjx`)

_Mask is thorough, well-structured (classification tiers, phrasing per scenario, checklist, deep-dive appendix) and consistent with R10 since MSK's only cited adjunct system (EULAR-OMERACT 0-3) has no version conflict. The one high-confidence defect is an internal contradiction in the carpal tunnel CSA reference thresholds: three different formulations of the same cutoff appear across the file and do not agree with each other, most notably the report-template boilerplate line which merges two bands into a garbled "≤9–12 mm²" normal range that contradicts both the main-body and the appendix thresholds._

- **[internal-contradiction]** Internal contradiction (violates instruction 3: 'two different reference ranges or thresholds for the same measurement'). The report-template boilerplate states the normal CSA reference as '≤9–12 mm²', which conflates two different bands. Elsewhere in the same mask, line 42 says the abnormal threshold is '>10-12 mm²' and the APROFUNDAMENTO appendix (line 135) explicitly defines '≤9 mm² normal | 10–12 mm² leve | 13–14 mm² moderada | ≥15 mm² grave'. A range of '≤9–12' as 'normal' contradicts both other statements, which treat 10-12 mm² as already mildly abnormal (N2/leve), not normal.

  - ANTES: `Nervo mediano com contornos, ecotextura fascicular e calibre normais — área de secção transversa ao nível do pisiforme de [__] mm² (referência: ≤9–12 mm²).`
  - DEPOIS: `Nervo mediano com contornos, ecotextura fascicular e calibre normais — área de secção transversa ao nível do pisiforme de [__] mm² (referência: ≤9 mm² = normal).`


## musculoesqueletico — TORNOZELO (`Vj1Jkm5MF0rXBg0A8pRM`)

_A máscara é detalhada, bem estruturada e majoritariamente coerente, com boa cobertura de achados obrigatórios, fraseologia de recomendações por camada de risco (N0-N4) e um protocolo quantitativo robusto para o tendão de Aquiles (ESSR 2021/AIUM). Não há conflitos de versão de classificação frente ao R10 (os sistemas citados — ESSR, OMERACT, EULAR-OMERACT, VISA-A — são adjuntos de MSK, corretamente datados e fora do escopo de "não misturar" do R10). Os dois problemas encontrados são: (1) um limiar numérico contraditório na espessura normal vs. patológica do tendão de Aquiles, e (2) uma definição duplicada verbatim de "DERRAME ARTICULAR" entre os blocos K1 e K3 no apêndice final._

- **[internal-contradiction]** O limiar de 6 mm é atribuído simultaneamente à faixa normal ("≤6 mm") e à tendinopatia focal ("≥6 mm"), tornando o valor exato de 6 mm classificável como normal E patológico ao mesmo tempo — contradição interna de limiar. Ajustar o limite normal para "<6 mm" elimina a sobreposição e mantém consistência com o critério de tendinopatia já definido na mesma linha.

  - ANTES: `• **Espessura:** Normal ≤6 mm no terço médio (3–6 cm proximal à inserção calcanear).
        Tendinopatia: ≥6 mm focal ou ≥7 mm difuso + hipoecoicidade + perda do padrão fibrilar.`
  - DEPOIS: `• **Espessura:** Normal <6 mm no terço médio (3–6 cm proximal à inserção calcanear).
        Tendinopatia: ≥6 mm focal ou ≥7 mm difuso + hipoecoicidade + perda do padrão fibrilar.`

- **[redundancy]** A definição de "DERRAME ARTICULAR" em K3 repete quase verbatim a definição já dada em K1 (mesma redação: coleção/material anecoico-hipoecoico intra-articular, deslocável, compressível, sem Doppler), sem agregar informação nova — redundância pura dentro da própria máscara. Mantém-se apenas a definição de BURSITE, que é o conteúdo não duplicado do bloco K3.

  - ANTES: `K3 — DERRAME / BURSITE (referências rápidas OMERACT):
  DERRAME ARTICULAR: coleção anecoica/hipoecoica intra-articular, deslocável e compressível, SEM sinal Doppler.
  BURSITE: distensão da bursa por`
  - DEPOIS: `K3 — BURSITE (referência rápida OMERACT):
  BURSITE: distensão da bursa por líquido ± espessamento sinovial ± Doppler (atividade inflamatória se PD+).`


## musculoesqueletico — PÉ (`wxMCzIXAkxlOrof7vzlF`)

_The mask is thorough and well-organized (compartmental checklist, N0-N4 severity tiers, exact recommendation phraseology per scenario, HTML skeleton, and a detailed MSK/OMERACT addendum). It correctly cites OMERACT/EULAR-OMERACT with a year and stays inside R10's allowed adjunct-system list for MSK. The one high-confidence defect is an internal contradiction between two Morton's neuroma size-based diagnostic-confidence statements (line 149 vs. lines 216-218), which give different confidence levels for the same 5-7mm size band and could cause inconsistent report language depending on which section the model draws from._

- **[internal-contradiction]** Line 149 states that any nodule ≥5mm is already "provável neuroma sintomático" (near-confirmatory), while the more granular size-based section at lines 216-218 ("CLASSIFICAÇÃO POR TAMANHO") reserves that confidence level for >7mm and calls 5-7mm only "compatível...leve a moderado". These are two different diagnostic-confidence thresholds for the identical 5-7mm size band within the same mask, which can cause the AI to generate contradictory conclusion/recommendation language depending on which passage it references. Patch aligns the earlier summary with the later, more detailed and specific size-tiered classification.

  - ANTES: `<5 mm: valor incerto (comum em assintomáticos); ≥5 mm: provável neuroma sintomático. Sinal de Mulder positivo reforça.`
  - DEPOIS: `<5 mm: indeterminado (pode ser fibrose interdigital, comum em assintomáticos); 5–7 mm: compatível com neuroma leve a moderado; >7 mm: neuroma confirmado, com correlação clínica alta. Sinal de Mulder`


## musculoesqueletico — MUSCULAR (`BTKHuY7jgnZIFfl8yfgO`)

_This is a well-constructed, internally coherent mask: the N0-N4 severity scale is applied consistently across all finding types, ALERTA categories map correctly to N4, the classic muscle/tendon injury phraseology is exact and actionable, and the MSK adjunct systems (OMERACT, EULAR-OMERACT, BAMIC) are correctly kept out of the <h2>CLASSIFICAÇÃO</h2> banner per R10 (MSK adjuncts belong in-text, not as a formal classification section). The one high-confidence defect is a genuine internal contradiction: the main body's muscle-injury classification uses classic "Grau I/II/III" (Estiramento/Rotura Parcial/Rotura Total) baked directly into Conclusão wording, while the appendix independently introduces BAMIC's distinct Grau 0-4 (percentage/length-based) system for the identical clinical entity, with overlapping "Grau II"/"Grau 2" and "Grau III"/"Grau 3" labels that carry different thresholds and meanings, and no statement reconciling which system the generator should use or how they map to each other._

- **[internal-contradiction]** The main body (lines 36-50) defines muscle injury severity as classic Grau I (estiramento) / II (rotura parcial) / III (rotura total) and bakes this exact numbering into the Conclusão phraseology. The appendix independently defines BAMIC's Grau 0-4 for the same entity with different thresholds (e.g., BAMIC Grau 2 = 10-50%/5-15cm moderate tear, vs. classic Grau II = any partial tear regardless of size). Because both systems use the same word "Grau" with overlapping numbers for different severity boundaries, the generator has no instruction on which one governs the report's Conclusão, risking a report that states one grade number derived from BAMIC criteria while the Conclusão template expects the classic scale. The patch clarifies that BAMIC is a supplementary in-text descriptor and the classic Grau I/II/III remains the mask's canonical classification for the CONCLUSÃO field.

  - ANTES: `MU1 — CLASSIFICAÇÃO BAMIC (British Athletics Muscle Injury Classification):
  Grau 0: dor sem lesão estrutural ao US/RM (0a DOMS, 0b neuromuscular).
  Grau 1: lesão pequena (<10% da área de secção / <`
  - DEPOIS: `MU1 — CLASSIFICAÇÃO BAMIC (British Athletics Muscle Injury Classification) — sistema OPCIONAL/complementar, citado apenas dentro da ANÁLISE quando o solicitante a referenciar; NÃO substitui a nomencla`


## mastologia — MAMAS E AXILAS (`EB9infqCigaUYfmvfQic`)

_The mask is generally well-structured, thorough, and correctly cites BI-RADS v2025 (ACR) consistently with R10 throughout, including a good note about the 'microlobulada' merge into 'indistinta'. However, it contains one clear, high-confidence internal contradiction: the file defines two incompatible meanings for the "N0–N5" clinical-importance score labels used to flag severity (Section 2 explicitly equates N3=BI-RADS 3 / "provavelmente benigno", but the M2 table and the implant-rupture rules later use N3 to mean BI-RADS 4 / suspicious-requiring-biopsy). This is load-bearing because those N-labels appear to drive downstream alerting logic, and a report-generation AI could apply the wrong urgency to a probably-benign vs. a suspicious finding. A secondary, lower-confidence issue is a boundary overlap in probability ranges for BI-RADS 4C vs 5 (95% appears in both ranges in the M2 table, while the narrative Section 2 text is internally boundary-consistent)._

- **[internal-contradiction]** Section 2 (lines 64-97) explicitly and authoritatively defines N0=BI-RADS0, N1=BI-RADS1, N2=BI-RADS2, N3=BI-RADS3, N4=BI-RADS4(A/B/C), N5=BI-RADS5 under the header 'NÍVEIS DE IMPORTÂNCIA CLÍNICA E BI-RADS®'. The M2 table redefines the same N-labels with an incompatible mapping (e.g. N3=BI-RADS4, N0=BI-RADS1/2), which directly contradicts Section 2 and also contradicts the implant-rupture rules in §6B that use 'N3' to mean a serious/urgent BI-RADS-4-level finding (ruptura extracapsular). This patch realigns M2's N-Score column to Section 2's own definition (also fixing the 95% boundary overlap between 4C and 5, matching Section 2's '>95%' for category 5).

  - ANTES: `| Cat | Significado | VPP malignidade | Conduta | N-Score |
  |-----|-------------|-----------------|---------|---------|
  | 0 | Incompleto | — | Complementar (MMG/RM) | N2 |
  | 1 | Negativo | 0%`
  - DEPOIS: `| Cat | Significado | VPP malignidade | Conduta | N-Score |
  |-----|-------------|-----------------|---------|---------|
  | 0 | Incompleto | — | Complementar (MMG/RM) | N0 |
  | 1 | Negativo | 0%`

- **[internal-contradiction]** Under Section 2's own explicit N-scale (N3=BI-RADS 3='provavelmente benigno', N4=BI-RADS 4='suspeito'), labeling extracapsular rupture and silicone migration as 'N3' is inconsistent with the urgent/suspicious conduct described in the same rows (RM de confirmação, referenciar para cirurgia plástica). These findings are severity-equivalent to a suspicious (BI-RADS 4-level) finding, so the N-Score should read N4 per the mask's own Section 2 definition, not N3.

  - ANTES: `| **Ruptura extracapsular** | Silicone além da cápsula fibrosa; "sinal da tempestade de neve" (snowstorm) no parênquima; depósitos hiperecoicos com reverberação | Silicone livre no parênquima — N3 → R`
  - DEPOIS: `| **Ruptura extracapsular** | Silicone além da cápsula fibrosa; "sinal da tempestade de neve" (snowstorm) no parênquima; depósitos hiperecoicos com reverberação | Silicone livre no parênquima — N4 → R`

- **[internal-contradiction]** Same N-Score mapping inconsistency as above: per Section 2's own definition N3=BI-RADS 3 ('provavelmente benigno', controle em 6 meses), which contradicts labeling a rupture requiring immediate referral to plastic surgery and confirmatory MRI as 'SEMPRE N3'. Should be N4 to match the urgent conduct described and to stay consistent with Section 2.

  - ANTES: `- **Ruptura extracapsular:** SEMPRE N3 → referenciar para cirurgia plástica + RM de confirmação.
- **Ruptura intracapsular isolada:** N2/N3 conforme sintomas; sempre referenciar para avaliação especia`
  - DEPOIS: `- **Ruptura extracapsular:** SEMPRE N4 → referenciar para cirurgia plástica + RM de confirmação.
- **Ruptura intracapsular isolada:** N2/N4 conforme sintomas; sempre referenciar para avaliação especia`


## mastologia — LINFONODOS AXILARES (`mastologia-linfonodos-axilares`)

_The mask is thorough and well-organized (anatomy, morphology criteria, Bedi classification, staging integration, biopsy technique, follow-up protocols), and correctly cites BI-RADS v2025 consistently, matching R10. However, it has three concrete internal-consistency defects: an unversioned vs. versioned AJCC citation for the same list, a shear-wave elastography kPa/(m/s) conversion pair that is physically inconsistent with itself, and a naming collision where two unrelated N0-N4 scales (axillary lymph-node severity in Section 8 vs. a BI-RADS-derived "N-Score" in table M2) share identical codes with contradictory meanings._

- **[internal-contradiction]** Line 17 cites 'AJCC 7th' while the adjacent Nível III entry (line 22) cites the same staging system as unversioned 'AJCC' — an internal edition-citation inconsistency for the identical classification within the same list. Removing the stray '7th' (an outdated edition; current is 8th) aligns both entries and avoids citing a specific old edition without justification.

  - ANTES: `Nível II — Axila Média (Posterior ao peitoral menor):
  Linfonodos centrais. Envolvimento = N2 (AJCC 7th).`
  - DEPOIS: `Nível II — Axila Média (Posterior ao peitoral menor):
  Linfonodos centrais. Envolvimento = N2 (AJCC).`

- **[internal-contradiction]** This table's 'N-Score' column reuses the exact N0-N4 codes already defined in Section 8 for a completely different scale (axillary lymph-node cortical/morphology severity, e.g. Section 8's N2 = '5-10mm unilateral cortical thickening'), while here N2 means 'BI-RADS category 0, incomplete study'. Same codes, contradictory meanings, no cross-reference — a generator following this mask could misapply N-labeled phraseology from the wrong scale. Renaming this column's scale (e.g. to a distinct 'Prioridade' P0-P4) removes the collision without altering clinical content.

  - ANTES: `| Cat | Significado | VPP malignidade | Conduta | N-Score |
  |-----|-------------|-----------------|---------|---------|
  | 0 | Incompleto | — | Complementar (MMG/RM) | N2 |
  | 1 | Negativo | 0%`
  - DEPOIS: `| Cat | Significado | VPP malignidade | Conduta | Prioridade sugerida |
  |-----|-------------|-----------------|---------|---------|
  | 0 | Incompleto | — | Complementar (MMG/RM) | P2 |
  | 1 | Ne`


## ginecologia — PÉLVICA TRANSVAGINAL (`j1fIt6ICfaEsWrRwCnjB`)

_The mask is generally thorough and well-structured (checklists, phraseology, classification tables), and its O-RADS/FIGO citations are consistent with R10. However, it contains one clear internal contradiction on postmenopausal endometrial thickness cutoffs (line 54 vs. the G5 block), where two different thresholds are given for the same clinical scenario (asymptomatic postmenopausal patient) — 5.0mm in one place and 11mm in another — which would produce inconsistent AI-generated recommendations depending on which passage is applied. There is also a fabricated/non-standard classification name ("SOMP") presented as if it were an official 2023 international guideline rename of PCOS, which risks the report generator inserting invented nomenclature into a medical document._

- **[internal-contradiction]** Linha 54 fixa um limite de normalidade assintomático de <5,0mm, mas a seção G5 (linhas 303-305), do mesmo documento e com citação ACOG 2018/IETA, define o limiar de investigação para pós-menopausa SEM sangramento como ≥11mm. São dois limiares diferentes para o mesmo cenário clínico (pós-menopausa assintomática), o que geraria recomendações contraditórias (ex.: endométrio de 7mm seria 'suspeito' pela linha 54 e 'normal, sem investigação' pela G5). O patch remove o valor conflitante da linha 54 e remete à tabela G5, que é mais detalhada e já referenciada.

  - ANTES: `*   **Pós-menopausa:** Limite de corte para normalidade é **< 5,0 mm** em pacientes assintomáticas. Em pacientes com sangramento, qualquer espessura > 4,0 mm é suspeita (N3). Descrever homogeneida`
  - DEPOIS: `*   **Pós-menopausa:** Limiares detalhados por sintoma (sangramento presente/ausente) conforme seção G5 (ACOG 2018/IETA) — NÃO usar um corte único de normalidade; ver G5 para os valores exatos a a`

- **[factual-fix]** "SOMP — Síndrome Ovariana Metabólica Poliendócrina" não corresponde a uma nomenclatura oficial adotada pela International Evidence-based Guideline for PCOS 2023 (Monash/ESHRE/ASRM), que manteve o nome consagrado SOP/PCOS. Citar isso como se fosse a nomenclatura vigente da diretriz de 2023 é uma atribuição factual incorreta a uma fonte citada nominalmente, com risco de o laudo gerado inserir terminologia não reconhecida clinicamente.

  - ANTES: `G6 — MORFOLOGIA OVARIANA POLICÍSTICA (SOMP / PCOM) [Diretriz Internacional SOP 2023 — Monash/ESHRE/ASRM]
  Nomenclatura: SOMP (Síndrome Ovariana Metabólica Poliendócrina) = antiga SOP/PCOS.`
  - DEPOIS: `G6 — MORFOLOGIA OVARIANA POLICÍSTICA (PCOM) [International Evidence-based Guideline for PCOS 2023 — Monash/ESHRE/ASRM]
  Nomenclatura: SOP/PCOS (Síndrome dos Ovários Policísticos) — a diretriz interna`


## ginecologia — PÉLVICA TRANSVAGINAL COM DOPPLER (`rR4NfNgfrOnFiWiEhfa2`)

_This is a very thorough, well-structured mask with correct O-RADS 2022 citation (matches R10) and generally sound clinical content, correctly separating adjunct systems (IOTA, MUSA, IETA, PALM-COEIN, FIGO miomas) from the O-RADS classification per R10's rules. However, it contains one clear internal contradiction on the post-menopausal endometrial thickness action threshold (5mm vs 4mm cited in two different sections for the same clinical scenario), and one high-confidence fabricated/unsupported nomenclature claim (renaming PCOS to "SOMP") that risks the AI generating non-standard terminology in real reports._

- **[internal-contradiction]** Internal contradiction: this line sets the post-menopausal endometrial-thickness action threshold at >5mm, while the later G5 section (line 250-252, citing ACOG 2018/IETA) sets it at >4mm for bleeding patients and ≥11mm for asymptomatic patients. Same measurement, same clinical scenario, two different numeric thresholds within the same mask — this must be reconciled so the AI does not apply an inconsistent cutoff depending on which section it reads.

  - ANTES: `*   **Pós-menopausa (sem TRH, > 5 mm):** N3. **ALERTA ONCOLÓGICO.** "Espessamento endometrial em paciente na pós-menopausa. Este achado é anormal e requer investigação histopatológica. Recomenda-se av`
  - DEPOIS: `*   **Pós-menopausa (sem TRH, com sangramento, > 4 mm):** N3. **ALERTA ONCOLÓGICO.** "Espessamento endometrial em paciente na pós-menopausa. Este achado é anormal e requer investigação histopatológica`

- **[factual-fix]** The claim that PCOS/SOP was internationally renamed to "SOMP" (Síndrome Ovariana Metabólica Poliendócrina) is not a recognized nomenclature change; the 2023 International PCOS Guideline (Monash/ESHRE/ASRM) retained the PCOS/SOP name. Instructing the AI to use "SOMP" as the primary term risks generating non-standard terminology in real clinical reports.

  - ANTES: `G6 — MORFOLOGIA OVARIANA POLICÍSTICA (SOMP / PCOM) [Diretriz Internacional SOP 2023 — Monash/ESHRE/ASRM]
  Nomenclatura: SOMP (Síndrome Ovariana Metabólica Poliendócrina) = antiga SOP/PCOS.`
  - DEPOIS: `G6 — MORFOLOGIA OVARIANA POLICÍSTICA (PCOM) [International Evidence-based Guideline for PCOS 2023 — Monash/ESHRE/ASRM]
  Nomenclatura: SOP/PCOS (Síndrome dos Ovários Policísticos) — termo mantido pela`


## ginecologia — PÉLVICA ABDOMINAL (`qzT7cw77f4OPP0xQgdwm`)

_The mask is generally well-structured and detailed (N0-N4 tiers, hormonal-status calibration, per-finding recommendation phraseology, and a strong "APROFUNDAMENTO" appendix citing IOTA/FIGO/ACOG with years). However it has two genuine internal contradictions on the SOMP/PCOM criteria (conjunctive vs. 2-of-3 diagnostic rule; and mismatched volume/follicle thresholds between section 4 and section 5B), plus O-RADS — the exam's central classification system, cited over a dozen times — is never given its mandated version/society (ACR 2022 per R10), unlike every other system in the appendix which is properly year-stamped._

- **[missing-citation]** O-RADS is used as the exam's core adnexal-mass classification system throughout the mask (over a dozen citations) but its version/society is never stated anywhere in the file, unlike every other classification in the appendix (IOTA 2008/2016, FIGO 2011, ACOG 2018, SOP 2023). Per R10, the mandated version is ACR 2022 and must be explicit wherever the system is first introduced as authoritative.

  - ANTES: `**▸ OVÁRIOS E ANEXOS (Terminologia IOTA / Classificação O-RADS):**`
  - DEPOIS: `**▸ OVÁRIOS E ANEXOS (Terminologia IOTA / Classificação O-RADS ACR 2022):**`

- **[internal-contradiction]** Direct internal contradiction: this line states all three Rotterdam criteria are required conjunctively ("+"), while line 303 of the same file correctly states the diagnostic rule is "2 de 3" (2-of-3). The two statements cannot both be followed by the report generator.

  - ANTES: `O diagnóstico de SOMP requer: irregularidade menstrual + hiperandrogenismo clínico/laboratorial + 
morfologia polycística (US). NUNCA diagnosticar SOMP apenas pelo US.`
  - DEPOIS: `O diagnóstico de SOMP requer 2 de 3 critérios de Rotterdam: irregularidade menstrual, hiperandrogenismo clínico/laboratorial e/ou morfologia polycística (US). NUNCA diagnosticar SOMP apenas pelo US.`

- **[internal-contradiction]** Threshold mismatch for the same SOMP/PCOM criteria stated twice in this mask: here as volume ">10-12 cm³" and follicle count ">20", versus section 5B (lines 166-168) which gives the criteria as "≥10 cm³" and "≥20 folículos de 2–9 mm" and explicitly flags the older ">12" follicle threshold as "DESATUALIZADO". The two passages give different boundary values for the identical clinical criterion.

  - ANTES: `- **Morfologia de Ovários Policísticos (critérios de Rotterdam):** Ovários aumentados (>10-12 cm³), com múltiplos (>20) pequenos folículos (<10 mm) periféricos ("colar de pérolas").`
  - DEPOIS: `- **Morfologia de Ovários Policísticos (critérios de Rotterdam):** Ovários aumentados (≥10 cm³), com múltiplos (≥20) pequenos folículos (2-9 mm) periféricos ("colar de pérolas").`


## ginecologia — PÉLVICA ABDOMINAL COM DOPPLER (`EH2UVqi3koehkuu9dH3Z`)

_This mask is unusually thorough and well-structured (correlação clínica, tiered N0-N4 recommendations, exact phraseology, Doppler reference tables, HTML output template, and a rich appendix of adjunct classification systems with citations). However it has three concrete, high-confidence defects: (1) O-RADS — the mask's own headline classification system, cited 15+ times — is never given a version/year anywhere in the file, unlike every other system in the appendix which is meticulously dated; R10 requires O-RADS ACR 2022 be stated. (2) A genuine internal contradiction on postmenopausal endometrial thickness cutoffs without bleeding: the main body (lines 69, 92) states the abnormal/N3 threshold is >5,0 mm, while the appendix G5 (line 255) states the investigation threshold for the same scenario (postmenopausal, no bleeding) is ≥11 mm — a materially different number for the same clinical situation, which could cause inconsistent AI outputs depending which passage is weighted. (3) The G6 appendix invents/renames PCOS to \"SOMP (Síndrome Ovariana Metabólica Poliendócrina)\" attributed to a 2023 international guideline — this rebranding does not match the actual 2023 International PCOS Guideline (Monash/ESHRE/ASRM), which kept the name PCOS/SOP; this is very likely a fabricated nomenclature that could mislead report generation._

- **[missing-citation]** O-RADS is cited throughout this mask (15+ occurrences) but never with its governing version/year, unlike every other classification system in the file (IOTA Timmerman 2008/2016, FIGO 2011, ACOG 2018), which are all dated. R10 mandates O-RADS ACR 2022 exclusively; stating the version at its first substantive mention removes ambiguity about which O-RADS edition governs the risk categories used later (lines 100-107).

  - ANTES: `**3. PRECISÃO TERMINOLÓGICA:** Utilize rigorosamente as classificações e terminologias mais atuais: **IOTA/O-RADS** para massas anexiais, **MUSA** para adenomiose e **FIGO** para localização de leiomi`
  - DEPOIS: `**3. PRECISÃO TERMINOLÓGICA:** Utilize rigorosamente as classificações e terminologias mais atuais: **IOTA/O-RADS (ACR 2022)** para massas anexiais, **MUSA** para adenomiose e **FIGO** para localizaçã`


## ginecologia — PÉLVICA — ENDOMETRIOSE (`OqKamU7OfwG9KCDNtiGF`)

_This is a detailed, well-organized mask with strong structure (ENZIAN staging table, IOTA Simple Rules/ADNEX, PALM-COEIN, FIGO myoma typing, endometrial thickness thresholds), good internal consistency on most measurement thresholds, and correct compliance with R10 for the systems it cites with explicit years (FIGO 2011/2018, FIGO 2011, ACOG 2018). However, it has one clear R10-relevant gap (O-RADS cited repeatedly and used to drive actual classification output without ever stating the mandated "ACR 2022" version) and one high-confidence fabricated/incorrect clinical nomenclature claim (a rename of PCOS to "SOMP") that could propagate a false statement into generated reports._

- **[missing-citation]** O-RADS é citado repetidamente ao longo da máscara (linhas 44, 59, 61, 187, 204, 205, 210) e usado para gerar classificação real no laudo (ex.: 'O-RADS 2', 'O-RADS 5'), mas a versão/ano nunca é declarada em nenhum ponto do texto. R10 exige exclusivamente O-RADS ACR 2022 para ovário/pelve; a ausência de citação de versão é uma lacuna de segurança de versionamento — a citação deve aparecer ao menos uma vez, preferencialmente na primeira menção.

  - ANTES: `(Baseado nos consensos IDEA, MUSA, O-RADS e na classificação #Enzian, alinhado às práticas do CBR/SBUS)`
  - DEPOIS: `(Baseado nos consensos IDEA, MUSA, O-RADS ACR 2022 e na classificação #Enzian, alinhado às práticas do CBR/SBUS)`


## medicina-interna — ABDOME SUPERIOR (`AaHERv60sL5e2oKTGkjM`)

_This is a very thorough, detailed mask with strong structural coverage (checklist, classification tiers N0-N4, exact phraseology templates, output skeleton). It correctly avoids the LI-RADS v2018/v2024 mixing error and correctly flags US-based CHC assessment as non-confirmatory. However it has one clear internal contradiction on hepatomegaly threshold values (repeated at two different points in the same document with different numbers) and omits the ACR version year for LI-RADS despite extensive LI-RADS content, which R10 requires to be cited when used._

- **[missing-citation]** R10 requires LI-RADS citations to specify the version (ACR v2024, replacing v2018). This section and section A5 use LI-RADS terminology extensively (LR-3/LR-4/LR-5/LR-M, US-LI-RADS categories) without ever stating the governing version year, creating a missing-citation gap versus R10.

  - ANTES: `HEPATOCARCINOMA (CHC) — LI-RADS AO US:`
  - DEPOIS: `HEPATOCARCINOMA (CHC) — LI-RADS AO US (ACR v2024):`


## medicina-interna — ABDOME SUPERIOR COM DOPPLER (`gBDCKQfrk1vi8YBdzd3J`)

_This is a dense, well-organized V2.0 mask with strong coverage (Doppler parameters, classification tiers, phraseology library, post-transplant/TIPS protocols). It correctly versions Bosniak (v2019, matching R10). However it has one clear internal contradiction — two different "normal" hepatic artery resistive index ranges (0,55–0,70 vs 0,55–0,80) — and one clear R10 compliance gap: LI-RADS is invoked four times (including a dedicated subsection A5) to guide HCC-surveillance conduct and phraseology but is never tied to a version year, whereas R10 mandates ACR v2024 exclusively (superseding v2018) precisely because version confusion changes categorization._

- **[internal-contradiction]** Internal contradiction: this line gives hepatic artery normal IR as 0,55–0,70, while line 40 (same mask, same non-transplant hepatic artery) states "IR normal: 0,55 a 0,80". Two different reference ranges for the identical measurement. Aligned here to the 0,55–0,80 figure used in the main parameters section (line 40) and consistent with the post-transplant range stated later (0,5–0,8, line 259).

  - ANTES: `Artéria Hepática: IR 0,55–0,70. IR <0,50 pós-transplante = suspeita de estenose anastomótica.`
  - DEPOIS: `Artéria Hepática: IR 0,55–0,80. IR <0,50 pós-transplante = suspeita de estenose anastomótica.`

- **[missing-citation]** R10 mandates LI-RADS ACR v2024 exclusively (superseding v2018), yet this mask cites LI-RADS four times (lines 155, 324, and this A5 subsection with its US-1/US-2/US-3 categories and phraseology) without ever stating a version/year. Since LI-RADS categorization criteria changed between versions, an unversioned citation is a missing-citation gap per R10 for the system's own governing rule.

  - ANTES: `A5 — LI-RADS US (rastreio HCC em hepatopatas crônicos/cirróticos):`
  - DEPOIS: `A5 — LI-RADS US v2024 (ACR) (rastreio HCC em hepatopatas crônicos/cirróticos):`


## medicina-interna — ABDOME TOTAL (`dTZ2W4qCGs2TDuax2Jod`)

_This is a very thorough, well-structured Camada 3 mask with clear N0-N4 cascade phraseology, detailed anatomical checklists, and appropriate cross-references to Camada 2. However, it contains one clear self-contradiction (an explicit "EXPRESSAMENTE PROIBIDO" ban on Bosniak terminology that is then used verbatim in the mask's own phraseology library) and one missing citation year for LI-RADS, which the file cites five separate times without ever stating the ACR v2024 version required by R10, despite the house style in this very file (see A1's "[Consenso Europeu Multissociedade 2022]" and A4's "[SVS 2018]") of bracket-citing society+year for named classifications._

- **[internal-contradiction]** Linhas 29-31 deste mesmo arquivo declaram 'EXPRESSAMENTE PROIBIDO utilizar a classificação de Bosniak em laudos ultrassonográficos', com regra de substituição por 'Simples'/'Complexo'. A biblioteca de fraseologia (linhas 271 e 275) usa 'Bosniak I' e 'Bosniak IIF' como texto de exemplo, contradizendo diretamente a própria diretriz mandatória do arquivo.

  - ANTES: `N1 — ACHADO INCIDENTAL BENIGNO:
"[Cisto hepático simples / Esteatose grau I / Nódulo renal Bosniak I] de aspecto benigno,
sem necessidade de investigação adicional em contexto assintomático."

N2 — AC`
  - DEPOIS: `N1 — ACHADO INCIDENTAL BENIGNO:
"[Cisto hepático simples / Esteatose grau I / Cisto renal simples] de aspecto benigno,
sem necessidade de investigação adicional em contexto assintomático."

N2 — ACHAD`

- **[missing-citation]** Conforme R10, LI-RADS deve citar exclusivamente a versão ACR v2024. O termo 'LI-RADS' aparece 5 vezes neste arquivo (linhas 153, 280, 285, 346, 350-351) e nunca leva o ano/versão, ao contrário de outras classificações citadas no mesmo arquivo que seguem o padrão de citar sociedade+ano entre colchetes (ex.: '[Consenso Europeu Multissociedade 2022]' em A1, '[SVS 2018]' em A4).

  - ANTES: `Exame operador-dependente realizado segundo protocolo padronizado e em conformidade com as diretrizes de CBR e ACR LI-RADS.`
  - DEPOIS: `Exame operador-dependente realizado segundo protocolo padronizado e em conformidade com as diretrizes de CBR e ACR LI-RADS (v2024).`


## medicina-interna — ABDOME TOTAL COM DOPPLER (`5FcflzxSDd8fCD7yPStV`)

_The mask is extensive and generally well-structured (clear Doppler sequencing, N0-N4 tiers, explicit HTML template, correct Bosniak-prohibition logic for a US-only report). However, it contains one clear internal numeric contradiction on portal vein normal velocity, and a missing version citation for the LI-RADS US (surveillance) system it instructs the AI to actively use in conclusions/phraseology._

- **[internal-contradiction]** Internal contradiction: line 67 (§2 SISTEMA PORTA, the primary hemodynamic-parameters section) states normal portal vein velocity as "entre 15 e 30 cm/s", while this line in the supplementary APROFUNDAMENTO FINAL section states "12–20 cm/s" for the identical measurement (Veia Porta Principal). These two ranges conflict (e.g. 12-14 cm/s and 21-30 cm/s are normal under one rule and abnormal under the other), which can cause the AI to inconsistently flag or clear the same velocity value depending on which section it weights. Aligned to the range stated in the main structural section (line 67).

  - ANTES: `Normal: ≤13 mm, 12–20 cm/s, hepatopetal.`
  - DEPOIS: `Normal: ≤13 mm, 15–30 cm/s, hepatopetal.`

- **[missing-citation]** R10 requires exact version/society for classification systems and specifically distinguishes US-LI-RADS from CT/MRI LI-RADS (ACR v2024) and CEUS-LI-RADS. This mask instructs the AI to actively cite "LI-RADS US" categories (US-1/US-2/US-3) in the conclusion phraseology but never states which version of US-LI-RADS applies, and the sole version-adjacent mention elsewhere in the file (line 141, "ACR LI-RADS" with no version) risks being read as covering this citation, conflating it with the differently-versioned CT/MRI system. Added the current official US-LI-RADS v2017 (ACR) designation and clarified the CT/MRI target uses ACR v2024, consistent with R10.

  - ANTES: `A5 — LI-RADS US (rastreio HCC em hepatopatas crônicos/cirróticos):
  US-1 Negativo: sem observação ou apenas benignidade definitiva.
  US-2 Subdiagnóstico: observação <10 mm não definitivamente benign`
  - DEPOIS: `A5 — US-LI-RADS v2017 (ACR) (rastreio HCC em hepatopatas crônicos/cirróticos):
  US-1 Negativo: sem observação ou apenas benignidade definitiva.
  US-2 Subdiagnóstico: observação <10 mm não definitiva`


## medicina-interna — PRÓSTATA VIA ABDOMINAL (`9gYSqG5C6qEIYg1JqSxw`)

_This mask is unusually long and appears to be the product of multiple merged drafts: it repeats the volume/HPB classification, the PSAD scheme, the peso-prostático formula, and the N0-N4 tiers in two or three separate blocks (main body vs. "APROFUNDAMENTO FINAL" vs. "APROFUNDAMENTO PROSTÁTICO"), and these restatements drift numerically from each other rather than matching. The core structure (técnica, achados obrigatórios, recomendações por cenário, HTML skeleton) is otherwise reasonably complete and does not conflict with R10 (no BI-RADS/TI-RADS/O-RADS/etc. version citations present; PI-RADS is correctly described as RM-only and not applied by the transabdominal US, consistent with R10's carve-out). The main defect category is internal numeric contradiction from redundant late-appended sections._

- **[internal-contradiction]** O restante da máscara (linha 10 e regra 2 do bloco V2.0 EXTREME, linha 43) fixa a constante do elipsoide em 0,523 (FASE 4.1 do Sistema Universal). Este trecho posterior usa 0,52, uma constante diferente para o mesmo cálculo de volume prostático dentro do mesmo documento — contradição interna de fórmula.

  - ANTES: `P1 — VOLUME PROSTÁTICO E DENSIDADE DE PSA:
  Volume = (L × A × AP × 0,52) [fórmula do elipsoide].`
  - DEPOIS: `P1 — VOLUME PROSTÁTICO E DENSIDADE DE PSA:
  Volume = (L × A × AP × 0,523) [fórmula do elipsoide — mesma constante da FASE 4.1].`

- **[internal-contradiction]** As linhas 11 e 44 definem peso prostático = Volume × 1,05. Este trecho final usa densidade ≈1,0, uma constante diferente para o mesmo cálculo (peso a partir do volume), gerando resultados divergentes conforme qual trecho da máscara for seguido.

  - ANTES: `Peso estimado ≈ volume (densidade ≈ 1,0 g/cm³).`
  - DEPOIS: `Peso estimado = Volume × 1,05 (densidade do tecido prostático — mesma constante da FASE 4.2).`

- **[internal-contradiction]** A Seção A (linhas 160-161) define PSAD com corte único: normal <0,15 e risco aumentado ≥0,15. Este trecho (P1) introduz uma faixa intermediária 0,10-0,15 não mencionada em nenhum outro lugar da máscara, criando dois esquemas de classificação diferentes para o mesmo índice (PSAD) dentro do mesmo documento.

  - ANTES: `PSAD <0,10 ng/mL/cm³: baixa probabilidade de câncer clinicamente significativo.
    PSAD 0,10-0,15: intermediária. PSAD >0,15: elevada — valoriza biópsia/RM.`
  - DEPOIS: `PSAD <0,15 ng/mL/cm³: normal (baixa probabilidade de câncer clinicamente significativo).
    PSAD ≥0,15: elevada — valoriza biópsia/RM (mesmo corte definido na Seção A).`

- **[internal-contradiction]** As demais seções da máscara (linha 19, linhas 60-63, e o gatilho N4 nas linhas 84/256-257) usam quatro faixas de RPM, com o limiar de urgência (R6) em >300 mL. Este trecho (P3) colapsa tudo acima de 100 mL em 'significativo', omitindo a distinção 100-300 vs. >300 mL e o gatilho de urgência R6, o que contradiz o restante da máscara sobre o mesmo valor.

  - ANTES: `RPM: <50 mL normal; 50-100 mL limítrofe; >100 mL significativo (risco de retenção).`
  - DEPOIS: `RPM: <50 mL normal; 50-100 mL limítrofe; 100-300 mL significativo; >300 mL acentuado/retenção (⚠️ gatilho R6).`


## medicina-interna — RINS E VIAS URINÁRIAS COM DOPPLER (`TODd9kUizva7uum2cf1D`)

_This mask is a large, heavily layered document (apparently multiple accretive revisions concatenated) that contains a severe internal contradiction: Section 2A explicitly and forcefully PROHIBITS use of the Bosniak classification ("É EXPRESSAMENTE PROIBIDO"), yet later sections (Observações Metodológicas, the N1-N4 matrix, and a dedicated "R1 — BOSNIAK v2019 ADAPTADO AO US" block) not only cite Bosniak but make it mandatory phraseology ("Cisto simples Bosniak I", "Massa renal... Bosniak III", full Cat I-IV definitions). This is a direct, high-confidence self-contradiction that would produce unpredictable model behavior. Additionally, the IR (índice de resistividade) severity staging is defined three separate times with three different threshold sets, which is confusing and internally inconsistent even though all fall in a broadly similar range._

- **[internal-contradiction]** The mask forbids Bosniak classification here ('É EXPRESSAMENTE PROIBIDO') but later sections (Observações Metodológicas at the 'classificação de Bosniak' reference, the N1-N4 matrix citing 'Bosniak I'/'Bosniak III', and the dedicated R1 block titled 'BOSNIAK v2019 ADAPTADO AO US') mandate and fully define Bosniak categories. This is a direct internal contradiction that would cause unpredictable output — the AI cannot both be forbidden from and required to use the same classification system. Aligning this section with the rest of the document (which consistently uses Bosniak v2019, matching R10) resolves the contradiction while preserving the version already used elsewhere.

  - ANTES: `### A. AVALIAÇÃO DE CISTOS (PROIBIÇÃO DA CLASSIFICAÇÃO DE BOSNIAK)
É **EXPRESSAMENTE PROIBIDO** utilizar a classificação de Bosniak em laudos ultrassonográficos neste prompt. Categorize morfologicamen`
  - DEPOIS: `### A. AVALIAÇÃO DE CISTOS (BOSNIAK v2019 ADAPTADO AO US)
Use a classificação de Bosniak (ACR v2019, adaptada ao US) para cistos renais — ver detalhamento completo em R1. Como referência morfológica r`


## vascular — CARÓTIDAS E VERTEBRAIS (`8sbK1BuPuPy8xzAm9DNz`)

_This is an unusually long, content-rich mask (308 lines) that goes well beyond the typical Camada 3 scope, appending multiple "expanded protocol" sections (vertebral, dissection, paraganglioma, FMD, SRU/plaque/EMI deep-dive) after the canonical HTML output template. This late material duplicates — and in two places contradicts — definitions already given earlier in the same file: the EMI classification thresholds and the plaque echogenicity/composition classification are each defined twice with different criteria. These are concrete internal contradictions that would give the AI generator conflicting rules to apply, not merely stylistic redundancy._

- **[internal-contradiction]** This second EMI classification block (C3, near the end of the file) contradicts the primary EMI rule set defined in Section 1 (lines 30-37): Section 1 requires age/sex-based ELSA-Brasil P75 thresholds and only falls back to a flat >0,9mm cutoff when age/sex are unavailable, with 'placa' defined by >1,5mm OR ≥50% focal protrusion. C3 instead states a flat, unconditional 'Normal <0,9mm; ≥1,0mm = espessamento' rule (leaving 0,9-1,0mm undefined) and a different placa criterion ('+0,5mm focal' instead of '≥50% protrusion'). An AI reading both would receive two different, non-reconcilable EMI classification thresholds for the same measurement.

  - ANTES: `C3 — ESPESSURA MÉDIO-INTIMAL (EMI):
  Medida na parede posterior da ACC, 1 cm proximal ao bulbo, livre de placa.
  Normal <0,9 mm; ≥1,0 mm = espessamento; ≥1,5 mm (ou +0,5 mm focal) = placa.
  Marcado`
  - DEPOIS: `C3 — ESPESSURA MÉDIO-INTIMAL (EMI):
  Medida na parede posterior da ACC, 1 cm proximal ao bulbo, livre de placa.
  Classificação conforme Seção 1 (Tabela ELSA-Brasil por idade/sexo — P75); 
  na ausên`

- **[internal-contradiction]** This Gray-Weale modificado plaque classification (Tipo 1-5, vulnerability = '>50% hipoecoica') duplicates and conflicts with the earlier, unattributed 'COMPOSIÇÃO DA PLACA (B-mode)' section (tipo I-IV, vulnerability = 'componente hipoecoico >40% da área transversal'). Both classify plaque echostructure for risk stratification but use different tier systems and different vulnerability percentage thresholds (40% vs 50%), creating conflicting guidance for the same clinical decision. Flagged as internal contradiction; the minimal fix is a cross-reference so it's clear these are meant to be read together rather than as competing rules — the underlying % mismatch should be reconciled by the mask author.

  - ANTES: `C2 — CARACTERIZAÇÃO DE PLACA (Gray-Weale modificado):
  Tipo 1: uniformemente ecolucente (mole, lipídica — instável/sintomática).
  Tipo 2: predominantemente ecolucente (>50% hipoecoica).
  Tipo 3: pr`
  - DEPOIS: `C2 — CARACTERIZAÇÃO DE PLACA (Gray-Weale modificado) — ver também composição da placa na Seção "COMPOSIÇÃO DA PLACA (B-mode)":
  Tipo 1: uniformemente ecolucente (mole, lipídica — instável/sintomática`


## vascular — AORTO-ILÍACO (`aTkVQCrPNUgpq89dDcPS`)

_The mask is detailed and well-organized (risk cascade N0-N4, EVAR/endoleak taxonomy, TASC II, May-Thurner/Nutcracker, Rutherford/ITB), and its cited adjunct systems (Rutherford, ITB) are consistent with R10. However, it contains one clear, high-confidence internal contradiction: the diagnostic threshold for common iliac artery (AIC) aneurysm is given as ≥2,0 cm in the main diagnostic/risk-cascade sections (used to drive N2/N3 conclusions) but restated as ≥3,0 cm in the dedicated "Aneurisma de Artérias Ilíacas" section, which would cause the model to produce inconsistent classifications depending on which passage it follows._

- **[internal-contradiction]** Section 7 defines the AIC aneurysm diagnostic threshold as ≥3,0 cm, directly contradicting the ≥2,0 cm threshold given in section 2 (line 45: 'Aneurisma: ≥2,0 cm') and used operationally in the N2/N3 risk-cascade tiers (line 67: 'Aneurisma ilíaco isolado (2,0 a 2,4 cm)' at N2; line 72: 'Aneurisma ilíaco ≥2,5 cm' at N3). Same measurement (AIC diameter), same finding (aneurysm determination), two different thresholds — this would cause inconsistent classification depending on which part of the prompt is followed.

  - ANTES: `LIMIARES DE INTERVENÇÃO (SVS/ESVS):
  Artéria Ilíaca Comum (AIC): diâmetro ≥3,0 cm = aneurisma; ≥3,5 cm = avaliar intervenção.
  Artéria Ilíaca Interna (AII): diâmetro ≥2,5 cm = aneurisma; ≥3,0 cm = a`
  - DEPOIS: `LIMIARES DE INTERVENÇÃO (SVS/ESVS):
  Artéria Ilíaca Comum (AIC): diâmetro ≥2,0 cm = aneurisma (consistente com item 2); ≥3,5 cm = avaliar intervenção.
  Artéria Ilíaca Interna (AII): diâmetro ≥2,5 cm`


## vascular — AORTA TORÁCICA (`vascular-aorta-toracica`)

_The mask is comprehensive and mostly well-organized, but it reads as several loosely-merged layers (base protocol, "MÓDULO EXPANDIDO", diameter table, and "APROFUNDAMENTO" addendum) that were never fully reconciled. The clearest defect is a direct numeric contradiction for the intramural hematoma (HIM) wall-thickness threshold (>7 mm in section 5 vs >5 mm in the expanded module's section 8), which could cause inconsistent flagging of the same finding. There is also a stray non-Portuguese word ("once") left in the screening-interval text. No classification-version conflicts against R10 were found (Stanford/DeBakey are cited appropriately as unversioned eponymous systems, consistent with the vascular adjunct-system guidance)._

- **[internal-contradiction]** Internal contradiction: section 5 defines the HIM wall-thickening threshold as >7 mm, while the 'MÓDULO EXPANDIDO' section 8 (line 262) defines the same finding as >5 mm. Both cannot be the operative threshold for the same diagnostic criterion; aligning to >5 mm matches the more detailed/expanded protocol section and the commonly cited threshold, but the key fix is making the two sections agree.

  - ANTES: `HEMATOMA INTRAMURAL (HIM):
  Espessamento hipoecoico concêntrico da parede >7 mm sem flap visível.`
  - DEPOIS: `HEMATOMA INTRAMURAL (HIM):
  Espessamento hipoecoico concêntrico da parede >5 mm sem flap visível.`

- **[clarity]** Stray English word 'once' left in Portuguese-language instruction text; house style is exclusively Brazilian Portuguese. Should read 'uma vez' to match the parenthetical clarification 'rastreio único'.

  - ANTES: `Familiar 1° grau de aneurisma torácico: TC/RM once (rastreio único, ao diagnóstico).`
  - DEPOIS: `Familiar 1° grau de aneurisma torácico: TC/RM uma vez (rastreio único, ao diagnóstico).`


## vascular — ARTERIAL MEMBRO INFERIOR (`vXAO9wOokphmh6xg6Eui`)

_The mask reads as several overlapping drafts concatenated rather than one coherent block: it defines the ITB (ankle-brachial index) classification table three separate times with three different numeric threshold sets (>1,40 vs >1,30 for incompressible; 0,41–0,90 undivided vs 0,71–0,90/0,41–0,70 split vs 0,70–0,90/0,50–0,69), and states the "isquemia crítica" ITB cutoff as ≤0,40 in two places but ≤0,20/0,21–0,40 in another. It also gives the stenosis-grade boundary as both 70% and 75% for the identical Vr 2,0–4,0 range. These are genuine internal contradictions on clinical thresholds the AI will apply per-report, not stylistic issues. Classification systems cited (TASC II, Rutherford/Fontaine, AHA/ACC ITB) match R10's allowed vascular adjunct list and carry no version conflict with the reference table._

- **[internal-contradiction]** This table's ITB thresholds (>1,30 / 1,00–1,30 / 0,70–0,90 / 0,50–0,69 / <0,50) contradict the two other ITB classification blocks in the same mask (lines 42-46 and 291-296), both of which use the AHA/ACC-standard cutoffs >1,40 / 1,00–1,40 / 0,71–0,90 / 0,41–0,70 / ≤0,40. Having three different numeric threshold sets for the identical clinical index within one aiInstructions block will cause inconsistent grading across reports.

  - ANTES: `**ITB (Doppler + esfignomanômetro):**
| ITB          | Interpretação clínica                                 |
|--------------|-------------------------------------------------------|
| >1,30        |`
  - DEPOIS: `**ITB (Doppler + esfignomanômetro):**
| ITB          | Interpretação clínica                                 |
|--------------|-------------------------------------------------------|
| >1,40        |`

- **[internal-contradiction]** This block splits grave/crítica at 0,21–0,40 vs ≤0,20, contradicting the ≤0,40 cutoff for 'DAOP grave / Isquemia crítica' used elsewhere in the same mask (line 46: '≤ 0,40: DAOP grave / Isquemia crítica'; line 296: '≤0,40: DAOP grave (isquemia crítica)'). The extra 0,20 boundary is introduced only here and nowhere else reconciled, creating a threshold the AI cannot consistently apply.

  - ANTES: `ITB 0,71–0,90: DAP leve.
  ITB 0,41–0,70: DAP moderada (claudicação de esforço).
  ITB 0,21–0,40: DAP grave (claudicação incapacitante / repouso).
  ITB ≤0,20:  Isquemia crítica dos membros (ICM) →`
  - DEPOIS: `ITB 0,71–0,90: DAP leve.
  ITB 0,41–0,70: DAP moderada (claudicação de esforço).
  ITB ≤0,40: DAP grave / Isquemia crítica dos membros (ICM) → R6 imediato.`


## vascular — ARTERIAL MEMBRO SUPERIOR (`Ml3A5Jz8uR8L2DtUMEwQ`)

_Esta máscara é extremamente extensa e clinicamente rica, mas tem a marca clara de duas (ou mais) versões de conteúdo concatenadas sem reconciliação: existem duas cascatas de gravidade N0–N4 com limiares de estenose diretamente conflitantes (seção 3 vs. seção 10) e três valores diferentes de VPS para suspeita de estenose de FAV (linha 10 vs. linha 216 vs. linha 220). Esses são problemas estruturais de alta confiança que podem levar a condutas clínicas divergentes para o mesmo achado, dependendo de qual trecho da máscara a IA privilegiar. Fora essas duplicações internas, o conteúdo em si (classificações NASCET/SRU-adjacentes via VR, protocolo SDT, mapeamento de FAV, Rutherford/Fontaine/ITB) está alinhado com R10 e não há citação de versão de classificação que contradiga a referência canônica._

- **[internal-contradiction]** A seção 10 ("CLASSIFICAÇÃO N0–N4 EXPANDIDA", linhas 234-241) define N2 como "Estenose <50%" e N3 como "Estenose ≥50% unilateral", o que contradiz diretamente esta seção 3 que define N2 como estenose 50-69% e N3 como estenose ≥70%. Uma estenose de 60%, por exemplo, seria N2 (seguimento eletivo) numa seção e N3 (encaminhamento prioritário) na outra — condutas clínicas opostas para o mesmo achado. Como não é possível eliminar uma das duas seções via patch cirúrgico sem reescrever o arquivo inteiro, sinalizo aqui o núcleo do conflito; a reconciliação completa exige decisão editorial sobre qual cascata (linhas 61-65 ou linhas 226-246) deve prevalecer e a remoção/ajuste da outra.

  - ANTES: `- **N2 (Seguimento Eletivo):** Estenose moderada (50-69%) assintomática, aneurisma pequeno e estável (< 2,0 cm), desfiladeiro torácico posicional sem isquemia de repouso. Conduta: Avaliação com cirurg`
  - DEPOIS: `- **N2 (Seguimento Eletivo):** Estenose moderada (50-69%) assintomática, aneurisma pequeno e estável (< 2,0 cm), desfiladeiro torácico posicional sem isquemia de repouso. Conduta: Avaliação com cirurg`

- **[internal-contradiction]** Este limiar de VPS >800 cm/s para suspeita de estenose de FAV contradiz a seção 9 do próprio arquivo, que define ">500 cm/s com gradiente >3:1 = estenose" (linha 216) e, separadamente, ">600 cm/s em segmento específico = estenose" (linha 220). Três valores distintos (800, 600, 500 cm/s) para o mesmo critério diagnóstico na mesma máscara geram instrução ambígua/contraditória para a IA.

  - ANTES: `• FAV existente: VPS na FAV normal 200–500 cm/s; >800 cm/s = suspeita de estenose.`
  - DEPOIS: `• FAV existente: VPS na FAV normal 200–500 cm/s; >500 cm/s (com gradiente >3:1) = suspeita de estenose.`


## vascular — VENOSO MEMBRO INFERIOR (`ajAFJHKswvhrbEvDDM1y`)

_The mask is extensive and well-organized (nomenclature, protocol, N0-N4 tiers, CEAP, ablation mapping, May-Thurner, TVP staging, Wells score), but it contains one clear internal contradiction: the pathological reflux time threshold for perforating veins is stated as >0,5 s in three separate places (lines 33, 60, 322) but as ≥0,35 s in a fourth place (line 144), all referring to the same measurement (TRV in perforantes with diameter ≥3,5mm). This directly conflicts and would cause inconsistent AI output depending on which section is sampled. A secondary, lower-confidence issue is the CEAP citation "[Eklöf 2004 / 2020]" (line 313) which joins two years without clarifying which is the operative version, unlike the single-version discipline required by R10 for other classification systems._

- **[internal-contradiction]** Internal contradiction: this line states the pathological reflux threshold for perforating veins as ≥0,35 s, but three other places in the same mask (line 33: 'Veias Perfurantes: TRV > 0,5 s'; line 60: perforantes '> 3,5mm ... TRV > 0,5s'; line 322: 'Veias perfurantes: refluxo >0,5 s E diâmetro >3,5 mm') all specify >0,5 s for the identical measurement. Aligning this line to 0,5 s removes the contradiction and matches the majority/consistent value used throughout the rest of the document.

  - ANTES: `Perfurantes: refluxo ≥0,35 s com diâmetro ≥3,5 mm.`
  - DEPOIS: `Perfurantes: refluxo ≥0,5 s com diâmetro ≥3,5 mm.`

- **[version-mismatch]** Citing two different years jointly ('2004 / 2020') for the same classification system is ambiguous about which version is authoritative, inconsistent with the single-version citation discipline required by R10 for classification systems (e.g. 'não misturar' versions). The mask should cite the current operative revision only.

  - ANTES: `VN1 — CLASSIFICAÇÃO CEAP (clínica) [Eklöf 2004 / 2020]:`
  - DEPOIS: `VN1 — CLASSIFICAÇÃO CEAP (clínica) [revisão 2020]:`


## vascular — ARTÉRIAS RENAIS (`vascular-doppler-renal`)

_This is a detailed, clinically rich Camada 3 mask with good coverage (native kidney, transplant, TVR, FMD, aneurysm, living donor, Nutcracker, CEUS) and no conflicts with the R10 classification-version rules. However, it has one safety-relevant internal contradiction — two different IR thresholds (0,85 vs 0,90) are given for the same "IR bilateral elevado + oligúria/anúria" scenario that gates the R6 emergency alert — plus a clear typo in a clinical term. The document also has broken section numbering (skips "8" and "14"), but that was left out of the patches as a purely cosmetic/structural issue distinct from the concrete content defects requested._

- **[clarity]** Typo in clinical terminology ("tardusy-parvus" instead of "tardus-parvus"). The correct term is used consistently everywhere else in the file (e.g. lines 63, 69, 75, 137, 145), so this is an isolated formatting/spelling defect.

  - ANTES: `Perda do ESP (Early Systolic Peak — pico sistólico precoce): tardusy-parvus completo`
  - DEPOIS: `Perda do ESP (Early Systolic Peak — pico sistólico precoce): tardus-parvus completo`


## pequenas-partes — TIREOIDE (`pFfqNwK8NQsW9XxLSs5r`)

_The mask is thorough and well-structured, correctly pins ACR TI-RADS to the 2017 version (consistent with R10) and appropriately cites EU-TIRADS/Chammas/Bethesda as adjunct systems outside the main classification tag. However, it contains one clear internal contradiction: the canonical recommendation matrix (ETAPA 5) specifies two distinct follow-up intervals for sub-2.5cm TR3 nodules (1-2 years for ≥1.5cm, 3-5 years for <1.5cm), but the N-score section's N2 conduct line collapses this into a single "1-2 anos se <2,5 cm" rule, silently dropping the 3-5-year tier for smaller nodules and giving the AI two conflicting instructions for the same clinical scenario (e.g., a 1.0cm TR3 nodule)._

- **[internal-contradiction]** The N2 conduct rule contradicts the canonical MATRIZ DE RECOMENDAÇÕES (ETAPA 5, line 72), which specifies two distinct TR3 follow-up intervals for sub-2.5cm nodules — 1-2 years for ≥1.5cm and 3-5 years for <1.5cm. As written, N2 gives a single '1-2 anos' rule for all <2.5cm TR3 nodules, directly conflicting with the matrix's 3-5-year guidance for the <1.5cm subgroup and creating ambiguity for the AI on which instruction to follow.

  - ANTES: `N2 — Nódulo(s) TR3 (risco baixo). Bócio multinodular com nódulo TR3 dominante.
  Conclusão: "Nódulo(s) de baixo risco — TI-RADS 3 (TR3)."
  Conduta: PAAF se ≥2,5 cm; controle US em 1–2 anos se <2,5 cm`
  - DEPOIS: `N2 — Nódulo(s) TR3 (risco baixo). Bócio multinodular com nódulo TR3 dominante.
  Conclusão: "Nódulo(s) de baixo risco — TI-RADS 3 (TR3)."
  Conduta: PAAF se ≥2,5 cm; controle US em 1–2 anos se <2,5 cm`


## pequenas-partes — TIREOIDE COM DOPPLER (`bfgf28EuR3mI0KNclMXm`)

_This is a well-constructed, internally coherent Camada 3 mask. All classification systems cited (ACR TI-RADS 2017, EU-TIRADS, Chammas, Bethesda) are correctly named and consistent with R10 — TI-RADS 2017 is the mandated version and is used exclusively and correctly, and the adjunct systems (EU-TIRADS/Chammas/Bethesda) are exactly the ones R10 whitelists for tireoide without requiring a cited year. The PAAF size thresholds in Section 5 and the "APROFUNDAMENTO" block (T1) are mutually consistent and match real ACR TI-RADS 2017 practice. Coverage of recommendation tiers (N0-N4, post-surgical, lymph node, parathyroid) is complete. The only defect found is a minor but unambiguous formatting inconsistency: the Section 6 banner is missing its closing bold marker, unlike every other numbered section banner in the file._

- **[clarity]** Every other numbered section banner in the file (2, 3, 4, 5) closes its bold marker with a trailing **, but section 6's banner is missing the closing **, breaking the established house formatting style for section headers.

  - ANTES: `**6. MODELO DE SAÍDA DO LAUDO
═══════════════════════════════════════════════════════════════`
  - DEPOIS: `**6. MODELO DE SAÍDA DO LAUDO**
═══════════════════════════════════════════════════════════════`


## pequenas-partes — CERVICAL (`629P0KzQrxWDgm7T9D4u`)

_This CERVICAL mask is well-organized, internally coherent overall, and correctly defers version-specific classification systems (TI-RADS) to dedicated exams rather than misapplying them here, which is consistent with R10. It gives concrete, scenario-specific recommendation phraseology and a clear N0-N4 severity ladder. The only high-confidence issue found is a small boundary inconsistency in the lymph node long-axis/short-axis (L:T) ratio cutoff used to distinguish benign from suspicious morphology: one passage uses a strict "> 2" for normal/benign while two other passages describing the same cutoff use "≥ 2", leaving the exact boundary value (L:T = 2) undefined/contradictory between sections._

- **[internal-contradiction]** Internal contradiction: this line uses a strict '> 2' cutoff for the benign/normal L:T ratio, while the HTML output template (line 208, 'índice L:T ≥2') and the CV2 module (line 226, 'forma oval (índice L:T ≥2)') both use the non-strict '≥2' for the identical benign classification. Aligning to '≥ 2' makes the boundary consistent with the rest of the same mask and complementary to the suspicious-node cutoff of '< 2' (line 96 / line 228), leaving no undefined gap at exactly L:T = 2.

  - ANTES: `-   **Aspecto Habitual / Reacional Discreto (N0/N1):** Morfologia ovalada (eixo longo/curto > 2), hilo ecogênico central nítido, córtex fino e simétrico, vascularização hilar. Eixo curto tipicamente <`
  - DEPOIS: `-   **Aspecto Habitual / Reacional Discreto (N0/N1):** Morfologia ovalada (eixo longo/curto ≥ 2), hilo ecogênico central nítido, córtex fino e simétrico, vascularização hilar. Eixo curto tipicamente <`


## pequenas-partes — CERVICAL COM DOPPLER (`VWUxY7TQHHWsoSdgVyU9`)

_The mask is generally well-structured (clear escalation N0-N4, exact recommendation phraseology per finding, house-style units/decimal-comma/alert banners all consistent, and correctly avoids applying TI-RADS in-exam while deferring to the dedicated thyroid template with proper ACR 2017 context). One concrete internal defect was found: a self-referential cross-reference in the expanded vascular module that points back to this exact template instead of a genuine dedicated carotid-Doppler protocol, leaving carotid stenosis/Doppler detail undefined despite the exam being explicitly Doppler-capable._

- **[internal-contradiction]** Line 181 tells the model to consult the template "CERVICAL COM DOPPLER" for full carotid Doppler detail, but that IS this exact template/exam (confirmed by the file's own <h1> on line 203 and the exam name given). This is a self-referential dead-end cross-reference — likely a copy-paste leftover from a plain (non-Doppler) cervical mask — that never resolves to actual carotid-stenosis Doppler criteria, even though this exam explicitly includes Doppler and section 1 (line 29) explicitly excludes carotid stenosis quantification from this exam's scope, meaning the reader is pointed nowhere for that content.

  - ANTES: `ARTÉRIA CARÓTIDA (B-mode): ateromatose, espessamento médio-intimal, placa.
  Para Doppler completo: template "CERVICAL COM DOPPLER" (Camada 3).`
  - DEPOIS: `ARTÉRIA CARÓTIDA (B-mode): ateromatose, espessamento médio-intimal, placa.
  Para quantificação de estenose e análise hemodinâmica completa: template dedicado "DOPPLER DE CARÓTIDAS E VERTEBRAIS" (Cama`


## pequenas-partes — BOLSA ESCROTAL COM DOPPLER (`VnSG0u9X35U4WedzLGUo`)

_The mask is generally well-structured and clinically thorough (TWIST score, whirlpool sign, N0-N4 tiering, mandatory volume calculation), but it contains two genuine internal contradictions between its main body (sections 3-6) and its appended "APROFUNDAMENTO" addendum (E1-E4): the varicocele grading thresholds are defined two incompatible ways, and the microlitíase clássica follow-up recommendation is unconditional in the main body but conditioned on risk factors in the addendum. No R10 classification-version conflicts were found since varicocele/microlithiasis/TWIST are adjunct scrotal grading systems not covered by R10's mandatory-version list._

- **[internal-contradiction]** A seção E2 define a graduação da varicocele exclusivamente pelo padrão de refluxo, com uma faixa de diâmetro genérica (">2,0-3,0 mm") que não corresponde grau a grau. Isso contradiz diretamente a Seção 3 (linhas 65-67), que atribui um limiar de calibre venoso específico e crescente a cada grau (>2,0 mm / >2,5 mm / >3,0 mm). As duas seções do mesmo arquivo descrevem a mesma classificação de formas incompatíveis; a correção alinha E2 aos limiares já estabelecidos na Seção 3.

  - ANTES: `E2 — VARICOCELE — GRADAÇÃO (Sarti/Dubin + critério de refluxo):
  Diâmetro do plexo pampiniforme >2,0-3,0 mm + refluxo ao Valsalva.
  Grau I (subclínico): refluxo só ao Valsalva. Grau II: refluxo inte`
  - DEPOIS: `E2 — VARICOCELE — GRADAÇÃO (Sarti/Dubin + critério de refluxo, consistente com a Seção 3):
  Grau I (subclínico): veias > 2,0 mm, refluxo só ao Valsalva. Grau II (moderada): veias > 2,5 mm,
  refluxo`


## pequenas-partes — GLÂNDULAS SALIVARES (`1deRd6lTDDsSNZyAN3ID`)

_The mask is well-structured and internally coherent overall: it follows the expected Camada 3 shape (classificações, recomendações padrão, técnica, achados obrigatórios, aprofundamento), uses a consistent N0-N4 severity scale, and its one cited external classification (OMERACT 2019 for Sjögren) does not conflict with R10 since R10 leaves OMERACT/EULAR-OMERACT unversioned as an adjunct system for MSK/Reumato. The main defects are two spots where the otherwise-strict single-value N-classification convention is broken with ambiguous dual/range values, undermining the deterministic triage logic the rest of the document relies on (lines 108/113-115 explicitly sort findings by discrete N-level)._

- **[internal-contradiction]** The rest of the mask assigns a single discrete N-value per finding, and the downstream priority-ordering logic (lines 108-116) sorts findings strictly by N-level (N4 > N3 > N2). A slash-separated 'N2/N3' value is ambiguous for that mechanical sort and is the only entry in the document written this way instead of stating the deciding criterion explicitly.

  - ANTES: `- Classificação: N2/N3 (depende da gravidade e sintomas)`
  - DEPOIS: `- Classificação: N2 (leve/limitada) ou N3 (extensa/sintomática)`


## pequenas-partes — REGIÕES INGUINAIS (`gdCig7G4kmz9uclrs2oE`)

_The mask is well-structured, comprehensive, and internally consistent on nearly all counts: no classification-version conflicts with R10 (it uses a custom N0-N4 severity scale, not any of the ACR systems), units/decimal-comma house style is correctly applied, and recommendation phraseology for each tier (N0-N4) is concrete and exact rather than vague. One genuine internal contradiction was found regarding femoral hernia risk stratification: the main-body tier lumps uncomplicated femoral hernia together with inguinal hernia under an N2/N3 "elective surgery" recommendation, while the expanded module explicitly states femoral hernias always carry high strangulation risk and always warrant surgical evaluation — an inconsistency in how urgently a reducible femoral hernia should be routed._

- **[internal-contradiction]** Line 87 classifies an uncomplicated, reducible femoral hernia the same as an inguinal hernia (N2/N3, routine 'cirurgia eletiva' wording), but the expanded module 7 (line 175) states 'QUALQUER hérnia femoral = avaliação cirúrgica (alto risco de estrangulamento)', i.e. femoral hernias should never be treated as low-urgency/elective-only. This is an internal contradiction in recommendation tier/urgency for the same finding (uncomplicated femoral hernia). The patch separates the femoral case into its own higher-priority (N3, prioritized referral) tier consistent with the module's stated rationale.

  - ANTES: `-   *Hérnia não complicada (redutível, sem sinais de sofrimento):* N2/N3 — "Achados compatíveis com hérnia inguinal [direta/indireta]/femoral [direita/esquerda], de conteúdo [descrição], redutível à c`
  - DEPOIS: `-   *Hérnia inguinal não complicada (redutível, sem sinais de sofrimento):* N2/N3 — "Achados compatíveis com hérnia inguinal [direta/indireta] [direita/esquerda], de conteúdo [descrição], redutível à`


## pediatria — TRANSFONTANELAR (`MtTMoVr6Vi11fFLGCjxe`)

_The mask is well-structured, clinically detailed, and internally consistent in its core classification tables (Papile grading and the Levene atrial-width table have clean, non-overlapping bands). It does not cite any R10-governed classification system (BI-RADS, TI-RADS, O-RADS, etc.), so no version-mismatch issues apply. Two concrete defects were found: a direct self-contradiction over use of the word "mandatório/mandatória" (instructed both to use it and to avoid it), and a sloppily-notated IR threshold range that reads as ambiguous compared to the crisp table format used elsewhere in the same document._

- **[internal-contradiction]** Linha 177 (EVITAR) proíbe explicitamente o termo "mandatório", mas esta linha o usa ("mandatória") para descrever a indicação do Doppler — contradição interna direta entre uma instrução de conteúdo e a lista de termos proibidos do próprio prompt.

  - ANTES: `6.  A avaliação com Doppler é mandatória em suspeita de lesão hipóxico-isquêmica, hipertensão intracraniana ou para caracterização de lesões vasculares.`
  - DEPOIS: `6.  A avaliação com Doppler é indicada em suspeita de lesão hipóxico-isquêmica, hipertensão intracraniana ou para caracterização de lesões vasculares.`

- **[internal-contradiction]** Mesmo conflito com a lista EVITAR da linha 177, que proíbe o termo "mandatório" — aqui usado como rótulo de subseção ("Mandatória").

  - ANTES: `5.  Correlação Clínica Mandatória: Os achados do Doppler devem sempre ser interpretados no contexto da situação hemodinâmica do paciente (ex: persistência do canal arterial, estado de choque, sepse).`
  - DEPOIS: `5.  Correlação Clínica Obrigatória: Os achados do Doppler devem sempre ser interpretados no contexto da situação hemodinâmica do paciente (ex: persistência do canal arterial, estado de choque, sepse).`


## pediatria — COLUNA LOMBOSSACRA (`1Wd6YKr4yuFgJx4lgJJn`)

_Esta máscara (COLUNA LOMBOSSACRA pediátrica) é bem estruturada e internamente coerente: os limiares de filum terminale (2,0 mm), a estratificação etária do nível do cone medular, os critérios de fosseta sacrococcígea (≤2,5 cm / >2,5 cm) e a escala de severidade N0-N4 são usados de forma consistente em todas as seções, incluindo o "Módulo Expandido". A fraseologia segue o padrão de casa (setas ▸, vírgula decimal, banners de seção) e as listas "SEMPRE PREFERIR/EVITAR" não são violadas em nenhum outro trecho do texto. O único problema de confiança alta encontrado é a citação da Classificação de Altman (teratoma sacrococcígeo) sem ano/sociedade, destoando do cuidado com versionamento demonstrado no resto do documento (ex.: cabeçalho "v2.0", limiares numéricos precisos)._

- **[missing-citation]** A Classificação Altman é citada sem ano/sociedade de referência, ao contrário do restante da máscara, que é cuidadosa em versionar critérios (ex.: cabeçalho 'v2.0', limiar 'até 2,0 mm'). Isso viola a regra de citação completa de sistemas de classificação nomeados (item 2 do escopo de auditoria).

  - ANTES: `TERATOMA SACROCOCCÍGEO (TSC):
  Massa mista (sólida + cística) na região sacral/presacral.
  Classificação Altman:`
  - DEPOIS: `TERATOMA SACROCOCCÍGEO (TSC):
  Massa mista (sólida + cística) na região sacral/presacral.
  Classificação Altman (Altman et al., 1974, American Academy of Pediatrics Surgical Section):`


## pediatria — ABDOME TOTAL PEDIÁTRICO (`nRoALtsmbqfFWo47RUZm`)

_The mask is well-structured and thorough, covering pediatric-specific classifications (N0-N4), detailed recommendation phraseology per scenario, a complete organ checklist, and a useful deep-dive appendix (PED1-PED4) with quantitative diagnostic criteria. No R10 classification-version conflicts apply since no ACR/FIGO systems are cited (correctly, as none are relevant to general pediatric abdominal US). However, there is one clear internal numeric contradiction between the main body and the appendix for pyloric stenosis diagnostic thresholds._

- **[internal-contradiction]** The main-body EHP criteria (channel length >14mm) directly contradict the more detailed PED1 appendix criteria (channel length ≥15-17mm) for the same measurement in the same document. This could cause the AI to classify a borderline case (e.g. 15mm) inconsistently depending on which section it references. Aligning the main body to reference/match the PED1 figures resolves the contradiction.

  - ANTES: `- **Estenose Hipertrófica de Piloro (EHP):**
    - Descrição: Espessura do músculo pilórico >3mm e comprimento do canal pilórico >14mm, com dificuldade de esvaziamento gástrico.`
  - DEPOIS: `- **Estenose Hipertrófica de Piloro (EHP):**
    - Descrição: Espessura do músculo pilórico ≥3mm (≥4mm definitivo) e comprimento do canal pilórico ≥15-17mm, com dificuldade de esvaziamento gástrico (v`


## pediatria — QUADRIL PEDIÁTRICO (DDQ) (`pediatria-quadril-pediarico-ddq`)

_This mask is well-structured and detailed (technique, obligatory measurements, full Graf classification, risk factors, conduct table, N0-N4 mapping, standard recommendation phraseology, HTML output template). It does not cite any ACR-style classification governed by R10 (Graf's method is an independent, non-ACR system with no version ambiguity), so no version-mismatch issues apply. However, there is one genuine internal contradiction in the numeric β threshold that defines Graf Type I / subtype Ib, which could cause the AI to misclassify or generate inconsistent angle-based conclusions._

- **[internal-contradiction]** Internal contradiction: line 37 ("Normal: <55° (Graf Tipo I e IIa/b)") and the TIPO I header itself (line 53, "α ≥60° | β <55°") state β must be <55° for Type I, but the very next line defines Subtipo Ib as β >55° and still calls it 'ainda normal' — the same threshold is used to both include and exclude the same value range from Tipo I. Graf's original method allows Ib up to the IIc boundary (β≈77°) while α stays ≥60°, so bounding Ib as 55–77° removes the self-contradiction and aligns with the rest of the mask's own β ranges used later (IIc uses 55–77°, IId uses >77°).

  - ANTES: `TIPO I — Quadril Maduro (Normal):
  α ≥60° | β <55°
  Subtipo Ia: β <55° (labro invertido para dentro — ideal)
  Subtipo Ib: β >55° (labro vertical — ainda normal se α ≥60°)`
  - DEPOIS: `TIPO I — Quadril Maduro (Normal):
  α ≥60°
  Subtipo Ia: β <55° (labro invertido para dentro — ideal)
  Subtipo Ib: β 55–77° (labro vertical — ainda normal se α ≥60°, sem descentralização)`


## pediatria — ESCROTO AGUDO PEDIÁTRICO (`pediatria-escroto-agudo`)

_This is a thorough, clinically detailed mask covering torsion, appendix torsion, epididymo-orchitis, hydrocele/hematocele/piocele, varicocele, trauma, cryptorchidism, tumors, and a solid HTML output template with R6 critical-alert phraseology. No conflicts with the R10 classification-version rules were found, since none of the R10-governed systems (BI-RADS/TI-RADS/O-RADS/LI-RADS/GRADS/Bosniak/PI-RADS/FIGO) apply to scrotal imaging. The main defects found are a self-contradictory phrase describing neonatal testicular artery caliber, a broken section-numbering sequence (section 9 missing), and a spelling inconsistency for the same clinical term used three times._

- **[internal-contradiction]** Internal contradiction: "muito calibrosas" (very large-caliber) directly contradicts "diminutas" (tiny) and the stated 1-2mm diameter in the same sentence. This appears to be a botched edit; the clause should consistently convey that neonatal testicular arteries are very small-caliber, which is also what the surrounding text (need for low PRF, high-frequency transducer, risk of false-negative) supports.

  - ANTES: `Artérias testiculares muito calibrosas diminutas (1–2 mm de diâmetro).`
  - DEPOIS: `Artérias testiculares de calibre muito diminuto (1–2 mm de diâmetro).`

- **[clarity]** The section numbering runs consecutively 1 through 8 (lines 14-179), then jumps directly to "10." at line 217, skipping "9." The two intervening headers (OBSERVAÇÕES METODOLÓGICAS and PARTICULARIDADES DO DOPPLER NO NEONATO) are the only headers in the whole document without a number/divider bar, breaking the established house style of numbered section banners used consistently everywhere else in the file.

  - ANTES: `OBSERVAÇÕES METODOLÓGICAS:
Avaliação dinâmica com Doppler; torção testicular é emergência (janela ~6 h) — ausência de fluxo intratesticular impõe conduta cirúrgica imediata. Correlação clínica.

PARTI`
  - DEPOIS: `9. OBSERVAÇÕES METODOLÓGICAS E PARTICULARIDADES DO DOPPLER NO NEONATO
───────────────────────────────────────────────────────────────
Avaliação dinâmica com Doppler; torção testicular é emergência (ja`

- **[clarity]** Spelling inconsistency: "espiralaamento" (with a duplicated/misplaced vowel) here versus the correct "espiralamento" used for the same term at lines 66 and 353 in the same document.

  - ANTES: `Nódulo hiperecoico no polo superior = "whirlpool sign" (espiralaamento do pedículo).`
  - DEPOIS: `Nódulo hiperecoico no polo superior = "whirlpool sign" (espiralamento do pedículo).`


## medicina-fetal — OBSTÉTRICA INICIAL (`3r76O3uzRFLSWQsLdwVX`)

_Mask muito completa e bem estruturada, com boa cobertura de classificações, fraseologia padrão e checklist de achados. Porém contém duas contradições internas genuínas de threshold clínico (bradicardia fetal e percentual de hematoma subcoriônico) entre a seção principal (Seção 5) e o "MÓDULO EXPANDIDO" anexado ao final, que parecem ter sido escritos em momentos diferentes sem reconciliação. Há também uma falha de numeração de seção (pula da seção 2 para a 4)._

- **[internal-contradiction]** A linha 212 fixa um limiar único de bradicardia (<110 bpm em qualquer IG) que contradiz diretamente a Seção 5.5 (linhas 82-85), a qual define 110-180 bpm como normal entre 7-9 sem e nota explicitamente que 110-120 bpm nesse período 'pode ser normal'. Um redator seguindo a linha 212 marcaria como bradicardia patológica um achado que a própria mask classifica como normal/observação em outro trecho. A correção remove o limiar numérico duplicado e conflitante, remetendo à regra já estabelecida e não-contraditória da Seção 5.5.

  - ANTES: `FREQUÊNCIA CARDÍACA FETAL (ritmo):
  Normal 6+0 a 7+0: 90–110 bpm (ainda lento). Normal 9+0 a 13+6: 150–180 bpm.
  Bradicardia persistente <110 bpm ou taquicardia >200 bpm em QQ IG = R6.`
  - DEPOIS: `FREQUÊNCIA CARDÍACA FETAL (ritmo):
  Normal 6+0 a 7+0: 90–110 bpm (ainda lento). Normal 9+0 a 13+6: 150–180 bpm.
  Bradicardia mau prognóstico (ver critérios da Seção 5.5 por IG) ou taquicardia >200 b`

- **[internal-contradiction]** A Seção 5.9 (linha 105) define o tamanho relativo do hematoma subcoriônico em três faixas (<30%, 30-50%, >50%) para classificação N2/N3. O Módulo 8 (linhas 219-220) usa um limiar diferente e binário (<25% vs ≥25%) para o mesmo achado, criando uma contradição direta de qual percentual separa 'pequeno' de 'grande' dentro da mesma mask. Ajustado para 30% para alinhar com o limiar já fixado na Seção 5.9.

  - ANTES: `Pequeno (<25% área do SG): prognóstico favorável; seguimento US em 2 semanas.
  Grande (≥25%): maior risco de aborto; N3/N4 → avaliação obstétrica.`
  - DEPOIS: `Pequeno (<30% área do SG): prognóstico favorável; seguimento US em 2 semanas.
  Grande (≥30%): maior risco de aborto; N3/N4 → avaliação obstétrica.`

- **[clarity]** A numeração das seções pula da Seção 2 (ESCOPO E OBJETIVOS PRIMÁRIOS) diretamente para a Seção 4 (ESTRUTURA DO LAUDO GERADO), sem que exista uma Seção 3 em nenhum ponto do documento. Inconsistência de formatação/numeração do house style do documento.

  - ANTES: `═══════════════════════════════════════════════════════════════
4. ESTRUTURA DO LAUDO GERADO
═══════════════════════════════════════════════════════════════`
  - DEPOIS: `═══════════════════════════════════════════════════════════════
3. ESTRUTURA DO LAUDO GERADO
═══════════════════════════════════════════════════════════════`


## medicina-fetal — OBSTÉTRICA ABDOMINAL COM DOPPLER (`Me4D9W0YCPNm4IL8aNR0`)

_This is an unusually thorough and well-referenced mask (explicit numeric percentile tables with cited curves, careful Delphi 2016 / Barcelona staging logic, self-verification rules, and repeated correction annotations showing prior QA passes). However, it contains a severe internal contradiction between the N-score alert-activation instructions (Section 8, lines 342 and 349) and the N-score definitions themselves (lines 273-298): Estágio I is told to activate N3 and Estágio II to activate N4, but N3/N4 are explicitly defined as corresponding to Estágio III/IV criteria (absent-diastole and DV wave-a abnormalities respectively), not Estágio I/II. This would cause the AI to emit critical/emergency alert language (including R6 "risco iminente de óbito fetal") for cases that are only mild-to-moderate RCIU, a clinically significant escalation error. A secondary, lower-confidence issue is the reuse of the N-score labels (N2/N3) for GIG/macrossomia classification, which conflicts with the N-score's own definition as a Doppler-insufficiency severity ladder._

- **[internal-contradiction]** Internal contradiction: N3 is explicitly defined at lines 290-292 as requiring absent/reversed umbilical diastole (AEDF/REDF) and corresponds to Barcelona Estágio III — but here Estágio I (which by its own stated criterion at line 339 has diastole PRESENTE) is instructed to activate N3. This mismatch would make the AI emit an inappropriately severe N-score/alert level for a mild-stage finding. The correct N-score per the document's own N0-N4 ↔ Estágio 0-IV parallel structure (lines 275-298) is N1 (redistribution without AEDV) or N2 (centralization).

  - ANTES: `Fraseologia: "RCIU Estágio I (Barcelona) — redistribuição hemodinâmica inicial."
  ATIVAR N3.`
  - DEPOIS: `Fraseologia: "RCIU Estágio I (Barcelona) — redistribuição hemodinâmica inicial."
  ATIVAR N1 (ou N2 se centralização com RCP <P5/ACM <P5 presente).`

- **[internal-contradiction]** Internal contradiction: N4 is explicitly defined at lines 295-298 as requiring ducto venoso wave 'a' absent/reversed (or pulsatile umbilical vein) and corresponds to Barcelona Estágio IV, triggering R6 'risco iminente de óbito fetal' / emergency cesarean language. Estágio II (AEDV only, DV not yet involved) instructing 'ATIVAR N4' would cause the AI to output critical/emergency alert wording for a case that is only Estágio II. Per the N0-N4 ↔ Estágio 0-IV correspondence used elsewhere in the document, AEDV (Estágio II) maps to N3 (line 290: 'Diástole ausente ou invertida na AU... Estágio III de Barcelona' — the closest matching N-tier for AEDV), not N4.

  - ANTES: `Fraseologia: "RCIU Estágio II (Barcelona) — ausência de diástole umbilical (AEDV).
  Risco elevado de comprometimento fetal agudo. Avaliação perinatológica URGENTE."
  ATIVAR N4.`
  - DEPOIS: `Fraseologia: "RCIU Estágio II (Barcelona) — ausência de diástole umbilical (AEDV).
  Risco elevado de comprometimento fetal agudo. Avaliação perinatológica URGENTE."
  ATIVAR N3.`


## medicina-fetal — CERVICOMETRIA (`B1ehwbQDCk6MUyQjA5aO`)

_The CERVICOMETRIA mask is detailed, internally consistent on its numeric thresholds (25mm/29,9mm/20mm/15mm/10mm cutoffs align across Section 5, the phraseology library, and the historical-stratification table), and does not cite any of the R10-governed classification systems, so no version-conflict issues apply. The one clear defect is a structural gap in the "FRASEOLOGIA PADRÃO — BIBLIOTECA V2.0" library: it provides exact wording for N0, N1, N2 and N4 but skips N3, even though Section 5 defines N3 as a full, distinct risk tier with its own criteria and recommendation text._

- **[gap-coverage]** Section 5 defines N3 ("RISCO ELEVADO / AVALIAÇÃO ESPECIALIZADA URGENTE") as a full, distinct risk tier with its own criteria and recommendation (lines 148-156), but the FRASEOLOGIA PADRÃO library jumps from N2 straight to N4, leaving no exact-wording template for the N3 tier. The only N3 phrases present later in the file (lines 239 and 259) are narrow, context-specific variants (prior PPT history; twin gestation) buried in a different section, not the general-purpose N3 phrase the library structure promises alongside N0/N1/N2/N4.

  - ANTES: `N2 — COLO CURTO (<25 mm) — RISCO MODERADO:
"Colo uterino com comprimento reduzido ao estudo transvaginal: [X] mm. Colo curto
(<25 mm) é fator de risco independente para parto prematuro. Encaminhamento`
  - DEPOIS: `N2 — COLO CURTO (<25 mm) — RISCO MODERADO:
"Colo uterino com comprimento reduzido ao estudo transvaginal: [X] mm. Colo curto
(<25 mm) é fator de risco independente para parto prematuro. Encaminhamento`


## medicina-fetal — GEMELAR (`Dn2dltlyR0EfkCR6ajuE`)

_This is a well-constructed, detailed Camada 3 mask with correct and properly cited classification systems (Quintero, Slaghekke/Delphi 2020, Gratacós) that are consistent with R10 (none of these are in the R10-governed BI-RADS/TI-RADS/etc. list, and none conflict with it). It found two concrete defects: a numeric contradiction in the TAPS Stage 1 receptor threshold between the detailed definition (7.2) and its condensed restatement (Section 9, rule 7), and a numbering gap (list restarts at "2." with no "1.") in the REGRAS FINAIS sub-list that suggests a rule was deleted without renumbering._

- **[internal-contradiction]** Contradiz a definição canônica do próprio documento na Seção 7.2 (linha 175): "Estágio 1: PSV-ACM doador >1,5 MoM E receptor <1,0 MoM". A restatement na Seção 9 inverteu o sinal do limiar do receptor para ">1,0 MoM", criando um critério numérico oposto para o mesmo estágio dentro do mesmo prompt — pode levar a estadiamento incorreto de TAPS.

  - ANTES: `7. TAPS → usar estadiamento de Slaghekke (5 estágios); Stage 1: >1,5/>1,0 MoM; Stage 2: >1,7/<0,8 MoM; Stage 3: comprometimento cardíaco do doador; Stage 4: hidropsia; Stage 5: óbito.`
  - DEPOIS: `7. TAPS → usar estadiamento de Slaghekke (5 estágios); Stage 1: doador >1,5 MoM / receptor <1,0 MoM; Stage 2: doador >1,7 MoM / receptor <0,8 MoM; Stage 3: comprometimento cardíaco do doador; Stage 4:`


## medicina-fetal — MORFOLÓGICA DO PRIMEIRO TRIMESTRE (`d8KNSSbuGgc3NpLqMmXn`)

_The mask is generally thorough and well-organized (FMF criteria, module structure, phraseology bank), but contains two genuine internal contradictions that would produce inconsistent report output: (1) the risk cut-off definition in the conclusion model uses a mathematically backwards inequality that conflicts with the correctly-stated NIPT module cut-offs, and (2) the N-score tier assigned to the same TN findings (P95–3,5mm and ≥3,5mm) differs between Module 3 and the Recommendations section. There is also a likely corrupted citation ("Resolução CFM 2013/2013") that reads as an unfilled placeholder duplicated across both the number and year slots. No R10 classification-version conflicts apply since this exam does not use any of the BI-RADS/TI-RADS/O-RADS/etc. systems._

- **[internal-contradiction]** The stated cut-off '>1:100 alto' is mathematically backwards: as a ratio, '>1:100' denotes risks smaller (safer) than 1:100 (e.g. 1:500), which is the opposite of high risk. This also contradicts the correctly-stated thresholds in the NIPT module later in the same file (lines 245-261: '≥1:100 alto risco', '1:101 a 1:1000 risco intermediário', '<1:1000 baixo risco'). Fixed to match the file's own correct convention and eliminate the overlap between 'baixo' and 'intermediário' bands.

  - ANTES: `3. Rastreamento do 1ºT para aneuploidias: [BAIXO/INTERMEDIÁRIO/ALTO] risco. (Cut-offs: <1:1.000 baixo; 1:100–1:1.000 intermediário; >1:100 alto.)`
  - DEPOIS: `3. Rastreamento do 1ºT para aneuploidias: [BAIXO/INTERMEDIÁRIO/ALTO] risco. (Cut-offs: <1:1.000 baixo; 1:101–1:1.000 intermediário; ≥1:100 alto.)`

- **[internal-contradiction]** TN ≥P95 and <3,5mm is explicitly classified as N3 in Module 3 (line 103: 'N3 (TN ≥P95 e <3,5 mm)') and again in the summary rule at line 215 ('TN P95–3,5 mm → eco fetal a considerar (N3)'). Labeling the corresponding recommendation as N2 here contradicts both of those statements for the same finding.

  - ANTES: `- Ecocardiografia fetal a considerar (N2): "Devido a [TN entre P95 e 3,5 mm / risco combinado aumentado], ecocardiografia fetal pode ser discutida em aconselhamento no 2ºT."`
  - DEPOIS: `- Ecocardiografia fetal a considerar (N3): "Devido a [TN entre P95 e 3,5 mm / risco combinado aumentado], ecocardiografia fetal pode ser discutida em aconselhamento no 2ºT."`

- **[internal-contradiction]** TN ≥3,5mm/>P99 is classified as N4 in Module 3 (line 106: 'N4 (TN ≥3,5 mm / >P99)') and in the summary rule at line 215 ('TN ≥3,5 mm/P99 → indicação FORMAL de eco fetal (N4)'). Labeling the formal echo indication as N3 here contradicts the N4 classification used elsewhere in the same document for the identical finding.

  - ANTES: `- Ecocardiografia fetal indicada (N3): "Devido a [TN ≥3,5 mm/P99 / DV alterado / RT / malformação extracardíaca], está indicada ecocardiografia fetal no 2ºT (FEBRASGO 2023/SBC), preferencialmente entr`
  - DEPOIS: `- Ecocardiografia fetal indicada (N4): "Devido a [TN ≥3,5 mm/P99 / DV alterado / RT / malformação extracardíaca], está indicada ecocardiografia fetal no 2ºT (FEBRASGO 2023/SBC), preferencialmente entr`

- **[missing-citation]** "Resolução CFM 2013/2013" duplicates the same number as both the resolution number and the year, which is the signature pattern of an unfilled/corrupted citation placeholder rather than a real, verifiable CFM resolution citation. Since the exact correct resolution number cannot be confirmed here, the safest fix is to remove the specific (likely wrong) citation and reference the standing CFM norm generically rather than assert an unverifiable specific number.

  - ANTES: `biópsia de vilo corial). O diagnóstico pré-natal é direito da paciente conforme Resolução
  CFM 2013/2013."`
  - DEPOIS: `biópsia de vilo corial). O diagnóstico pré-natal é direito da paciente conforme normativa
  do CFM vigente."`


## medicina-fetal — MORFOLÓGICO DE SEGUNDO TRIMESTRE (`FxSIs2Deay4aYyH5KiOi`)

_This is a well-structured, clinically careful Camada 3 mask for the second-trimester morphology scan: it covers técnica, checklist anatômico obrigatório, classificação ponderal (Delphi 2016), gatilhos formais para exames especializados, N-score, fraseologia padrão, and explicitly guards against overreach (e.g. not offering eco fetal as universal screening, not diagnosing RCIU by PFE P3-P10 alone). No R10-governed classification systems (BI-RADS/TI-RADS/O-RADS/etc.) are cited, so no version-mismatch risk there; the systems it does cite (ISUOG, FEBRASGO, ACOG, SMFM, Delphi 2016) are used consistently and with correct distinctions (e.g. TN vs. prega nucal are correctly kept separate). Only two concrete, surgical defects were found: a duplicated version tag typo and a numbered checklist that skips its first item._

- **[clarity]** Every other version banner in this mask uses the plain form "(V2.0)" (lines 2, 232, 295, 315, 321). "(V2.0/V2.0)" is a duplicated-token typo/copy-paste artifact that is inconsistent with the file's own house style for version tags.

  - ANTES: `NOTA SOBRE ECOCARDIOGRAFIA FETAL (V2.0/V2.0):`
  - DEPOIS: `NOTA SOBRE ECOCARDIOGRAFIA FETAL (V2.0):`

- **[gap-coverage]** The closing "regras de ouro" checklist runs 2 through 9 with no item 1 — it jumps directly from the section 3.6 header/table into "2.", an off-by-one gap in an otherwise complete enumerated list (items 2-9 are all present and coherent). This reads as an editing artifact where rule 1 was dropped; restoring a rule 1 consistent with Section 1.A item 1-2 (correlação clínica/veracidade) closes the numbering gap. If the omission was intentional, the list should at minimum be renumbered starting at 1 to avoid the appearance of missing content.

  - ANTES: `- Grave: >15,0 mm → N3/N4 / ALERTA NEUROLÓGICO.

2. Dados insuficientes → descrever limitação; não inventar; não presumir normalidade absoluta.`
  - DEPOIS: `- Grave: >15,0 mm → N3/N4 / ALERTA NEUROLÓGICO.

1. Correlação clínica e veracidade → integrar anamnese/exames prévios; nunca inventar biometria, achados ou conduta.
2. Dados insuficientes → descrever`


## medicina-fetal — NEUROSSONOGRAFIA FETAL (`fuLw5Rs3ui4is8PtCZVu`)

_This is a substantial, well-structured Camada 3 mask with detailed classification thresholds, IG-referenced sulcation milestones, tiered N-score recommendations, and appropriately-caveated adjunct systems (Papile, Zika differential). It stays consistent with R10 (no BI-RADS/TI-RADS/etc. systems cited here that would need version pinning). However, the appended "SEÇÃO ADICIONAL C5/P5" block (added after the "FIM DO PROMPT" marker) introduces a ventriculomegalia banding for RM triage that directly contradicts the mask's own primary classification thresholds defined three times earlier in the same file, creating a genuine internal contradiction an LLM could resolve either way._

- **[internal-contradiction]** O limiar de 'grave' está definido três vezes no mesmo prompt (linhas 73, 118, 193) como '>15,0 mm' (exclusivo). Esta seção usa '≥15 mm' (inclusive), uma contradição interna direta sobre o mesmo limiar de mensuração.

  - ANTES: `URGENTE (solicitar e realizar em ≤48 horas):
  - Ventriculomegalia grave (atrium ≥15 mm) bilateral`
  - DEPOIS: `URGENTE (solicitar e realizar em ≤48 horas):
  - Ventriculomegalia grave (atrium >15,0 mm) bilateral`

- **[internal-contradiction]** O prompt define três faixas distintas de ventriculomegalia (leve 10,0–12,0 / moderada 12,1–15,0 / grave >15,0 mm, linhas 70-73 e 193) com recomendações e N-scores diferentes (N2/N3 para leve; N3/ALERTA para moderada). Esta seção colapsa as duas faixas em um único intervalo '10-14 mm', contradizendo a própria estratificação do documento e omitindo o intervalo 14,1–15,0 mm.

  - ANTES: `ELETIVA (dentro de 2-4 semanas, após 20-22 semanas):
  - Ventriculomegalia leve/moderada (10-14 mm) isolada`
  - DEPOIS: `ELETIVA (dentro de 2-4 semanas, após 20-22 semanas):
  - Ventriculomegalia leve (10,0–12,0 mm) ou moderada (12,1–15,0 mm) isolada`


## medicina-fetal — OBSTÉTRICA ABDOMINAL (`3wGk3zoYVVefVkkRhBXK`)

_This is a well-constructed, detailed Camada-3 mask with strong internal logic: DPP/gestational-milestone date math checks out, N-Score tiers are mostly well-defined, and the classification systems it cites (Delphi 2016, Grannum, Finberg, FEBRASGO 2023/SBC, ISUOG 2018) are outside R10's scope (which governs BI-RADS/TI-RADS/O-RADS/LI-RADS/GRADS/Bosniak/PI-RADS/FIGO-ginecológico) so no version conflicts were found there. Two concrete, high-confidence issues survived scrutiny: an asymmetric phraseology gap where polidrâmnio grave is explicitly scored N3/N4 in the reference table but never gets its own N4 wording template (unlike the fully-fleshed oligodrâmnio N0→R6 ladder), and a missing section-banner line before header D that breaks the file's own consistent ═══/header/═══ pattern used everywhere else._

- **[gap-coverage]** A tabela de referência (linhas 218-231) define três níveis distintos — Polidrâmnio leve (N2), moderado (N3) e grave (N3/N4) — mas a seção de fraseologia padronizada só fornece texto para N2 (leve) e um único template combinado 'N3 — moderado a grave', sem nenhuma fraseologia N4 dedicada. Isso deixa o laudo sem redação padrão exata para o cenário mais grave (ILA ≥35 cm / MBV ≥16 cm), inconsistente com o tratamento simétrico dado ao oligodrâmnio (que tem template para cada tier até N4/R6).

  - ANTES: `**N3 — Polidrâmnio moderado a grave:**
"⚠️ POLIDRÂMNIO MODERADO A GRAVE. ILA: X,X cm / MBV: X,X cm. Avaliação em Medicina Fetal. Risco de trabalho de parto prematuro, descolamento placentário e prolap`
  - DEPOIS: `**N3 — Polidrâmnio moderado:**
"⚠️ POLIDRÂMNIO MODERADO. ILA: X,X cm / MBV: X,X cm. Avaliação em Medicina Fetal. Risco de trabalho de parto prematuro, descolamento placentário e prolapso de cordão. In`

- **[clarity]** Todas as demais seções (A, B, C, E, F) usam a moldura ═══/TÍTULO/═══ com uma linha de banner tanto antes quanto depois do cabeçalho. A seção D está com a linha de banner superior ausente, quebrando o padrão visual estabelecido pelo próprio arquivo.

  - ANTES: `D. DATAÇÃO, DPP E CÁLCULO DE AGENDAMENTOS
═══════════════════════════════════════════════════════════════`
  - DEPOIS: `═══════════════════════════════════════════════════════════════
D. DATAÇÃO, DPP E CÁLCULO DE AGENDAMENTOS
═══════════════════════════════════════════════════════════════`


## procedimentos — PAAF TIREOIDE (`UCLNaw0tHp8pnYTcvNbl`)

_Mask is well-structured (escopo, técnica, achados obrigatórios, classificação N0-N4, recomendações por cenário, seção de segurança periprocedimento) and internally consistent in its recommendation-tier logic (N0/N2/N3/N4 all defined and covered in both the detailed blocks and the summary table). The one high-confidence defect is a factual/version error in the Bethesda citation: it labels the 2023 update as the "2ª edição" when 2023 is actually the 3rd edition (2nd edition was 2017) — a verifiable, unambiguous mistake that could mislead a reader about which edition's criteria/ROM figures are being cited._

- **[version-mismatch]** Factual/version error: the Bethesda System for Reporting Thyroid Cytopathology update published in 2023 is the 3rd edition, not the 2nd edition. The 2nd edition was published in 2017. Confirmed via multiple sources (journals.sagepub.com/doi/10.1089/thy.2023.0141; education.cytopathology.org 'Updates from the New 3rd Edition'). Mislabeling the edition number could cause confusion about which criteria/ROM table version is authoritative.

  - ANTES: `**SISTEMA DE BETHESDA PARA CITOPATOLOGIA TIREOIDIANA (2ª edição, 2023):**`
  - DEPOIS: `**SISTEMA DE BETHESDA PARA CITOPATOLOGIA TIREOIDIANA (3ª edição, 2023):**`


## procedimentos — PAAF MAMA (`TE3KSrgQue5QiB9XoAuk`)

_This is a well-structured, clinically coherent mask with consistent BI-RADS v2025 citations throughout (matching R10), a clear N0-N4 severity ladder specific to procedural complications rather than lesion category, and exact recommendation phraseology for each complication scenario (hematoma, vasovagal reaction, insatisfactory sample). The expanded module (PADINI/C1-C5 cytology, coagulation thresholds, checklist) adds genuine procedural depth without redundantly repeating Camada 1/2 content. Two concrete, low-risk defects were found: a duplicated closing HTML tag in the report header template, and an ambiguous "≤X-Y" threshold notation (mixing a ceiling operator with a range) for INR/platelet safety limits that appears twice and is inconsistent with the plain hyphen-range style used elsewhere in the same file (e.g., "3-5 dias", "24-48h")._

- **[other]** Duplicated closing tag in the MODELO DE SAÍDA template (</h1></h1>) is malformed HTML that would be carried into the generated report output.

  - ANTES: `<h1>PUNÇÃO ASPIRATIVA POR AGULHA FINA (PAAF) DE MAMA GUIADA POR ULTRASSONOGRAFIA</h1></h1>`
  - DEPOIS: `<h1>PUNÇÃO ASPIRATIVA POR AGULHA FINA (PAAF) DE MAMA GUIADA POR ULTRASSONOGRAFIA</h1>`


## procedimentos — PUNÇÃO/DRENAGEM DE CISTO (`TieSCWDKqitCZrv3H1DP`)

_The mask is well-structured and detailed (technique, N0-N4 classification ladder, scenario-specific recommendation phraseology, expanded module with per-organ protocols, and a periprocedural safety appendix). The main defect is that three classification systems (TI-RADS, Bosniak, O-RADS) are cited repeatedly throughout the expanded module without ever stating their required version/society, which violates R10's citation requirement even though these are adjunct references rather than a formal <h2>CLASSIFICAÇÃO</h2> section. No internal contradictions in the N-classification/recommendation ladder were found, and the recommendation phraseology per scenario is concrete and non-vague._

- **[missing-citation]** TI-RADS é citado repetidamente neste módulo sem indicar a versão/sociedade (ACR 2017), conforme exigido por R10 sempre que o sistema é nomeado.

  - ANTES: `CISTO TIREOIDIANO:
  Simples (completamente anecoico, TI-RADS 1): PAAF não indicada.
  Misto (cisto + componente sólido, TI-RADS 3–5):`
  - DEPOIS: `CISTO TIREOIDIANO:
  Simples (completamente anecoico, TI-RADS 1 — ACR TI-RADS 2017): PAAF não indicada.
  Misto (cisto + componente sólido, TI-RADS 3–5 — ACR TI-RADS 2017):`

- **[missing-citation]** Bosniak é citado múltiplas vezes (linhas 125, 129, 130) sem a versão ACR 2019 (v2019) exigida por R10.

  - ANTES: `CISTO RENAL SIMPLES (BOSNIAK I):`
  - DEPOIS: `CISTO RENAL SIMPLES (BOSNIAK I — ACR Bosniak v2019):`

- **[missing-citation]** O-RADS é citado (linhas 140 e 143) sem a versão ACR 2022 exigida por R10.

  - ANTES: `Simples (<5 cm, O-RADS 2): não puncionar rotineiramente; regressão espontânea.`
  - DEPOIS: `Simples (<5 cm, O-RADS 2 — ACR O-RADS US 2022): não puncionar rotineiramente; regressão espontânea.`


## procedimentos — CORE BIOPSY (`G83ufrwjCr50dLF2w1dI`)

_The core biopsy mask is generally well-structured (clear N0–N4 severity ladder, exact recommendation phraseology per tier, R6 alert logic, safety checklist) but has two concrete defects: it cites BI-RADS repeatedly to drive a clinical indication table without ever stating the required version/society (R10 mandates "BI-RADS v2025 (ACR)"), and it gives two different, unreconciled INR/platelet safety thresholds for hepatic biopsy coagulation screening in two different sections of the same file._

- **[missing-citation]** R10 exige que toda citação de sistema de classificação declare a versão/sociedade vigente (BI-RADS: v2025 ACR). O bloco cita BI-RADS 7 vezes (linhas 113-129) e usa as categorias para determinar obrigatoriedade de biópsia, mas nunca declara a versão da classificação, violando a regra de segurança em versões de classificações.

  - ANTES: `INDICAÇÃO POR CATEGORIA BI-RADS:
  BI-RADS 3: biópsia opcional (risco <2%); preferir controle em 6 meses.`
  - DEPOIS: `INDICAÇÃO POR CATEGORIA BI-RADS (ACR BI-RADS v2025):
  BI-RADS 3: biópsia opcional (risco <2%); preferir controle em 6 meses.`


## procedimentos — BIÓPSIA DE VILO CORIÔNICO (`lsPYxcH8F5xi3sswQGDY`)

_The mask is well-structured and clinically thorough (clear N0/N2/N3/N4 tiers with exact recommendation phrasing, a complete MODELO DE SAÍDA, and no misuse of R10-governed ACR classification systems). The main defect is that its "MÓDULO EXPANDIDO" and "APROFUNDAMENTO PROCEDIMENTOS" sections appear to be generic percutaneous-biopsy boilerplate pasted in without full adaptation: they repeatedly invoke an undefined alert code "R6" that contradicts the mask's own consistently-used N0-N4/ALERTA OBSTÉTRICO-HEMORRÁGICO nomenclature, and include a pneumothorax complications entry irrelevant to an obstetric chorionic villus sampling exam. There is also a stray English clause and a Portuguese misspelling._

- **[internal-contradiction]** "R6" is never defined anywhere in this mask and is inconsistent with the exam's own established alert taxonomy (N0/N2/N3/N4 and "ALERTA OBSTÉTRICO"/"ALERTA HEMORRÁGICO" used consistently at lines 17, 49, 61-63, 66-68, 71-73, 75, 140). This looks like unedited boilerplate from a different/generic template and creates an internal contradiction about which escalation label applies to sustained fetal bradycardia.

  - ANTES: `Bradicardia persistente >30 seg → ATIVAR R6 — obstetrícia urgente.`
  - DEPOIS: `Bradicardia persistente >30 seg → ALERTA OBSTÉTRICO (N4) — obstetrícia urgente.`

- **[internal-contradiction]** Same undefined "R6" reference; the mask's own N3/N4 sections (lines 47-51, 64-68) already define the correct escalation labels for maternal bleeding after BVC (N3 for moderate, N4/ALERTA HEMORRÁGICO for active/expanding hemorrhage), so this generic-module fragment should align with them instead of citing an undefined code.

  - ANTES: `Sangramento materno pós-BVC: compressão + repouso; se abundante → R6.`
  - DEPOIS: `Sangramento materno pós-BVC: compressão + repouso; se abundante → ALERTA HEMORRÁGICO (N4).`

- **[internal-contradiction]** This PR4 entry is generic image-guided percutaneous-biopsy boilerplate: pneumothorax risk from "lesões torácicas/supraclaviculares/mama profunda" is not applicable to an obstetric chorionic villus sampling procedure (transabdominal/transcervical, uterine target only) and its undefined "R6" code again conflicts with this mask's N-scale. Removing the irrelevant pneumothorax line and aligning the escalation label with the mask's own taxonomy avoids misleading the generator into producing an unrelated complication pathway for this exam.

  - ANTES: `Sangramento/hematoma: compressão, monitorização; expansivo/instável → R6.
  Pneumotórax (lesões torácicas/supraclaviculares/mama profunda): dor + dispneia →
    RX/US tórax; hipertensivo → R6 (drena`
  - DEPOIS: `Sangramento/hematoma: compressão, monitorização; expansivo/instável → ALERTA HEMORRÁGICO (N4).
  Reação vagal, infecção, lesão de estrutura nobre. Orientações de alta por escrito.`

- **[clarity]** Stray English-language fragment in an otherwise entirely Portuguese instruction block — formatting/language inconsistency versus house style.

  - ANTES: `BVC adicional acima do risco de base: ~0,5–1,0% (higher than amniocentesis).`
  - DEPOIS: `BVC adicional acima do risco de base: ~0,5–1,0% (risco superior ao da amniocentese).`

- **[factual-fix]** Misspelling of "amniocentese" (written as "aminocentese"), the standard confirmatory procedure name.

  - ANTES: `Resultado discordante BVC vs. cariótipo fetal → aminocentese de confirmação.`
  - DEPOIS: `Resultado discordante BVC vs. cariótipo fetal → amniocentese de confirmação.`


## procedimentos — AMNIOCENTESE (`633UqIfdutGURCBK1iO3`)

_The mask is well-structured, procedurally detailed, and its N0-N4 classification scheme is almost entirely self-consistent across the findings list (lines 34-82), the summary tiers (lines 88-96), and the CONCLUSÃO ordering list (lines 94-97). No R10 classification-system conflicts apply since this is a purely interventional/procedural exam with no BI-RADS/TI-RADS/O-RADS/etc. citations. The one genuine defect is a severity-tier contradiction around ruptura prematura de membranas (RPM): the only RPM finding actually defined in the mask (suspeita de RPM) is classified N3, but the N4 summary line separately cites "RPM evidente" as an N4 exemplar without ever defining that finding's description/conclusão/recomendação — leaving the model to either invent an undefined N4 RPM scenario or misapply the N3 phraseology to it._

- **[internal-contradiction]** O mascaramento define apenas um achado de RPM ("Suspeita de Ruptura Prematura de Membranas", linhas 78-81), classificado como N3 e listado corretamente como N3 na linha 95. A linha 92, porém, cita "RPM evidente" como exemplo de achado N4 sem nunca definir descrição/conclusão/recomendação para essa variante mais grave — criando uma classificação contraditória (N3 vs N4) para o mesmo tipo de achado (RPM) sem uma segunda entrada que justifique a diferença de gravidade. Remover a menção indefinida de "RPM evidente" no tier N4 elimina a contradição; caso o objetivo fosse realmente ter um tier N4 para RPM confirmada/franca perda de líquido, seria necessário adicionar uma entrada própria com descrição/conclusão/recomendação específicas, o que foge do escopo de um patch cirúrgico.

  - ANTES: `-   **Achados N4 (bradicardia sustentada, sangramento ativo, RPM evidente):** "ALERTA [CATEGORIA]: Recomenda-se encaminhamento IMEDIATO para serviço de urgência/emergência obstétrica para avaliação e`
  - DEPOIS: `-   **Achados N4 (bradicardia sustentada, sangramento ativo):** "ALERTA [CATEGORIA]: Recomenda-se encaminhamento IMEDIATO para serviço de urgência/emergência obstétrica para avaliação e intervenção, d`


## procedimentos — ESCLEROTERAPIA (`procedimentos-escleroterapia`)

_The mask is well-structured, internally consistent on dosing/volumes, and correctly separates procedure technique, complications, and the N0-N4 outcome classification. It contains one clear factual/internal-consistency defect: it cites the Bosniak classification (renal cyst system per R10) as if applicable to an adnexal/ovarian cyst finding, alongside O-RADS (the correct adnexal system), and neither citation carries its required version year. No BI-RADS/TI-RADS/LI-RADS-type conflicts with R10 were found elsewhere in the file._

- **[factual-fix]** Bosniak classifica cistos renais (R10), não cistos anexiais/ovarianos — está sendo citado junto de O-RADS como se fossem intercambiáveis para o mesmo achado (cisto anexial), o que é factualmente incorreto. O-RADS é o sistema correto para achados anexiais, mas também carecia do ano de versão exigido pela R10 (ACR 2022).

  - ANTES: `NUNCA escleroterapia sem certeza de benignidade (Bosniak / O-RADS ≤2).`
  - DEPOIS: `NUNCA escleroterapia sem certeza de benignidade (O-RADS ACR 2022 ≤2).`

- **[missing-citation]** Citação da classificação Bosniak sem o ano/versão exigido pela R10 (Bosniak ACR 2019/v2019).

  - ANTES: `Cisto renal simples Bosniak I–II sintomático:`
  - DEPOIS: `Cisto renal simples Bosniak I–II (ACR 2019) sintomático:`


## reumatologico — ARTICULAÇÕES PERIFÉRICAS (`reumatologico-articulacoes-perifericas`)

_This is a well-structured, internally consistent Camada 3 mask. It correctly uses OMERACT/EULAR-OMERACT 0-3 scoring per R10 (MSK/Reumato adjunct system, correctly kept out of the <h2>CLASSIFICAÇÃO</h2> banner and cited within ANÁLISE instead), cites ACR/EULAR 2010 with its year, and its severity tiers (sinovite, PD, erosão, derrame) are numerically consistent across the quick-reference (Section 2), the N0-N4 staging (Section 6), and the OMERACT deep-dive (RE1-RE4). The one confirmed gap is that Section 4 (DERRAME ARTICULAR) names Doppler flow within an effusion as suggestive of 'sinovite villonodular ou neoplasia' but no recommendation tier anywhere in the mask (Section 6 N-classification or Section 8 RECOMENDAÇÕES PADRÃO) addresses this distinct, higher-stakes mass-lesion differential — it is raised once and then dropped._

- **[gap-coverage]** Section 4 names Doppler flow within an effusion as suggestive of PVNS/neoplasia — a distinct, higher-stakes mass-lesion differential — but no recommendation tier in Section 6 (N0-N4) or Section 8 (RECOMENDAÇÕES PADRÃO) covers this scenario; both existing recommendation frameworks are built only around inflammatory-arthritis activity and sepsis. Adding the exact recommendation wording at the point the differential is raised closes this gap without altering the N0-N4 staging logic.

  - ANTES: `• Power Doppler no derrame: ausente (normal); fluxo = sinovite villonodular ou neoplasia.

5. DIAGNÓSTICO DIFERENCIAL — PADRÕES POR PATOLOGIA`
  - DEPOIS: `• Power Doppler no derrame: ausente (normal); fluxo = sinovite villonodular ou neoplasia.
    → Se fluxo intralesional em massa sinovial/derrame não compressível: "Achado suspeito
    para sinovite`


## reumatologico — SACROILÍACAS (`reumatologico-sacroiliacas`)

_The mask is well-structured and its cited classification systems (ASAS/EULAR 2022, OMERACT, EULAR-OMERACT 0-3) correctly follow R10's rule that MSK/Reumato adjunct systems are cited inline rather than as a dedicated CLASSIFICAÇÃO section. However, it contains two concrete internal contradictions: conflicting normal-range thresholds for the same "interlinha anterior" measurement (≤2mm vs 1–3mm), and a mandatory HTML output sentence that misstates the joint portion assessed by US (dorsal/ligamentar) in direct contradiction to the mask's own anatomy section (PORÇÃO ANTERIOR/sinovial) and to the preceding sentences of the same output paragraph._

- **[internal-contradiction]** Internal contradiction: line 25 defines the normal interlinha anterior gap as ≤2 mm, while line 33 (CRITÉRIOS DE NORMALIDADE) defines it as 1–3 mm for the same measurement. A value of 2.5 mm would be 'normal' under one rule and 'abnormal' under the other. Aligning both to the same 1–3 mm range (which is also the more detailed/qualified statement) removes the ambiguity.

  - ANTES: `(a) Interlinha anterior: gap hipoecóico normal ≤2 mm (espaço sinovial).`
  - DEPOIS: `(a) Interlinha anterior: gap hipoecóico normal 1–3 mm (espaço sinovial, variável por superfície).`

- **[internal-contradiction]** This mandatory output sentence contradicts the mask's own anatomy section (line 19: 'A US avalia a PORÇÃO ANTERIOR (sinovial) pela abordagem posterior ao paciente') and is inconsistent with the interlinha/sinóvia/cortical findings described immediately before it in the same output paragraph. Since this sentence is baked into every generated report via the mandatory HTML template, it would systematically state incorrect anatomy.

  - ANTES: `<em>A ultrassonografia avalia a porção dorsal/ligamentar das sacroilíacas; erosões e esclerose intra-articulares profundas podem exigir ressonância magnética (critérios ASAS).</em>`
  - DEPOIS: `<em>A ultrassonografia avalia a porção anterior/sinovial das sacroilíacas por via posterior; erosões e esclerose intra-articulares profundas podem exigir ressonância magnética (critérios ASAS).</em>`


## reumatologico — ESCORE PDUS-28 (`reumatologico-pdus28`)

_The mask is well-structured (activity thresholds, HTML template, OMERACT definitions, R6 sepsis trigger) and correctly avoids the <h2>CLASSIFICAÇÃO</h2> section for MSK/Reumato per R10 (OMERACT-EULAR 0-3 is an adjunct system, cited without any version conflict). However, Section 1 and Section 2 contain a self-contradictory joint count: Section 1 itemizes MCF and IFP as "2ª–5ª" (4 joints/side = 16 total), yielding 24 joints overall, yet labels this "MEMBROS SUPERIORES (20 articulações)" and "TOTAL: 28 articulações" — numbers that don't reconcile with the list beneath them. Section 2 compounds this by asserting "28 articulações × 3 = 84 pontos (MCF/IFP)" (should be 20 joints if the true 28-joint protocol is used, not 28) then adding "8 grandes articulações × 3 = 24" for a stated "TOTAL MÁXIMO CINZA: 168" that arithmetically should be 84, not 168. The HTML output template (line 196) uses "1ª–5ª" (5 joints/side, the true DAS28/PDUS-28 joint set including the thumb/1st digit) which directly conflicts with Section 1/5's "2ª–5ª" wording and the 4-row-per-side registration table — the AI would be instructed to both fill a 24-row table (Section 5) and describe a 28-joint 1ª–5ª protocol (HTML template) in the same report._

- **[internal-contradiction]** The registration table only has 4 MCF + 4 IFP rows per side (16 total), undercounting the joints needed to reach the file's own stated 28-joint total, and contradicting the HTML output template's '1ª–5ª' wording (line 196). Adding the 1st-digit MCF/IFP rows aligns the table with the true 28-joint DAS28/PDUS-28 protocol and the output template.

  - ANTES: `MCF 2ª            | D    |             |
MCF 3ª            | D    |             |
MCF 4ª            | D    |             |
MCF 5ª            | D    |             |
MCF 2ª            | E    |`
  - DEPOIS: `MCF 1ª            | D    |             |
MCF 2ª            | D    |             |
MCF 3ª            | D    |             |
MCF 4ª            | D    |             |
MCF 5ª            | D    |`
