import { z } from 'zod';

export const submitKycSchema = z.object({
  riderId: z.string().min(1),
  aadhaarNumber: z.string().regex(/^\d{4}-\d{4}-\d{4}$/, 'Invalid Aadhaar format'),
  panNumber: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Invalid PAN format'),
  bankName: z.string().min(1, 'Bank name required'),
  bankAccount: z.string().regex(/^\d{8,18}$/, 'Invalid account number'),
  bankIfsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
  aadhaarFront: z.string().optional().or(z.literal('')),
  aadhaarBack: z.string().optional().or(z.literal('')),
  panCard: z.string().optional().or(z.literal('')),
  profilePhoto: z.string().optional().or(z.literal('')),
  riderPhoto: z.string().url('Rider photo is required'),
  riderVideo: z.string().url('Rider video is required'),
  signature: z.string().optional().or(z.literal('')),
});

export const submitGuarantorSchema = z.object({
  riderId: z.string().min(1),
  name: z.string().min(2, 'Name required'),
  relation: z.string().min(2, 'Relation required'),
  phone: z.string().regex(/^\d{10}$/, 'Invalid phone'),
  dob: z
    .string()
    .regex(/^\d{2}-\d{2}-\d{4}$/, 'DOB must be dd-mm-yyyy')
    .optional(),
  fatherName: z.string().max(100).optional(),
  motherName: z.string().max(100).optional(),
  aadhaarFront: z.string().optional().or(z.literal('')),
  aadhaarBack: z.string().optional().or(z.literal('')),
  pan: z.string().optional().or(z.literal('')),
  video: z.string().url('Video is required'),
  signature: z.string().optional().or(z.literal('')),
});
