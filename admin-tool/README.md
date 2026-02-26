# Backoffice locale (PHP vanilla)

Questo tool gestisce il dataset master e genera il JSON pubblico.

## Avvio
1. Crea `config.local.php` (vedi README principale)
2. Avvia il server locale:
```
php -S localhost:8000 -t public
```
3. Apri `http://localhost:8000`

## Funzionalità
- Login admin
- CRUD parrocchie
- Geocoding lat/lng via Nominatim
- Rigenerazione automatica del JSON pubblico
- Publish con git add/commit/push

## Note
- Non pubblicare `config.local.php` e `parishes_master.json`
- Il JSON pubblico viene filtrato tramite allow-list dei campi