# Trova Catechesi – Roma

Progetto statico per GitHub Pages + backoffice locale in PHP per gestire il dataset pubblico delle parrocchie.

## Struttura
- `/docs` → sito statico (GitHub Pages)
- `/admin-tool` → backoffice locale (PHP vanilla)

---

## Frontend (GitHub Pages)
Il sito statico è già pronto in `/docs`.

Percorsi principali:
- `/docs/index.html`
- `/docs/assets/styles.css`
- `/docs/assets/app.js`
- `/docs/assets/config.js`
- `/docs/data/parishes_public.json`

### Configurazione Google Form precompilato
Apri `/docs/assets/config.js` e inserisci:
- `GOOGLE_FORM_BASE_URL` (link viewform)
- `GOOGLE_FORM_FIELD_PARISH_ID` (entry.NNN)
- `GOOGLE_FORM_FIELD_PARISH_NAME` (entry.MMM, opzionale)

Per trovare `entry.NNN`, apri il form, fai “Ottieni link precompilato” e verifica i parametri nell’URL.

---

## Backoffice locale (PHP vanilla)
Il backoffice serve solo in locale. Non va pubblicato su GitHub Pages.

### 1) Configura credenziali e path
Crea il file:
`/admin-tool/config.local.php`

Esempio:
```php
<?php
return [
  "admin_user" => "admin",
  "admin_pass" => "cambia_questa_password",
  "pages_repo_path" => "/percorso/assoluto/alla/repo-pages",
  "commit_message" => "Update parishes_public.json"
];
```

### 2) Avvio backoffice
Da terminale nella cartella `admin-tool`:
```
php -S localhost:8000 -t public
```

### 3) Publish verso GitHub Pages
Dal backoffice usa il pulsante “Publish”.
Il publish:
1. Rigenera `parishes_public.json` dal master
2. Copia il JSON nel repo Pages
3. Crea/aggiorna `version.txt`
4. Esegue `git add/commit/push`

### Note di sicurezza
- **Non pubblicare** `admin-tool/config.local.php` e `admin-tool/data/parishes_master.json`
- Il JSON pubblico è creato con allow-list (campi non pubblici esclusi)

---

## Dataset demo
Il dataset demo è fittizio e incluso per test. Sostituiscilo con dati reali solo dopo verifica.