<?php

function read_json_file(string $path, array $default): array
{
    if (!file_exists($path)) {
        return $default;
    }

    $raw = file_get_contents($path);
    $data = json_decode($raw ?: '', true);

    return is_array($data) ? $data : $default;
}

function atomic_write_json(string $path, array $data): void
{
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }

    $lockPath = $path . '.lock';
    $lockHandle = fopen($lockPath, 'c');
    if ($lockHandle === false) {
        throw new RuntimeException('Impossibile aprire il lock file.');
    }

    if (!flock($lockHandle, LOCK_EX)) {
        throw new RuntimeException('Impossibile ottenere il lock.');
    }

    $tmpPath = $path . '.tmp';
    file_put_contents(
        $tmpPath,
        json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
    );
    rename($tmpPath, $path);
    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);
}

function load_master_data(string $path): array
{
    $default = [
        'version' => 1,
        'updated_at' => date(DATE_ATOM),
        'parishes' => [],
    ];

    return read_json_file($path, $default);
}

function save_master_data(string $path, array $data, string $publicPath): void
{
    $data['updated_at'] = date(DATE_ATOM);
    atomic_write_json($path, $data);
    regenerate_public_json($data, $publicPath);
}

function regenerate_public_json(array $master, string $publicPath): void
{
    $public = [
        'version' => $master['version'] ?? 1,
        'updated_at' => date(DATE_ATOM),
        'parishes' => [],
    ];

    foreach ($master['parishes'] ?? [] as $parish) {
        $public['parishes'][] = [
            'id' => $parish['id'] ?? '',
            'name' => $parish['name'] ?? '',
            'address' => $parish['address'] ?? '',
            'lat' => $parish['lat'] ?? null,
            'lng' => $parish['lng'] ?? null,
            'diocese' => $parish['diocese'] ?? null,
            'city' => $parish['city'] ?? null,
            'is_active' => $parish['is_active'] ?? true,
            'contact' => [
                'public_email' => $parish['contact']['public_email'] ?? null,
                'website_url' => $parish['contact']['website_url'] ?? null,
            ],
            'catechesis' => [
                'year' => $parish['catechesis']['year'] ?? (int)date('Y'),
                'status' => $parish['catechesis']['status'] ?? 'UNKNOWN',
                'days' => $parish['catechesis']['days'] ?? [],
                'time' => $parish['catechesis']['time'] ?? null,
                'start_date' => $parish['catechesis']['start_date'] ?? null,
                'source_level' => $parish['catechesis']['source_level'] ?? 'COMMUNITY',
                'last_verified_at' => $parish['catechesis']['last_verified_at'] ?? null,
            ],
        ];
    }

    atomic_write_json($publicPath, $public);
}

function find_parish_index(array $parishes, string $id): int
{
    foreach ($parishes as $index => $parish) {
        if (($parish['id'] ?? '') === $id) {
            return $index;
        }
    }
    return -1;
}
