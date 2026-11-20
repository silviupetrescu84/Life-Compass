export const PASSWORD_REQUIREMENTS =
  'Use 8–128 characters, including at least one uppercase letter and one special character.';

export function isValidSignupPassword(password: string): boolean {
  return (
    password.length <= 128 && [...password].length >= 8 && /\p{Lu}/u.test(password) && /[\p{P}\p{S}]/u.test(password)
  );
}
