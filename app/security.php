<?php

/**
 * Security checks за ПБ Лични Финанси API.
 * Приема само POST с JSON от браузър (Origin/Referer), HTTPS, GeoIP (България), rate limit по IP и по jet_id.
 */

/**
 * Връща 403 с причина – при PB_DEBUG показва reason в JSON тялото за лесно четене.
 */
function jet_exit_403(string $reason): void
{
    header('X-Jet-403-Reason: ' . $reason);
    if (defined('PB_DEBUG') && PB_DEBUG) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(403);
        echo json_encode([
            'ok' => false,
            'error' => 'Forbidden',
            'reason' => $reason,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    http_response_code(403);
    exit('Access denied');
}

/**
 * Изпълнява всички проверки за сигурност.
 *
 * @param array<string, mixed> $payload декодирано тяло на заявката (JSON)
 */
function perform_security_checks(array $payload): void
{
    $jetId = isset($payload['jet_id']) ? trim((string) $payload['jet_id']) : null;
    // 1. Само POST (OPTIONS се обработва в index.php преди извикването тук)
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        exit;
    }

    // 2. HTTPS – блокирай незашифрован достъп
    $isHttps = false;
    if (isset($_SERVER['HTTPS']) && strtolower($_SERVER['HTTPS']) !== 'off') {
        $isHttps = true;
    } elseif (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') {
        $isHttps = true;
    } elseif (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443) {
        $isHttps = true;
    }

    if (!$isHttps) {
        jet_exit_403('https_required');
    }

    // 3. Origin или Referer – заявки от браузър (CORS) ги изпращат
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    if (empty($origin) && empty($referer)) {
        jet_exit_403('origin_or_referer_required');
    }

    // 4. Блокиране на ботове/сканери по User-Agent
    if (is_bot_user_agent()) {
        jet_exit_403('bot_user_agent');
    }

    // 5. GeoIP – само заявки от България (Cloudflare / MaxMind / ipapi.co)
    require_once __DIR__ . '/geoip.php';
    $ip = get_client_ip();
    if (!is_ip_from_bulgaria($ip)) {
        jet_exit_403('geoip_not_bulgaria');
    }

    // 6. Rate limiting по IP
    if (!rl_check('ip_' . $ip, 60, 60)) { // 60 заявки/минута на IP
        http_response_code(429);
        header('Retry-After: 60');
        exit('Too many requests');
    }

    // 7. Rate limiting по jet_id (идентификатор на магазина)
    if ($jetId !== null && $jetId !== '') {
        if (!rl_check('jet_' . $jetId, 120, 60)) { // 120 заявки/минута на магазин
            http_response_code(429);
            header('Retry-After: 60');
            exit('Too many requests');
        }
    }

    // 8. Задължителни полета
    $step2Firstname = isset($payload['jet-step2-firstname']) ? trim((string) $payload['jet-step2-firstname']) : null;
    $step2Lastname = isset($payload['jet-step2-lastname']) ? trim((string) $payload['jet-step2-lastname']) : null;
    $step2Egn = isset($payload['jet-step2-egn']) ? trim((string) $payload['jet-step2-egn']) : null;
    $step2Phone = isset($payload['jet-step2-phone']) ? trim((string) $payload['jet-step2-phone']) : null;
    $step2Email = isset($payload['jet-step2-email']) ? trim((string) $payload['jet-step2-email']) : null;
    $items = isset($payload['items']) && is_array($payload['items']) ? $payload['items'] : null;
    $jetCard = array_key_exists('jet_card', $payload) ? (bool) $payload['jet_card'] : null;
    $jetParva = isset($payload['jet_parva']) ? trim((string) $payload['jet_parva']) : null;
    $jetVnoski = isset($payload['jet_vnoski']) ? trim((string) $payload['jet_vnoski']) : null;
    $jetVnoska = isset($payload['jet_vnoska']) ? trim((string) $payload['jet_vnoska']) : null;
    $jetEmailPbpf = isset($payload['jet_email_pbpf']) ? trim((string) $payload['jet_email_pbpf']) : null;
    $jetEmailShop = isset($payload['jet_email_shop']) ? trim((string) $payload['jet_email_shop']) : null;
    $shopDomain = isset($payload['shop_domain']) ? trim((string) $payload['shop_domain']) : null;
    $shopPermanentDomain = isset($payload['shop_permanent_domain']) ? trim((string) $payload['shop_permanent_domain']) : null;

    $required = [
        'jet_id' => $jetId,
        'shop_domain' => $shopDomain,
        'shop_permanent_domain' => $shopPermanentDomain,
        'jet-step2-firstname' => $step2Firstname,
        'jet-step2-lastname' => $step2Lastname,
        'jet-step2-egn' => $step2Egn,
        'jet-step2-phone' => $step2Phone,
        'jet-step2-email' => $step2Email,
        'jet_parva' => $jetParva,
        'jet_vnoski' => $jetVnoski,
        'jet_vnoska' => $jetVnoska,
        'jet_email_pbpf' => $jetEmailPbpf,
        'jet_email_shop' => $jetEmailShop,
    ];
    $missing = [];
    foreach ($required as $name => $value) {
        if ($value === null || $value === '') {
            $missing[] = $name;
        }
    }
    if (array_key_exists('jet_card', $payload) === false) {
        $missing[] = 'jet_card';
    }
    if ($items === null || $items === []) {
        $missing[] = 'items';
    } else {
        foreach ($items as $i => $item) {
            if (!is_array($item)) {
                $missing[] = 'items[' . $i . ']';
                continue;
            }
            $pid = isset($item['jet_product_id']) ? trim((string) $item['jet_product_id']) : null;
            $cTxt = isset($item['product_c_txt']) ? trim((string) $item['product_c_txt']) : null;
            $pTxt = isset($item['product_p_txt']) ? trim((string) $item['product_p_txt']) : null;
            $qty = isset($item['jet_quantity']) ? trim((string) $item['jet_quantity']) : null;
            if ($pid === null || $pid === '' || $cTxt === null || $cTxt === '' || $pTxt === null || $pTxt === '' || $qty === null || $qty === '') {
                $missing[] = 'items[' . $i . '].jet_product_id|product_c_txt|product_p_txt|jet_quantity';
            }
        }
    }
    if ($missing !== []) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(400);
        exit(json_encode([
            'ok' => false,
            'error' => 'Missing required fields',
            'missing' => $missing,
        ], JSON_UNESCAPED_UNICODE));
    }
}

