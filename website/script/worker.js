// worker.js
self.onmessage = function(e) {
    const { url, interval } = e.data;
    async function fetchData() {
        try {
            const response = await fetch(url);
            const data = await response.json();
            self.postMessage(data);
        } catch (error) {
            console.error('Fetch error:', error);
        }
    }
    fetchData(); // Initial fetch
    setInterval(fetchData, interval);
};
