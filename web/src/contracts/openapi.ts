/**
 * OpenAPI Specification Generator
 *
 * Generates a comprehensive OpenAPI 3.0 spec from contract types and Zod schemas.
 * Run with: npx tsx src/contracts/openapi.ts
 *
 * Output: src/contracts/openapi.json
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as validators from '../lib/validators';

interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: { url: string; description: string }[];
  paths: Record<string, Record<string, any>>;
  components: { schemas: Record<string, any>; securitySchemes: Record<string, any> };
  tags: { name: string; description: string }[];
}

function buildSpec(): OpenApiSpec {
  const spec: OpenApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'Voltium Fleet API',
      version: '1.0.0',
      description: 'REST API for the Voltium electric vehicle rental and fleet management platform.\n\n## Authentication\n\nSession-based JWT authentication. Tokens are set as httpOnly cookies on login and automatically sent with every request.\n\n## Money Safety\n\nAll wallet mutations go through a double-entry ledger system with idempotency keys. Deposit approvals are idempotent — double-clicking will not double-credit.\n\n## State Machines\n\nAll entity statuses are controlled by state machines defined in `docs/STATE_MACHINES.md`. Invalid transitions are rejected at the application layer.',
    },
    servers: [
      { url: 'http://localhost:8081', description: 'Local development' },
      { url: 'https://api.voltium.app', description: 'Production' },
    ],
    tags: [
      { name: 'Auth', description: 'OTP-based authentication and session management' },
      { name: 'Rider Profile', description: 'Rider profile management and onboarding' },
      { name: 'KYC', description: 'Know Your Customer document verification' },
      { name: 'Guarantor', description: 'Guarantor submission and verification' },
      { name: 'Wallet', description: 'Wallet balance, top-up, and ledger' },
      { name: 'Deposits', description: 'Security deposit lifecycle management' },
      { name: 'Rentals', description: 'Rental plans, booking, pickup, and return' },
      { name: 'Vehicles', description: 'Vehicle inventory and assignment' },
      { name: 'Hubs', description: 'Hub management for vehicle pickup/return' },
      { name: 'Support', description: 'Support tickets, FAQ, and chat' },
      { name: 'Notifications', description: 'Push notifications and announcements' },
      { name: 'Admin', description: 'Admin operations, RBAC, and approval workflows' },
      { name: 'Files', description: 'Secure file upload, signed URLs, and ownership checks' },
      { name: 'Health', description: 'API health and monitoring endpoints' },
    ],
    paths: {
      // ── Auth ──────────────────────────────────────────────────────────────
      '/api/auth/send-otp': {
        post: {
          tags: ['Auth'],
          summary: 'Send OTP to phone number',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SendOtpRequest' } } },
          },
          responses: {
            '200': { description: 'OTP sent successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/SendOtpResponse' } } } },
            '429': { description: 'Rate limited — too many requests' },
          },
        },
      },
      '/api/auth/verify-otp': {
        post: {
          tags: ['Auth'],
          summary: 'Verify OTP and establish session',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyOtpRequest' } } },
          },
          responses: {
            '200': { description: 'OTP verified, session cookie set', content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyOtpResponse' } } } },
            '401': { description: 'Invalid OTP' },
          },
        },
      },
      // ── Rider Profile ─────────────────────────────────────────────────────
      '/api/rider/profile': {
        get: {
          tags: ['Rider Profile'],
          summary: 'Get rider profile with all related data',
          security: [{ riderSession: [] }],
          responses: {
            '200': { description: 'Rider profile data', content: { 'application/json': { schema: { $ref: '#/components/schemas/RiderProfileResponse' } } } },
          },
        },
        put: {
          tags: ['Rider Profile'],
          summary: 'Update rider profile fields',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateProfileRequest' } } },
          },
          responses: {
            '200': { description: 'Profile updated' },
          },
        },
      },
      '/api/rider/kyc': {
        get: {
          tags: ['KYC'],
          summary: 'Get KYC submission status',
          security: [{ riderSession: [] }],
          responses: {
            '200': { description: 'KYC status', content: { 'application/json': { schema: { $ref: '#/components/schemas/KycStatusResponse' } } } },
          },
        },
        post: {
          tags: ['KYC'],
          summary: 'Submit KYC documents',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SubmitKycRequest' } } },
          },
          responses: {
            '200': { description: 'KYC submitted', content: { 'application/json': { schema: { $ref: '#/components/schemas/SubmitKycResponse' } } } },
            '409': { description: 'Invalid KYC state transition' },
          },
        },
      },
      '/api/rider/guarantor': {
        get: {
          tags: ['Guarantor'],
          summary: 'Get guarantor status',
          security: [{ riderSession: [] }],
          responses: {
            '200': { description: 'Guarantor status' },
          },
        },
        post: {
          tags: ['Guarantor'],
          summary: 'Submit guarantor details',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { properties: { name: { type: 'string' }, relation: { type: 'string' }, phone: { type: 'string' } } } } },
          },
          responses: {
            '200': { description: 'Guarantor submitted' },
            '409': { description: 'Invalid guarantor state transition' },
          },
        },
      },
      // ── Wallet ────────────────────────────────────────────────────────────
      '/api/transaction/topup': {
        post: {
          tags: ['Wallet'],
          summary: 'Submit a top-up or security deposit payment',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TopupRequest' } } },
          },
          responses: {
            '200': { description: 'Payment submitted', content: { 'application/json': { schema: { $ref: '#/components/schemas/TopupResponse' } } } },
          },
        },
      },
      '/api/transaction/history': {
        get: {
          tags: ['Wallet'],
          summary: 'Get transaction history',
          security: [{ riderSession: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: {
            '200': { description: 'Transaction list' },
          },
        },
      },
      // ── Rentals ───────────────────────────────────────────────────────────
      '/api/rental/book': {
        post: {
          tags: ['Rentals'],
          summary: 'Book a vehicle rental',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/BookRentalRequest' } } },
          },
          responses: {
            '200': { description: 'Rental booked', content: { 'application/json': { schema: { $ref: '#/components/schemas/BookRentalResponse' } } } },
          },
        },
      },
      // ── Support ───────────────────────────────────────────────────────────
      '/api/support/tickets': {
        get: {
          tags: ['Support'],
          summary: 'List rider support tickets',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'Ticket list' } },
        },
        post: {
          tags: ['Support'],
          summary: 'Create a support ticket',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTicketRequest' } } },
          },
          responses: { '200': { description: 'Ticket created', content: { 'application/json': { schema: { $ref: '#/components/schemas/TicketResponse' } } } } },
        },
      },
      // ── Files ─────────────────────────────────────────────────────────────
      '/api/files/request-upload': {
        post: {
          tags: ['Files'],
          summary: 'Request a signed upload URL for a file',
          security: [{ riderSession: [] }, { adminSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RequestUploadUrlRequest' } } },
          },
          responses: {
            '200': { description: 'Upload URL generated', content: { 'application/json': { schema: { $ref: '#/components/schemas/RequestUploadUrlResponse' } } } },
            '400': { description: 'Invalid file type or size' },
          },
        },
      },
      '/api/files/confirm-upload': {
        post: {
          tags: ['Files'],
          summary: 'Confirm a file upload was completed',
          security: [{ riderSession: [] }, { adminSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ConfirmUploadRequest' } } },
          },
          responses: { '200': { description: 'Upload confirmed' } },
        },
      },
      '/api/files/{path}': {
        get: {
          tags: ['Files'],
          summary: 'Serve a private file (proxied with auth check)',
          security: [{ riderSession: [] }, { adminSession: [] }],
          parameters: [
            { name: 'path', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'File content' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'File not found' },
          },
        },
      },
      // ── Admin ─────────────────────────────────────────────────────────────
      '/api/admin/kyc': {
        post: {
          tags: ['Admin'],
          summary: 'Review KYC submission (approve/reject/request-info)',
          security: [{ adminSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ReviewKycRequest' } } },
          },
          responses: { '200': { description: 'KYC review processed' } },
        },
      },
      '/api/admin/deposits': {
        post: {
          tags: ['Admin'],
          summary: 'Review deposit (approve/reject/refund/forfeit)',
          security: [{ adminSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ReviewDepositRequest' } } },
          },
          responses: { '200': { description: 'Deposit review processed' } },
        },
      },
      '/api/admin/transactions': {
        post: {
          tags: ['Admin'],
          summary: 'Approve/reject/reverse a transaction',
          security: [{ adminSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApproveTransactionRequest' } } },
          },
          responses: { '200': { description: 'Transaction action processed' } },
        },
      },
      // ── Notifications ──────────────────────────────────────────────────────
      '/api/rider/notifications': {
        get: {
          tags: ['Notifications'],
          summary: 'List rider notifications',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'Notification list', content: { 'application/json': { schema: { $ref: '#/components/schemas/ListNotificationsResponse' } } } } },
        },
      },
      // ── Vehicles ───────────────────────────────────────────────────────────
      '/api/vehicles': {
        get: {
          tags: ['Vehicles'],
          summary: 'List vehicles by hub',
          security: [{ riderSession: [] }],
          parameters: [{ name: 'hubId', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Vehicle list', content: { 'application/json': { schema: { $ref: '#/components/schemas/ListVehiclesResponse' } } } } },
        },
      },
      // ── Hubs ───────────────────────────────────────────────────────────────
      '/api/admin/hubs': {
        get: {
          tags: ['Hubs'],
          summary: 'List all hubs',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'Hub list', content: { 'application/json': { schema: { $ref: '#/components/schemas/ListHubsResponse' } } } } },
        },
      },
      // ── Admin ─────────────────────────────────────────────────────────────
      '/api/admin/riders': {
        get: {
          tags: ['Admin'],
          summary: 'List riders (paginated)',
          security: [{ adminSession: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Paginated rider list' } },
        },
      },
      '/api/admin/reconciliation': {
        get: {
          tags: ['Admin'],
          summary: 'Run wallet reconciliation across all riders',
          security: [{ adminSession: [] }],
          responses: { '200': { description: 'Reconciliation results' } },
        },
      },
      // ── Additional Rider Routes ───────────────────────────────────────────
      '/api/auth/verify-phone': {
        post: {
          tags: ['Auth'],
          summary: 'Verify phone OTP',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyPhoneRequest' } } },
          },
          responses: { '200': { description: 'Verified', content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyPhoneResponse' } } } } },
        },
      },
      '/api/files/request-read': {
        post: {
          tags: ['Files'],
          summary: 'Request read URL',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RequestReadUrlRequest' } } },
          },
          responses: { '200': { description: 'Read URL generated', content: { 'application/json': { schema: { $ref: '#/components/schemas/RequestReadUrlResponse' } } } } },
        },
      },
      '/api/notification/list': {
        get: {
          tags: ['Notifications'],
          summary: 'List notifications',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'Notification list', content: { 'application/json': { schema: { $ref: '#/components/schemas/ListNotificationsResponse' } } } } },
        },
      },
      '/api/pricing': {
        get: {
          tags: ['Rentals'],
          summary: 'Fetch plan pricing',
          security: [{ riderSession: [] }],
          parameters: [
            { name: 'hubId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'basePrice', in: 'query', required: true, schema: { type: 'number' } },
          ],
          responses: { '200': { description: 'Pricing details' } },
        },
      },
      '/api/rider/dashboard': {
        get: {
          tags: ['Rider Profile'],
          summary: 'Rider dashboard',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'Dashboard data' } },
        },
      },
      '/api/rider/device': {
        post: {
          tags: ['Rider Profile'],
          summary: 'Submit device telemetry or token',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { properties: { token: { type: 'string' }, type: { type: 'string' } } } } },
          },
          responses: { '200': { description: 'Token submitted' } },
        },
      },
      '/api/rider/earnings': {
        get: {
          tags: ['Rider Profile'],
          summary: 'List earnings',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'Earning list' } },
        },
        post: {
          tags: ['Rider Profile'],
          summary: 'Add earning entry',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { properties: { amount: { type: 'number' }, taskName: { type: 'string' } } } } },
          },
          responses: { '200': { description: 'Earning added' } },
        },
      },
      '/api/rider/offers': {
        get: {
          tags: ['Rider Profile'],
          summary: 'Fetch rental offers',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'Offer list' } },
        },
      },
      '/api/rider/plans': {
        get: {
          tags: ['Rentals'],
          summary: 'List available plans',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'Plan list' } },
        },
        post: {
          tags: ['Rentals'],
          summary: 'Subscribe to plan',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { properties: { planId: { type: 'string' } } } } },
          },
          responses: { '200': { description: 'Subscribed' } },
        },
      },
      '/api/rider/pricing': {
        get: {
          tags: ['Rentals'],
          summary: 'Fetch rider pricing info',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'Pricing info' } },
        },
      },
      '/api/rider/referral': {
        get: {
          tags: ['Rider Profile'],
          summary: 'Fetch referral status summary',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'Referral status' } },
        },
      },
      '/api/rider/referrals': {
        get: {
          tags: ['Rider Profile'],
          summary: 'List referrals',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'Referrals list' } },
        },
      },
      '/api/rider/rewards': {
        get: {
          tags: ['Rider Profile'],
          summary: 'Fetch rewards',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'Rewards list' } },
        },
      },
      '/api/rider/settings': {
        get: {
          tags: ['Rider Profile'],
          summary: 'Fetch system settings',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'System settings' } },
        },
      },
      '/api/rider/sync/device-data': {
        post: {
          tags: ['Rider Profile'],
          summary: 'Sync device telemetry logs',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { properties: { type: { type: 'string' }, data: { type: 'object' } } } } },
          },
          responses: { '200': { description: 'Synced' } },
        },
      },
      '/api/rider/sync/pickup': {
        post: {
          tags: ['Rentals'],
          summary: 'Finalise pickup checklists',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  properties: {
                    riderId: { type: 'string' },
                    vehicleId: { type: 'string' },
                    hubId: { type: 'string' },
                    teamLeader: { type: 'string' },
                    emergencyContact: { type: 'string' },
                    pickupPhoto: { type: 'string' },
                    pickupPhotoFront: { type: 'string' },
                    pickupPhotoBack: { type: 'string' },
                    pickupPhotoLeft: { type: 'string' },
                    pickupPhotoRight: { type: 'string' },
                    pickupPhotoWithVehicle: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Pickup completed' } },
        },
      },
      '/api/rider/sync/pickup/vehicle': {
        get: {
          tags: ['Rentals'],
          summary: 'Check vehicle availability for pickup',
          security: [{ riderSession: [] }],
          parameters: [
            { name: 'hubId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'vehicleId', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Vehicle details' } },
        },
      },
      '/api/riders/register-token': {
        post: {
          tags: ['Notifications'],
          summary: 'Register FCM device token',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { properties: { token: { type: 'string' } } } } },
          },
          responses: { '200': { description: 'Token registered' } },
        },
      },
      '/api/shifts': {
        get: {
          tags: ['Rentals'],
          summary: 'Fetch shifts by hub and date',
          security: [{ riderSession: [] }],
          parameters: [
            { name: 'hubId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          ],
          responses: { '200': { description: 'Shifts list' } },
        },
      },
      '/api/support/chat': {
        get: {
          tags: ['Support'],
          summary: 'Fetch support chat messages',
          security: [{ riderSession: [] }],
          responses: { '200': { description: 'Chat message list' } },
        },
        post: {
          tags: ['Support'],
          summary: 'Send chat message',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { properties: { message: { type: 'string' } } } } },
          },
          responses: { '200': { description: 'Message sent' } },
        },
      },
      '/api/support/faqs': {
        get: {
          tags: ['Support'],
          summary: 'List active FAQs',
          responses: { '200': { description: 'Faq list' } },
        },
      },
      '/api/transaction/request': {
        post: {
          tags: ['Wallet'],
          summary: 'Request a transaction / payment session',
          security: [{ riderSession: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { properties: { amount: { type: 'number' }, purpose: { type: 'string' } } } } },
          },
          responses: { '200': { description: 'Request created' } },
        },
      },
      // ── Health ────────────────────────────────────────────────────────────
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check endpoint',
          responses: { '200': { description: 'Service is healthy' } },
        },
      },
    },
    components: {
      schemas: {
        // ── Auth ────────────────────────────────────────────────────────────
        SendOtpRequest: {
          type: 'object',
          required: ['phone'],
          properties: { phone: { type: 'string', description: '10-digit phone number', example: '9876543210' } },
        },
        SendOtpResponse: {
          type: 'object',
          properties: {
            exists: { type: 'boolean', description: 'Whether a rider account exists for this phone' },
            otp: { type: 'string', description: 'OTP value (development only)' },
          },
        },
        VerifyOtpRequest: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            otp: { type: 'string' },
            idToken: { type: 'string', description: 'Firebase ID token (alternative to OTP)' },
            referralCode: { type: 'string' },
          },
        },
        VerifyOtpResponse: {
          type: 'object',
          description: 'Returns flattened rider profile with session token',
          properties: {
            riderId: { type: 'string' },
            phone: { type: 'string' },
            fullName: { type: 'string' },
            state: { type: 'string' },
            kycStatus: { type: 'string' },
            guarantorStatus: { type: 'string' },
            walletBalance: { type: 'integer' },
            depositStatus: { type: 'string' },
            rentalStatus: { type: 'string' },
            referralCode: { type: 'string' },
            token: { type: 'string' },
            accountStatus: { type: 'string' },
            isNewRider: { type: 'boolean' },
          },
        },
        // ── Rider ──────────────────────────────────────────────────────────
        RiderProfileResponse: {
          type: 'object',
          description: 'Flattened rider profile with all relations',
          properties: {
            riderId: { type: 'string' },
            phone: { type: 'string' },
            fullName: { type: 'string' },
            state: { type: 'string' },
            kycStatus: { type: 'string' },
            guarantorStatus: { type: 'string' },
            walletBalance: { type: 'integer' },
            depositStatus: { type: 'string' },
            rentalStatus: { type: 'string' },
            referralCode: { type: 'string' },
            accountStatus: { type: 'string' },
            email: { type: 'string' },
            fatherName: { type: 'string' },
            motherName: { type: 'string' },
            currentAddress: { type: 'string' },
            emergencyContact: { type: 'string' },
            dob: { type: 'string' },
            profilePhoto: { type: 'string' },
            aadhaarFront: { type: 'string' },
            aadhaarBack: { type: 'string' },
            panCard: { type: 'string' },
          },
        },
        UpdateProfileRequest: {
          type: 'object',
          properties: {
            fullName: { type: 'string' },
            email: { type: 'string' },
            fatherName: { type: 'string' },
            motherName: { type: 'string' },
            currentAddress: { type: 'string' },
            emergencyContact: { type: 'string' },
            dob: { type: 'string' },
            intent: { type: 'string', enum: ['deliver', 'personal'] },
            aadhaarFront: { type: 'string' },
            aadhaarBack: { type: 'string' },
            panCard: { type: 'string' },
            bankName: { type: 'string' },
            bankAccount: { type: 'string' },
            bankIfsc: { type: 'string' },
            guarantorName: { type: 'string' },
            guarantorPhone: { type: 'string' },
            guarantorRelation: { type: 'string' },
          },
        },
        // ── KYC ────────────────────────────────────────────────────────────
        SubmitKycRequest: {
          type: 'object',
          required: ['aadhaarNumber', 'panNumber', 'bankName', 'bankAccount', 'bankIfsc'],
          properties: {
            aadhaarNumber: { type: 'string' },
            panNumber: { type: 'string' },
            bankName: { type: 'string' },
            bankAccount: { type: 'string' },
            bankIfsc: { type: 'string' },
            aadhaarFront: { type: 'string' },
            aadhaarBack: { type: 'string' },
            panCard: { type: 'string' },
            profilePhoto: { type: 'string' },
            signature: { type: 'string' },
          },
        },
        SubmitKycResponse: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            riderId: { type: 'string' },
            kycStatus: { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'INFO_REQUIRED'] },
          },
        },
        KycStatusResponse: {
          type: 'object',
          properties: {
            kycStatus: { type: 'string' },
            profilePhoto: { type: 'string', nullable: true },
            riderPhoto: { type: 'string', nullable: true },
            signature: { type: 'string', nullable: true },
            aadhaarFront: { type: 'string', nullable: true },
            aadhaarBack: { type: 'string', nullable: true },
            panCard: { type: 'string', nullable: true },
            bankName: { type: 'string', nullable: true },
            rejectionReason: { type: 'string', nullable: true },
          },
        },
        ReviewKycRequest: {
          type: 'object',
          required: ['riderId', 'action'],
          properties: {
            riderId: { type: 'string' },
            action: { type: 'string', enum: ['APPROVE', 'REJECT', 'REQUEST_INFO'] },
            rejectionReason: { type: 'string' },
            infoRequest: { type: 'string' },
          },
        },
        // ── Wallet ──────────────────────────────────────────────────────────
        TopupRequest: {
          type: 'object',
          required: ['riderId', 'amount', 'method'],
          properties: {
            riderId: { type: 'string' },
            amount: { type: 'number', description: 'Amount in rupees' },
            purpose: { type: 'string', default: 'TOP_UP' },
            method: { type: 'string', enum: ['UPI', 'CASH', 'CARD'] },
            upiRef: { type: 'string' },
            proofUrl: { type: 'string' },
          },
        },
        TopupResponse: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            amount: { type: 'number' },
            status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
            idempotent: { type: 'boolean' },
          },
        },
        // ── Deposits ────────────────────────────────────────────────────────
        ReviewDepositRequest: {
          type: 'object',
          required: ['riderId', 'action'],
          properties: {
            riderId: { type: 'string' },
            action: { type: 'string', enum: ['APPROVE', 'REJECT', 'REFUND', 'FORFEIT'] },
            reason: { type: 'string' },
            refundAmount: { type: 'number' },
            bonusAmount: { type: 'number' },
          },
        },
        ApproveTransactionRequest: {
          type: 'object',
          required: ['id', 'action'],
          properties: {
            id: { type: 'string' },
            action: { type: 'string', enum: ['APPROVE', 'REJECT', 'REVERSE'] },
            rejectionReason: { type: 'string' },
          },
        },
        // ── Rentals ────────────────────────────────────────────────────────
        BookRentalRequest: {
          type: 'object',
          required: ['vehicleId', 'shiftId', 'leaseDate', 'startTime'],
          properties: {
            vehicleId: { type: 'string' },
            shiftId: { type: 'string' },
            leaseDate: { type: 'string', format: 'date', example: '2025-06-15' },
            startTime: { type: 'string', example: '09:00' },
          },
        },
        BookRentalResponse: {
          type: 'object',
          properties: {
            lease: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                status: { type: 'string' },
                leaseDate: { type: 'string' },
                startTime: { type: 'string' },
                basePrice: { type: 'number' },
                finalPrice: { type: 'number' },
                vehicle: { type: 'object', properties: { id: { type: 'string' }, vehicleId: { type: 'string' }, model: { type: 'string' } } },
                shift: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, startTime: { type: 'string' }, endTime: { type: 'string' } } },
              },
            },
            pricing: { type: 'object', properties: { tier: { type: 'string' }, discount: { type: 'number' }, discountLabel: { type: 'string' }, hubAvailability: { type: 'object' } } },
          },
        },
        // ── Support ────────────────────────────────────────────────────────
        CreateTicketRequest: {
          type: 'object',
          required: ['category', 'subject', 'message'],
          properties: {
            category: { type: 'string' },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
            subject: { type: 'string' },
            message: { type: 'string' },
            attachments: { type: 'string' },
          },
        },
        TicketResponse: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            ticketId: { type: 'string' },
            riderId: { type: 'string' },
            category: { type: 'string' },
            priority: { type: 'string' },
            subject: { type: 'string' },
            message: { type: 'string' },
            status: { type: 'string', enum: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        // ── Files ────────────────────────────────────────────────────────────
        RequestUploadUrlRequest: {
          type: 'object',
          required: ['fileName', 'mimeType', 'category', 'fileSize'],
          properties: {
            fileName: { type: 'string', maxLength: 255 },
            mimeType: { type: 'string' },
            category: { type: 'string', enum: ['kyc_document', 'profile_photo', 'vehicle_photo', 'payment_proof', 'support_attachment'] },
            fileSize: { type: 'number', maximum: 10485760 },
          },
        },
        RequestUploadUrlResponse: {
          type: 'object',
          properties: {
            uploadUrl: { type: 'string' },
            fileRecordId: { type: 'string' },
            storageKey: { type: 'string' },
            expiresIn: { type: 'number' },
          },
        },
        ConfirmUploadRequest: {
          type: 'object',
          required: ['fileRecordId', 'sizeBytes'],
          properties: {
            fileRecordId: { type: 'string' },
            sizeBytes: { type: 'number' },
            checksum: { type: 'string' },
            idempotencyKey: { type: 'string' },
          },
        },
        RequestReadUrlRequest: {
          type: 'object',
          required: ['fileRecordId'],
          properties: {
            fileRecordId: { type: 'string' },
          },
        },
        RequestReadUrlResponse: {
          type: 'object',
          properties: {
            readUrl: { type: 'string' },
            expiresIn: { type: 'number' },
          },
        },
        // ── Notifications ────────────────────────────────────────────────────
        ListNotificationsResponse: {
          type: 'object',
          properties: {
            notifications: { type: 'array', items: { $ref: '#/components/schemas/NotificationResponse' } },
            unreadCount: { type: 'integer' },
            total: { type: 'integer' },
          },
        },
        NotificationResponse: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            title: { type: 'string' },
            message: { type: 'string' },
            isRead: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // ── Vehicles ─────────────────────────────────────────────────────────
        ListVehiclesResponse: {
          type: 'object',
          properties: {
            vehicles: { type: 'array', items: { $ref: '#/components/schemas/VehicleResponse' } },
            total: { type: 'integer' },
          },
        },
        VehicleResponse: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            vehicleId: { type: 'string' },
            registrationNumber: { type: 'string' },
            model: { type: 'string' },
            status: { type: 'string', enum: ['AVAILABLE', 'RESERVED', 'ASSIGNED', 'ACTIVE_RENTAL', 'RETURN_PENDING', 'MAINTENANCE', 'RETIRED', 'LOST'] },
            batteryLevel: { type: 'number' },
            hubId: { type: 'string' },
          },
        },
        // ── Hubs ─────────────────────────────────────────────────────────────
        ListHubsResponse: {
          type: 'object',
          properties: {
            hubs: { type: 'array', items: { $ref: '#/components/schemas/HubResponse' } },
            total: { type: 'integer' },
          },
        },
        HubResponse: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            capacity: { type: 'integer' },
            activeVehicles: { type: 'integer' },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] },
          },
        },
        // ── Deposit ──────────────────────────────────────────────────────────
        DepositStatusResponse: {
          type: 'object',
          properties: {
            riderId: { type: 'string' },
            status: { type: 'string', enum: ['NOT_SUBMITTED', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'REFUND_REQUESTED', 'REFUNDED', 'FORFEITED', 'PARTIALLY_REFUNDED'] },
            amountInPaise: { type: 'number' },
          },
        },
        SubmitDepositRequest: {
          type: 'object',
          required: ['amount', 'proofUrl', 'method'],
          properties: {
            amount: { type: 'number' },
            proofUrl: { type: 'string' },
            method: { type: 'string', enum: ['UPI', 'CASH', 'CARD'] },
            upiRef: { type: 'string' },
          },
        },
        // ── Verify Phone ──────────────────────────────────────────────────
        VerifyPhoneRequest: {
          type: 'object',
          required: ['phone', 'otp'],
          properties: { phone: { type: 'string' }, otp: { type: 'string' } },
        },
        VerifyPhoneResponse: {
          type: 'object',
          properties: { verified: { type: 'boolean' } },
        },
        // ── Generic ─────────────────────────────────────────────────────────
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' },
              },
            },
          },
        },
        ApiSuccess: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { type: 'object' },
            message: { type: 'string' },
            meta: { type: 'object', properties: { correlationId: { type: 'string' }, timestamp: { type: 'string' } } },
          },
        },
      },
      securitySchemes: {
        riderSession: {
          type: 'apiKey',
          in: 'cookie',
          name: 'voltium-session',
          description: 'Rider session cookie (set after OTP verification)',
        },
        adminSession: {
          type: 'apiKey',
          in: 'cookie',
          name: 'voltium-admin',
          description: 'Admin session cookie (set after admin login)',
        },
      },
    },
  };

  // Inject Zod schemas into components.schemas
  for (const [key, schema] of Object.entries(validators)) {
    if (key.endsWith('Schema')) {
      const name = key.replace('Schema', 'Request');
      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
      const jsonSchema = zodToJsonSchema(schema as any, { target: "openApi3" });
      spec.components.schemas[capitalizedName] = jsonSchema;
    }
  }

  return spec;
}

// Generate and write the spec
const spec = buildSpec();
const outputPath = resolve(process.cwd(), 'src/contracts/openapi.json');
writeFileSync(outputPath, JSON.stringify(spec, null, 2));
console.log(`✅ OpenAPI spec generated at ${outputPath}`);
console.log(`   Paths: ${Object.keys(spec.paths).length}`);
console.log(`   Schemas: ${Object.keys(spec.components.schemas).length}`);
