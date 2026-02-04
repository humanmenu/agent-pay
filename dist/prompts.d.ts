export declare function prompt(question: string, defaultValue?: string): Promise<string>;
export declare function promptHidden(question: string): Promise<string>;
export declare function promptYesNo(question: string, defaultNo?: boolean): Promise<boolean>;
export declare function promptSelect(question: string, options: string[], defaultIndex?: number): Promise<number>;
