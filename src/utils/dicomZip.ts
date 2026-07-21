import { unzip } from 'fflate';

export interface DicomZipExtractionResult {
  /** Arquivos DICOM encontrados dentro do ZIP, prontos pra fila de upload. */
  files: File[];
  /** Entradas puladas por não serem DICOM (relatório pro usuário). */
  ignored: string[];
}

/** Detecta se o arquivo selecionado é um ZIP (por extensão ou MIME). */
export function isZipFile(file: File): boolean {
  return (
    /\.zip$/i.test(file.name) ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  );
}

/**
 * Um arquivo DICOM Part 10 tem preâmbulo de 128 bytes seguido de "DICM".
 * Alguns exports antigos vêm sem preâmbulo — nesses, aceitamos pela
 * extensão .dcm. Coisas óbvias de não-imagem (jpg, pdf, txt, DICOMDIR)
 * ficam de fora: o Orthanc rejeitaria uma a uma com erro confuso.
 */
function looksLikeDicom(data: Uint8Array, entryName: string): boolean {
  const base = entryName.split('/').pop() || entryName;
  // DICOMDIR tem magic DICM mas é índice de mídia, não instância — Orthanc recusa.
  if (base.toUpperCase() === 'DICOMDIR') return false;
  if (data.length > 132 && data[128] === 0x44 && data[129] === 0x49 && data[130] === 0x43 && data[131] === 0x4d) {
    return true;
  }
  return /\.dcm$/i.test(base);
}

/** Lixo comum em ZIPs (metadados do macOS, arquivos ocultos, pastas). */
function isJunkEntry(entryName: string): boolean {
  if (entryName.endsWith('/')) return true;
  if (entryName.includes('__MACOSX')) return true;
  const base = entryName.split('/').pop() || entryName;
  return base.startsWith('.');
}

/**
 * Descompacta um ZIP no navegador e devolve só os arquivos DICOM de dentro,
 * como objetos File — assim eles entram na mesma fila de upload dos .dcm
 * selecionados soltos (com progresso e retry por arquivo). O nome preserva
 * o caminho interno do ZIP pra distinguir séries em subpastas.
 */
export async function extractDicomFilesFromZip(zipFile: File): Promise<DicomZipExtractionResult> {
  const buffer = new Uint8Array(await zipFile.arrayBuffer());
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(buffer, { filter: (f) => !isJunkEntry(f.name) }, (err, data) => {
      if (err) reject(new Error(`ZIP inválido ou corrompido (${zipFile.name}): ${err.message}`));
      else resolve(data);
    });
  });

  const files: File[] = [];
  const ignored: string[] = [];
  for (const [name, data] of Object.entries(entries)) {
    if (looksLikeDicom(data, name)) {
      files.push(new File([data.slice().buffer as ArrayBuffer], name, { type: 'application/dicom' }));
    } else {
      ignored.push(name);
    }
  }
  return { files, ignored };
}
