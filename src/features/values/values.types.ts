export interface Value {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
}

export interface ValueCategory {
  readonly name: string;
  readonly values: readonly Value[];
}
