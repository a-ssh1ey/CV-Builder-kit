const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const nunjucks = require("nunjucks");
const puppeteer = require("puppeteer");

const basic = require("./data/basic.json");
const resume = require("./data/resume.json");

const templatesPath = __dirname;

nunjucks.configure(templatesPath, {
  autoescape: true,
  noCache: true
});

function safeFileName(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}

function addPdfStyles(html) {
  const pdfStyles = `
    <style>
      @page {
        size: A4;
        margin: 0;
      }

      html,
      body {
        margin: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    </style>
  `;

  if (html.includes("</head>")) {
    return html.replace("</head>", `${pdfStyles}</head>`);
  }

  return `${pdfStyles}${html}`;
}

async function generate() {
  const local = {
    ...basic,
    ...resume
  };

  const html = nunjucks.render("index.njk", {
    local
  });

  const outputDir = path.join(__dirname, "output");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = safeFileName(
    `${basic.name || "CV"} - ${resume.job_title || "Resume"}`
  );

  const outputHtmlPath = path.join(outputDir, `${fileName}.html`);
  const outputPdfPath = path.join(outputDir, `${fileName}.pdf`);

  const htmlForPdf = addPdfStyles(html);

  fs.writeFileSync(outputHtmlPath, htmlForPdf, "utf-8");

  const browser = await puppeteer.launch({
    headless: "new"
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 1
    });

    await page.goto(pathToFileURL(outputHtmlPath).href, {
      waitUntil: "networkidle0"
    });

    await page.emulateMediaType("screen");

    await page.pdf({
      path: outputPdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true
    });

    console.log("Generated HTML:", outputHtmlPath);
    console.log("Generated PDF:", outputPdfPath);
  } finally {
    await browser.close();
  }
}

generate().catch((error) => {
  console.error("Generation failed:");
  console.error(error);
  process.exit(1);
});