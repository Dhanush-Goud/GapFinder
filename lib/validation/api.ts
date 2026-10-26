// Zod schemas for API inputs.
import { z } from "zod";

export const difficultySchema = z.enum(["easy", "medium", "hard", "mixed"]);

export const startQuizSchema = z.object({
  topicIds: z.array(z.string().min(1)).min(1).max(10),
  count: z.number().int().min(3).max(15),
  difficulty: difficultySchema,
  includeShortAnswer: z.boolean().default(true),
});

export const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedOption: z.number().int().min(0).max(9).nullable().optional(),
  text: z.string().max(2000).nullable().optional(),
});

export const submitQuizSchema = z.object({
  answers: z.array(answerSchema).max(30),
});

export const demoStartQuizSchema = startQuizSchema.extend({
  history: z
    .array(z.object({ questionId: z.string(), isCorrect: z.boolean(), at: z.string() }))
    .max(2000)
    .default([]),
});

export const demoSubmitSchema = z.object({
  questionIds: z.array(z.string().min(1)).min(1).max(15),
  answers: z.array(answerSchema).max(30),
});

export const settingsSchema = z.object({
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hoursPerDay: z.number().min(0.25).max(12),
  preferredSlot: z.enum(["morning", "afternoon", "evening"]),
});

export const planRequestSchema = z.object({
  settings: settingsSchema,
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const taskUpdateSchema = z.object({ completed: z.boolean() });

export const tutorSchema = z.object({
  question: z.string().trim().min(3).max(1000),
  topicId: z.string().nullable().optional(),
});

export const documentKindSchema = z.enum(["syllabus", "notes", "textbook", "question_paper"]);
