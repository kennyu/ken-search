import { initSqlJs } from './sql-wasm-debug.js';

async function main() {
  const now = () => {
    return Date.now() / 1000;
  };

  const base64ToArrayBuffer = async (base64) => {
    const response = await fetch("data:application/octet-stream;base64," + base64);
    const blob = await response.blob();
    const promise = new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
    return await promise;
  }

  const arrayToBase64 = async (arrayBuffer) => {
    const promise = new Promise((resolve, reject) => {
      const blob = new Blob([arrayBuffer], {type: 'application/octet-stream'});
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const result = await promise;
    return result.slice(result.indexOf(",") + 1);
  }

  const SQL = await initSqlJs({
    locateFile: file => file
  });

  let loadStart = now();
  let blobKV = await chrome.storage.local.get("db");
  let getFinish = now();
  let blob = blobKV.db;
  let blobArray;
  if (blob) {
    blobArray = base64ToArrayBuffer(blob);
  }
  let deserializeFinish = now();
  let db = new SQL.Database(blobArray);
  let dbInitFinish = now();
  
  db.run(`
    drop table if exists pages
  `);

  db.run(`
    create virtual table if not exists search_pages using fts5(
      url, title, content, timestamp
    )
  `);

  const log = async (tab, message) => {
    await chrome.scripting.executeScript({
      func: (message) => {
        console.log(message);
      },
      args: [message],
      target: {tabId: tab.id}
    });
  };

  chrome.action.onClicked.addListener(async (tab) => {
    await log(tab, `DB load: ${loadStart} ${getFinish} ${deserializeFinish} ${dbInitFinish}`);
    let results = db.exec("SELECT * FROM search_pages where content match 'gpt'");
    await log(tab, results[0]);
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

      let timestamp = Math.floor(now());

      let pageText = result[0].result;
      await log(tab, pageText);

      db.run(`
        insert into search_pages (url, title, content, timestamp)
        values (:url, :title, :content, :timestamp)
      `, {
        ":url": tab.url,
        ":title": tab.title,
        ":content": pageText,
        ":timestamp": timestamp
      });
      const outBlobArray = db.export();
      const outBlob = await arrayToBase64(outBlobArray);
      await chrome.storage.local.set({"db": outBlob});
    }
  });
}

main();
