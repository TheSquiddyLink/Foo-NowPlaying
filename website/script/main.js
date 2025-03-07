
class BeefWeb {
    
    /**@private */
    options = {
        player: "/player",
        artwork: "/artwork/current"
    }

    /**@private */
    columns = [
        "%isplaying%",
        "%ispaused%",
        "%album artist%",
        "%album%",
        "%artist%",
        "%title%",
        "%track number%",
        "%length_seconds%",
        "%playback_time_seconds%",
        "%path%",
    ]

    previousItem = new Item();

    activeItem = new Item();

    frequency = 500;

    worker = new Worker("./script/worker.js");

    elements = {
        data: {
            albumArt: null,
            title: null,
            artist: null,
            album: null,
        },
        progress: {
            current: null,
            total: null,
            percent: null,
        }
    }

    constructor(port){
        this.port = port
        this.root = "http://localhost:" + port + "/api"
    }

    /**@private */
    getColumnsQuery() {
        return `?columns=${this.columns.join(",")}`;
    }
    
    /**
     * 
     * @param {MessageEvent<any>} event 
     * @private
     */
    async update(event){
        if (!event || !event.data || !event.data.player?.activeItem) return;
        this.activeItem.update(event.data);

        if(this.compareAll()){
            console.log("No changes detected");
        } else if(this.compareTrack()){
            console.log("Only time changed");
            this.updateTime();
        } else {
            console.log("Track changed");
            this.updateAll();
        }

        this.previousItem.from(this.activeItem);
    }

    start(){
        this.worker.postMessage({
            url: this.root + this.options.player + this.getColumnsQuery(),
            interval: this.frequency
        });

        this.worker.onmessage = this.update.bind(this);
    }

    init(){
        this.elements.data.albumArt = document.getElementById("playerArt");
        this.elements.data.title = document.getElementById("playerTitle");
        this.elements.data.artist = document.getElementById("playerArtist");
        this.elements.data.album = document.getElementById("playerAlbum");

        this.elements.progress.current = document.getElementById("progressCurrent");
        this.elements.progress.total = document.getElementById("progressTotal");
    }
    
    /**@private */
    updateAll(){
        this.elements.data.title.innerText = this.activeItem.columns.title;
        this.elements.data.artist.innerText = this.activeItem.columns.artist;
        this.elements.data.album.innerText = this.activeItem.columns.album;
        
        this.elements.data.albumArt.src = this.root + this.options.artwork + "?a=" + new Date().getTime();
    }

    /**@private */
    updateTime(){
        this.elements.progress.current.innerText = this.formatTime(this.activeItem.time.current);
        this.elements.progress.total.innerText = this.formatTime(this.activeItem.time.total);
    }

    /**@private */
    compareAll(){
        return this.activeItem.compareAll(this.previousItem);
    }

    /**@private */
    compareTrack() {
        return this.activeItem.compareTrack(this.previousItem);
    }

    /**@private */
    formatTime(seconds){
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`; 
    }
}

class Item {
    constructor(data) {
        this.playlist = {};
        this.time = {
            current: 0,
            total: 0,
            percent: () => (this.time.current / this.time.total) * 100
        };
        this.columns = {};
        if(data) this.update(data);
    }

    update(data) {
        if (!data?.player?.activeItem) return;
        let activeItem = data.player.activeItem;

        this.playlist.id = activeItem.playlistId;
        this.playlist.index = activeItem.playlistIndex;
        this.songIndex = activeItem.index;

        this.time.current = activeItem.position;
        this.time.total = activeItem.duration;

        this.columns.isPlaying = activeItem.columns?.[0] ?? false;
        this.columns.isPaused = activeItem.columns?.[1] ?? false;
        this.columns.albumArtist = activeItem.columns?.[2] ?? "Unknown";
        this.columns.album = activeItem.columns?.[3] ?? "Unknown";
        this.columns.artist = activeItem.columns?.[4] ?? "Unknown";
        this.columns.title = activeItem.columns?.[5] ?? "Unknown";
        this.columns.trackNumber = activeItem.columns?.[6] ?? 0;
        this.columns.length = activeItem.columns?.[7] ?? 0;
        this.columns.elapsed = activeItem.columns?.[8] ?? 0;
        this.columns.path = activeItem.columns?.[9] ?? "";
    }

    /**
     * 
     * @param {Item} item 
     */
    from(item) {
        Object.assign(this.playlist, item.playlist);
        Object.assign(this.time, item.time);
        Object.assign(this.columns, item.columns);

        this.songIndex = item.songIndex;
    }

    /**
     * @param {Item} item 
     * @returns {boolean}
     */
    compareAll(item) {
        if (!(this instanceof Item) || !(item instanceof Item)) return false;
        
        return (
            this.songIndex === item.songIndex &&
            this.time.current === item.time.current &&
            this.time.total === item.time.total &&
            this.columns.title === item.columns.title &&
            this.columns.artist === item.columns.artist &&
            this.columns.album === item.columns.album &&
            this.columns.isPlaying === item.columns.isPlaying
        );
    }

    /**
     * 
     * @param {Item} item 
     * @returns {boolean}
     */
    compareTrack(item) {
        return (
            this.columns.title === item.columns.title &&
            this.columns.artist === item.columns.artist &&
            this.columns.album === item.columns.album
        )
    }
    
}



document.addEventListener("DOMContentLoaded", () => {
    const beef = new BeefWeb(8880);

    beef.init();

    beef.start();
})