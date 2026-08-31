# Ledger — Rent & Bills Tracker (Full Stack)

Same tracker as before, now with a real backend: **Python (Flask) + SQLite** serving a REST API, with the HTML/CSS/JS frontend served by the same server.

## Project structure

```
rent-tracker-fullstack/
├── backend/
│   ├── app.py            # Flask app: serves the frontend + REST API
│   └── requirements.txt  # Flask
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/script.js      # calls the API with fetch()
└── README.md
```

`ledger.db` (SQLite) is created automatically the first time you run the server — it isn't included in this zip.

## How to run it

1. Unzip and open the folder in VS Code.
2. In a terminal, go into the backend folder:
   ```bash
   cd backend
   ```
3. (Recommended) create a virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Mac/Linux:
   source venv/bin/activate
   ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Run the server:
   ```bash
   python app.py
   ```
6. Open **http://127.0.0.1:5000** in your browser.

That's it — one server does both the API and the page. No separate frontend server needed.

## API reference

| Method | Endpoint                          | Description                                  |
|--------|------------------------------------|-----------------------------------------------|
| GET    | `/api/entries?month=2026-08`       | List entries for a month (`YYYY-MM`)          |
| POST   | `/api/entries`                     | Add an entry — body: `{name, category, amount, due, month}` |
| PATCH  | `/api/entries/<id>`                | Toggle or set paid status — body: `{paid: true}` (optional) |
| DELETE | `/api/entries/<id>`                | Delete a single entry                         |
| DELETE | `/api/entries/month/<month>`       | Clear every entry in a given month            |

All responses are JSON. Data lives in `backend/ledger.db` (SQLite) — you can open it with any SQLite browser (e.g. "DB Browser for SQLite") to inspect it directly.

## Customizing

- **Currency**: change the `CURRENCY` constant at the top of `frontend/js/script.js`.
- **Categories**: edit the `<option>` list in `frontend/index.html` under `#entryCategory`.
- **Colors/fonts**: CSS variables at the top of `frontend/css/style.css` under `:root`.
- **Port**: change `app.run(debug=True, port=5000)` at the bottom of `backend/app.py`.

## Notes

- The dev server (`app.run(debug=True)`) is for local use only. For deploying somewhere public, run it behind a production WSGI server (e.g. `gunicorn app:app`) and set `debug=False`.
- The frontend talks to the backend with relative paths (`/api/entries`), so as long as both are served from the same Flask app, there's no CORS setup needed.
