<?php

/**
 * Приложение за изпращане на имейли от заявки за кредит (ПБ Лични Финанси).
 * Посреща POST с jet_id, shop, items, данни от форма и връща JSON.
 * CORS: разрешава заявки от магазина (fetch от storefront).
 */

// Debug режим (PB_DEBUG) – при true при 403 причината се връща в JSON тялото. За production задай false.
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

/**
 * Връща и инкрементира брояча на заявки за даден магазин (защитено с file locking)
 * @param string $shopDomain Домейн на магазина (идентификатор)
 * @return int Поредният номер на заявката
 */
function getAndIncrementRequestCounter($shopDomain)
{
    // Санитизираме домейна за използване като име на файл
    $safeDomain = preg_replace('/[^a-zA-Z0-9._-]/', '_', $shopDomain);
    if (empty($safeDomain)) {
        $safeDomain = 'default';
    }

    $countersDir = __DIR__ . '/counters';
    if (!is_dir($countersDir)) {
        @mkdir($countersDir, 0755, true);
    }

    $counterFile = $countersDir . '/' . $safeDomain . '.txt';

    // Отваряме файла за четене и писане (създаваме ако не съществува)
    $fp = @fopen($counterFile, 'c+');
    if ($fp === false) {
        // Ако не можем да отворим файла, връщаме 1 като fallback
        error_log('[Jet] Failed to open counter file: ' . $counterFile);
        return 1;
    }

    // Заключваме файла за ексклузивен достъп (защита от конкурентни заявки)
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        error_log('[Jet] Failed to lock counter file: ' . $counterFile);
        return 1;
    }

    // Четем текущата стойност
    rewind($fp);
    $currentValue = (int) trim(fgets($fp) ?: '0');

    // Инкрементираме
    $newValue = $currentValue + 1;

    // Записваме новата стойност
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, (string) $newValue);
    fflush($fp);

    // Отключваме и затваряме
    flock($fp, LOCK_UN);
    fclose($fp);

    return $newValue;
}

$response = ['ok' => true];
if (PB_DEBUG) {
    $response['debug'] = $payload;
}

require_once __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$body = "Данни за потребителя:\r\n";
$body .= "Собствено име: {$payload['jet-step2-firstname']};\r\n";
$body .= "Фамилия: {$payload['jet-step2-lastname']};\r\n";
$body .= "ЕГН: {$payload['jet-step2-egn']};\r\n";
$body .= "Телефон за връзка: {$payload['jet-step2-phone']};\r\n";
$body .= "Имейл адрес: {$payload['jet-step2-email']};\r\n\r\n";

$body .= "Данни за стоката:\r\n";
$totalCartAmount = 0.0; // Обща сума на количката (за изчисляване на размера на кредита)

if (isset($payload['items']) && is_array($payload['items'])) {
    $itemsCount = count($payload['items']);

    // Ако има само един продукт (от продуктова страница)
    if ($itemsCount == 1) {
        $item = $payload['items'][0];
        $itemTotal = (float) $item['product_p_txt'] * (int) $item['jet_quantity'];
        $totalCartAmount = $itemTotal;

        $body .= "Тип стока: {$item['product_c_txt']};\r\n";
        $body .= "Марка: " . "({$item['jet_product_id']}) {$item['att_name']};\r\n";
        $body .= "Единична цена с ДДС: {$item['product_p_txt']};\r\n";
        $body .= "Брой стоки: {$item['jet_quantity']};\r\n";
        $body .= "Обща сума с ДДС: " . number_format($itemTotal, 2, '.', '') . ";\r\n\r\n";
    } else {
        // Ако има повече продукти (от количката) - показваме всеки продукт
        foreach ($payload['items'] as $index => $item) {
            $itemTotal = (float) $item['product_p_txt'] * (int) $item['jet_quantity'];
            $totalCartAmount += $itemTotal;

            $body .= "Продукт " . ($index + 1) . ":\r\n";
            $body .= "Тип стока: {$item['product_c_txt']};\r\n";
            $attName = isset($item['att_name']) && $item['att_name'] !== '' ? $item['att_name'] : '-';
            $body .= "Марка: " . "({$item['jet_product_id']}) {$attName};\r\n";
            $body .= "Единична цена с ДДС: {$item['product_p_txt']};\r\n";
            $body .= "Брой стоки: {$item['jet_quantity']};\r\n";
            $body .= "Обща сума с ДДС: " . number_format($itemTotal, 2, '.', '') . ";\r\n\r\n";
        }
    }
}

if (isset($payload['jet_card']) && $payload['jet_card'] == true) {
    $body .= "Тип стока: Кредитна Карта;\r\n";
    $body .= "Марка: -;\r\n";
    $body .= "Единична цена с ДДС: 0.00;\r\n";
    $body .= "Брой стоки: 1;\r\n";
    $body .= "Обща сума с ДДС: 0.00;\r\n\r\n";
}

$body .= "Данни за кредита:\r\n";
// Размер на кредита = обща сума на количката минус първоначалната вноска
$parva = isset($payload['jet_parva']) ? (float) $payload['jet_parva'] : 0.0;
$creditAmount = $totalCartAmount - $parva;
$body .= "Размер на кредита: " . number_format($creditAmount, 2, '.', '') . ";\r\n";
$body .= "Срок на изплащане в месеца: {$payload['jet_vnoski']};\r\n";
$body .= "Месечна вноска: {$payload['jet_vnoska']};\r\n";
$body .= "Първоначална вноска: " . number_format(floatval($payload['jet_parva']), 2, ".", "") . ";\r\n";

// Вземаме поредния номер на заявката за този магазин
// Използваме shop_permanent_domain като първи избор (по-стабилен), иначе shop_domain
$shopDomain = !empty($payload['shop_permanent_domain'])
    ? $payload['shop_permanent_domain']
    : ($payload['shop_domain'] ?? '');
$requestNumber = getAndIncrementRequestCounter($shopDomain);

$subject = $payload['jet_id'] . ", онлайн заявка по поръчка " . $requestNumber;

$mail = new PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host = 'mail.avalonbg.com';
    $mail->Port = 587;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->SMTPAuth = true;
    $mail->Username = 'home@avalonbg.com';
    $mail->Password = 'Z7F+?@GRNcC]';
    $mail->Subject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $mail->CharSet = 'UTF-8';
    $mail->Encoding = 'base64';
    $mail->setFrom($payload['jet_email_shop'], $payload['jet_id']);
    $mail->addAddress($payload['jet_email_pbpf']);
    $mail->addCC($payload['jet_email_shop']);
    $mail->addCC($payload['jet-step2-email']);
    $mail->Body = $body;
    $mail->isHTML(false);
    if ($mail->send()) {
        echo json_encode($response, JSON_UNESCAPED_UNICODE);
        exit;
    }
    $response['ok'] = false;
    $response['error'] = PB_DEBUG ? ('Failed to send email: ' . $mail->ErrorInfo) : 'Не можем да изпратим заявката към Банката.';
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
} catch (Exception $e) {
    $response['ok'] = false;
    $response['error'] = PB_DEBUG ? ('Failed to send email: ' . $e->getMessage()) : 'Не можем да изпратим заявката към Банката.';
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}
