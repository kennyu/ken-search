import { initSqlJs } from './sql-wasm-debug.js';
import { readDB } from './shared.js';
import { XXH64 } from './xxhash.js';

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

    // db.run(`
    //     drop table if exists search_pages
    // `);

    db.run(`
        create virtual table if not exists search_pages using fts5(
            url, title, content, timestamp, content_hash
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

            let pageTextHash = XXH64(pageText, 0xABCD).toString(16);

            let results = db.exec(`
                SELECT * FROM search_pages WHERE content_hash = '${pageTextHash}'
            `);

            if (results[0]) {
                await log(tab, "Hash found in the database");
                await log(tab, pageTextHash);
            } else {
                await log(tab, "Hash not found in the database");
                await log(tab, pageTextHash);
                db.run(`
                    insert into search_pages (url, title, content, timestamp, content_hash)
                    values (:url, :title, :content, :timestamp, :content_hash)
                `, {
                    ":url": tab.url,
                    ":title": tab.title,
                    ":content": pageText,
                    ":timestamp": timestamp,
                    ":content_hash": pageTextHash
                });
            }

            const outBlobArray = db.export();
            const outBlob = await arrayToBase64(outBlobArray);
            await chrome.storage.local.set({ "db": outBlob });
        }
    });
}

main();
