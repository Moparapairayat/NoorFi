<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'wallet_id' => ['nullable', 'integer'],
            'type' => ['nullable', 'string', 'max:24'],
            'direction' => ['nullable', 'in:credit,debit'],
            'status' => ['nullable', 'string', 'max:24'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Transaction::query()
            ->where('user_id', $request->user()->id)
            ->with(['wallet:id,currency', 'related'])
            ->orderByDesc('occurred_at')
            ->orderByDesc('id');

        if (! empty($data['wallet_id'])) {
            $query->where('wallet_id', $data['wallet_id']);
        }

        if (! empty($data['type'])) {
            $query->where('type', $data['type']);
        }

        if (! empty($data['direction'])) {
            $query->where('direction', $data['direction']);
        }

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        if (! empty($data['search'])) {
            $search = $data['search'];
            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where('reference', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $transactions = $query->paginate((int) ($data['per_page'] ?? 20));

        return response()->json([
            'data' => $transactions->getCollection()->map(fn (Transaction $transaction): array => $this->transform($transaction)),
            'meta' => [
                'current_page' => $transactions->currentPage(),
                'last_page' => $transactions->lastPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
            ],
        ]);
    }

    public function show(Request $request, Transaction $transaction): JsonResponse
    {
        abort_unless($transaction->user_id === $request->user()->id, 404);

        $transaction->loadMissing(['wallet:id,currency', 'related']);

        return response()->json([
            'transaction' => $this->transform($transaction, true),
        ]);
    }

    private function transform(Transaction $transaction, bool $withMeta = false): array
    {
        $payload = [
            'id' => $transaction->id,
            'wallet_id' => $transaction->wallet_id,
            'currency' => strtoupper((string) optional($transaction->wallet)->currency),
            'type' => $transaction->type,
            'direction' => $transaction->direction,
            'amount' => (float) $transaction->amount,
            'fee' => (float) $transaction->fee,
            'net_amount' => (float) $transaction->net_amount,
            'status' => $transaction->status,
            'reference' => $transaction->reference,
            'description' => $transaction->description,
            'related_type' => $transaction->related_type ? class_basename($transaction->related_type) : null,
            'related_id' => $transaction->related_id,
            'occurred_at' => $transaction->occurred_at?->toIso8601String(),
            'created_at' => $transaction->created_at?->toIso8601String(),
        ];

        if ($withMeta) {
            $payload['meta'] = $transaction->meta ?? [];
        }

        return $payload;
    }
}
