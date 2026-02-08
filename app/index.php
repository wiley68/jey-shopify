<?php

/**
 * Приложение за изпращане на имейли от заявки за кредит (ПБ Лични Финанси).
 * Посреща POST с jet_id, shop, items, данни от форма и връща JSON.
 * CORS: разрешава заявки от магазина (fetch от storefront).
 */

// Debug режим (PB_DEBUG) – при true при 403 причината се връща в JSON тялото; задай false за production
define('PB_DEBUG', true);

header('Content-Type: application/json; charset=utf-8');

// CORS preflight – преди security, иначе OPTIONS ще получи 405
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'ok' => false,
        'error' => 'Method not allowed',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Четене на тялото веднъж
$contentType = $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
$handler = fopen('php://input', 'r');
$rawInput = $handler !== false ? stream_get_contents($handler) : '';
if ($handler !== false) {
    fclose($handler);
}
$rawInput = ($rawInput !== false) ? $rawInput : '';

$payload = [];
if ($rawInput !== '' && (strpos($contentType, 'application/json') !== false || strpos(trim($rawInput), '{') === 0)) {
    $decoded = json_decode($rawInput, true);
    if (is_array($decoded)) {
        $payload = $decoded;
    }
}
if ($payload === [] && $rawInput !== '') {
    parse_str($rawInput, $parsed);
    if (is_array($parsed)) {
        $payload = $parsed;
    }
}

// Нормализиране на стойности – trim за string полета
$trimStrings = function (array $data) use (&$trimStrings) {
    $out = [];
    foreach ($data as $k => $v) {
        if (is_string($v)) {
            $out[$k] = trim($v);
        } elseif (is_array($v)) {
            $out[$k] = $trimStrings($v);
        } else {
            $out[$k] = $v;
        }
    }
    return $out;
};
$payload = $trimStrings($payload);

require_once __DIR__ . '/security.php';
perform_security_checks($payload);

$response = ['ok' => true];
foreach ($payload as $key => $value) {
    $response[$key] = $value;
}
if (PB_DEBUG) {
    $response['debug'] = $payload;
}

echo json_encode($response, JSON_UNESCAPED_UNICODE);
