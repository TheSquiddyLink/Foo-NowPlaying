document.addEventListener("DOMContentLoaded", async () => {
    const beef = new BeefWeb(8880);
    await beef.queueInit();
    beef.startQueue();
})