import { ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";


@ValidatorConstraint({ name: 'noWhitespaceOnly', async: false })
export class NoWhitespace implements ValidatorConstraintInterface {
  validate(text: string): boolean {
    return text.trim().length > 0;
  }
}