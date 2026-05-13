<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

allow_methods(['GET']);

json_response([
    'shop' => [
        'name' => 'PrintUrge',
        'hours' => 'Monday to Saturday, 8:00 AM - 6:00 PM',
        'contact' => 'orders@printurge.local',
        'description' => 'Printing shop management system.',
    ],
]);
