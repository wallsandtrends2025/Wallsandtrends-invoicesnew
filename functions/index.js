const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require("googleapis");
const dayjs = require("dayjs");
const fs = require("fs");
const os = require("os");
const path = require("path");
const archiver = require("archiver");

// Initialize Admin SDK only once
try {
  admin.app();
} catch (e) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Collection: audit_emails
 * Document sample:
 * {
 *   enabled: true,
 *   primary: "audit@example.com",
 *   cc: ["manager@example.com"],
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp
 * }
 */

// Helper: fetch audit email configuration (first enabled doc)
async function getAuditEmailConfig() {
  const snap = await db
    .collection("audit_emails")
    .where("enabled", "==", true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

// Helper: build previous month time range [inclusive]
function previousMonthRange(tz = "Asia/Kolkata") {
  const now = dayjs().tz ? dayjs().tz(tz) : dayjs();
  const prev = now.subtract(1, "month");
  const start = prev.startOf("month");
  const end = prev.endOf("month");
  return { start: start.toDate(), end: end.toDate(), y: prev.year(), m: prev.month() + 1 };
}

// Gmail Auth via Service Account impersonation (recommended) OR OAuth2
function getGmailClient() {
  // Option 1: Use OAuth2 credentials via environment config
  const clientId = process.env.GMAIL_CLIENT_ID || functions.config().gmail?.client_id;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || functions.config().gmail?.client_secret;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN || functions.config().gmail?.refresh_token;
  const user = process.env.GMAIL_USER || functions.config().gmail?.user;

  if (!clientId || !clientSecret || !refreshToken || !user) {
    throw new Error("Gmail credentials not configured. Set functions config: gmail.client_id, gmail.client_secret, gmail.refresh_token, gmail.user");
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  return { gmail, user };
}

// Build RFC822 email and return base64url encoded string
function buildRawEmail({ from, to, cc, subject, html, attachments = [] }) {
  const boundary = "foo_bar_baz_boundary";
  const lines = [];
  lines.push(`From: ${from}`);
  lines.push(`To: ${Array.isArray(to) ? to.join(", ") : to}`);
  if (cc && cc.length) lines.push(`Cc: ${cc.join(", ")}`);
  lines.push(`Subject: ${subject}`);
  lines.push("MIME-Version: 1.0");
  lines.push(`Content-Type: multipart/mixed; boundary=${boundary}`);
  lines.push("");
  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/html; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 7bit");
  lines.push("");
  lines.push(html);

  // attachments: [{filename, mimeType, contentBase64}]
  for (const a of attachments) {
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${a.mimeType}; name=${a.filename}`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push(`Content-Disposition: attachment; filename=${a.filename}`);
    lines.push("");
    lines.push(a.contentBase64.replace(/\n/g, ""));
  }

  lines.push("");
  lines.push(`--${boundary}--`);

  const raw = Buffer.from(lines.join("\r\n")).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  return raw;
}

// Server-side reconstruct of a chunked PDF into a Buffer
async function reconstructPDFFromChunksServer(pdfId) {
  const chunksSnap = await db
    .collection("pdf_chunks")
    .where("pdfId", "==", pdfId)
    .get();
  if (chunksSnap.empty) {
    throw new Error(`No chunks found for ${pdfId}`);
  }
  const chunks = chunksSnap.docs.map((d) => d.data());
  const joined = chunks.sort((a, b) => a.chunkIndex - b.chunkIndex).map((c) => c.data).join("");
  const base64 = joined.startsWith("data:") ? (joined.split("base64,")[1] || "") : joined;
  if (!base64) throw new Error(`Invalid base64 for ${pdfId}`);
  return Buffer.from(base64, "base64");
}

// Create a ZIP file in the /tmp directory, return path and size
async function createZipToTmp(files, zipBaseName) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(os.tmpdir(), zipBaseName);
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve({ path: outPath, size: archive.pointer() }));
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    for (const f of files) {
      archive.append(f.buffer, { name: f.filename });
    }
    archive.finalize();
  });
}

// Upload a file to default bucket and return a signed URL
async function uploadAndGetSignedUrl(localPath, destPath, expiresDays = 7) {
  const bucket = admin.storage().bucket();
  await bucket.upload(localPath, {
    destination: destPath,
    contentType: "application/zip",
  });
  const file = bucket.file(destPath);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresDays * 24 * 60 * 60 * 1000,
  });
  return url;
}

// Callable to seed a default audit_emails document
exports.seedAuditEmailConfig = functions.https.onCall(async (data, context) => {
  const payload = {
    enabled: true,
    primary: data?.primary || "audit@example.com",
    cc: Array.isArray(data?.cc) ? data.cc : [],
    companyFilters: Array.isArray(data?.companyFilters) ? data.companyFilters : [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const ref = await db.collection("audit_emails").add(payload);
  return { id: ref.id, ...payload };
});

// Scheduled function: runs 09:00 on the 1st of every month IST
exports.sendMonthlyAuditEmails = functions.pubsub
  .schedule("0 9 1 * *")
  .timeZone("Asia/Kolkata")
  .onRun(async (context) => {
    const cfg = await getAuditEmailConfig();
    if (!cfg) {
      console.log("No enabled audit_emails config found. Skipping.");
      return null;
    }

    // TEMPORARY: Use current month for testing (revert after test)
    const { start, end, y, m } = previousMonthRange("Asia/Kolkata");
    // For testing, uncomment next line to use current month:
    // const now = dayjs().tz ? dayjs().tz("Asia/Kolkata") : dayjs();
    // const start = now.startOf("month").toDate();
    // const end = now.endOf("month").toDate();
    // const y = now.year(); const m = now.month() + 1;

    // Collect PDFs created in the previous month
    const pdfSnap = await db
      .collection("pdf_metadata")
      .where("createdAt", ">=", start)
      .where("createdAt", "<=", end)
      .get();

    if (pdfSnap.empty) {
      console.log("No PDFs created in previous month.");
      return null;
    }

    const rawPdfs = pdfSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Filter only 'tax' invoices (send all companies)
    let pdfs = rawPdfs.filter((p) => (p.type || "").toLowerCase() === "tax");
    if (!pdfs.length) {
      console.log("No TAX PDFs created in previous month after filters.");
      return null;
    }

    // Reconstruct PDFs into buffers
    const files = [];
    for (const p of pdfs) {
      try {
        const buffer = await reconstructPDFFromChunksServer(p.pdfId || p.id);
        const safeName = p.filename || `${p.invoiceId || "unknown"}_${p.type || "pdf"}.pdf`;
        files.push({ filename: safeName, buffer });
      } catch (e) {
        console.error("Failed to reconstruct", p.id, e.message);
      }
    }

    if (!files.length) {
      console.log("No reconstructable PDFs found for month.");
      return null;
    }

    // Build a CSV summary
    const header = ["invoiceId", "type", "company", "filename", "originalSize", "createdAt"].join(",");
    const rows = pdfs.map((p) => [
      p.invoiceId,
      p.type,
      p.company || p.invoice_type || "",
      p.filename,
      p.originalSize,
      p.createdAt?.toDate?.().toISOString?.() || ""
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const csvB64 = Buffer.from(csv).toString("base64");

    // Create ZIP in /tmp
    const zipBase = `audit-invoices-${y}-${String(m).padStart(2, "0")}.zip`;
    const { path: zipPath, size: zipSize } = await createZipToTmp(files, zipBase);

    // Thresholds
    const ATTACHMENT_LIMIT_BYTES = 15 * 1024 * 1024; // 15 MB
    let html = `
      <div>
        <p>Dear Audit Team,</p>
        <p>Attached is the monthly invoices package for ${y}-${String(m).padStart(2, "0")} and a CSV summary.</p>
        <p>Total PDFs: <b>${files.length}</b></p>
    `;

    const attachments = [
      { filename: `audit-summary-${y}-${String(m).padStart(2, "0")}.csv`, mimeType: "text/csv", contentBase64: csvB64 },
    ];

    if (zipSize <= ATTACHMENT_LIMIT_BYTES) {
      const zipB64 = fs.readFileSync(zipPath).toString("base64");
      attachments.push({ filename: zipBase, mimeType: "application/zip", contentBase64: zipB64 });
      html += `<p>ZIP is attached directly to this email.</p>`;
    } else {
      const dest = `audit-zips/${zipBase}`;
      const url = await uploadAndGetSignedUrl(zipPath, dest, 7);
      html += `<p>ZIP was too large to attach. Download it securely (valid 7 days):<br/><a href="${url}">${url}</a></p>`;
    }

    html += `<p>Regards,<br/>WT Invoices</p></div>`;

    const { gmail, user } = getGmailClient();
    const subject = `Monthly Audit Invoices - ${y}-${String(m).padStart(2, "0")}`;
    const raw = buildRawEmail({ from: user, to: cfg.primary, cc: cfg.cc || [], subject, html, attachments });

    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    console.log("Audit ZIP email sent to", cfg.primary);

    return null;
  });

// Existing example retained for compatibility
exports.sendInvoiceEmail = functions.https.onCall((data, context) => {
  console.log("Sending email to:", data.email);
  return { message: "Email sent successfully" };
});
