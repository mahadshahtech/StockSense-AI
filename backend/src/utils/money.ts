/** Money stored as integer paisa (1 PKR = 100 paisa). Never use floats for money. */

export function pkrToPaisa(pkr: number): number {
  return Math.round(pkr * 100);
}

export function paisaToPkr(paisa: number): number {
  return paisa / 100;
}

export function formatPkr(paisa: number): string {
  const pkr = paisaToPkr(paisa);
  return `PKR ${pkr.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function serializeMoney(paisa: number | null | undefined): number | null {
  if (paisa == null) return null;
  return paisaToPkr(paisa);
}
