const functions = require("firebase-functions");

// Example Cloud Function (you’ll customize this later)
exports.sendInvoiceEmail = functions.https.onCall((data, context) => {
  console.log("Sending email to:", data.email);
  return { message: "Email sent successfully" };
});
