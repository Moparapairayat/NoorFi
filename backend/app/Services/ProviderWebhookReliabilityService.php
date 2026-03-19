<?php

namespace App\Services;

use App\Models\ProviderWebhookLog;
use Illuminate\Database\QueryException;

class ProviderWebhookReliabilityService
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{0: ProviderWebhookLog, 1: bool}
     */
    public function registerIncoming(
        string $provider,
        array $payload,
        ?string $eventKey = null,
        ?string $topic = null
    ): array {
        $normalizedProvider = strtolower(trim($provider));
        $normalizedTopic = $topic !== null && trim($topic) !== '' ? strtolower(trim($topic)) : null;
        $normalizedEventKey = $eventKey !== null && trim($eventKey) !== '' ? trim($eventKey) : null;
        $eventHash = hash('sha256', $this->canonicalJson($payload));

        try {
            $log = ProviderWebhookLog::query()->create([
                'provider' => $normalizedProvider,
                'topic' => $normalizedTopic,
                'event_key' => $normalizedEventKey,
                'event_hash' => $eventHash,
                'payload' => $payload,
                'attempt_count' => 1,
                'process_status' => 'received',
                'received_at' => now(),
            ]);

            return [$log, false];
        } catch (QueryException $exception) {
            $existing = ProviderWebhookLog::query()
                ->where('provider', $normalizedProvider)
                ->where('event_hash', $eventHash)
                ->first();

            if (! $existing) {
                throw $exception;
            }

            $existing->increment('attempt_count');

            return [$existing->fresh(), true];
        }
    }

    public function markProcessing(ProviderWebhookLog $log, ?string $message = null): void
    {
        $log->forceFill([
            'process_status' => 'processing',
            'process_message' => $message,
        ])->save();
    }

    public function markProcessed(ProviderWebhookLog $log, string $status = 'processed', ?string $message = null): void
    {
        $normalizedStatus = in_array($status, ['processed', 'ignored'], true) ? $status : 'processed';

        $log->forceFill([
            'process_status' => $normalizedStatus,
            'process_message' => $message,
            'processed_at' => now(),
        ])->save();
    }

    public function markFailed(ProviderWebhookLog $log, string $message): void
    {
        $log->forceFill([
            'process_status' => 'failed',
            'process_message' => trim($message) !== '' ? trim($message) : 'Webhook processing failed.',
            'processed_at' => now(),
        ])->save();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function canonicalJson(array $payload): string
    {
        $normalized = $this->normalizeValue($payload);
        $encoded = json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return $encoded === false ? '{}' : $encoded;
    }

    private function normalizeValue(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        if ($this->isList($value)) {
            return array_map(fn ($item) => $this->normalizeValue($item), $value);
        }

        ksort($value);

        $normalized = [];
        foreach ($value as $key => $item) {
            $normalized[(string) $key] = $this->normalizeValue($item);
        }

        return $normalized;
    }

    /**
     * @param  array<mixed>  $array
     */
    private function isList(array $array): bool
    {
        if (function_exists('array_is_list')) {
            return array_is_list($array);
        }

        $index = 0;
        foreach ($array as $key => $_) {
            if ($key !== $index) {
                return false;
            }
            $index++;
        }

        return true;
    }
}
