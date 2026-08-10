export interface EmailTemplate {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  /** Documentation-only — the placeholder names this template expects in `variables`. Not
   * enforced at render time (a missing variable just renders empty, see renderTemplate). */
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailTemplateSeed = Omit<EmailTemplate, 'isActive' | 'createdAt' | 'updatedAt'>;
