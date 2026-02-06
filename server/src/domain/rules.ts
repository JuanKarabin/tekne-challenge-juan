import type { RuleError } from '../types';

export interface PolicyRowForValidation {
  policy_type: string;
  insured_value_usd: number;
}

export abstract class BusinessRule {
  abstract readonly name: string;

  abstract validate(row: PolicyRowForValidation): RuleError[];
}

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


export class PolicyValidator {
  constructor(private readonly rules: BusinessRule[]) {}

  validate(row: PolicyRowForValidation): RuleError[] {
    const errors: RuleError[] = [];
    for (const rule of this.rules) {
      errors.push(...rule.validate(row));
    }
    return errors;
  }
}

export function createDefaultPolicyValidator(): PolicyValidator {
  return new PolicyValidator([
    new PropertyMinInsuredValueRule(),
    new AutoMinInsuredValueRule(),
  ]);
}
