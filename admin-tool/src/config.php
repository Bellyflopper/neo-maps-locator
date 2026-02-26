<?php

function load_config(): array
{
    $configPath = __DIR__ . '/../config.local.php';
    if (!file_exists($configPath)) {
        return [
            'missing' => true,
        ];
    }

    $config = require $configPath;

    return is_array($config) ? $config : ['missing' => true];
}