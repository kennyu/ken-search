import { initSqlJs } from './sql-wasm-debug.js';

async function main() {

  const SQL = await initSqlJs({
    locateFile: file => file
  });

  let blobKV = await chrome.storage.local.get("db");
  let blob = blobKV.db;
  let blobArray;
  if (blob) {
    const blobBytes = self.atob(blob);
    blobArray = new Uint8Array(blobBytes.length);
    for (let i = 0; i < blobBytes.length; i++) {
      blobArray[i] = blobBytes.charCodeAt(i);
    }
  }
  let db = new SQL.Database(blobArray);

  db.run(`
    create table if not exists pages (
      url text not null,
      title text not null,
      content string not null,
      timestamp integer not null
    )
  `);

  chrome.action.onClicked.addListener(async (tab) => {
      let results = db.exec("SELECT * FROM pages");
      await chrome.scripting.executeScript({
        func: (results) => {
          console.log(results[0]);
        },
        args: [results],
        target: {tabId: tab.id}
      });
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if ((changeInfo.status === 'complete') && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
      let result = await chrome.scripting.executeScript({
        func: () => {
          let body = document.documentElement.innerText;
          return body;
        },
        target: { tabId: tabId }
      });

      let timestamp = Math.floor(Date.now() / 1000);

      let pageText = result[0].result;
      await chrome.scripting.executeScript({
        func: (pageText) => {
          console.log(pageText);
        },
        args: [pageText],
        target: { tabId: tabId }
      });

      db.run(`
        insert into pages (url, title, content, timestamp)
        values (:url, :title, :content, :timestamp)
      `, {
        ":url": tab.url,
        ":title": tab.title,
        ":content": pageText,
        ":timestamp": timestamp
      });

      const outBlobArray = db.export();
      let outBlobBytes = "";
      for (let i = 0; i < outBlobArray.length; i++) {
        outBlobBytes += String.fromCharCode(outBlobArray[i]);
      }
      const outBlob = self.btoa(outBlobBytes);
      await chrome.storage.local.set({"db": outBlob});

      const countResult = db.exec("select count(*) from pages");
      const count = countResult[0].values[0][0];
      await chrome.scripting.executeScript({
        func: (count) => {
          console.log(count);
        },
        args: [count],
        target: { tabId: tabId }
      });
    }
  });
}

main();
