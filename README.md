# Trova Catechesi – Roma (pilota)

Sito statico per trovare parrocchie con Cammino Neocatecumenale e catechesi disponibili nell’area di Roma, con ricerca per zona e visualizzazione su mappa.

Il progetto separa chiaramente:
- **frontend pubblico statico** (pubblicabile su GitHub Pages),
- **backoffice locale PHP** per gestire il dataset e pubblicare aggiornamenti in sicurezza.

---

## Perché contribuire

Questo progetto nasce per rendere più semplice trovare catechesi affidabili e aggiornate.
I contributi della community sono fondamentali per:
- ampliare copertura e qualità dei dati,
- correggere errori su indirizzi/coordinate,
- mantenere aggiornato lo stato delle catechesi.

---

## Struttura repository

- `/docs` → sito statico (GitHub Pages)
- `/admin-tool` → backoffice locale (PHP vanilla)
- `/docs/data/parishes_public.json` → dataset pubblico usato dal frontend

Percorsi principali frontend:
- `/docs/index.html`
- `/docs/assets/styles.css`
- `/docs/assets/app.js`
- `/docs/assets/config.js`

---

## Stato del progetto

- Ambito attuale: **Roma**
- Maturità: **pilota**
- Deploy: GitHub Pages dalla cartella `/docs` (branch `main`)

---

## Come contribuire (dataset)

Cerchiamo contributi su:
- nuove parrocchie,
- aggiornamenti su catechesi (stato/giorni/orario),
- correzioni su dati esistenti (indirizzi, duplicati, coordinate).

### Regole minime del JSON pubblico

Nel file `/docs/data/parishes_public.json`, ogni record parrocchia include:

- **Obbligatori**: `id`, `name`, `address`
- **Opzionali**: `lat`, `lng`, `diocese`, `city`, `is_active`, `contact.public_email`, `contact.website_url`
- Campo `catechesis` (sempre presente):
  - `year` (es. `2026`)
  - `status`: `AVAILABLE | NOT_AVAILABLE | UNKNOWN`
  - `days`: array es. `["Mon", "Thu"]` oppure `[]`
  - `time`: `"HH:MM"` oppure `null`
  - `start_date`: data ISO (`YYYY-MM-DD`) oppure `null`
  - `source_level`: `VERIFIED | COMMUNITY`
  - `last_verified_at`: timestamp ISO o `null`

### Flusso PR consigliato

1. Fai **fork** del repository.
2. Crea un branch, ad esempio:
   - `data/add-parish-roma-nord`
   - `data/update-catechesis-roma-centro`
3. Modifica `/docs/data/parishes_public.json`.
4. Apri una Pull Request includendo:
   - cosa hai cambiato,
   - come hai verificato l’informazione,
   - se il dato è `COMMUNITY`, indicazione esplicita che va confermato.

> Se hai dubbi sulla qualità della fonte, usa `source_level=COMMUNITY`.

### Template titolo PR (suggerito)

- `Add parish: <Nome> (Roma <zona>)`
- `Update catechesis: <Nome> (status/days/time)`

---

## Configurazione Google Form precompilato

Apri `/docs/assets/config.js` e imposta:

- `GOOGLE_FORM_BASE_URL` (link `viewform`)
- `GOOGLE_FORM_FIELD_PARISH_ID` (`entry.NNN`)
- `GOOGLE_FORM_FIELD_PARISH_NAME` (`entry.MMM`, opzionale)

Per trovare `entry.NNN`: nel Google Form usa “Ottieni link precompilato” e leggi i parametri URL.

---

## Backoffice locale (PHP)

Il backoffice è per uso locale e **non va pubblicato** su GitHub Pages.

### 1) Configura credenziali e path

Crea `admin-tool/config.local.php`:

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

```bash
cd admin-tool
php -S localhost:8000 -t public
```

### 3) Publish verso GitHub Pages

Dal backoffice usa il pulsante **Publish**. Il processo:

1. rigenera `parishes_public.json` dal master,
2. copia il JSON nel repo Pages,
3. crea/aggiorna `version.txt`,
4. esegue `git add/commit/push`.

---

## Esecuzione locale del frontend statico

Per test rapido del sito statico:

```bash
cd docs
python -m http.server 8080
```

Poi apri `http://localhost:8080`.

---

## Sicurezza dati

Non pubblicare mai:
- `admin-tool/config.local.php`
- `admin-tool/data/parishes_master.json` (se contiene dati non pubblici)

Il JSON pubblico deve essere generato con allow-list, escludendo campi sensibili o interni.

---

## Dataset demo

Il dataset demo è fittizio. Prima del go-live sostituiscilo con dati verificati.

---

## Licenza e governance (proposta)

Per facilitare contributi esterni:
- aggiungere una licenza OSS (es. MIT),
- definire una breve policy dati (fonti, verifica, attribuzione, limiti d’uso).
