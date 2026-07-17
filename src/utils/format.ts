/**
 * Formata data para o formato brasileiro (dd/mm/aaaa).
 */
export function formatDate(date: number | string | Date | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '';
  
  let d: Date;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Caso YYYY-MM-DD (comum em inputs de data)
    const [year, month, day] = date.split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', options);
}

/**
 * Formata data e hora para o formato brasileiro (dd/mm/aaaa hh:mm).
 */
export function formatDateTime(date: number | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Formata apenas a hora (hh:mm) no fuso local.
 */
export function formatTime(date: number | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Converte timestamp (ms) para o formato YYYY-MM-DD de <input type="date">,
 * usando o fuso local (toISOString deslocaria o dia em fusos negativos).
 */
export function toDateInputValue(timestamp: number | undefined): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Converte o valor YYYY-MM-DD de <input type="date"> para timestamp (ms).
 * O horário do dia vem de `timeSource` (normalmente o createdAt do exame),
 * para que editar a data nunca zere o horário para 00:00; sem `timeSource`
 * válido, usa o horário atual.
 */
export function parseDateInputValue(value: string, timeSource?: number): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const time = timeSource && !isNaN(new Date(timeSource).getTime()) ? new Date(timeSource) : new Date();
  const ts = new Date(year, month - 1, day, time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds()).getTime();
  return isNaN(ts) ? null : ts;
}

/**
 * Calcula a idade a partir da data de nascimento. Abaixo de 1 ano mostra em
 * meses (nunca "0 anos" — importante em pediatria: usada também em laudos
 * impressos/PDF/docx e no prompt enviado à IA, ver ai/engine.ts).
 */
export function calculateAge(birthDate: string | undefined, referenceDate?: number | string | Date): string {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return '';
  const today = referenceDate ? new Date(referenceDate) : new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    years--;
  }
  if (years === 0) {
    const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
    const finalMonths = months <= 0 ? 1 : months;
    return `${finalMonths} ${finalMonths === 1 ? 'mês' : 'meses'}`;
  }
  return `${years} ${years === 1 ? 'ano' : 'anos'}`;
}

/**
 * Junta classes CSS condicionais (filtra falsy).
 */
export function classNames(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Faz parse de um valor numérico de formulário (preço, cota, custo) nunca
 * permitindo negativo — `parseFloat(v) || 0` sozinho deixa passar negativos
 * (só cai no fallback para NaN/0/vazio, `-149` é truthy). Usado em todo
 * campo monetário/de cota do Admin.
 */
export function parseNonNegativeNumber(value: string, fallback = 0): number {
  const n = parseFloat(value);
  if (isNaN(n)) return fallback;
  return Math.max(0, n);
}

/** Mesma proteção de `parseNonNegativeNumber`, para campos inteiros (dias, tokens, unidades). */
export function parseNonNegativeInt(value: string, fallback = 0): number {
  const n = parseInt(value, 10);
  if (isNaN(n)) return fallback;
  return Math.max(0, n);
}

/**
 * Formata CPF: 000.000.000-00
 */
export function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Formata telefone: (00) 00000-0000 ou (00) 0000-0000
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Formata CNPJ: 00.000.000/0000-00
 */
export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}
