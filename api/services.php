<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

allow_methods(['GET']);

json_response([
    'services' => [
        ['key' => 'document', 'name' => 'Document Printing', 'category' => 'academics business', 'href' => 'pages/services/document-printing.html'],
        ['key' => 'softbinding', 'name' => 'Soft Binding', 'category' => 'academics finishing', 'href' => 'pages/services/soft-binding.html'],
        ['key' => 'lamination', 'name' => 'Lamination', 'category' => 'finishing', 'href' => 'pages/services/lamination.html'],
        ['key' => 'photocopy', 'name' => 'Photocopying', 'category' => 'academics business', 'href' => 'pages/services/photocopying.html'],
        ['key' => 'poster', 'name' => 'Poster Printing', 'category' => 'business creative', 'href' => 'pages/services/poster-printing.html'],
        ['key' => 'photoid', 'name' => 'Photo and ID Printing', 'category' => 'academics creative', 'href' => 'pages/services/photo-id-printing.html'],
        ['key' => 'banner', 'name' => 'Banners and Tarpaulin', 'category' => 'business creative', 'href' => 'pages/services/banners-tarpaulin.html'],
        ['key' => 'spiralbinding', 'name' => 'Spiral Binding', 'category' => 'finishing academics', 'href' => 'pages/services/spiral-binding.html'],
    ],
]);