/**
 * Дали User-Agent е бот/сканер.
 */
function is_bot_user_agent(): bool
{
    $ua = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');

    if (empty($ua)) {
        return true;
    }

    $botPatterns = [
        'bot',
        'crawler',
        'spider',
        'scraper',
        'curl',
        'wget',
        'python',
        'java',
        'perl',
        'ruby',
        'go-http',
        'scrapy',
        'mechanize',
        'headless',
        'phantom',
        'selenium',
        'webdriver',
        'postman',
        'insomnia',
        'apache-httpclient',
        'okhttp',
        'libwww-perl',
        'masscan',
        'nmap',
        'nikto',
        'sqlmap',
        'dirbuster',
        'gobuster',
        'burp',
        'zap',
        'nessus',
        'openvas',
        'acunetix',
        'netsparker',
        'appscan',
        'qualys',
        'rapid7',
        'metasploit',
        'havij',
        'pangolin',
        'sqlsus',
        'sqlninja',
        'w3af',
        'skipfish',
        'wapiti',
        'arachni',
        'lynx',
        'links',
        'w3m'
    ];

    foreach ($botPatterns as $pattern) {
        if (strpos($ua, $pattern) !== false) {
            return true;
        }
    }

    $validBrowsers = ['mozilla', 'chrome', 'safari', 'edge', 'firefox', 'opera', 'msie'];
    foreach ($validBrowsers as $browser) {
        if (strpos($ua, $browser) !== false) {
            return false;
        }
    }

    return true;
}

/**
 * Rate limit по ключ – файлово съхранение.
 * @param string $key Напр. 'ip_1.2.3.4'
 * @param int $limit Макс. заявки в прозореца
 * @param int $windowSeconds Прозорец в секунди
 * @return bool true ако е под лимита
 */
function rl_check(string $key, int $limit, int $windowSeconds = 60): bool
{
    $dir = __DIR__ . '/ratelimit';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }

    $safeKey = preg_replace('/[^A-Za-z0-9_\-.]/', '_', $key);
    $file = $dir . '/rl_' . $safeKey . '.txt';
    $now = time();
    $start = $now;
    $count = 0;

    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return true;
    }

    if (flock($fh, LOCK_EX)) {
        $data = stream_get_contents($fh);
        if ($data !== false && $data !== '') {
            $parts = array_pad(explode('|', trim($data), 2), 2, 0);
            $storedStart = (int) $parts[0];
            $storedCount = (int) $parts[1];
            if ($now - $storedStart < $windowSeconds) {
                $start = $storedStart;
                $count = $storedCount;
            }
        }

        $count++;

        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, $start . '|' . $count);
        fflush($fh);
        flock($fh, LOCK_UN);
    }
    fclose($fh);

    return $count <= $limit;
}
