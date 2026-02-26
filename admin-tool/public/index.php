<?php
session_start();

require __DIR__ . '/../src/config.php';
require __DIR__ . '/../src/storage.php';

$config = load_config();
if (!empty($config['missing'])) {
    echo "<h2>Config mancante</h2><p>Crea admin-tool/config.local.php</p>";
    exit;
}

$masterPath = __DIR__ . '/../data/parishes_master.json';
$publicPath = __DIR__ . '/../data/parishes_public.json';

$errors = [];
$message = null;

if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    session_destroy();
    header('Location: /');
    exit;
}

if (!isset($_SESSION['admin_logged'])) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $user = trim($_POST['username'] ?? '');
        $pass = trim($_POST['password'] ?? '');

        if ($user === ($config['admin_user'] ?? '') && $pass === ($config['admin_pass'] ?? '')) {
            $_SESSION['admin_logged'] = true;
            header('Location: /');
            exit;
        }
        $errors[] = 'Credenziali non valide.';
    }

    ?>
<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css" />
  <title>Admin - Login</title>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Accesso Admin</h1>
      <?php foreach ($errors as $error): ?>
        <div class="notice"><?php echo htmlspecialchars($error); ?></div>
      <?php endforeach; ?>
      <form method="post" class="form-grid">
        <label>
          Username
          <input type="text" name="username" required />
        </label>
        <label>
          Password
          <input type="password" name="password" required />
        </label>
        <div class="actions">
          <button type="submit" class="btn">Entra</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>
    <?php
    exit;
}

$master = load_master_data($masterPath);
$parishes = $master['parishes'] ?? [];

