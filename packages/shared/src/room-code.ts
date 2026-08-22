/** Unambiguous uppercase alphabet: no 0/O/1/I/L (spec §5). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;

export function makeRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function isValidRoomCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-HJ-KMNP-Z2-9]{4}$/.test(value);
}
