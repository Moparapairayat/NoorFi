<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportTicketController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category' => ['nullable', 'in:kyc'],
            'submission_id' => ['nullable', 'string', 'max:120'],
            'subject' => ['nullable', 'string', 'max:160'],
            'message' => ['nullable', 'string', 'max:2000'],
            'meta' => ['nullable', 'array'],
        ]);

        $user = $request->user();
        $category = (string) ($data['category'] ?? 'kyc');
        $submissionId = trim((string) ($data['submission_id'] ?? ''));
        $subject = trim((string) ($data['subject'] ?? 'KYC verification support'));
        $message = trim((string) ($data['message'] ?? 'User requested help with KYC verification.'));

        $openStatuses = ['open', 'in_progress'];
        $existing = SupportTicket::query()
            ->where('user_id', $user->id)
            ->where('category', $category)
            ->when(
                $submissionId !== '',
                fn ($query) => $query->where('submission_id', $submissionId),
                fn ($query) => $query->whereNull('submission_id')
            )
            ->whereIn('status', $openStatuses)
            ->latest('id')
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Support ticket already open for this submission.',
                'ticket' => $this->transformTicket($existing),
            ]);
        }

        $ticket = SupportTicket::query()->create([
            'user_id' => $user->id,
            'category' => $category,
            'status' => 'open',
            'submission_id' => $submissionId !== '' ? $submissionId : null,
            'subject' => $subject,
            'message' => $message,
            'contact_email' => $user->email,
            'meta' => $data['meta'] ?? null,
            'admin_note' => null,
            'resolved_at' => null,
        ]);

        return response()->json([
            'message' => 'Support ticket submitted successfully.',
            'ticket' => $this->transformTicket($ticket),
        ], 201);
    }

    private function transformTicket(SupportTicket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'category' => $ticket->category,
            'status' => $ticket->status,
            'submission_id' => $ticket->submission_id,
            'subject' => $ticket->subject,
            'message' => $ticket->message,
            'contact_email' => $ticket->contact_email,
            'meta' => $ticket->meta,
            'admin_note' => $ticket->admin_note,
            'resolved_at' => optional($ticket->resolved_at)->toIso8601String(),
            'created_at' => optional($ticket->created_at)->toIso8601String(),
        ];
    }
}

