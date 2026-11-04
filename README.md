# PM Crane Service — Invoice Generator

A browser-based invoice manager for PM Crane Service.

## Run locally
1. Keep all six project files in the same folder.
2. Open `index.html` in Chrome or Edge.
3. Use the sidebar to create invoices, manage customers and update company settings.

No build step or server is required.

## Included features
- Dashboard, saved invoices and customer/vendor management
- Multiple crane/job line items
- Per Shift, Per Day and Lumpsum billing
- CGST + SGST, IGST and No Tax modes
- Automatic totals, round-off and amount in words
- Live invoice preview, PDF export and browser printing
- Browser-based data persistence
- JSON data backup export and import

## Important data note
Invoices and customers are stored in the browser's LocalStorage on the device and browser where they were created. They do not automatically sync to another computer or browser. Clearing browser site data can remove saved records. Use **Company Settings → Export Data Backup** regularly and keep the JSON file somewhere safe. Importing a backup replaces the currently stored records after confirmation.

## PDF export
PDF generation uses `html2canvas` and `jsPDF` from public CDNs, so an internet connection is required when loading those libraries. The browser Print function is also available.

## Deploy to Vercel
1. Upload the complete folder to a GitHub repository.
2. Import the repository into Vercel.
3. Framework Preset: **Other**.
4. Build Command: leave blank.
5. Output Directory: `.` (project root).
6. Deploy.

Ensure `index.html`, `styles.css`, `app.js`, `crane-left.png` and `crane-right.png` remain together in the deployed root folder.

## Privacy
This is a frontend-only app. There is no hosted database, login system or automatic cloud sync. Do not use it as a multi-user accounting system without adding a secure backend and access controls.
