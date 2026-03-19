import { apiRequest } from './client';

export type CreateSupportTicketPayload = {
  category?: 'kyc';
  submission_id?: string;
  subject?: string;
  message?: string;
  meta?: Record<string, unknown>;
};

export type SupportTicketResponse = {
  message: string;
  ticket: {
    id: number;
    category: string;
    status: string;
    submission_id: string | null;
    subject: string;
    message: string;
    contact_email: string | null;
    meta: Record<string, unknown> | null;
    admin_note: string | null;
    resolved_at: string | null;
    created_at: string | null;
  };
};

export async function createSupportTicket(
  payload: CreateSupportTicketPayload
): Promise<SupportTicketResponse> {
  return apiRequest<SupportTicketResponse>('/support/tickets', {
    method: 'POST',
    body: payload,
  });
}

