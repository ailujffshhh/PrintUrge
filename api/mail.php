<?php
declare(strict_types=1);

/**
 * Sends payment / e-receipt email. Prefer Resend (PRINTURGE_RESEND_API_KEY); falls back to mail().
 *
 * Env: PRINTURGE_RESEND_API_KEY, PRINTURGE_MAIL_FROM (e.g. PrintUrge <orders@yourdomain.com>)
 */
function printurge_send_ereceipt_email(string $to, string $transactionId, string $customerName, string $service): bool
{
    $to = trim($to);
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $from = getenv('PRINTURGE_MAIL_FROM') ?: 'PrintUrge <noreply@printurge.local>';
    $subject = 'PrintUrge payment confirmed — ' . $transactionId;
    $safeName = htmlspecialchars($customerName !== '' ? $customerName : 'Customer', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeTxn = htmlspecialchars($transactionId, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeSvc = htmlspecialchars($service, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui,sans-serif;line-height:1.5">'
        . '<h1>Payment received</h1>'
        . '<p>Hi ' . $safeName . ',</p>'
        . '<p>Your payment for print order <strong>' . $safeTxn . '</strong> has been confirmed.</p>'
        . '<p><strong>Service:</strong> ' . $safeSvc . '</p>'
        . '<p>Keep this email as your e-receipt. You can check order status anytime on the PrintUrge track order page.</p>'
        . '<p style="color:#666;font-size:14px">Thank you for choosing PrintUrge.</p>'
        . '</body></html>';

    $apiKey = getenv('PRINTURGE_RESEND_API_KEY') ?: '';
    if ($apiKey !== '') {
        $payload = [
            'from' => $from,
            'to' => [$to],
            'subject' => $subject,
            'html' => $html,
        ];
        $ch = curl_init('https://api.resend.com/emails');
        if ($ch === false) {
            return false;
        }
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
        ]);
        $raw = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code >= 200 && $code < 300) {
            return true;
        }
        error_log('Resend email failed: HTTP ' . $code . ' ' . (string)$raw);
        return false;
    }

    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=UTF-8',
        'From: ' . $from,
    ];
    return @mail($to, $subject, $html, implode("\r\n", $headers));
}
