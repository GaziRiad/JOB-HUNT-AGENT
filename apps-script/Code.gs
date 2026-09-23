/**
 * Job Agent - "Refresh now" button for the Google Sheet.
 *
 * Setup (one time):
 *  1. In the Sheet: Extensions -> Apps Script. Delete the sample, paste this file, Save.
 *  2. Project Settings -> Script Properties, add:
 *       GH_OWNER  = your GitHub username/org
 *       GH_REPO   = the repo name (e.g. job-hunt-agent)
 *       GH_REF    = the default branch (e.g. main)
 *       GH_TOKEN  = a fine-grained Personal Access Token with
 *                   "Actions: Read and write" on THIS repo only
 *  3. Reload the Sheet. A "Job Agent" menu appears -> "Refresh now".
 *
 * The button asks GitHub to run .github/workflows/daily.yml via workflow_dispatch,
 * which writes new rows to this Sheet in ~1-2 minutes. No server required.
 */
var WORKFLOW_FILE = 'daily.yml';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Job Agent')
    .addItem('Refresh now', 'refreshNow')
    .addToUi();
}

function refreshNow() {
  var props = PropertiesService.getScriptProperties();
  var owner = props.getProperty('GH_OWNER');
  var repo = props.getProperty('GH_REPO');
  var ref = props.getProperty('GH_REF') || 'main';
  var token = props.getProperty('GH_TOKEN');
  var ui = SpreadsheetApp.getUi();

  if (!owner || !repo || !token) {
    ui.alert('Set GH_OWNER, GH_REPO and GH_TOKEN in Script Properties first.');
    return;
  }

  var url = 'https://api.github.com/repos/' + owner + '/' + repo +
    '/actions/workflows/' + WORKFLOW_FILE + '/dispatches';

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    payload: JSON.stringify({ ref: ref }),
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  if (code === 204) {
    setStatus_('Refresh requested ' + new Date().toISOString() + ' (new rows in ~1-2 min)');
    ui.toast('Refresh triggered. New rows appear in ~1-2 minutes.', 'Job Agent', 5);
  } else {
    ui.alert('GitHub returned ' + code + ':\n' + res.getContentText());
  }
}

function setStatus_(msg) {
  try {
    var runs = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Runs');
    if (runs) runs.getRange('N1').setValue(msg);
  } catch (e) {
    // status cell is best-effort only
  }
}
