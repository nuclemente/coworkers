import { z } from 'zod';

const sourceEnum = z.enum(['local', 'drive', 'gmail']);

export const transcriptJobCreateSchema = z
  .object({
    source: sourceEnum,
    ref: z
      .string()
      .trim()
      .min(1)
      .max(1024)
      .nullable()
      .optional(),
  })
  .refine(
    (v) => v.source === 'gmail' || (typeof v.ref === 'string' && v.ref.length > 0),
    {
      message: '`ref` é obrigatório para fontes `local` e `drive`.',
      path: ['ref'],
    },
  );

export type TranscriptJobCreateInput = z.infer<typeof transcriptJobCreateSchema>;
