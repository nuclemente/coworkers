import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato YYYY-MM-DD.');

const sourceEnum = z.enum([
  'manual_slack',
  'manual_cli',
  'one_on_one',
  'transcript',
]);

export const cardCreateSchema = z.object({
  title: z.string().trim().min(1, 'Título obrigatório.').max(280),
  column_slug: z.string().trim().min(1).optional(),
  description: z.string().max(4000).nullable().optional(),
  labels: z.array(z.string().trim().min(1).max(40)).max(20).nullable().optional(),
  due_date: isoDate.nullable().optional(),
  linked_person: z.string().trim().min(1).max(80).nullable().optional(),
  context: z.string().max(2000).nullable().optional(),
  source: sourceEnum.optional(),
});

export const cardUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(280).optional(),
    description: z.string().max(4000).nullable().optional(),
    labels: z.array(z.string().trim().min(1).max(40)).max(20).nullable().optional(),
    due_date: isoDate.nullable().optional(),
    linked_person: z.string().trim().min(1).max(80).nullable().optional(),
    context: z.string().max(2000).nullable().optional(),
    column_slug: z.string().trim().min(1).optional(),
    position: z.number().int().nonnegative().optional(),
    completed: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Pelo menos um campo deve ser informado.',
  });

export type CardCreateInput = z.infer<typeof cardCreateSchema>;
export type CardUpdateInput = z.infer<typeof cardUpdateSchema>;