if (isset($_GET['action']) && $_GET['action'] === 'toggle' && isset($_GET['id'])) {
    $id = $_GET['id'];
    $index = find_parish_index($parishes, $id);
    if ($index !== -1) {
        $parishes[$index]['is_active'] = !($parishes[$index]['is_active'] ?? true);
        $master['parishes'] = $parishes;
        save_master_data($masterPath, $master, $publicPath);
        $message = 'Stato aggiornato.';
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_parish') {
    $id = trim($_POST['id'] ?? '');
    $originalId = trim($_POST['original_id'] ?? '');

    $name = trim($_POST['name'] ?? '');
    $address = trim($_POST['address'] ?? '');

    if ($id === '') {
        $errors[] = "ID obbligatorio.";
    }
    if ($name === '') {
        $errors[] = "Nome obbligatorio.";
    }
    if ($address === '') {
        $errors[] = "Indirizzo obbligatorio.";
    }

    $existingIndex = find_parish_index($parishes, $id);
    if ($existingIndex !== -1 && $id !== $originalId) {
        $errors[] = "ID duplicato.";
    }

    $lat = $_POST['lat'] !== '' ? (float)$_POST['lat'] : null;
    $lng = $_POST['lng'] !== '' ? (float)$_POST['lng'] : null;

    $days = $_POST['days'] ?? [];
    $days = array_values(array_filter($days));

    if (!$errors) {
        $catechesis = [
            'year' => (int)($_POST['catechesis_year'] ?? date('Y')),
            'status' => $_POST['catechesis_status'] ?? 'UNKNOWN',
            'days' => $days,
            'time' => $_POST['catechesis_time'] !== '' ? $_POST['catechesis_time'] : null,
            'source_level' => $_POST['catechesis_source_level'] ?? 'COMMUNITY',
            'last_verified_at' => date(DATE_ATOM),
            'last_verified_by' => $config['admin_user'] ?? 'admin',
            'notes' => trim($_POST['catechesis_notes'] ?? ''),
        ];

        $parish = [
            'id' => $id,
            'name' => $name,
            'address' => $address,
            'lat' => $lat,
            'lng' => $lng,
            'diocese' => $_POST['diocese'] !== '' ? trim($_POST['diocese']) : null,
            'city' => $_POST['city'] !== '' ? trim($_POST['city']) : null,
            'is_active' => isset($_POST['is_active']),
            'contact' => [
                'public_email' => $_POST['public_email'] !== '' ? trim($_POST['public_email']) : null,
                'internal_email' => $_POST['internal_email'] !== '' ? trim($_POST['internal_email']) : null,
            ],
            'catechesis' => $catechesis,
        ];

        if ($originalId && $originalId !== $id) {
            $index = find_parish_index($parishes, $originalId);
        } else {
            $index = find_parish_index($parishes, $id);
        }

        if ($index !== -1) {
            $parishes[$index] = $parish;
        } else {
            $parishes[] = $parish;
        }

        $master['parishes'] = $parishes;
        save_master_data($masterPath, $master, $publicPath);
        $message = 'Parrocchia salvata.';
    }
}

$editId = $_GET['edit'] ?? '';
$editing = null;
if ($editId) {
    $index = find_parish_index($parishes, $editId);
    if ($index !== -1) {
        $editing = $parishes[$index];
    }
}

function selected_day(array $days, string $value): string
{
    return in_array($value, $days, true) ? 'checked' : '';
}

$currentYear = (int)date('Y');
?>
<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css" />
  <title>Admin - Parrocchie</title>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="actions">
        <a href="/" class="btn secondary">Dashboard</a>
        <a href="/publish.php" class="btn">Publish</a>
        <a href="/?action=logout" class="btn secondary">Logout</a>
      </div>
    </div>

    <?php foreach ($errors as $error): ?>
      <div class="notice"><?php echo htmlspecialchars($error); ?></div>
    <?php endforeach; ?>
    <?php if ($message): ?>
      <div class="success"><?php echo htmlspecialchars($message); ?></div>
    <?php endif; ?>

    <div class="card">
      <h2>Parrocchie</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>Stato</th>
            <th>Catechesi</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($parishes as $parish): ?>
            <tr>
              <td><?php echo htmlspecialchars($parish['id']); ?></td>
              <td><?php echo htmlspecialchars($parish['name']); ?></td>
              <td>
                <?php if (!empty($parish['is_active'])): ?>
                  <span class="badge success">Attiva</span>
                <?php else: ?>
                  <span class="badge warning">Disattiva</span>
                <?php endif; ?>
                <?php if (empty($parish['lat']) || empty($parish['lng'])): ?>
                  <div class="helper">Posizione mancante</div>
                <?php endif; ?>
              </td>
              <td><?php echo htmlspecialchars($parish['catechesis']['status'] ?? 'UNKNOWN'); ?></td>
              <td>
                <a class="btn secondary" href="/?edit=<?php echo urlencode($parish['id']); ?>">Modifica</a>
                <a class="btn secondary" href="/?action=toggle&id=<?php echo urlencode($parish['id']); ?>">
                  <?php echo !empty($parish['is_active']) ? 'Disattiva' : 'Attiva'; ?>
                </a>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2><?php echo $editing ? 'Modifica parrocchia' : 'Nuova parrocchia'; ?></h2>
      <form method="post" class="form-grid" id="parish-form">
        <input type="hidden" name="action" value="save_parish" />
        <input type="hidden" name="original_id" value="<?php echo htmlspecialchars($editing['id'] ?? ''); ?>" />

        <label>
          ID parrocchia
          <input type="text" name="id" required value="<?php echo htmlspecialchars($editing['id'] ?? ''); ?>" />
        </label>
        <label>
          Nome
          <input type="text" name="name" required value="<?php echo htmlspecialchars($editing['name'] ?? ''); ?>" />
        </label>
        <label>
          Indirizzo
          <input type="text" name="address" required value="<?php echo htmlspecialchars($editing['address'] ?? ''); ?>" />
        </label>
        <label>
          Diocesi
          <input type="text" name="diocese" value="<?php echo htmlspecialchars($editing['diocese'] ?? ''); ?>" />
        </label>
        <label>
          Città
          <input type="text" name="city" value="<?php echo htmlspecialchars($editing['city'] ?? ''); ?>" />
        </label>
        <label>
          Email pubblica
          <input type="email" name="public_email" value="<?php echo htmlspecialchars($editing['contact']['public_email'] ?? ''); ?>" />
        </label>
        <label>
          Email interna (solo master)
          <input type="email" name="internal_email" value="<?php echo htmlspecialchars($editing['contact']['internal_email'] ?? ''); ?>" />
        </label>
        <label>
          Latitudine
          <input type="text" name="lat" id="lat" value="<?php echo htmlspecialchars($editing['lat'] ?? ''); ?>" />
        </label>
        <label>
          Longitudine
          <input type="text" name="lng" id="lng" value="<?php echo htmlspecialchars($editing['lng'] ?? ''); ?>" />
        </label>
        <div>
          <button type="button" class="btn secondary" id="geocode-btn">Calcola coordinate</button>
          <div class="helper">Usa l'indirizzo per ottenere lat/lng via Nominatim.</div>
        </div>
        <label class="helper">
          <input type="checkbox" name="is_active" <?php echo !empty($editing['is_active']) ? 'checked' : ''; ?> />
          Parrocchia attiva
        </label>

        <label>
          Anno catechesi
          <input type="number" name="catechesis_year" value="<?php echo htmlspecialchars($editing['catechesis']['year'] ?? $currentYear); ?>" />
        </label>
        <label>
          Stato catechesi
          <select name="catechesis_status">
            <?php
              $current = $editing['catechesis']['status'] ?? 'UNKNOWN';
              foreach (['AVAILABLE', 'NOT_AVAILABLE', 'UNKNOWN'] as $status) {
                  $selected = $status === $current ? 'selected' : '';
                  echo "<option value=\"$status\" $selected>$status</option>";
              }
            ?>
          </select>
        </label>
        <label>
          Orario
          <input type="text" name="catechesis_time" placeholder="HH:MM" value="<?php echo htmlspecialchars($editing['catechesis']['time'] ?? ''); ?>" />
        </label>
        <label>
          Fonte
          <select name="catechesis_source_level">
            <?php
              $currentSource = $editing['catechesis']['source_level'] ?? 'COMMUNITY';
              foreach (['VERIFIED', 'COMMUNITY'] as $level) {
                  $selected = $level === $currentSource ? 'selected' : '';
                  echo "<option value=\"$level\" $selected>$level</option>";
              }
            ?>
          </select>
        </label>

        <label>
          Giorni catechesi
          <div class="days">
            <?php
              $selectedDays = $editing['catechesis']['days'] ?? [];
              foreach (['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as $day) {
                $checked = selected_day($selectedDays, $day);
                echo "<label><input type=\"checkbox\" name=\"days[]\" value=\"$day\" $checked /> $day</label>";
              }
            ?>
          </div>
        </label>

        <label>
          Note interne
          <textarea name="catechesis_notes" rows="3"><?php echo htmlspecialchars($editing['catechesis']['notes'] ?? ''); ?></textarea>
        </label>

        <div class="actions">
          <button type="submit" class="btn">Salva</button>
          <a href="/" class="btn secondary">Annulla</a>
        </div>
      </form>
    </div>
  </div>

  <script>
    const geocodeBtn = document.getElementById("geocode-btn");
    const addressInput = document.querySelector('input[name="address"]');
    const latInput = document.getElementById("lat");
    const lngInput = document.getElementById("lng");

    geocodeBtn.addEventListener("click", async () => {
      if (!addressInput.value.trim()) {
        alert("Inserisci un indirizzo prima di calcolare le coordinate.");
        return;
      }
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressInput.value)}&limit=1&countrycodes=it`;
      const response = await fetch(url, { headers: { "Accept-Language": "it" } });
      if (!response.ok) {
        alert("Errore nel geocoding. Riprova.");
        return;
      }
      const data = await response.json();
      if (!data.length) {
        alert("Nessun risultato trovato.");
        return;
      }
      latInput.value = parseFloat(data[0].lat).toFixed(6);
      lngInput.value = parseFloat(data[0].lon).toFixed(6);
    });
  </script>
</body>
</html>