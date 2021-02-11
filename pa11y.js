const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const pa11y = require('pa11y')
const puppeteer = require('puppeteer')
const htmlReporter = require('pa11y-reporter-html')
const chalk = require('chalk')

const reportsPath = path.join(__dirname, 'reports.zip')
const snapshotDir = '../target/snapshots/'

let archive = null

generateReportsForFailedTests()

async function generateReportsForFailedTests() {
  clearReports()

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless', '--disable-gpu', '--window-size=1280,800']
  });

  fs.readdir(snapshotDir, async (err, files) => {
    if (err) throw err;

    for (let file of files) {
      let results = await pa11y(snapshotDir + file, {
        browser: browser,
        includeNotices: false,
        includeWarnings: false,
        level: "error",
        rules: [
          'Principle1.Guideline1_3.1_3_1_AAA'
        ],
      })

      logTestResult(results)
      if (results.issues.length > 0) {
        archive = await createAndAppendReport(archive, results)
      }
    }

    browser.close();
    logOverallResult(archive)

    if (archive) {
      archive.finalize()
      process.exitCode = 1  // Fail build
    }
  });
}

function clearReports() {
  if (fs.existsSync(reportsPath)) {
    fs.unlinkSync(reportsPath)
  }
}

function logTestResult(results) {
  const issues = results.issues
  if (issues && issues.length > 0) {
    const failedIssue = failedIssueResult(results);
    const formattedEachIssue = JSON.stringify(failedIssue, null, 1);
    const failedOutput = chalk.red(`** FAIL - issue found: ${results.documentTitle} \n ${results.pageUrl} \n ${formattedEachIssue} \n`);
    console.log(failedOutput);
  } else {
    const passedOutput = chalk.green(`** PASS: ${results.documentTitle} \n ${results.pageUrl} \n`);
    console.log(passedOutput);
  }
}

async function createAndAppendReport(archive, results) {
  if (!archive) {
    archive = initArchive()
  }

  let htmlResults = await htmlReporter.results(results)
  archive.append(htmlResults, { name: generateFileName(results.pageUrl) })

  return archive
}

function initArchive() {
  let archive = archiver('zip')
  let output = fs.createWriteStream(reportsPath)

  archive.pipe(output)

  return archive
}

function generateFileName(pageUrl) {
  return `${pageUrl.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
}

function logOverallResult(archive) {
  let resultText = archive ? chalk.red('FAILED') : chalk.green('PASSED')
  console.log(`Accessibility tests ${resultText}`)
}

const failedIssueResult = (results) => {
  const failedIssueDetails = results.issues.map( issue => {
    const { type, code, selector, message } = issue
    return {
      "Type": type,
      "Code": code,
      "Selector": selector,
      "Message": message
    }
  })
  return failedIssueDetails;
}
