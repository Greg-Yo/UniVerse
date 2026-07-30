import { Matches, MinLength, ValidationOptions, registerDecorator } from 'class-validator';

/** Mot de passe : min 12, majuscule, minuscule, chiffre, caractere special. */
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export const PASSWORD_MESSAGE =
  'Mot de passe trop faible (min. 12 caracteres, majuscule, minuscule, chiffre, symbole)';

export function IsStrongUniversePassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongUniversePassword',
      target: object.constructor,
      propertyName,
      options: {
        message: PASSWORD_MESSAGE,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && PASSWORD_REGEX.test(value);
        },
      },
    });
  };
}

/** Raccourci class-validator natif (utile dans les DTOs Swagger). */
export function StrongPasswordMatchers() {
  return [MinLength(12), Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })];
}
