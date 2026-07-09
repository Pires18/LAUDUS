import sys
import json
import os
try:
    import pydicom
    from pydicom.dataset import Dataset, FileMetaDataset
    from pydicom.sequence import Sequence
except ImportError:
    print(json.dumps({
        "success": False, 
        "error": "A biblioteca 'pydicom' nao esta instalada. Execute 'pip install pydicom' no terminal do Windows."
    }), file=sys.stderr)
    sys.exit(1)

def get_numeric_uid_from_firestore_id(id_str):
    chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    value = 0
    for char in id_str:
        index = chars.find(char)
        if index == -1:
            value = value * 62 + (ord(char) % 62)
        else:
            value = value * 62 + index
    return str(value)

def main():
    try:
        # Ler dados do JSON fornecido via stdin
        data = json.load(sys.stdin)

        # ── Health-check (ping) ──────────────────────────────────────────────
        # Quando chamado com {"ping": true}, verifica a cadeia completa SEM gerar
        # nenhum arquivo .wl: pydicom disponível (já importado no topo), pasta
        # de destino existente e gravável. Usado pelo Diagnóstico de Rede na UI.
        if data.get('ping'):
            output_dir = data.get('outputDir', '')
            if not output_dir:
                import platform
                output_dir = ('C:/OrthancServer/db/WorklistsDatabase/'
                              if platform.system() == 'Windows'
                              else os.path.expanduser('~/OrthancServer/db/WorklistsDatabase/'))
            writable = False
            dir_error = ''
            try:
                os.makedirs(output_dir, exist_ok=True)
                writable = os.access(output_dir, os.W_OK)
            except Exception as e:
                dir_error = str(e)
            print(json.dumps({
                "success": bool(writable),
                "ping": True,
                "pydicom": getattr(pydicom, "__version__", "ok"),
                "dir": output_dir,
                "writable": writable,
                "error": '' if writable else (dir_error or f'Sem permissão de escrita em {output_dir}')
            }))
            return

        exam_id = data.get('examId')
        patient_name = data.get('patientName', 'PACIENTE^TESTE')
        patient_id = data.get('patientId', '000000')
        patient_birth_date = data.get('patientBirthDate', '') # Formato: AAAAMMDD
        patient_sex = data.get('patientSex', 'F') # F, M, O
        modality = data.get('modality', 'US')
        # Sem default silencioso aqui de propósito: esse valor vira o
        # ScheduledStationAETitle do .wl, o que identifica QUAL aparelho deve
        # atender aquele item da worklist. Um default hardcoded (era
        # 'MINDRAYMX7') mascarava silenciosamente qualquer chamador que
        # esquecesse de mandar o AE Title do aparelho selecionado — o exame
        # ainda "funcionava" (arquivo .wl gerado sem erro), só que pro
        # aparelho errado. Ver docs/pacs/PACS_CENTRAL_MESTRE.md secao 6.
        ae_title = data.get('aeTitle')
        step_date = data.get('stepDate', '') # Formato: AAAAMMDD
        step_time = data.get('stepTime', '') # Formato: HHMMSS
        step_desc = data.get('stepDescription', 'US OBSTETRICA')

        if not exam_id:
            raise ValueError("O campo 'examId' e obrigatorio.")
        if not ae_title:
            raise ValueError("O campo 'aeTitle' e obrigatorio (AE Title do aparelho selecionado).")

        numeric_id = get_numeric_uid_from_firestore_id(exam_id)

        # Garantir a pasta de destino configurada (com fallback dependendo do SO)
        output_dir = data.get('outputDir', '')
        if not output_dir:
            import platform
            if platform.system() == 'Windows':
                output_dir = 'C:/OrthancServer/db/WorklistsDatabase/'
            else:
                output_dir = os.path.expanduser('~/OrthancServer/db/WorklistsDatabase/')
            
        os.makedirs(output_dir, exist_ok=True)
        
        caminho_destino = os.path.join(output_dir, f'agendamento_{exam_id}.wl')

        # 1. Configuracao Obrigatoria dos Metadados do Arquivo (Garante os 128 bytes de preambulo)
        file_meta = FileMetaDataset()
        file_meta.TransferSyntaxUID = pydicom.uid.ImplicitVRLittleEndian
        file_meta.MediaStorageSOPClassUID = '1.2.840.10008.5.1.4.31'  # Modality Worklist Info Model - FIND
        file_meta.MediaStorageSOPInstanceUID = '1.2.276.0.7230010.3.1.4.234324.' + numeric_id

        ds = Dataset()
        ds.file_meta = file_meta
        # 2. Dados Demograficos da Paciente (Sobrenome^Nome^NomeMeio em maiusculas)
        ds.PatientName = patient_name
        ds.PatientID = patient_id
        if patient_birth_date:
            ds.PatientBirthDate = patient_birth_date
        ds.PatientSex = patient_sex
        ds.StudyInstanceUID = '1.2.276.0.7230010.3.1.2.' + numeric_id
        ds.AccessionNumber = str(exam_id)
        ds.StudyDescription = step_desc
        ds.RequestedProcedureDescription = step_desc
        ds.RequestedProcedureID = 'RP-' + str(exam_id)

        # 3. Sequencia de Agendamento da Modalidade (Scheduled Procedure Step Sequence)
        sps_dataset = Dataset()
        sps_dataset.Modality = modality
        sps_dataset.ScheduledStationAETitle = ae_title
        if step_date:
            sps_dataset.ScheduledProcedureStepStartDate = step_date
        if step_time:
            sps_dataset.ScheduledProcedureStepStartTime = step_time
        sps_dataset.ScheduledProcedureStepID = 'SPS-' + str(exam_id)
        sps_dataset.ScheduledProcedureStepDescription = step_desc

        ds.ScheduledProcedureStepSequence = Sequence([sps_dataset])

        # 4. Gravacao Direta
        # O argumento write_like_original=False e CRUCIAL para forcar a criacao correta do cabecalho de compatibilidade
        ds.save_as(caminho_destino, write_like_original=False)
        
        print(json.dumps({"success": True, "path": caminho_destino}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
