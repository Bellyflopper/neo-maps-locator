<?php
session_start();

require __DIR__ . '/src/config.php';
require __DIR__ . '/src/storage.php';

$config = load_config();
if (!empty($config['missing'])) {
    echo "Config mancante.";
    exit;
}

if (!isset($_SESSION['admin_logged'])) {
    echo "Accesso negato.";
    exit;
}

$masterPath = __DIR__ . '/data/parishes_master.json';
$publicPath = __DIR__ . '/data/parishes_public.json';

$master = load_master_data($masterPath);
regenerate_public_json($master, $publicPath);

$repoPath = $config['pages_repo_path'] ?? '';
if (!$repoPath) {
    echo "pages_repo_path non configurato.";
    exit;
}

$targetJson = rtrim($repoPath, '/') . '/docs/data/parishes_public.json';
$targetVersion = rtrim($repoPath, '/') . '/docs/data/version.txt';

if (!is_dir(dirname($targetJson))) {
    mkdir(dirname($targetJson), 0775, true);
}

copy($publicPath, $targetJson);
file_put_contents($targetVersion, date(DATE_ATOM));

$commitMessage = $config['commit_message'] ?? 'Update parishes_public.json';

$commands = [
    "cd " . escapeshellarg($repoPath) . " && git add docs/data/parishes_public.json docs/data/version.txt",
    "cd " . escapeshellarg($repoPath) . " && git commit -m " . escapeshellarg($commitMessage),
    "cd " . escapeshellarg($repoPath) . " && git push",
];

$output = [];
foreach ($commands as $command) {
    $result = shell_exec($command . " 2>&1");
    $output[] = $result ?: '';
}

?>
<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/styles.css" />
  <title>Publish</title>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Publish completato</h1>
      <p>Output:</p>
      <pre><?php echo htmlspecialchars(implode("\n", $output)); ?></pre>
      <a href="/" class="btn">Torna alla dashboard</a>
    </div>
  </div>
</body>
</html>