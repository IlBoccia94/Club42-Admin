# Club42 Admin

Gestionale operativo di **Club42**, pensato per centralizzare in un'unica web app l'organizzazione del club: eventi, soci, cassa, progetti, task, contenuti social, contatti, comunicazioni e accessi.

L'app è pubblicata come **PWA** su GitHub Pages e usa **Supabase** come backend condiviso per autenticazione, database, realtime, RPC ed Edge Functions.

## Funzionalità principali

### Dashboard
- Panoramica operativa del Club
- Scadenze e attività che richiedono attenzione
- Task assegnati all'utente
- Agenda dei prossimi giorni
- Riepilogo di eventi, progetti, social, cassa e quote associative

### Eventi
- Creazione e modifica eventi
- Data e ora di inizio/fine, luogo, capienza e prezzo
- Eventi gratuiti
- Gestione partecipanti e lista d'attesa
- Stato pagamento e stato socio
- Check-in, presenze e no-show
- Esigenze alimentari e note
- Collegamento con soci e collaboratori
- Pubblicazione nell'area Guest/Soci
- Modalità "Prossimamente"
- Esportazione CSV
- Generazione file calendario `.ics`
- Storico eventi

### Soci
- Anagrafica soci
- Gestione annualità associative
- Stato quote e rinnovi
- Collegamento tra soci e partecipazioni agli eventi
- Accesso differenziato in base al ruolo

### Cassa
- Entrate e uscite
- Movimenti collegabili a eventi, soci e utenti
- Gestione rimborsi
- Riepiloghi economici
- Accesso completo per Admin e Tesoriere
- Accesso in sola lettura per Staff

### Progetti e Task
- Pipeline dei progetti
- Responsabili, priorità e scadenze
- Prossime azioni
- Task assegnabili agli utenti
- Stati, priorità e collegamenti a eventi/progetti
- Aggiornamenti e votazioni

### Social
- Piano editoriale
- Reel, caroselli, storie, post, live e altri formati
- Obiettivi e pillar
- Hook, CTA, caption e note di produzione
- Calendario di pubblicazione
- Assegnazioni e stati di lavorazione
- Formati ricorrenti
- Votazioni sulle idee
- Metriche dei contenuti

### Contatti e collaboratori
- Rubrica di partner, artisti, fornitori, associazioni e location
- Collegamenti tra contatti ed eventi
- Storico delle collaborazioni

### Chat direttivo
- Chat interna per gli operatori
- Stato di lettura e presenza
- Modifica dei propri messaggi
- Sondaggi e votazioni

### Newsletter
- Gestione del consenso newsletter
- Selezione dei destinatari
- Invio tramite Gmail SMTP
- Allegati
- Storico degli invii e stato delle consegne
- Accesso riservato agli Admin

### Notifiche
- Notifiche interne e push
- Preferenze per utente
- Promemoria automatici per task, eventi, progetti, social e rinnovi
- Coda di invio con deduplicazione

### Area Guest / Soci
- Area separata dal gestionale operativo
- Visualizzazione degli eventi pubblicati dal direttivo
- Iscrizione e rinuncia agli eventi
- Manifestazione di interesse per gli eventi futuri

### Gestione utenti
- Registrazione e login con Supabase Auth
- Approvazione delle richieste
- Inviti via email
- Gestione ruoli e stato account
- Disabilitazione ed eliminazione utenti

## Recupero e cambio password

Il recupero password usa **Supabase Auth** e la configurazione email del progetto:

1. Dalla schermata di accesso apri **Password dimenticata?**, inserisci l'indirizzo email e invia la richiesta. L'app mostra un messaggio neutro per non rivelare se esiste un account.
2. La mail contiene il link di recupero che torna all'app. Supabase verifica il link e la schermata di impostazione password consente di inserire due volte una nuova password di almeno 8 caratteri.
3. Gli utenti autenticati possono usare **Cambia password** nella barra laterale; nell'area Guest il comando si trova in alto accanto a **Esci**.
4. Gli inviti amministrativi usano lo stesso modulo di impostazione password.

### Configurazione Supabase da verificare

In **Authentication → URL Configuration** la URL di produzione deve essere presente fra quelle consentite:

```text
https://ilboccia94.github.io/Club42-Admin/
```

La mail di recupero deve usare il link generato da Supabase (ad esempio il template con `{{ .ConfirmationURL }}`), in modo che la destinazione `redirectTo` sia rispettata. Nessuna credenziale SMTP o chiave privilegiata deve essere inserita nel client.

### Verifica manuale dopo il deploy

- Richiedere il recupero per una email valida e per una email sconosciuta: entrambi i casi devono mostrare lo stesso messaggio.
- Aprire il link valido da un browser senza sessione, impostare una password di almeno 8 caratteri e accedere con quella nuova.
- Provare password discordanti, link scaduto e secondo utilizzo dello stesso link.
- Verificare un invito Guest o Staff appena ricevuto.
- Provare **Cambia password** sia come Staff/Admin sia come Guest già autenticato.
- Verificare che un Guest rimanga Guest e che un account sospeso o in attesa conservi il proprio stato dopo il recupero.

