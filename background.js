import { initSqlJs } from './sql-wasm-debug.js';
import { readDB } from './shared.js';

async function main() {
    const now = () => {
        return Date.now() / 1000;
    };

    const arrayToBase64 = async (arrayBuffer) => {
        const promise = new Promise((resolve, reject) => {
            const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        const result = await promise;
        return result.slice(result.indexOf(",") + 1);
    }

    let db = await readDB(initSqlJs);

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
            target: { tabId: tab.id }
        });
    };

    // chrome.action.onClicked.addListener(async (tab) => {
    //   let results = db.exec("SELECT * FROM search_pages where content match 'gpt'");
    //   await log(tab, results[0]);
    // });

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        if ((changeInfo.status === 'complete') && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                injectImmediately: true,
                files: ['Readability.js']
            });

            let result = await chrome.scripting.executeScript({
                func: () => {
                    const documentClone = document.cloneNode(true);
                    const body = new Readability(documentClone).parse().textContent;
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
            await chrome.storage.local.set({ "db": outBlob });
        }
    });
}

main();
