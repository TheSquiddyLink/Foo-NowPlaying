document.addEventListener("DOMContentLoaded", async () => {
    const beef = new BeefWeb(8880);

    await beef.init();

    beef.start();

    window.addEventListener("resize",() => beef.checkLength())
})