-- ============================================================================
-- backup-forward.lua — Store-and-forward do PACS de BACKUP (clínica) → VM
-- ============================================================================
-- Este script roda dentro do Orthanc de BACKUP (na clínica). Sempre que um
-- estudo termina de chegar (fica "estável"), ele é ENVIADO para a modality
-- CLOUD — que aponta para o Orthanc da VM (principal) via DICOM 4242 na
-- tailnet Tailscale. Se o envio for ACEITO, a cópia local é APAGADA: a VM
-- passa a ser a única dona do exame. Se a VM estiver inacessível (internet
-- caiu, VM desligada), o estudo é MANTIDO no backup e o sweep periódico
-- (backup-forward-sweep.sh, via cron) tenta de novo mais tarde.
--
-- Resultado: o backup local funciona como um "buffer" temporário. Em operação
-- normal ele fica praticamente VAZIO (tudo é empurrado para a VM na hora). Só
-- acumula exames enquanto a VM estiver fora do ar, e se auto-limpa quando ela
-- volta.
--
-- Pré-requisito: no orthanc.json do BACKUP, defina a modality CLOUD:
--   "DicomModalities": { "CLOUD": [ "ORTHANC", "100.x.y.z", 4242 ] }
-- onde 100.x.y.z é o IP tailnet da VM. E carregue este script em "LuaScripts".
-- ============================================================================

local CLOUD_MODALITY = 'CLOUD'

-- Envia um estudo à VM (síncrono) e, se aceito, apaga localmente.
-- Retorna true em sucesso; false se a VM não aceitou/estava inacessível.
function ForwardStudyToCloud(studyId)
  local payload = DumpJson({ Resources = { studyId }, Synchronous = true })

  -- RestApiPost lança erro se o C-STORE falhar (peer offline, recusa, etc.).
  -- pcall captura isso para NÃO apagar o estudo quando o envio não deu certo.
  local ok = pcall(function()
    RestApiPost('/modalities/' .. CLOUD_MODALITY .. '/store', payload)
  end)

  if ok then
    RestApiDelete('/studies/' .. studyId)
    print('[backup-forward] Estudo ' .. studyId ..
          ' enviado a VM e removido do backup local.')
    return true
  else
    print('[backup-forward] VM inacessivel — mantendo estudo ' .. studyId ..
          ' no backup para reenvio posterior.')
    return false
  end
end

-- Disparado quando um estudo fica estável (terminou de receber imagens).
function OnStableStudy(studyId, tags, metadata)
  ForwardStudyToCloud(studyId)
end
