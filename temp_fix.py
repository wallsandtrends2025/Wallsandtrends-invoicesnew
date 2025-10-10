from pathlib import Path

path = Path('src/utils/generateInvoicePDF.js')
text = path.read_text()

text = text.replace('const fmtInteger = (n) => Number(n || 0).toLocaleString("en-IN");\n\n', "const fmtCurrency = (n) => Number(n || 0).toLocaleString(\"en-IN\", { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n\n")
text = text.replace('const fmtInteger = (n) => Number(n || 0).toLocaleString("en-IN");', "const fmtCurrency = (n) => Number(n || 0).toLocaleString(\"en-IN\", { minimumFractionDigits: 2, maximumFractionDigits: 2 });")

if 'function numberToWordsIND' in text:
    start = text.index('function numberToWordsIND')
    end = text.index('\n\n/* ===== Main ===== */')
    number_block = '''function numberToWordsINR(amountInput) {
  const amount = Number(amountInput ?? 0);
  if (!Number.isFinite(amount)) return "";

  const totalPaise = Math.round(amount * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const twoDigitWords = (n) => {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${tens[t]}${o ? " " + ones[o] : ""}`.trim();
  };

  const threeDigitWords = (n) => {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let out = "";
    if (h) out += `${ones[h]} Hundred`;
    if (rem) out += `${out ? " " : ""}${twoDigitWords(rem)}`;
    return out.trim();
  };

  const segmentWords = (n) => {
    if (n === 0) return "Zero";
    let out = "";

    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const hundred = n % 1000;

    if (crore) out += `${threeDigitWords(crore)} Crore`;
    if (lakh) out += `${out ? " " : ""}${threeDigitWords(lakh)} Lakh`;
    if (thousand) out += `${out ? " " : ""}${threeDigitWords(thousand)} Thousand`;
    if (hundred) out += `${out ? " " : ""}${threeDigitWords(hundred)}`;

    return out.trim();
  };

  const rupeesWords = `${segmentWords(rupees)} Rupees`;
  const paiseWords = paise ? ` and ${twoDigitWords(paise)} Paise` : "";
  return `${rupeesWords}${paiseWords} only`;
}
'''
    text = text[:start] + number_block + text[end:]

path.write_text(text)
