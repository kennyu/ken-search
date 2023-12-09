export const readDB = async (initSqlJs) => {
    const base64ToArrayBuffer = async (base64) => {
        const response = await fetch("data:application/octet-stream;base64," + base64);
        const blob = await response.blob();
        const promise = new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
        const result = await promise;
        return new Uint8Array(result);
    }

    const SQL = await initSqlJs({
        locateFile: file => file
    });

    const blobKV = await chrome.storage.local.get("db");
    const blob = blobKV.db;
    let blobArray;
    if (blob) {
        blobArray = await base64ToArrayBuffer(blob);
    }
    const db = new SQL.Database(blobArray);
    return db;
};