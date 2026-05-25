import sys
import json
import os
import pydicom
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.sequence import Sequence

def main():
    try:
        # Ler dados do JSON fornecido via stdin
        data = json.load(sys.stdin)
        
        exam_id = data.get('examId')
        patient_name = data.get('patientName', 'PACIENTE^TESTE')
        patient_id = data.get('patientId', '000000')
        patient_birth_date = data.get('patientBirthDate', '') # Formato: AAAAMMDD
        patient_sex = data.get('patientSex', 'F') # F, M, O
        modality = data.get('modality', 'US')
        ae_title = data.get('aeTitle', 'MINDRAYMX7')
        step_date = data.get('stepDate', '') # Formato: AAAAMMDD
        step_time = data.get('stepTime', '') # Formato: HHMMSS
        step_desc = data.get('stepDescription', 'US OBSTETRICA')

        if not exam_id:
            raise ValueError("O campo 'examId' e obrigatorio.")

        # Garantir a pasta de destino configurada (com fallback para o Mac Mini M2)
        output_dir = data.get('outputDir', '')
        if not output_dir:
            output_dir = '/Users/matheuskistenmackerpires/Documents/OrthancServer/db/WorklistsDatabase/'
            
        os.makedirs(output_dir, exist_ok=True)
        
        caminho_destino = os.path.join(output_dir, f'agendamento_{exam_id}.wl')

        # 1. Configuracao Obrigatoria dos Metadados do Arquivo (Garante os 128 bytes de preambulo)
        file_meta = FileMetaDataset()
        file_meta.TransferSyntaxUID = pydicom.uid.ImplicitVRLittleEndian
        file_meta.MediaStorageSOPClassUID = '1.2.840.10008.5.1.4.31'  # Modality Worklist Info Model - FIND
        file_meta.MediaStorageSOPInstanceUID = '1.2.276.0.7230010.3.1.4.234324.' + str(exam_id)

        ds = Dataset()
        ds.file_meta = file_meta
        ds.is_little_endian = True
        ds.is_implicit_VR = True

        # 2. Dados Demograficos da Paciente (Sobrenome^Nome^NomeMeio em maiusculas)
        ds.PatientName = patient_name
        ds.PatientID = patient_id
        if patient_birth_date:
            ds.PatientBirthDate = patient_birth_date
        ds.PatientSex = patient_sex
        ds.StudyInstanceUID = '1.2.276.0.7230010.3.1.2.' + str(exam_id)
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