Non vengono modificate tabelle, policy, ruoli o stati degli utenti.

## Ruoli

Il gestionale utilizza quattro ruoli:

| Ruolo | Accesso |
| --- | --- |
| **Admin** | Accesso completo, inclusi utenti e newsletter |
| **Tesoriere** | Moduli operativi + gestione completa della cassa |
| **Staff** | Moduli operativi, cassa in sola lettura |
| **Guest** | Solo area Guest/Soci |

I permessi non sono gestiti soltanto nell'interfaccia: le operazioni sensibili sono protette anche lato database tramite **Row Level Security (RLS)** e funzioni di autorizzazione.

## Stack

- **HTML5**
- **CSS3**
- **JavaScript ES Modules**
- **Supabase JS**
- **Supabase Auth**
- **PostgreSQL / Supabase Database**
- **Row Level Security**
- **Supabase Realtime**
- **Supabase Edge Functions**
- **Web Push / Service Worker**
- **GitHub Pages**

Il progetto non utilizza framework frontend o build system: il browser carica direttamente i moduli JavaScript.

## Architettura

```text
GitHub Pages
     │
     ▼
Club42 Admin
HTML / CSS / JavaScript
     │
     ▼
Supabase
├── Auth
├── PostgreSQL
├── RLS / RPC
├── Realtime
└── Edge Functions
    ├── manage-admin-users
    ├── push-dispatcher
    └── send-newsletter
```

## Struttura del progetto

```text
/
├── index.html
├── styles.css
├── *.css
├── manifest.webmanifest
├── sw.js
├── assets/
└── js/
    ├── app.js
    ├── core.js
    ├── auth.js
    ├── permissions.js
    ├── router.js
    ├── dashboard*.js
    ├── events.js
    ├── members*.js
    ├── cash*.js
    ├── projects*.js
    ├── tasks*.js
    ├── social*.js
    ├── contacts*.js
    ├── chat.js
    ├── newsletter*.js
    ├── notifications*.js
    ├── feedback*.js
    ├── guest*.js
    └── users.js
```

La logica applicativa è suddivisa per dominio. I file `*-ui.js` costruiscono principalmente l'interfaccia dei rispettivi moduli, mentre i moduli principali gestiscono dati e comportamento.

## Database

La persistenza è affidata a Supabase. Tra le principali aree dati:

- utenti e ruoli
- eventi e iscrizioni
- soci e annualità associative
- movimenti di cassa
- progetti, task, aggiornamenti e votazioni
- contenuti e metriche social
- contatti e collaborazioni
- chat del direttivo
- feedback
- newsletter
- notifiche push
- audit log

> Il vecchio salvataggio locale tramite `localStorage` appartiene alle prime versioni del progetto e non rappresenta più l'architettura corrente.

## Sicurezza

- Il frontend utilizza una **Supabase publishable key**, progettata per essere utilizzata nel client.
- Le chiavi privilegiate e le credenziali SMTP restano nei **Supabase Secrets** e non devono essere inserite nel repository.
- Le tabelle esposte utilizzano **RLS**.
- Le operazioni amministrative sensibili vengono ulteriormente validate lato Edge Function o database.
- I ruoli applicativi devono sempre essere verificati lato backend: nascondere un pulsante nella UI non è considerato un controllo di sicurezza.

## PWA

Il progetto include:

- `manifest.webmanifest`
- Service Worker
- modalità standalone
- gestione notifiche push
- aggiornamento degli asset applicativi con strategia network-first per HTML, JS e CSS

Può quindi essere installato sul dispositivo come una normale app web.

## Avvio locale

Non è necessario alcun processo di build.

È consigliato servire la cartella tramite un web server locale, perché i moduli ES e alcune API browser non funzionano correttamente aprendo direttamente `index.html` con `file://`.

Esempio:

```bash
python -m http.server 8080
```

Poi aprire:

```text
http://localhost:8080
```

## Deploy

Il branch di produzione è:

```text
main
```

La pubblicazione avviene tramite GitHub Pages dalla root del repository.

Applicazione:

https://ilboccia94.github.io/Club42-Admin/

## Backup

Dal gestionale è possibile esportare un backup JSON dello stato applicativo disponibile al client.

Per i dati di produzione, Supabase rimane comunque la fonte dati principale e condivisa.

## Sviluppo

Quando si aggiunge una nuova funzionalità:

1. verificare i permessi del ruolo nell'interfaccia;
2. verificare anche RLS/RPC/Edge Functions lato backend;
3. mantenere separata la logica dei diversi moduli;
4. collegare le entità esistenti invece di duplicare i dati;
5. controllare l'impatto su Dashboard, ricerca globale, area Guest e notifiche;
6. testare almeno Admin, Staff, Tesoriere e Guest quando la modifica riguarda gli accessi.

## Stato del progetto

Club42 Admin è un progetto in evoluzione continua e viene utilizzato come centro operativo digitale dell'associazione.

Il repository nasce come semplice gestore delle iscrizioni agli eventi e si è progressivamente trasformato in un gestionale completo per il coordinamento delle attività di Club42.
