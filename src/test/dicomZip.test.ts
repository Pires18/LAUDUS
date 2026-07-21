import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { extractDicomFilesFromZip, isZipFile } from '../utils/dicomZip';

/** Monta um payload DICOM Part 10 mínimo: 128 bytes de preâmbulo + "DICM". */
function fakeDicomBytes(extra = 16): Uint8Array {
  const data = new Uint8Array(132 + extra);
  data.set([0x44, 0x49, 0x43, 0x4d], 128); // "DICM"
  return data;
}

function makeZipFile(entries: Record<string, Uint8Array>, name = 'estudo.zip'): File {
  const zipped = zipSync(entries);
  return new File([zipped.slice().buffer as ArrayBuffer], name, { type: 'application/zip' });
}

describe('isZipFile', () => {
  it('detecta por extensão e por MIME', () => {
    expect(isZipFile(new File([], 'estudo.zip', { type: '' }))).toBe(true);
    expect(isZipFile(new File([], 'ESTUDO.ZIP', { type: '' }))).toBe(true);
    expect(isZipFile(new File([], 'sem-extensao', { type: 'application/zip' }))).toBe(true);
    expect(isZipFile(new File([], 'sem-extensao', { type: 'application/x-zip-compressed' }))).toBe(true);
    expect(isZipFile(new File([], 'imagem.dcm', { type: 'application/dicom' }))).toBe(false);
  });
});

describe('extractDicomFilesFromZip', () => {
  it('extrai DICOMs com magic DICM mesmo sem extensão .dcm', async () => {
    const zip = makeZipFile({
      'SERIE1/IM000001': fakeDicomBytes(),
      'SERIE1/IM000002': fakeDicomBytes(),
    });
    const { files, ignored } = await extractDicomFilesFromZip(zip);
    expect(files.map((f) => f.name).sort()).toEqual(['SERIE1/IM000001', 'SERIE1/IM000002']);
    expect(files.every((f) => f.type === 'application/dicom')).toBe(true);
    expect(ignored).toEqual([]);
  });

  it('aceita .dcm sem preâmbulo DICM (exports antigos)', async () => {
    const zip = makeZipFile({ 'img.dcm': new Uint8Array([1, 2, 3]) });
    const { files } = await extractDicomFilesFromZip(zip);
    expect(files.map((f) => f.name)).toEqual(['img.dcm']);
  });

  it('ignora não-DICOM, DICOMDIR e lixo do macOS', async () => {
    const zip = makeZipFile({
      'estudo/IM000001': fakeDicomBytes(),
      'estudo/DICOMDIR': fakeDicomBytes(), // magic DICM, mas é índice de mídia — Orthanc recusa
      'estudo/relatorio.pdf': new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      'estudo/.DS_Store': new Uint8Array([0]),
      '__MACOSX/estudo/._IM000001': new Uint8Array([0]),
    });
    const { files, ignored } = await extractDicomFilesFromZip(zip);
    expect(files.map((f) => f.name)).toEqual(['estudo/IM000001']);
    // .DS_Store e __MACOSX são filtrados antes de descompactar (nem entram no relatório)
    expect(ignored.sort()).toEqual(['estudo/DICOMDIR', 'estudo/relatorio.pdf']);
  });

  it('preserva o conteúdo dos bytes extraídos', async () => {
    const original = fakeDicomBytes(64);
    original[140] = 0xab;
    const zip = makeZipFile({ 'a.dcm': original });
    const { files } = await extractDicomFilesFromZip(zip);
    const roundTrip = new Uint8Array(await files[0].arrayBuffer());
    expect(roundTrip).toEqual(original);
  });

  it('rejeita ZIP corrompido com mensagem amigável', async () => {
    const broken = new File([new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer], 'quebrado.zip', { type: 'application/zip' });
    await expect(extractDicomFilesFromZip(broken)).rejects.toThrow(/quebrado\.zip/);
  });
});
