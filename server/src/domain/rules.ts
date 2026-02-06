/**
 * Motor de reglas de negocio (OOP) — Challenge Tekne.
 * Clase base abstracta + reglas concretas + PolicyValidator (polimorfismo).
 */

import type { RuleError } from '../types';

/** Contrato mínimo que debe cumplir una fila para ser evaluada por las reglas. */
export interface PolicyRowForValidation {
  policy_type: string;
  insured_value_usd: number;
}

/**
 * Clase base abstracta para reglas de negocio.
 * Cada regla concreta implementa validate() y devuelve errores si no se cumple.
 */
export abstract class BusinessRule {
  abstract readonly name: string;

  /**
   * Evalúa la fila y devuelve un array de errores (vacío si la regla pasa).
   */
  abstract validate(row: PolicyRowForValidation): RuleError[];
}

/**
 * Regla: Si policy_type = Property ⇒ insured_value_usd >= 5000.
 * Code: PROPERTY_VALUE_TOO_LOW
 */
export class PropertyMinInsuredValueRule extends BusinessRule {
  readonly name = 'PropertyMinInsuredValueRule';

  private static readonly MIN_INSURED_VALUE_USD = 5000;
  private static readonly CODE = 'PROPERTY_VALUE_TOO_LOW' as const;
  private static readonly FIELD = 'insured_value_usd' as const;

  validate(row: PolicyRowForValidation): RuleError[] {
    if (row.policy_type !== 'Property') return [];

    const value = Number(row.insured_value_usd);
    if (value >= PropertyMinInsuredValueRule.MIN_INSURED_VALUE_USD) return [];

    return [
      {
        code: PropertyMinInsuredValueRule.CODE,
        field: PropertyMinInsuredValueRule.FIELD,
        message: `Property policies require insured_value_usd >= ${PropertyMinInsuredValueRule.MIN_INSURED_VALUE_USD}. Got ${value}.`,
      },
    ];
  }
}

/**
 * Regla: Si policy_type = Auto ⇒ insured_value_usd >= 10000.
 * Code: AUTO_VALUE_TOO_LOW
 */
export class AutoMinInsuredValueRule extends BusinessRule {
  readonly name = 'AutoMinInsuredValueRule';

  private static readonly MIN_INSURED_VALUE_USD = 10000;
  private static readonly CODE = 'AUTO_VALUE_TOO_LOW' as const;
  private static readonly FIELD = 'insured_value_usd' as const;

  validate(row: PolicyRowForValidation): RuleError[] {
    if (row.policy_type !== 'Auto') return [];

    const value = Number(row.insured_value_usd);
    if (value >= AutoMinInsuredValueRule.MIN_INSURED_VALUE_USD) return [];

    return [
      {
        code: AutoMinInsuredValueRule.CODE,
        field: AutoMinInsuredValueRule.FIELD,
        message: `Auto policies require insured_value_usd >= ${AutoMinInsuredValueRule.MIN_INSURED_VALUE_USD}. Got ${value}.`,
      },
    ];
  }
}

/**
 * Validador que aplica un conjunto de reglas sin conocer sus detalles (polimorfismo).
 * Recibe un array de reglas e implementa validate(row) agregando todos los errores.
 */
export class PolicyValidator {
  constructor(private readonly rules: BusinessRule[]) {}

  /**
   * Ejecuta todas las reglas sobre la fila y devuelve la lista agregada de errores.
   */
  validate(row: PolicyRowForValidation): RuleError[] {
    const errors: RuleError[] = [];
    for (const rule of this.rules) {
      errors.push(...rule.validate(row));
    }
    return errors;
  }
}

/** Factory: crea un PolicyValidator con las reglas obligatorias del challenge. */
export function createDefaultPolicyValidator(): PolicyValidator {
  return new PolicyValidator([
    new PropertyMinInsuredValueRule(),
    new AutoMinInsuredValueRule(),
  ]);
}
